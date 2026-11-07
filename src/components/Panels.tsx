"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/AppProvider";
import { Rig } from "./rigs/Rig";
import { Avatar, PriorityBars, TierBadge } from "./ui/bits";

export function ChatPanel({ className = "" }: { className?: string }) {
  const { chat, transcript, me, openAuth, refreshMe } = useApp();
  const [text, setText] = useState("");
  const joinAsGuest = async () => {
    setError(null);
    try { await api("/api/auth/guest", { body: {} }); await refreshMe(); }
    catch (err: any) { setError(err.message); }
  };
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const items = useMemo(() => [
    ...chat.map((m) => ({ key: m.id, at: new Date(m.createdAt).getTime(), chat: m })),
    ...transcript.map((l) => ({ key: l.id, at: l.startedAt, line: l })),
  ].sort((a, b) => a.at - b.at).slice(-100), [chat, transcript]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true); setError(null);
    try {
      await api("/api/chat", { body: { content: text } });
      setText("");
      void refreshMe();
    } catch (err: any) { setError(err.message); } finally { setSending(false); }
  }

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div ref={scroller} className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3" aria-live="polite">
        {items.length === 0 && <p className="p-6 text-center text-sm text-mist">Chat is dead. Say something and they&apos;ll roast you for it.</p>}
        {items.map((i) =>
          "line" in i && i.line ? (
            <div key={i.key} className="rounded-xl border border-ember/25 bg-ember/8 px-3 py-2 text-sm">
              <strong className="text-ember-soft">{i.line.characterName}</strong>
              {i.line.addressedTo && <span className="text-xs text-frost"> to @{i.line.addressedTo}</span>}
              <p className="mt-0.5">{i.line.text}</p>
            </div>
          ) : "chat" in i && i.chat ? (
            <div key={i.key} className="flex gap-2 text-sm">
              <Avatar seed={i.chat.avatarSeed} size={26} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong className="truncate">{i.chat.username}</strong>
                  <PriorityBars tier={i.chat.tier} />
                  {i.chat.tier !== "visitor" && <TierBadge tier={i.chat.tier} size="xs" />}
                </div>
                <p className="break-words text-frost">{i.chat.content}</p>
              </div>
            </div>
          ) : null,
        )}
      </div>
      <div className="border-t border-white/10 p-3">
        {me?.user ? (
          <form onSubmit={send} className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder="Say something. Name Tanner or Jade to pick who answers" className="field min-w-0 flex-1 py-2 text-sm" aria-label="Chat message" />
            <button disabled={sending || !text.trim()} className="btn btn-ember px-4 text-sm">Send</button>
          </form>
        ) : (
          <div className="flex gap-2">
            <button onClick={joinAsGuest} className="btn btn-ember flex-1 py-2.5 text-sm">Join the chat</button>
            <button onClick={openAuth} className="btn btn-glass flex-1 py-2 text-sm">Connect wallet</button>
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { queued: "Waiting", generating: "On air now", answered: "Answered", rejected: "Rejected", failed: "Failed", expired: "Expired" };

export function AskForm({ characterId, setCharacterId }: { characterId: string; setCharacterId: (id: string) => void }) {
  const { characters, me, openAuth, refreshMe } = useApp();
  const [text, setText] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const selected = characters.find((c) => c.id === characterId);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setNote(null);
    try {
      const r = await api("/api/queue", { body: { characterId, content: text } });
      setText("");
      setNote({ ok: true, text: `You're #${r.position ?? "?"} in the queue.` });
      void refreshMe();
    } catch (err: any) { setNote({ ok: false, text: err.message }); } finally { setSending(false); }
  }

  return (
    <div className="p-3">
      <div className="scroll-thin mb-3 flex gap-1.5 overflow-x-auto pb-1" role="radiogroup" aria-label="Choose a character">
        {characters.map((c) => (
          <button key={c.id} role="radio" aria-checked={c.id === characterId} onClick={() => setCharacterId(c.id)}
            className={`flex shrink-0 flex-col items-center rounded-xl border px-1.5 pt-1 pb-1 transition ${c.id === characterId ? "border-ember bg-ember/15" : "border-white/10 bg-white/[.03] hover:bg-white/10"}`}>
            <Rig rig={c.rig} className="h-14 w-auto" />
            <span className="text-[11px] font-bold">{c.name.replace(/^Big /, "").split(" ")[0]}</span>
          </button>
        ))}
      </div>
      {me?.user ? (
        <form onSubmit={ask} className="space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={280} rows={2} placeholder={`Ask ${selected?.name ?? "someone"} something`} className="field resize-none text-sm" aria-label="Your question" />
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-frost">Priority: <TierBadge tier={me.tier ?? "visitor"} size="xs" /></span>
            <button disabled={sending || !text.trim() || !characterId} className="btn btn-ember px-5 py-2 text-sm">{sending ? "Sending…" : `Ask ${selected?.name.replace(/^Big /, "").split(" ")[0] ?? ""}`}</button>
          </div>
        </form>
      ) : <button onClick={openAuth} className="btn btn-ember w-full py-2 text-sm">Enter to ask a question</button>}
      {note && <p role="status" className={`mt-2 text-xs ${note.ok ? "text-neon" : "text-danger"}`}>{note.text}</p>}
    </div>
  );
}

export function QueuePanel({ className = "" }: { className?: string }) {
  const { queue, characters } = useApp();
  const name = (id: string) => characters.find((c) => c.id === id)?.name ?? id;
  const waiting = queue.filter((q) => q.position !== null);
  const done = queue.filter((q) => q.position === null);
  return (
    <div className={`scroll-thin min-h-0 space-y-2 overflow-y-auto p-3 ${className}`}>
      {waiting.length === 0 && <p className="py-3 text-center text-sm text-mist">The queue is empty. Your question goes straight to the front.</p>}
      {[...waiting, ...done].map((q) => (
        <article key={q.id} className={`rounded-xl border p-2.5 text-sm ${q.status === "generating" ? "border-neon/50 bg-neon/8" : "border-white/10 bg-white/[.03]"}`}>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {q.position !== null && <span className="numeric rounded bg-white/12 px-1.5 font-bold">#{q.position}</span>}
            <strong className="truncate">{q.username}</strong>
            <PriorityBars tier={q.tier} />
            <TierBadge tier={q.tier} size="xs" />
            <span className="ml-auto text-frost">to {name(q.characterId).replace(/^Big /, "").split(" ")[0]} · {STATUS_LABEL[q.status] ?? q.status}</span>
          </div>
          <p className="mt-1 break-words text-frost">{q.content}</p>
          {q.response && <p className="mt-1.5 border-l-2 border-ember pl-2 text-[13px]">{q.response}</p>}
        </article>
      ))}
    </div>
  );
}

export function StatStrip({ className = "" }: { className?: string }) {
  const { market, viewers } = useApp();
  const { formatCompact, formatPrice } = fmt;
  const na = market?.status === "unavailable" || market?.status === "no_mint";
  const stats = [
    ["Price", formatPrice(market?.priceUsd)],
    ["Market cap", formatCompact(market?.marketCap, { prefix: "$" })],
    ["Holders", formatCompact(market?.holders)],
    ["24h volume", formatCompact(market?.volume24h, { prefix: "$" })],
    ["Online now", String(viewers)],
  ] as const;
  return (
    <div className={className}>
      <dl className="glass grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-black/10 px-4 py-3">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-mist">{label}</dt>
            <dd className="numeric mt-0.5 text-lg font-bold">{value ?? <span className="text-sm font-semibold text-mist" title={market?.holdersUnavailableReason ?? market?.reason}>Unavailable</span>}</dd>
          </div>
        ))}
      </dl>
      {market?.status === "simulated" && <p className="mt-2 text-xs text-frost"><strong>Simulated data.</strong> Dev mock mode is on, so these are not real market numbers.</p>}
      {na && <p className="mt-2 text-xs text-frost">{market?.reason}</p>}
    </div>
  );
}
import * as fmt from "@/lib/shared/format";
