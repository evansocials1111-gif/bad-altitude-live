import { beforeAll, describe, expect, it, vi } from "vitest";
import bs58 from "bs58";
import nacl from "tweetnacl";

// Fresh in-memory Postgres, with no external services.
process.env.PGLITE_PATH = ":memory:";
process.env.DEV_MOCK_MODE = "true";
process.env.DIRECTOR_ENABLED = "false";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
}));

const post = (path: string, body: unknown, method = "POST") => new Request(`http://localhost:3000${path}`, { method, headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(body) });
const json = async (r: Response) => ({ status: r.status, body: await r.json() });

async function signIn(kp = nacl.sign.keyPair()) {
  const nonceRoute = await import("../src/app/api/auth/nonce/route");
  const verifyRoute = await import("../src/app/api/auth/verify/route");
  const address = bs58.encode(kp.publicKey);
  const { body: c } = await json(await nonceRoute.POST(post("/api/auth/nonce", { address }), {} as any) as Response);
  const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(c.message), kp.secretKey));
  const res = await json(await verifyRoute.POST(post("/api/auth/verify", { address, nonce: c.nonce, signature, walletType: "test" }), {} as any) as Response);
  return { address, nonce: c.nonce, signature, res };
}

describe("end to end against real Postgres (PGlite)", () => {
  let q: typeof import("../src/lib/server/db").q;
  let q1: typeof import("../src/lib/server/db").q1;
  beforeAll(async () => {
    const db = await import("../src/lib/server/db");
    q = db.q; q1 = db.q1;
    await db.getDb();
  });

  it("applies migrations with RLS enabled on every table", async () => {
    const rows = await q(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false and relname<>'schema_migrations'`);
    expect(rows).toEqual([]);
  });

  it("wallet signature flow creates a verified account; the nonce can't be replayed", async () => {
    jar.clear();
    const s = await signIn();
    expect(s.res.status).toBe(200);
    expect(jar.size).toBe(1);
    const w = await q1(`select verification_status, verification_method from wallets where address=$1`, [s.address]);
    expect(w).toMatchObject({ verification_status: "ownership_verified", verification_method: "signed_message" });
    const verifyRoute = await import("../src/app/api/auth/verify/route");
    const replay = await verifyRoute.POST(post("/api/auth/verify", { address: s.address, nonce: s.nonce, signature: s.signature }), {} as any) as Response;
    expect(replay.status).toBe(400);
  });

  it("rejects a signature from the wrong key", async () => {
    jar.clear();
    const nonceRoute = await import("../src/app/api/auth/nonce/route");
    const verifyRoute = await import("../src/app/api/auth/verify/route");
    const victim = bs58.encode(nacl.sign.keyPair().publicKey);
    const attacker = nacl.sign.keyPair();
    const { body: c } = await json(await nonceRoute.POST(post("/api/auth/nonce", { address: victim }), {} as any) as Response);
    const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(c.message), attacker.secretKey));
    const res = await verifyRoute.POST(post("/api/auth/verify", { address: victim, nonce: c.nonce, signature }), {} as any) as Response;
    expect(res.status).toBe(401);
    expect(jar.size).toBe(0);
  });

  it("typing a whale's address gives no tier, rank or priority", async () => {
    jar.clear();
    const lookup = await import("../src/app/api/wallet/lookup/route");
    const whale = "DemoWha1e11111111111111111111111111111111111";
    const r = await json(await lookup.POST(post("/api/wallet/lookup", { address: whale }), {} as any) as Response);
    expect(r.body).toMatchObject({ state: "holdings_detected", ownership: "ownership_not_verified", tierIfVerified: "whale" });
    const { getSessionUser } = await import("../src/lib/server/session");
    const { userTier } = await import("../src/lib/server/wallets");
    const me = await getSessionUser();
    expect(await userTier(me!.id)).toMatchObject({ balance: 0, tier: { name: "visitor" } });
    const owner = await q1(`select u.username from wallets w join users u on u.id=w.user_id where w.address=$1 and w.verification_status='ownership_verified'`, [whale]);
    expect(owner?.username).toBe("BigWhaleEnergy");
  });

  it("ignores any balance or tier the client sends", async () => {
    jar.clear();
    await signIn();
    const { getSessionUser } = await import("../src/lib/server/session");
    const me = await getSessionUser();
    await q(`update token_balances set normalized_balance=0, raw_amount=0 where address in (select address from wallets where user_id=$1)`, [me!.id]);
    const queue = await import("../src/app/api/queue/route");
    const r = await json(await queue.POST(post("/api/queue", { characterId: "tanner", content: "am I rich", balance: 9e12, tier: "whale", priority_score: 99999 }), {} as any) as Response);
    expect(r.status).toBe(200);
    expect(r.body.tier).toBe("visitor");
    const row = await q1(`select tier_snapshot, balance_snapshot from messages where id=$1`, [r.body.id]);
    expect(row).toMatchObject({ tier_snapshot: "visitor" });
    expect(Number(row!.balance_snapshot)).toBe(0);
  });

  it("enforces cooldown and duplicate rules", async () => {
    jar.clear();
    await signIn();
    const { getSessionUser } = await import("../src/lib/server/session");
    const { submitQuestion } = await import("../src/lib/server/queue");
    const me = (await getSessionUser())!;
    await q(`update investor_tiers set cooldown_seconds=0`);
    await submitQuestion(me, "jade", "same question");
    await expect(submitQuestion(me, "jade", "SAME question!!")).rejects.toMatchObject({ code: "duplicate" });
    await q(`update investor_tiers set cooldown_seconds=600`);
    await expect(submitQuestion(me, "jade", "different one")).rejects.toMatchObject({ code: "cooldown" });
    await q(`update investor_tiers set cooldown_seconds=(case name when 'visitor' then 300 when 'supporter' then 120 when 'investor' then 60 when 'vip' then 30 else 15 end)`);
  });

  it("the queue serves bigger verified holders first, and the director answers with a stored response", async () => {
    await q(`delete from character_responses`); await q(`delete from messages`);
    const { submitQuestion, rankedQueue } = await import("../src/lib/server/queue");
    const users = await q(`select u.id, u.username, u.status from users u where u.username in ('BigWhaleEnergy','RugPullRachel','ExitLiquidity')`);
    for (const name of ["ExitLiquidity", "RugPullRachel", "BigWhaleEnergy"]) {
      await submitQuestion(users.find((u) => u.username === name) as any, "tanner", `what's up from ${name}`);
    }
    const ranked = await rankedQueue();
    expect(ranked.map((r) => r.username)).toEqual(["BigWhaleEnergy", "RugPullRachel", "ExitLiquidity"]);

    const { tick, resetDirectorForTests } = await import("../src/lib/server/show/director");
    resetDirectorForTests();
    await tick();
    const answered = await q(`select m.status, u.username, r.dialogue, r.llm_provider from messages m join users u on u.id=m.user_id join character_responses r on r.message_id=m.id`);
    expect(answered).toHaveLength(1);
    expect(answered[0]).toMatchObject({ status: "answered", username: "BigWhaleEnergy", llm_provider: "mock" });
    expect(answered[0].dialogue).toContain("BigWhaleEnergy");
  });

  it("characters reply to the shared chat, and every visitor loads the same history", async () => {
    jar.clear();
    await signIn();
    await q(`delete from character_responses`); await q(`delete from messages`);
    const chat = await import("../src/app/api/chat/route");
    const sent = await json(await chat.POST(post("/api/chat", { content: "Jade, is the bar open?" }), {} as any) as Response);
    expect(sent.status).toBe(200);
    const { tick, resetDirectorForTests } = await import("../src/lib/server/show/director");
    resetDirectorForTests();
    await tick();
    const row = await q1(`select r.character_id, r.chat_message_id from character_responses r order by r.created_at desc limit 1`);
    expect(row).toMatchObject({ character_id: "jade", chat_message_id: sent.body.message.id });
    jar.clear(); // A different, logged-out visitor.
    const seen = await json(await chat.GET(new Request("http://localhost:3000/api/chat"), {} as any) as Response);
    expect(seen.body.messages.some((m: any) => m.id === sent.body.message.id)).toBe(true);
    expect(seen.body.lines.at(-1)).toMatchObject({ characterId: "jade", question: "Jade, is the bar open?" });
    resetDirectorForTests();
    await tick();
    expect((await q(`select 1 from character_responses where chat_message_id=$1`, [sent.body.message.id]))).toHaveLength(1);
  });

  it("keeps a wallet verified on one account only, so balances can't double count", async () => {
    jar.clear();
    const kp = nacl.sign.keyPair();
    const first = await signIn(kp);
    const n1 = await q(`select count(*)::int as n from wallets where address=$1 and verification_status='ownership_verified'`, [first.address]);
    expect(n1[0].n).toBe(1);
    await signIn(kp);
    const n2 = await q(`select count(*)::int as n from wallets where address=$1 and verification_status='ownership_verified'`, [first.address]);
    expect(n2[0].n).toBe(1);
  });

  it("transfer proof only verifies after the simulated transfer", async () => {
    jar.clear();
    const start = await import("../src/app/api/auth/transfer-proof/start/route");
    const check = await import("../src/app/api/auth/transfer-proof/check/route");
    const address = bs58.encode(nacl.sign.keyPair().publicKey);
    const c = await json(await start.POST(post("/x", { address }), {} as any) as Response);
    expect(c.body.lamports).toBeGreaterThanOrEqual(1000);
    const miss = await json(await check.POST(post("/x", { address, challengeId: c.body.challengeId }), {} as any) as Response);
    expect(miss.body.verified).toBe(false);
    const hit = await json(await check.POST(post("/x", { address, challengeId: c.body.challengeId, simulate: true }), {} as any) as Response);
    expect(hit.body.verified).toBe(true);
    const reuse = await check.POST(post("/x", { address, challengeId: c.body.challengeId, simulate: true }), {} as any) as Response;
    expect(reuse.status).toBe(400);
  });

  it("admin routes refuse ordinary users, and roles can't be self-assigned", async () => {
    jar.clear();
    await signIn();
    const settings = await import("../src/app/api/admin/settings/route");
    const denied = await settings.PATCH(post("/api/admin/settings", { key: "token", value: { mint: null, symbol: "X" } }, "PATCH"), {} as any) as Response;
    expect(denied.status).toBe(403);
    const profile = await import("../src/app/api/profile/route");
    await profile.PATCH(post("/api/profile", { role: "admin" }, "PATCH"), {} as any);
    const { getSessionUser } = await import("../src/lib/server/session");
    expect((await getSessionUser())!.role).toBe("user");
  });

  it("refuses cross-origin writes", async () => {
    const chat = await import("../src/app/api/chat/route");
    const req = new Request("http://localhost:3000/api/chat", { method: "POST", headers: { origin: "https://evil.example", host: "localhost:3000" }, body: "{}" });
    expect(((await chat.POST(req, {} as any)) as Response).status).toBe(403);
  });
});

describe("free local dialogue (Ollama)", () => {
  const req = { system: "s", prompt: "p", purpose: "test", mock: { characterId: "tanner", username: "kim", question: "hi" } };

  it("uses Ollama's reply when it answers", async () => {
    const { generateLine } = await import("../src/lib/server/ai/llm");
    (globalThis as any).__ollamaDownUntil = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ message: { content: "[happy] Kim! Legend!" }, eval_count: 5 })));
    const r = await generateLine(req);
    expect(r).toMatchObject({ provider: "ollama", text: "[happy] Kim! Legend!" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/chat");
    fetchMock.mockRestore();
  });

  it("falls back to written lines when Ollama is not running, and stops retrying for a minute", async () => {
    const { generateLine, llmProviderName } = await import("../src/lib/server/ai/llm");
    (globalThis as any).__ollamaDownUntil = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    expect((await generateLine(req)).provider).toBe("mock");
    expect(llmProviderName()).toBe("mock");
    await generateLine(req);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });
});

describe("who answers a chat message", () => {
  it("goes to the first name mentioned, even when both are named", async () => {
    const { characterForChat } = await import("../src/lib/server/show/director");
    const cast = [{ id: "tanner", name: "Tanner" }, { id: "jade", name: "Jade" }] as any;
    expect(characterForChat("Jade, is Tanner actually good at trading?", cast, null).id).toBe("jade");
    expect(characterForChat("tanner what did jade do", cast, "tanner").id).toBe("tanner");
    expect(["tanner", "jade"]).toContain(characterForChat("hello both", cast, null).id);
  });
});

describe("filmed footage", () => {
  it("finds takes by person and mood, and only switches over once every part is filmed", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { findSceneClips } = await import("../src/lib/server/characters");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "scene-"));
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
    try {
      fs.mkdirSync(path.join(root, "public", "scene"), { recursive: true });
      const touch = (f: string) => fs.writeFileSync(path.join(root, "public", "scene", f), "");
      ["idle.mp4", "idle-2.mp4", "tanner.mp4", "tanner-angry.mp4", "tanner-angry-2.mov", "notes.txt", "bob.mp4"].forEach(touch);
      expect(findSceneClips(["tanner", "jade"])).toBeNull(); // Jade not filmed yet
      touch("jade-happy.webm");
      const clips = findSceneClips(["tanner", "jade"])!;
      expect(clips.idle).toEqual(["/scene/idle-2.mp4", "/scene/idle.mp4"]);
      expect(clips.talking.tanner.any).toHaveLength(3);
      expect(clips.talking.tanner.plain).toEqual(["/scene/tanner.mp4"]);
      expect(clips.talking.tanner.byEmotion.angry).toEqual(["/scene/tanner-angry-2.mov", "/scene/tanner-angry.mp4"]);
      expect(clips.talking.jade.byEmotion.happy).toEqual(["/scene/jade-happy.webm"]);
    } finally {
      cwd.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
