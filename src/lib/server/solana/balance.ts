import { createHash } from "node:crypto";
import { config } from "../config";
import { q, q1 } from "../db";
import { rpc } from "./rpc";

export type TokenHolding = { rawAmount: string; decimals: number; normalized: number; tokenAccountCount: number; source: "rpc" | "simulated" };

/** Exact raw to UI conversion. Never goes through floats until the final step. */
export function normalizeRaw(raw: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  return Number(raw / base) + Number(raw % base) / Number(base);
}

/** Sums every token account for the mint. A wallet can legally hold several. */
export function summarizeTokenAccounts(value: any[], fallbackDecimals: number) {
  let raw = 0n;
  let decimals = fallbackDecimals;
  for (const entry of value) {
    const amount = entry?.account?.data?.parsed?.info?.tokenAmount;
    if (!amount) continue;
    raw += BigInt(amount.amount);
    decimals = amount.decimals;
  }
  return { rawAmount: raw.toString(), decimals, normalized: normalizeRaw(raw, decimals), tokenAccountCount: value.length };
}

/**
 * Reads the balance from chain. The mint filter makes the RPC resolve the owning program from the
 * mint account, so SPL Token and Token-2022 mints both work without a separate query.
 */
export async function fetchChainHolding(address: string, mint: string): Promise<TokenHolding> {
  const accounts = await rpc<{ value: any[] }>("getTokenAccountsByOwner", [
    address, { mint }, { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  let decimals = 0;
  if (!accounts.value.length) {
    const supply = await rpc<{ value: { decimals: number } }>("getTokenSupply", [mint]);
    decimals = supply.value.decimals;
  }
  return { ...summarizeTokenAccounts(accounts.value, decimals), source: "rpc" };
}

const SIM_DECIMALS = 6;
const SIM_LADDER = [0, 0, 250_000, 5_000_000, 75_000_000, 650_000_000];

export function simulatedHolding(address: string): TokenHolding {
  const idx = createHash("sha256").update(address).digest()[0] % SIM_LADDER.length;
  const normalized = SIM_LADDER[idx];
  return { rawAmount: (BigInt(normalized) * 10n ** BigInt(SIM_DECIMALS)).toString(), decimals: SIM_DECIMALS, normalized, tokenAccountCount: normalized ? 1 : 0, source: "simulated" };
}

export async function saveHolding(address: string, mint: string, h: TokenHolding) {
  await q(
    `insert into token_balances (address, mint, raw_amount, decimals, normalized_balance, token_account_count, source, last_updated)
     values ($1,$2,$3,$4,$5,$6,$7,now())
     on conflict (address, mint) do update set raw_amount=excluded.raw_amount, decimals=excluded.decimals,
       normalized_balance=excluded.normalized_balance, token_account_count=excluded.token_account_count,
       source=excluded.source, last_updated=now()`,
    [address, mint, h.rawAmount, h.decimals, h.normalized, h.tokenAccountCount, h.source],
  );
}

/** Fresh read from chain (or the simulator in mock mode), stored server-side. */
export async function refreshHolding(address: string, mint: string): Promise<TokenHolding> {
  if (config.mock) {
    const existing = await q1(`select * from token_balances where address=$1 and mint=$2`, [address, mint]);
    if (existing) {
      return { rawAmount: String(existing.raw_amount), decimals: existing.decimals, normalized: Number(existing.normalized_balance), tokenAccountCount: existing.token_account_count, source: "simulated" };
    }
    const sim = simulatedHolding(address);
    await saveHolding(address, mint, sim);
    return sim;
  }
  const holding = await fetchChainHolding(address, mint);
  await saveHolding(address, mint, holding);
  return holding;
}
