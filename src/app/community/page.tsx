"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { ChatPanel, QueuePanel } from "@/components/Panels";
import { Avatar, PageHeader, TierBadge } from "@/components/ui/bits";

export default function CommunityPage() {
  const [active, setActive] = useState<any[]>([]);
  useEffect(() => { api("/api/leaderboard").then((r) => setActive([...r.entries].sort((a, b) => b.questions7d - a.questions7d).slice(0, 8))).catch(() => {}); }, []);
  return (
    <div className="mx-auto max-w-7xl px-5 pt-28 sm:px-8">
      <PageHeader eyebrow="Community" title="The whole town's talking">Chat with other holders and see what they&apos;re asking the cast.</PageHeader>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_280px]">
        <section className="glass flex h-[560px] flex-col overflow-hidden rounded-3xl"><h2 className="border-b border-white/10 px-4 py-3 font-extrabold">Community chat</h2><ChatPanel className="flex-1" /></section>
        <section className="glass flex h-[560px] flex-col overflow-hidden rounded-3xl"><h2 className="border-b border-white/10 px-4 py-3 font-extrabold">Questions to the cast</h2><QueuePanel className="flex-1" /></section>
        <section className="glass h-fit rounded-3xl p-4">
          <h2 className="mb-3 font-extrabold">Most active holders</h2>
          {active.length === 0 && <p className="text-sm text-mist">No verified holders yet.</p>}
          <ul className="space-y-2.5">
            {active.map((e) => <li key={e.username} className="flex items-center gap-2 text-sm"><Avatar seed={e.avatarSeed} size={26} /><span className="min-w-0 flex-1 truncate font-bold">{e.username}</span><TierBadge tier={e.tier} size="xs" /></li>)}
          </ul>
          <Link href="/leaderboard" className="mt-4 block text-sm font-bold text-ember-soft">Full leaderboard →</Link>
        </section>
      </div>
    </div>
  );
}
