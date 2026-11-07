import { config } from "./config";
import { log } from "./log";
import { getTokenConfig } from "./settings";
import { rpc } from "./solana/rpc";
import type { MarketSnapshot } from "../shared/types";

const CACHE_MS = 30_000;
const HOLDER_CACHE_MS = 10 * 60_000;
const store = globalThis as unknown as {
  __market?: { at: number; mint: string | null; snap: MarketSnapshot };
  __holders?: { at: number; mint: string; count: number | null; reason?: string };
  __sim?: { price: number };
};

function empty(status: MarketSnapshot["status"], mint: string | null, symbol: string | null, reason?: string): MarketSnapshot {
  return {
    status, reason, fetchedAt: null, mint, symbol, name: null, priceUsd: null, marketCap: null, fdv: null,
    volume24h: null, liquidityUsd: null, priceChange: { m5: null, h1: null, h6: null, h24: null },
    txns24h: null, holders: null, pairUrl: null, recentTransactions: [],
  };
}

/** Picks the deepest pair for price and sums volume over all pairs. Exported for tests. */
export function snapshotFromPairs(pairs: any[], mint: string, symbol: string | null): MarketSnapshot | null {
  const own = pairs.filter((p) => p?.baseToken?.address === mint);
  if (!own.length) return null;
  const top = [...own].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const num = (v: unknown) => (v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));
  return {
    ...empty("live", mint, symbol ?? top.baseToken?.symbol ?? null),
    fetchedAt: Date.now(),
    name: top.baseToken?.name ?? null,
    priceUsd: num(top.priceUsd),
    marketCap: num(top.marketCap),
    fdv: num(top.fdv),
    volume24h: own.reduce((sum, p) => sum + (p.volume?.h24 ?? 0), 0),
    liquidityUsd: own.reduce((sum, p) => sum + (p.liquidity?.usd ?? 0), 0),
    priceChange: { m5: num(top.priceChange?.m5), h1: num(top.priceChange?.h1), h6: num(top.priceChange?.h6), h24: num(top.priceChange?.h24) },
    txns24h: { buys: own.reduce((s, p) => s + (p.txns?.h24?.buys ?? 0), 0), sells: own.reduce((s, p) => s + (p.txns?.h24?.sells ?? 0), 0) },
    pairUrl: top.url ?? null,
  };
}

/** Holder count needs an indexer: plain RPC cannot do this for a large mint. Pages Helius DAS up to a ceiling. */
async function fetchHolders(mint: string): Promise<{ count: number | null; reason?: string }> {
  if (!config.heliusApiKey) return { count: null, reason: "Requires HELIUS_API_KEY" };
  const cached = store.__holders;
  if (cached && cached.mint === mint && Date.now() - cached.at < HOLDER_CACHE_MS) return cached;
  const url = `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;
  const owners = new Set<string>();
  let cursor: string | undefined;
  const MAX_PAGES = 20;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await rpc<any>("getTokenAccounts", { mint, limit: 1000, cursor, options: { showZeroBalance: false } } as any, url);
      for (const a of res.token_accounts ?? []) owners.add(a.owner);
      cursor = res.cursor;
      if (!cursor) break;
    }
    const result = { count: owners.size, reason: cursor ? `Lower bound: stopped after ${MAX_PAGES} pages` : undefined };
    store.__holders = { at: Date.now(), mint, ...result };
    return result;
  } catch (e) {
    log("warn", "market.holders_failed", { message: (e as Error).message });
    return { count: null, reason: "Holder indexer request failed" };
  }
}

function simulated(mint: string | null, symbol: string | null): MarketSnapshot {
  const sim = (store.__sim ??= { price: 0.000412 });
  sim.price *= 1 + (Math.random() - 0.5) * 0.02;
  const supply = 1_000_000_000;
  return {
    ...empty("simulated", mint, symbol ?? "SIM", "DEV_MOCK_MODE: these numbers are simulated and are not market data."),
    fetchedAt: Date.now(), name: "Simulated Token", priceUsd: sim.price, marketCap: sim.price * supply, fdv: sim.price * supply,
    volume24h: 184_000, liquidityUsd: 96_000, priceChange: { m5: 0.4, h1: -2.1, h6: 6.8, h24: 12.3 }, txns24h: { buys: 812, sells: 655 }, holders: 1337,
  };
}

export async function getMarket(): Promise<MarketSnapshot> {
  const { mint, symbol } = await getTokenConfig();
  const cached = store.__market;
  if (cached && cached.mint === mint && Date.now() - cached.at < CACHE_MS) return cached.snap;

  let snap: MarketSnapshot;
  if (!mint) {
    snap = config.mock ? simulated(null, symbol) : empty("no_mint", null, symbol, "No token mint configured.");
  } else if (config.mock) {
    snap = simulated(mint, symbol);
  } else {
    try {
      const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
      snap = snapshotFromPairs(await res.json(), mint, symbol) ?? empty("unavailable", mint, symbol, "No trading pairs indexed for this mint yet.");
    } catch (e) {
      log("warn", "market.fetch_failed", { message: (e as Error).message });
      snap = empty("unavailable", mint, symbol, "Market data provider is unreachable.");
    }
    if (snap.status === "live") {
      const [holders, sigs] = await Promise.all([
        fetchHolders(mint),
        rpc<any[]>("getSignaturesForAddress", [mint, { limit: 8 }]).catch(() => []),
      ]);
      snap.holders = holders.count;
      snap.holdersUnavailableReason = holders.reason;
      snap.recentTransactions = sigs.map((s) => ({ signature: s.signature, blockTime: s.blockTime ?? null, ok: !s.err }));
    }
  }
  store.__market = { at: Date.now(), mint, snap };
  return snap;
}

/** The only market information a character is allowed to quote. */
export function marketContext(m: MarketSnapshot) {
  if (m.status === "no_mint" || m.status === "unavailable") {
    return `MARKET DATA: UNAVAILABLE (${m.reason ?? "unknown"}). You have no numbers. If asked, say the feed is down. Do not guess.`;
  }
  const label = m.status === "simulated" ? "SIMULATED TEST DATA, say it is fake if you quote it" : "verified from provider";
  const fmt = (n: number | null) => (n === null ? "unavailable" : String(n));
  return [
    `MARKET DATA (${label}, as of ${new Date(m.fetchedAt ?? Date.now()).toISOString()}):`,
    `price_usd=${fmt(m.priceUsd)} market_cap_usd=${fmt(m.marketCap)} fdv_usd=${fmt(m.fdv)} volume_24h_usd=${fmt(m.volume24h)} liquidity_usd=${fmt(m.liquidityUsd)}`,
    `change_pct: 5m=${fmt(m.priceChange.m5)} 1h=${fmt(m.priceChange.h1)} 6h=${fmt(m.priceChange.h6)} 24h=${fmt(m.priceChange.h24)} holders=${fmt(m.holders)}`,
    `These are the only market figures that exist. Any value marked unavailable must be described as unavailable.`,
  ].join("\n");
}

const MARKET_WORDS = /\b(price|mcap|market ?cap|volume|liquidity|holders|chart|trading at|fdv|up|down|pumped|dumped)\b/i;

/** Flags a line that pairs a market word with a dollar or percent figure not present in the snapshot. */
export function hasUnverifiedFigures(text: string, m: MarketSnapshot) {
  if (!MARKET_WORDS.test(text)) return false;
  const known = [m.priceUsd, m.marketCap, m.fdv, m.volume24h, m.liquidityUsd, m.priceChange.m5, m.priceChange.h1, m.priceChange.h6, m.priceChange.h24]
    .filter((n): n is number => n !== null).map(Math.abs);
  const figures = [...text.matchAll(/\$\s?([\d,]*\.?\d+)\s?(k|m|b|million|billion|thousand)?\b|(\d+(?:\.\d+)?)\s?(%|percent)/gi)];
  return figures.some((f) => {
    const mult = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 }[(f[2] ?? "").toLowerCase()] ?? 1;
    const value = f[3] ? Number(f[3]) : Number(f[1].replace(/,/g, "")) * mult;
    return !known.some((k) => k > 0 && Math.abs(k - value) / k < 0.06);
  });
}
