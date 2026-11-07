import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { getSetting } from "../settings";
import { log } from "../log";
import { recordUsage } from "./usage";

export type LlmRequest = { system: string; prompt: string; purpose: string; mock: MockContext };
export type LlmResult = { text: string; provider: string; model: string; refused?: boolean };
export type MockContext = { characterId: string; username?: string; question?: string; marketLine?: string | null; lastLine?: string };

// USD per million tokens, input then output.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5],
};

const store = globalThis as unknown as { __anthropic?: Anthropic; __mockTurn?: number; __ollamaDownUntil?: number };

export function llmProviderName() {
  if (config.anthropicApiKey) return "anthropic";
  return config.ollamaEnabled && !((store.__ollamaDownUntil ?? 0) > Date.now()) ? "ollama" : "mock";
}

export async function generateLine(req: LlmRequest): Promise<LlmResult> {
  if (!config.anthropicApiKey) {
    if (config.ollamaEnabled && !((store.__ollamaDownUntil ?? 0) > Date.now())) {
      const local = await ollamaGenerate(req);
      if (local) return local;
    }
    return mockGenerate(req);
  }

  const client = (store.__anthropic ??= new Anthropic({ apiKey: config.anthropicApiKey }));
  const model = (await getSetting("ai")).llmModel || config.llmModel;
  const params: any = {
    model,
    max_tokens: 1500,
    output_config: { effort: "low" },
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: req.prompt }],
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
  const res: any = await client.beta.messages.create(params);
  const u = res.usage ?? {};
  const [pIn, pOut] = PRICES[model] ?? [4, 20];
  await recordUsage({
    kind: "llm", provider: "anthropic", model, purpose: req.purpose,
    input: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), output: u.output_tokens ?? 0,
    costUsd: ((u.input_tokens ?? 0) * pIn + (u.output_tokens ?? 0) * pOut) / 1e6,
  });
  if (res.stop_reason === "refusal") {
    log("warn", "llm.refusal", { purpose: req.purpose, category: res.stop_details?.category ?? null });
    return { text: "", provider: "anthropic", model, refused: true };
  }
  const text = (res.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ");
  return { text, provider: "anthropic", model };
}

/** Free dialogue from a model running on this machine. Returns null when Ollama isn't reachable, so the caller falls back. */
async function ollamaGenerate(req: LlmRequest): Promise<LlmResult | null> {
  const model = config.ollamaModel;
  try {
    const res = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model, stream: false,
        options: { temperature: 1, num_predict: 160 },
        messages: [{ role: "system", content: req.system }, { role: "user", content: req.prompt }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body: any = await res.json();
    const text = String(body?.message?.content ?? "").trim();
    if (!text) throw new Error("ollama returned no text");
    await recordUsage({ kind: "llm", provider: "ollama", model, purpose: req.purpose, input: body.prompt_eval_count ?? 0, output: body.eval_count ?? 0, costUsd: 0 });
    return { text, provider: "ollama", model };
  } catch (err) {
    // Don't stall every line on a server that isn't there. Try again in a minute.
    store.__ollamaDownUntil = Date.now() + 60_000;
    log("warn", "llm.ollama_unavailable", { error: String(err).slice(0, 200) });
    return null;
  }
}

const MOCK: Record<string, { answer: string[]; banter: string[] }> = {
  tanner: {
    answer: [
      "[happy] {user}! King! Bro, that's the dumbest shit I've read today, and I read my own trade history this morning.",
      "[angry] {user}, bro, I'm mid-chug right now and you made me spit. You owe me a can.",
      "[smug] {user}, look at this arm. Now look at your message. Exactly. That's what I thought.",
      "[shocked] Yo, {user} really typed that with their whole chest. Jade, read this. No, read it out loud.",
    ],
    banter: [
      "[angry] Jade, the liquidation wasn't my fault. The candle came out of nowhere, like a sniper, bro.",
      "[happy] Chat, rate my calves out of ten. Wrong answers get banned. Jade, don't look.",
      "[shocked] Jade, why is my cereal bowl empty? I literally just poured it. Are you serious right now?",
      "[smug] Jade, I'm gonna say it. I could beat a horse. Not a big one. A medium one.",
    ],
  },
  jade: {
    answer: [
      "[smug] {user}. Babe. Say your username out loud once and then think about what you've done.",
      "[neutral] {user}, I'm doing my nails right now and I still have more going on than you.",
      "[angry] Oh my god, {user}, you type like your hands are wet. What is happening over there?",
      "[smug] {user}, that's cute. Tanner, look, it's you but with less money.",
    ],
    banter: [
      "[smug] Tanner, you used my card for pre-workout again. I can see it. I can see everything.",
      "[neutral] Tanner, your room smells like a gym bag got divorced. Fix it or I'm moving out.",
      "[angry] Tanner, stop flexing at the camera. Nobody asked. Chat didn't ask. God didn't ask.",
      "[smug] Chat, Tanner got liquidated at nine a.m. He cried in the shower. I heard it.",
    ],
  },
  doug: {
    answer: [
      "[happy] {user}! Legend! Okay, hold on, let me move the laptop, my jaw's blocking the whole camera again.",
      "[shocked] {user}, chief, that is exactly what my ski instructor said to me in 2009, right before I won regionals. Coincidence? Absolutely.",
      "[smug] Great question, {user}. Short answer, bend your knees. Long answer, also bend your knees.",
      "[sad] {user}, buddy, I'm eating cold pasta out of a ski boot right now, so I'm not the guy for that one.",
    ],
    banter: [
      "[happy] Marlene, hear me out. Rent, but instead of money, it's six private lessons on the bunny hill.",
      "[shocked] Marlene, your cat just looked at me through the vent again. He knows things, Marlene.",
      "[smug] I'm doing calf raises on your stairs right now, Marlene. You're welcome for the free content.",
      "[sad] Marlene, I need you to tell the chat my jaw isn't that big. Marlene. Tell them.",
    ],
  },
  marlene: {
    answer: [
      "[angry] {user}, sweetheart, I typed court transcripts for forty years, and that's the dumbest sentence I've ever read.",
      "[smug] Hold on, {user}. Let me get closer to the screen. No, it's worse up close.",
      "[neutral] {user}, I'm writing that down with today's date. You'll be hearing about it.",
      "[angry] {user}, I'm knitting a scarf right now, and every stitch is a grudge. That one's yours now.",
    ],
    banter: [
      "[angry] Douglas, you owe me eleven hundred dollars and a bathmat, and don't think I forgot the bathmat.",
      "[smug] Douglas, Judge doesn't hate you. Judge doesn't think about you at all. That's worse.",
      "[angry] Douglas, it is three in the afternoon and you are wearing goggles indoors.",
      "[neutral] Douglas, the stairs are not a gym. The stairs are evidence.",
    ],
  },
  dale: {
    answer: [
      "[shocked] {user}. Okay. Listen. You typed that at the exact moment my radio went quiet. I'm not saying you did it. I'm saying write down where you were.",
      "[angry] Nobody asks that by accident, {user}. Who sent you? Was it the snow people? There are snow people, {user}. Check your boots.",
      "[neutral] {user}, I've been on this lift nineteen years, and I can tell you for a fact that's what they want you to wonder.",
      "[shocked] Funny you say that, {user}, because a bird looked at me weird this morning. Same bird. Different hat.",
    ],
    banter: [
      "[shocked] That chairlift's moved four inches left since Tuesday, and every one of you is acting normal about it.",
      "[angry] Ronda, your receipts all end in nine. All of them. Who's nine working for?",
      "[neutral] I counted the mountains again. I'm not gonna tell you the number. But sleep with your shoes on.",
      "[shocked] Yolanda, you plowed the same street twice. Either that's a mistake or there's two streets, and I don't like either one.",
    ],
  },
  ronda: {
    answer: [
      "[smug] {user}, hon. I've watched men lose houses with more dignity than that sentence.",
      "[neutral] Noted, {user}. It's going on your tab.",
      "[smug] Cute, {user}. Ask me again when you've been margin called at a wedding.",
      "[neutral] I'd answer that, {user}, but you haven't tipped since you got here.",
    ],
    banter: [
      "[smug] Dale, the nines are the price of the drink. Pay for one and I'll explain the rest.",
      "[neutral] Tab's due, boys. Not a metaphor. Mostly not a metaphor.",
      "[smug] Yolanda, you can't motivate a raccoon. I've seen his books.",
      "[neutral] I retired to the mountains for peace and quiet. Instead I got all of you and a fucking karaoke machine.",
    ],
  },
  yolanda: {
    answer: [
      "[happy] {user}! I DON'T KNOW WHAT THAT MEANT, AND I'M SO PROUD OF YOU! GET IN THE TRUCK!",
      "[angry] {user}, THAT WAS WEAK AND I BELIEVE IN YOU! ASK IT AGAIN LIKE YOU'VE GOT A BLADE ON THE FRONT OF YOU!",
      "[happy] LISTEN UP, {user}! LIFE IS A SNOWBANK AND YOU'RE A DAMN PLOW! THAT'S NOT AN ANSWER, BUT DON'T YOU FEEL DANGEROUS?",
      "[angry] WHO HURT YOU, {user}? GIVE ME A NAME AND A STREET! I'M KIDDING! I'M THE MAYOR! THERE'S PAPERWORK!",
    ],
    banter: [
      "[happy] MORT! LOOK AT ME! YOU ARE NOT A DUMPSTER RACCOON! YOU ARE A DUMPSTER RACCOON WITH GOALS!",
      "[angry] I WAS ELECTED MAYOR BY ACCIDENT AND I'VE STILL DONE MORE THAN ANY OF YOU ON PURPOSE!",
      "[happy] DALE, THAT'S THE CRAZIEST SHIT I EVER HEARD, AND I'M PUTTING YOU ON THE ZONING BOARD!",
      "[angry] RONDA, I'LL PAY MY TAB WHEN THE TOWN PAYS ME! THE TOWN IS ALSO ME! WE'RE IN TALKS!",
    ],
  },
  mort: {
    answer: [
      "[neutral] {user}. I can give you four dollars for that. Sigh. Three, because you made me read it.",
      "[sad] Got a whole dumpster of those, {user}. Nobody ever comes back for them.",
      "[neutral] Interesting, {user}. Some wear on the edges. Previous owner clearly gave up. Two dollars.",
      "[sad] I'd take that in trade, {user}, but I've still got your last one. It doesn't sell.",
    ],
    banter: [
      "[neutral] Somebody pawned their hopes this morning. Slightly used. I gave them a coupon.",
      "[sad] That's a nice watch, Dale. Had. Sorry. It's a nice watch I've got.",
      "[neutral] Yolanda gave me a pep talk. I gave her a dollar for it. She overpaid for the dollar.",
      "[sad] Sigh. I'm a raccoon with a business license, and I'm still the most stable one here.",
    ],
  },
};

function mockGenerate(req: LlmRequest): LlmResult {
  const set = MOCK[req.mock.characterId] ?? MOCK.tanner;
  const turn = (store.__mockTurn = (store.__mockTurn ?? 0) + 1);
  const isAnswer = req.mock.question !== undefined;
  const pool = isAnswer ? set.answer : set.banter;
  let text = pool[turn % pool.length]
    .replace(/\{user\}/g, req.mock.username ?? "pal");
  if (isAnswer && req.mock.marketLine && /price|market|chart|pump|dump|happening|token|volume/i.test(req.mock.question ?? "")) {
    text += ` ${req.mock.marketLine}`;
  }
  return { text, provider: "mock", model: "mock-template" };
}
