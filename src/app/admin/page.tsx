"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/AppProvider";
import { PageHeader, TierBadge } from "@/components/ui/bits";
import { maskAddress } from "@/lib/shared/format";

const TABS = ["Overview", "Token & tiers", "Priority", "Show & AI", "Characters", "Users", "Moderation"] as const;
type Tab = (typeof TABS)[number];

function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return <section className={`glass rounded-2xl p-4 ${className}`}>{title && <h2 className="mb-3 font-extrabold">{title}</h2>}{children}</section>;
}

function useSave(onDone?: () => void) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (fn: () => Promise<unknown>) => {
    try { await fn(); setNote({ ok: true, text: "Saved." }); onDone?.(); }
    catch (e: any) { setNote({ ok: false, text: e.message }); }
  };
  const el = note && <span role="status" className={`text-sm ${note.ok ? "text-neon" : "text-danger"}`}>{note.text}</span>;
  return { save, el };
}

function NumberFields({ value, labels, onChange }: { value: any; labels: Record<string, string>; onChange: (v: any) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(labels).map(([k, label]) => (
        <label key={k} className="text-sm font-semibold">{label}
          <input type="number" step="any" value={value[k] ?? 0} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} className="field numeric mt-1 py-2" />
        </label>
      ))}
    </div>
  );
}

function Toggles({ value, labels, onChange }: { value: any; labels: Record<string, string>; onChange: (v: any) => void }) {
  return <div className="space-y-2">{Object.entries(labels).map(([k, label]) => <label key={k} className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} className="accent-[#ff7a1a]" />{label}</label>)}</div>;
}

function Overview() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    const load = () => api("/api/admin/overview").then(setD).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  if (!d) return <p className="text-frost">Loading…</p>;
  const stats = [["Users", d.counts.users], ["Verified wallets", d.counts.verified_wallets], ["Queued", d.counts.queued], ["Answered 24h", d.counts.answered_24h], ["Chat 24h", d.counts.chat_24h], ["Online", d.viewers]];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{stats.map(([l, v]) => <Card key={l as string}><p className="text-xs font-bold text-mist">{l}</p><p className="numeric text-2xl font-bold">{v}</p></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="System health">
          <p className="mb-2 text-sm">Show: <strong>{d.show.mode}</strong>{d.show.note ? ` (${d.show.note})` : ""}</p>
          <ul className="divide-y divide-white/6 text-sm">{d.integrations.map((i: any) => <li key={i.name} className="flex flex-wrap justify-between gap-2 py-1.5"><span className="font-semibold">{i.name}</span><span className="text-frost"><strong className={["connected", "configured", "live", "enabled"].includes(i.status) ? "text-neon" : "text-ember-soft"}>{i.status}</strong> · {i.detail}</span></li>)}</ul>
        </Card>
        <Card title="AI usage and estimated cost (30 days)">
          {d.usage.length === 0 && <p className="text-sm text-mist">No paid API calls recorded. Mock providers cost nothing.</p>}
          <ul className="divide-y divide-white/6 text-sm">{d.usage.map((u: any, i: number) => <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5"><span>{u.kind} · {u.provider} {u.model}</span><span className="numeric text-frost">{u.calls} calls · ${Number(u.cost).toFixed(3)} · today ${Number(u.cost_today).toFixed(3)}</span></li>)}</ul>
        </Card>
      </div>
    </div>
  );
}

function TokenTiers({ settings, reload }: { settings: any; reload: () => void }) {
  const [token, setToken] = useState(settings.token);
  const [tiers, setTiers] = useState<any[]>([]);
  useEffect(() => { api("/api/admin/tiers").then((r) => setTiers(r.tiers)); }, []);
  const t = useSave(reload); const s = useSave();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Token">
        <p className="mb-3 text-sm text-frost">Overrides TOKEN_MINT from the environment. Balances are stored per mint, so changing it empties the leaderboard until wallets refresh.</p>
        <label className="text-sm font-semibold">Mint address<input value={token.mint ?? ""} onChange={(e) => setToken({ ...token, mint: e.target.value || null })} className="field numeric mt-1 text-sm" spellCheck={false} /></label>
        <label className="mt-3 block text-sm font-semibold">Symbol<input value={token.symbol ?? ""} onChange={(e) => setToken({ ...token, symbol: e.target.value || null })} className="field mt-1" /></label>
        <div className="mt-3 flex items-center gap-3"><button onClick={() => t.save(() => api("/api/admin/settings", { method: "PATCH", body: { key: "token", value: token } }))} className="btn btn-ember px-5 py-2 text-sm">Save token</button>{t.el}</div>
      </Card>
      <Card title="Investor tiers">
        <div className="space-y-2">
          {tiers.map((tier, i) => (
            <div key={tier.name} className="grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-2 text-xs">
              <TierBadge tier={tier.name} size="xs" />
              {([["min_holdings", "Min tokens"], ["priority_weight", "Weight"], ["cooldown_seconds", "Cooldown s"]] as const).map(([k, label]) => (
                <label key={k} className="font-semibold text-mist">{label}<input type="number" value={tier[k]} onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, [k]: Number(e.target.value) } : x))} className="field numeric mt-0.5 px-2 py-1 text-xs" /></label>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3"><button onClick={() => s.save(() => api("/api/admin/tiers", { method: "PUT", body: { tiers: tiers.map(({ name, min_holdings, priority_weight, cooldown_seconds }) => ({ name, min_holdings, priority_weight, cooldown_seconds })) } }))} className="btn btn-ember px-5 py-2 text-sm">Save tiers</button>{s.el}</div>
      </Card>
    </div>
  );
}

function Priority({ settings, reload }: { settings: any; reload: () => void }) {
  const [p, setP] = useState(settings.priority);
  const { save, el } = useSave(reload);
  return (
    <Card title="Priority weights">
      <p className="mb-3 text-sm text-frost"><span className="numeric">score = balanceWeight × log10(1 + tokens) + tierWeight × tier weight + waitWeight × min(wait, cap) ÷ 10 − recentPenalty × recent answers</span></p>
      <NumberFields value={p} onChange={setP} labels={{ balanceWeight: "Balance weight", tierWeight: "Tier weight", waitWeight: "Wait weight", waitCapSeconds: "Wait cap (s)", recentPenalty: "Recent answer penalty", recentWindowSeconds: "Recent window (s)", maxPendingPerUser: "Max pending per user", duplicateWindowSeconds: "Duplicate window (s)" }} />
      <div className="mt-3 flex items-center gap-3"><button onClick={() => save(() => api("/api/admin/settings", { method: "PATCH", body: { key: "priority", value: p } }))} className="btn btn-ember px-5 py-2 text-sm">Save</button>{el}</div>
    </Card>
  );
}

function ShowAi({ settings, reload }: { settings: any; reload: () => void }) {
  const [show, setShow] = useState(settings.show); const [ai, setAi] = useState(settings.ai); const [community, setCommunity] = useState(settings.community);
  const a = useSave(reload); const b = useSave(reload); const c = useSave(reload);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Broadcast">
        <Toggles value={show} onChange={setShow} labels={{ liveMode: "Live mode on", chatRepliesEnabled: "Characters reply to live chat", banterEnabled: "Characters talk when idle", pauseWhenNoViewers: "Stop generating when nobody is watching" }} />
        <div className="mt-3"><NumberFields value={show} onChange={setShow} labels={{ chatReplyCooldownSeconds: "Seconds between chat replies", banterIntervalSeconds: "Seconds between idle scenes", marketMoveThresholdPct: "Market move that triggers a scene (%)", sessionMaxMinutes: "Session limit in minutes (0 = none)" }} /></div>
        <div className="mt-3 flex items-center gap-3"><button onClick={() => a.save(() => api("/api/admin/settings", { method: "PATCH", body: { key: "show", value: show } }))} className="btn btn-ember px-5 py-2 text-sm">Save</button>{a.el}</div>
      </Card>
      <Card title="AI and cost limits">
        <Toggles value={ai} onChange={setAi} labels={{ ttsEnabled: "Generate paid voice audio" }} />
        <label className="mt-3 block text-sm font-semibold">LLM model override<input value={ai.llmModel ?? ""} onChange={(e) => setAi({ ...ai, llmModel: e.target.value || null })} placeholder="Uses LLM_MODEL from env" className="field mt-1 py-2" /></label>
        <div className="mt-3"><NumberFields value={ai} onChange={setAi} labels={{ dailyLlmBudgetUsd: "Daily LLM budget (USD)", dailyTtsBudgetUsd: "Daily voice budget (USD)", maxResponseChars: "Max characters per line" }} /></div>
        <p className="mt-2 text-xs text-mist">API keys live in environment variables only and are never sent to the browser.</p>
        <div className="mt-3 flex items-center gap-3"><button onClick={() => b.save(() => api("/api/admin/settings", { method: "PATCH", body: { key: "ai", value: ai } }))} className="btn btn-ember px-5 py-2 text-sm">Save</button>{b.el}</div>
      </Card>
      <Card title="Community access">
        <Toggles value={community} onChange={setCommunity} labels={{ guestChatEnabled: "Visitors can chat", guestQuestionsEnabled: "Visitors can ask questions" }} />
        <div className="mt-3 flex items-center gap-3"><button onClick={() => c.save(() => api("/api/admin/settings", { method: "PATCH", body: { key: "community", value: community } }))} className="btn btn-ember px-5 py-2 text-sm">Save</button>{c.el}</div>
      </Card>
    </div>
  );
}

function Characters() {
  const [list, setList] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("dale");
  const { save, el } = useSave();
  useEffect(() => { api("/api/admin/characters").then((r) => setList(r.characters)); }, []);
  const c = list.find((x) => x.id === selected);
  const set = (patch: object) => setList(list.map((x) => (x.id === selected ? { ...x, ...patch } : x)));
  if (!c) return <p className="text-frost">Loading…</p>;
  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-1.5">{list.map((x) => <button key={x.id} onClick={() => setSelected(x.id)} className={`rounded-full px-3 py-1 text-sm font-bold ${x.id === selected ? "bg-ember text-black" : "bg-white/8"}`}>{x.name}</button>)}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold">Name<input value={c.name} onChange={(e) => set({ name: e.target.value })} className="field mt-1 py-2" /></label>
        <label className="text-sm font-semibold">Tagline<input value={c.tagline} onChange={(e) => set({ tagline: e.target.value })} className="field mt-1 py-2" /></label>
        {([["personality", "Personality"], ["speaking_style", "Speaking style"], ["humor", "Humor"], ["behavior_rules", "Behavior rules"]] as const).map(([k, label]) => (
          <label key={k} className="text-sm font-semibold">{label}<textarea rows={4} value={c[k]} onChange={(e) => set({ [k]: e.target.value })} className="field mt-1 text-sm" /></label>
        ))}
        <label className="text-sm font-semibold">ElevenLabs voice ID (original or licensed voices only)<input value={c.voice_config.elevenlabsVoiceId ?? ""} onChange={(e) => set({ voice_config: { ...c.voice_config, elevenlabsVoiceId: e.target.value || null } })} className="field numeric mt-1 py-2 text-sm" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">Browser pitch<input type="number" step="0.05" value={c.voice_config.browserPitch} onChange={(e) => set({ voice_config: { ...c.voice_config, browserPitch: Number(e.target.value) } })} className="field numeric mt-1 py-2" /></label>
          <label className="text-sm font-semibold">Browser rate<input type="number" step="0.05" value={c.voice_config.browserRate} onChange={(e) => set({ voice_config: { ...c.voice_config, browserRate: Number(e.target.value) } })} className="field numeric mt-1 py-2" /></label>
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={c.active} onChange={(e) => set({ active: e.target.checked })} className="accent-[#ff7a1a]" /> On the show</label>
      <div className="mt-3 flex items-center gap-3"><button onClick={() => save(() => api("/api/admin/characters", { method: "PATCH", body: { id: c.id, name: c.name, tagline: c.tagline, personality: c.personality, speaking_style: c.speaking_style, humor: c.humor, behavior_rules: c.behavior_rules, voice_config: c.voice_config, active: c.active } }))} className="btn btn-ember px-5 py-2 text-sm">Save {c.name}</button>{el}</div>
    </Card>
  );
}

function Users({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<any[]>([]);
  const load = useCallback(() => api("/api/admin/users").then((r) => setUsers(r.users)).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);
  const update = async (id: string, patch: object) => { await api("/api/admin/users", { method: "PATCH", body: { id, ...patch } }); await load(); };
  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-mist"><tr><th className="p-3">User</th><th className="p-3">Wallets</th><th className="p-3 text-right">Verified tokens</th><th className="p-3">Status</th><th className="p-3">Role</th></tr></thead>
        <tbody className="divide-y divide-white/6">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="p-3"><strong>{u.username}</strong>{u.is_demo && <span className="ml-1 text-xs text-violet">demo</span>}<p className="text-xs text-mist">{new Date(u.created_at).toLocaleDateString()}</p></td>
              <td className="p-3 text-xs">{u.wallets.map((w: any) => <div key={w.address} className="numeric" title={w.address}>{maskAddress(w.address)} <span className={w.status === "ownership_verified" ? "text-neon" : "text-ember-soft"}>{w.status === "ownership_verified" ? `verified (${w.method?.replace("_", " ")})` : "unverified"}</span></div>)}</td>
              <td className="numeric p-3 text-right">{Number(u.holdings).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
              <td className="p-3"><select aria-label={`Status of ${u.username}`} value={u.status} onChange={(e) => update(u.id, { status: e.target.value })} className="rounded bg-black/40 px-1 py-1 text-xs"><option>active</option><option>muted</option><option>banned</option></select></td>
              <td className="p-3"><select aria-label={`Role of ${u.username}`} disabled={!isAdmin} value={u.role} onChange={(e) => update(u.id, { role: e.target.value })} className="rounded bg-black/40 px-1 py-1 text-xs"><option>user</option><option>moderator</option><option>admin</option></select></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Moderation() {
  const [m, setM] = useState<{ questions: any[]; chat: any[] }>({ questions: [], chat: [] });
  const [events, setEvents] = useState<any[]>([]);
  const load = useCallback(() => {
    api("/api/admin/messages").then(setM).catch(() => {});
    api("/api/admin/overview").then((r) => setEvents(r.moderation)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (kind: string, id: string, action: string) => { await api("/api/admin/messages", { method: "PATCH", body: { kind, id, action } }); load(); };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Questions">
        <ul className="scroll-thin max-h-[520px] space-y-2 overflow-y-auto text-sm">{m.questions.map((q) => (
          <li key={q.id} className="rounded-xl bg-white/[.04] p-2.5"><p className="text-xs text-mist"><strong className="text-snow">{q.username}</strong> · {q.tier_snapshot} · score {Number(q.priority_score).toFixed(1)} · {q.status}</p><p className="mt-0.5">{q.content}</p>{q.status === "queued" && <button onClick={() => act("question", q.id, "reject")} className="mt-1 text-xs font-bold text-danger">Reject</button>}</li>
        ))}{!m.questions.length && <li className="text-mist">None yet.</li>}</ul>
      </Card>
      <Card title="Chat">
        <ul className="scroll-thin max-h-[520px] space-y-2 overflow-y-auto text-sm">{m.chat.map((c) => (
          <li key={c.id} className={`rounded-xl bg-white/[.04] p-2.5 ${c.hidden ? "opacity-50" : ""}`}><p className="text-xs font-bold">{c.username}</p><p>{c.content}</p><button onClick={() => act("chat", c.id, c.hidden ? "unhide" : "hide")} className="mt-1 text-xs font-bold text-danger">{c.hidden ? "Unhide" : "Hide"}</button></li>
        ))}{!m.chat.length && <li className="text-mist">None yet.</li>}</ul>
      </Card>
      <Card title="Automatic blocks">
        <ul className="scroll-thin max-h-[520px] space-y-2 overflow-y-auto text-sm">{events.map((e, i) => <li key={i} className="rounded-xl bg-white/[.04] p-2.5"><p className="text-xs font-bold text-ember-soft">{e.category} · {e.source}</p><p className="break-words text-frost">{e.excerpt}</p></li>)}{!events.length && <li className="text-mist">Nothing blocked.</li>}</ul>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const { me, refreshMe } = useApp();
  const [tab, setTab] = useState<Tab>("Overview");
  const [settings, setSettings] = useState<any>(null);
  const isAdmin = me?.user?.role === "admin";
  const allowed = isAdmin || me?.user?.role === "moderator";
  const load = useCallback(() => { if (isAdmin) api("/api/admin/settings").then(setSettings).catch(() => {}); }, [isAdmin]);
  useEffect(load, [load]);

  if (!me) return <div className="pt-40 text-center text-frost">Loading…</div>;
  if (!allowed) return (
    <div className="mx-auto max-w-lg px-5 pt-40 text-center">
      <h1 className="display text-4xl">Staff only</h1>
      <p className="mt-3 text-frost">Sign a message with a wallet listed in ADMIN_WALLETS to get in.</p>
      {me.mock && <button onClick={async () => { await api("/api/dev/admin", { body: {} }); await refreshMe(); }} className="btn btn-glass mt-5 px-5 py-2.5 text-sm">Sign in as dev admin (mock mode)</button>}
    </div>
  );
  const tabs = isAdmin ? TABS : (["Overview", "Users", "Moderation"] as const);
  return (
    <div className="mx-auto max-w-7xl px-5 pt-28 sm:px-8">
      <PageHeader eyebrow={`Control room · ${me.user!.role}`} title="Admin" />
      <div className="scroll-thin mb-5 flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {tabs.map((t) => <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${t === tab ? "bg-ember text-black" : "bg-white/8 text-frost hover:bg-white/15"}`}>{t}</button>)}
      </div>
      {tab === "Overview" && <Overview />}
      {tab === "Token & tiers" && settings && <TokenTiers settings={settings} reload={load} />}
      {tab === "Priority" && settings && <Priority settings={settings} reload={load} />}
      {tab === "Show & AI" && settings && <ShowAi settings={settings} reload={load} />}
      {tab === "Characters" && <Characters />}
      {tab === "Users" && <Users isAdmin={isAdmin} />}
      {tab === "Moderation" && <Moderation />}
    </div>
  );
}
