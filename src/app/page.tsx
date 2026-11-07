"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useApp } from "@/lib/client/AppProvider";
import { LiveRoom } from "@/components/LiveRoom";
import { formatCompact, formatPrice } from "@/lib/shared/format";

const STEPS = [
  ["Type anything", "Join the chat and say something. Name Tanner or Jade to pick who answers."],
  ["Get roasted out loud", "They read your message on stream and tear into it, then into each other."],
  ["Holders go first", "Verified holders jump the line. Bigger bag, faster roast."],
] as const;

function Intro() {
  return (
    <div className="mb-4 grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-[11px] font-black uppercase tracking-[.2em] text-acid">
          <span className="on-air-dot h-1.5 w-1.5 rounded-full bg-danger" />Live 24/7 · AI · 18+
        </p>
        <h1 className="display text-4xl sm:text-6xl">Two degenerates. <span className="text-ember">One couch.</span> <span className="text-acid">Your chat.</span></h1>
        <p className="mt-2 max-w-2xl text-sm text-frost sm:text-base">Tanner and Jade are AI roommates who never log off. Everything they say is written live in response to the chat, so nobody sees the same show twice.</p>
      </div>
      <ol className="hidden gap-2 sm:grid sm:grid-cols-3 lg:w-[620px]">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="glass rounded-2xl p-3">
            <p className="display text-2xl text-ember">0{i + 1}</p>
            <p className="mt-1 text-sm font-black">{title}</p>
            <p className="mt-0.5 text-xs text-frost">{body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Change({ label, v }: { label: string; v: number | null | undefined }) {
  return (
    <div className="rounded-xl bg-white/[.04] px-3 py-2 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-mist">{label}</p>
      <p className={`numeric font-bold ${v == null ? "text-mist" : v >= 0 ? "text-acid" : "text-danger"}`}>{v == null ? "n/a" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`}</p>
    </div>
  );
}

function TokenBoard() {
  const { market: m, viewers } = useApp();
  const stats = [
    ["Price", formatPrice(m?.priceUsd)],
    ["Market cap", formatCompact(m?.marketCap, { prefix: "$" })],
    ["24h volume", formatCompact(m?.volume24h, { prefix: "$" })],
    ["Liquidity", formatCompact(m?.liquidityUsd, { prefix: "$" })],
    ["Holders", formatCompact(m?.holders)],
    ["Watching", String(viewers)],
  ] as const;
  return (
    <section id="token" className="mt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">The token board</p>
          <h2 className="display text-4xl sm:text-5xl">{m?.symbol ? `$${m.symbol}` : "The token"}</h2>
        </div>
        <div className="flex gap-2">
          {m?.pairUrl && <a href={m.pairUrl} target="_blank" rel="noreferrer" className="btn btn-acid px-4 py-2 text-sm">Chart</a>}
          <Link href="/token" className="btn btn-glass px-4 py-2 text-sm">Full board →</Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="glass rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-mist">{label}</p>
            <p className="numeric mt-1 text-xl font-bold sm:text-2xl">{value ?? <span className="text-sm text-mist">Unavailable</span>}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <Change label="5m" v={m?.priceChange.m5} /><Change label="1h" v={m?.priceChange.h1} /><Change label="6h" v={m?.priceChange.h6} /><Change label="24h" v={m?.priceChange.h24} />
      </div>
      {m?.mint && <p className="numeric mt-3 break-all text-xs text-mist">CA: {m.mint}</p>}
      {m?.status === "simulated" && <p className="mt-2 text-xs text-frost"><strong>Simulated data.</strong> Dev mock mode is on, so these are not real market numbers.</p>}
      {(m?.status === "unavailable" || m?.status === "no_mint") && <p className="mt-2 text-xs text-frost">{m.reason}</p>}
    </section>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-[1500px] px-3 pt-20 sm:px-5 sm:pt-24">
      <Intro />
      <Suspense><LiveRoom /></Suspense>
      <TokenBoard />
    </div>
  );
}
