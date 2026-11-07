"use client";
import { useApp } from "@/lib/client/AppProvider";
import { PageHeader, SimulatedBanner } from "@/components/ui/bits";
import { formatCompact, formatPrice } from "@/lib/shared/format";

function Stat({ label, value, reason }: { label: string; value: string | null; reason?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-mist">{label}</p>
      <p className="numeric mt-1 text-2xl font-bold">{value ?? <span className="text-base text-mist">Unavailable</span>}</p>
      {!value && reason && <p className="mt-1 text-xs text-mist">{reason}</p>}
    </div>
  );
}

function Change({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="flex-1 rounded-xl bg-white/[.04] p-3 text-center">
      <p className="text-xs font-bold text-mist">{label}</p>
      <p className={`numeric mt-0.5 font-bold ${v === null ? "text-mist" : v >= 0 ? "text-neon" : "text-danger"}`}>{v === null ? "n/a" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`}</p>
    </div>
  );
}

export default function TokenPage() {
  const { market: m } = useApp();
  return (
    <div className="mx-auto max-w-5xl px-5 pt-28 sm:px-8">
      <PageHeader eyebrow="Token" title={m?.symbol ? `$${m.symbol}` : "The token"}>Live figures from public market data and the Solana chain. The cast read the same numbers, timestamped, and are told to say so when the feed is down. This is not investment advice.</PageHeader>
      {m?.status === "simulated" && <SimulatedBanner>{m.reason}</SimulatedBanner>}
      {(m?.status === "unavailable" || m?.status === "no_mint") && <div className="mb-5 rounded-xl border border-ember/40 bg-ember/10 px-4 py-2.5 text-sm"><strong>Market data unavailable. </strong>{m.reason}</div>}
      {m?.mint && <p className="numeric mb-5 break-all text-xs text-frost">Mint: {m.mint}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Price" value={formatPrice(m?.priceUsd)} />
        <Stat label="Market cap" value={formatCompact(m?.marketCap, { prefix: "$" })} />
        <Stat label="Fully diluted" value={formatCompact(m?.fdv, { prefix: "$" })} />
        <Stat label="24h volume" value={formatCompact(m?.volume24h, { prefix: "$" })} />
        <Stat label="Liquidity" value={formatCompact(m?.liquidityUsd, { prefix: "$" })} />
        <Stat label="Holders" value={formatCompact(m?.holders)} reason={m?.holdersUnavailableReason} />
      </div>
      <div className="glass mt-3 flex flex-wrap gap-2 rounded-2xl p-3">
        <Change label="5m" v={m?.priceChange.m5 ?? null} /><Change label="1h" v={m?.priceChange.h1 ?? null} /><Change label="6h" v={m?.priceChange.h6 ?? null} /><Change label="24h" v={m?.priceChange.h24 ?? null} />
      </div>
      {m?.txns24h && <p className="mt-3 text-sm text-frost">24h trades: <span className="numeric text-neon">{m.txns24h.buys.toLocaleString()} buys</span> · <span className="numeric text-danger">{m.txns24h.sells.toLocaleString()} sells</span></p>}
      <section className="glass mt-6 rounded-3xl p-5">
        <h2 className="mb-3 font-extrabold">Recent mint activity</h2>
        {!m?.recentTransactions.length && <p className="text-sm text-mist">No transactions available{m?.status === "simulated" ? " in mock mode" : ""}.</p>}
        <ul className="divide-y divide-white/6">
          {m?.recentTransactions.map((t) => (
            <li key={t.signature} className="flex items-center justify-between gap-3 py-2 text-sm">
              <a href={`https://solscan.io/tx/${t.signature}`} target="_blank" rel="noreferrer" className="numeric truncate text-ice hover:underline">{t.signature.slice(0, 24)}…</a>
              <span className="shrink-0 text-xs text-mist">{t.blockTime ? new Date(t.blockTime * 1000).toLocaleTimeString() : "pending"}{t.ok ? "" : " · failed"}</span>
            </li>
          ))}
        </ul>
      </section>
      {m?.pairUrl && <a href={m.pairUrl} target="_blank" rel="noreferrer" className="btn btn-glass mt-5 px-5 py-2.5 text-sm">View chart on DexScreener</a>}
      {m?.fetchedAt && <p className="mt-3 text-xs text-mist">Last updated {new Date(m.fetchedAt).toLocaleTimeString()}</p>}
    </div>
  );
}
