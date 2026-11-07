"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/AppProvider";
import { Avatar, PageHeader, PriorityBars, SimulatedBanner, TierBadge } from "@/components/ui/bits";

function ago(d: string | null) {
  if (!d) return "—";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export default function LeaderboardPage() {
  const { me } = useApp();
  const [data, setData] = useState<{ entries: any[]; simulated: boolean; reason?: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { api("/api/leaderboard").then(setData).catch(() => setFailed(true)); }, [me?.balance]);
  const [a, b, c] = data?.entries ?? [];
  return (
    <div className="mx-auto max-w-5xl px-5 pt-28 sm:px-8">
      <PageHeader eyebrow="Leaderboard" title="Who's up the mountain">Only wallets with proven ownership rank here, and each wallet counts once. Balances are read from the Solana chain.</PageHeader>
      {data?.simulated && <SimulatedBanner>Dev mock mode shows demo holders with fake balances. They disappear as soon as a real mint is configured.</SimulatedBanner>}
      {failed && <p className="text-danger">The leaderboard could not load.</p>}
      {data?.reason && <p className="text-frost">{data.reason}</p>}
      {data && !data.entries.length && !data.reason && <p className="glass rounded-2xl p-8 text-center text-frost">No verified holders yet. The summit is open.</p>}
      {a && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[a, b, c].filter(Boolean).map((e) => (
            <div key={e.username} className={`glass rise rounded-3xl p-5 ${e.rank === 1 ? "border-ember/50" : ""}`}>
              <div className="flex items-center justify-between"><span className="display text-3xl text-ember">#{e.rank}</span><TierBadge tier={e.tier} /></div>
              <div className="mt-3 flex items-center gap-2"><Avatar seed={e.avatarSeed} size={36} /><strong className="truncate">{e.username}</strong></div>
              <p className="numeric mt-2 text-xl font-bold">{e.holdings.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
            </div>
          ))}
        </div>
      )}
      {data && data.entries.length > 3 && (
        <div className="glass overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-mist"><tr><th className="p-3 pl-5">Rank</th><th className="p-3">Holder</th><th className="p-3">Tier</th><th className="p-3 text-right">Tokens</th><th className="p-3 text-right pr-5">Recent activity</th></tr></thead>
            <tbody className="divide-y divide-white/6">
              {data.entries.slice(3).map((e) => (
                <tr key={e.username} className={`transition hover:bg-white/5 ${me?.user?.username === e.username ? "bg-ember/8" : ""}`}>
                  <td className="numeric p-3 pl-5 font-bold">{e.rank}</td>
                  <td className="p-3"><span className="flex items-center gap-2"><Avatar seed={e.avatarSeed} size={26} /><strong>{e.username}</strong>{e.address && <span className="numeric text-xs text-mist">{e.address}</span>}</span></td>
                  <td className="p-3"><span className="flex items-center gap-2"><PriorityBars tier={e.tier} /><TierBadge tier={e.tier} size="xs" /></span></td>
                  <td className="numeric p-3 text-right">{e.holdings.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  <td className="p-3 pr-5 text-right text-frost">{e.questions7d} questions · {ago(e.lastActive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
