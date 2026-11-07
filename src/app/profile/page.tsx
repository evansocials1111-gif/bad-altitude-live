"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/AppProvider";
import { Avatar, PageHeader, TierBadge } from "@/components/ui/bits";
import { maskAddress } from "@/lib/shared/format";

const OWNERSHIP = { ownership_verified: ["Ownership verified", "text-neon"], ownership_not_verified: ["Ownership not verified", "text-ember-soft"] } as const;

export default function ProfilePage() {
  const { me, refreshMe, openAuth } = useApp();
  const router = useRouter();
  const [history, setHistory] = useState<{ questions: any[]; chats: any[] } | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const user = me?.user;

  useEffect(() => {
    if (user) { setUsername(user.username); setBio(user.bio); api("/api/profile").then(setHistory).catch(() => {}); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return <div className="pt-40 text-center text-frost">Loading…</div>;
  if (!user) return (
    <div className="mx-auto max-w-lg px-5 pt-40 text-center">
      <h1 className="display text-4xl">No profile yet</h1>
      <p className="mt-3 text-frost">Enter the community to get one.</p>
      <button onClick={openAuth} className="btn btn-ember mt-6 px-6 py-3">Enter community</button>
    </div>
  );

  async function patch(values: object, ok = "Saved.") {
    try { await api("/api/profile", { method: "PATCH", body: values }); setNote({ ok: true, text: ok }); await refreshMe(); }
    catch (e: any) { setNote({ ok: false, text: e.message }); }
  }
  async function remove(address: string) {
    await api(`/api/wallet/${address}`, { method: "DELETE" });
    await refreshMe();
  }
  async function logout() {
    await api("/api/auth/logout", { body: {} });
    await refreshMe();
    router.push("/");
  }
  async function setSim(address: string, amount: number) {
    await api("/api/dev/balance", { body: { address, amount } });
    await refreshMe();
  }

  const wallets = me.wallets ?? [];
  const verified = wallets.filter((w) => w.verification_status === "ownership_verified");

  return (
    <div className="mx-auto max-w-5xl px-5 pt-28 sm:px-8">
      <PageHeader eyebrow="Your profile" title={user.username} />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="glass rounded-3xl p-5">
          <div className="flex items-center gap-3"><Avatar seed={user.avatarSeed} size={64} /><div><TierBadge tier={me.tier ?? "visitor"} /><p className="mt-1 text-xs text-frost">Joined {new Date(user.createdAt).toLocaleDateString()}</p></div></div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-frost">Verified balance</dt><dd className="numeric font-bold">{(me.balance ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd></div>
            <div className="flex justify-between"><dt className="text-frost">Leaderboard</dt><dd className="numeric font-bold">{me.rank ? `#${me.rank}` : "Unranked"}</dd></div>
          </dl>
          <button onClick={() => patch({ avatarSeed: crypto.randomUUID().slice(0, 12) }, "New face.")} className="btn btn-glass mt-4 w-full py-2 text-sm">Shuffle avatar</button>
          <button onClick={logout} className="mt-2 w-full py-2 text-sm font-semibold text-frost hover:underline">Sign out</button>
        </section>

        <section className="glass rounded-3xl p-5 lg:col-span-2">
          <h2 className="font-extrabold">Public profile</h2>
          <form onSubmit={(e) => { e.preventDefault(); void patch({ username, bio }); }} className="mt-3 space-y-3">
            <label className="block text-sm font-semibold">Username<input value={username} onChange={(e) => setUsername(e.target.value)} className="field mt-1" maxLength={20} /></label>
            <label className="block text-sm font-semibold">Bio<input value={bio} onChange={(e) => setBio(e.target.value)} className="field mt-1" maxLength={160} /></label>
            <button className="btn btn-ember px-5 py-2 text-sm">Save</button>
            {note && <span role="status" className={`ml-3 text-sm ${note.ok ? "text-neon" : "text-danger"}`}>{note.text}</span>}
          </form>
          <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={user.hideWallet} onChange={(e) => patch({ hideWallet: e.target.checked })} className="accent-[#ff7a1a]" /> Hide my wallet address on the leaderboard</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={user.hideFromLeaderboard} onChange={(e) => patch({ hideFromLeaderboard: e.target.checked })} className="accent-[#ff7a1a]" /> Leave the leaderboard entirely</label>
          </div>
        </section>

        <section className="glass rounded-3xl p-5 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-extrabold">Wallets</h2><button onClick={openAuth} className="btn btn-glass px-4 py-1.5 text-sm">Add wallet</button></div>
          <p className="mt-1 text-sm text-frost">Balances of your <strong>verified</strong> wallets combine into one total ({verified.length} counted). Unverified wallets are shown for reference and add nothing.</p>
          {wallets.length === 0 && <p className="mt-4 text-sm text-mist">No wallets yet.</p>}
          <ul className="mt-3 space-y-2">
            {wallets.map((w) => {
              const [label, color] = OWNERSHIP[w.verification_status as keyof typeof OWNERSHIP];
              return (
                <li key={w.address} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white/[.04] p-3 text-sm">
                  <span className="numeric font-bold" title={w.address}>{maskAddress(w.address)}</span>
                  <span className={`text-xs font-bold ${color}`}>{label}</span>
                  <span className="text-xs text-mist">{w.wallet_type}{w.verification_method ? ` · ${w.verification_method.replace("_", " ")}` : ""}</span>
                  <span className="numeric ml-auto">{Number(w.balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}{w.source === "simulated" ? " (sim)" : ""}</span>
                  {me.mock && w.verification_status === "ownership_verified" && (
                    <select aria-label="Simulated balance" className="rounded bg-black/40 px-1 py-0.5 text-xs" value="" onChange={(e) => e.target.value && setSim(w.address, Number(e.target.value))}>
                      <option value="">Set sim balance</option>
                      {[0, 250000, 5000000, 75000000, 650000000].map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
                    </select>
                  )}
                  <button onClick={() => remove(w.address)} className="text-xs font-semibold text-frost hover:text-danger">Remove</button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="glass rounded-3xl p-5 lg:col-span-2">
          <h2 className="font-extrabold">Character interactions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {history?.questions.length === 0 && <li className="text-mist">You haven&apos;t asked anything yet.</li>}
            {history?.questions.map((m) => (
              <li key={m.id} className="rounded-xl bg-white/[.04] p-3"><p className="text-xs text-mist">To {m.character_id} · {m.status}</p><p className="text-frost">{m.content}</p>{m.response && <p className="mt-1 border-l-2 border-ember pl-2">{m.response}</p>}</li>
            ))}
          </ul>
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="font-extrabold">Chat history</h2>
          <ul className="scroll-thin mt-3 max-h-80 space-y-1.5 overflow-y-auto text-sm text-frost">
            {history?.chats.length === 0 && <li className="text-mist">Nothing yet.</li>}
            {history?.chats.map((c) => <li key={c.id}>{c.content}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
