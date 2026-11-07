import { randomUUID } from "node:crypto";
import { config } from "../config";
import { q, q1 } from "../db";
import { log } from "../log";
import { getMarket, hasUnverifiedFigures, marketContext } from "../market";
import { moderateOutput, recordModeration, sanitizeUserText } from "../moderation";
import { expireOldQuestions, claimNextQuestion, getQueue } from "../queue";
import { getSetting } from "../settings";
import { formatPrice, TIER_LABEL } from "../../shared/format";
import { estimateDurationMs, textToVisemes } from "../../shared/visemes";
import type { LineKind, ShowLine, ShowStatus } from "../../shared/types";
import { generateLine, type MockContext } from "../ai/llm";
import { answerPrompt, banterPrompt, BANTER_TOPICS, characterSystemPrompt, FALLBACKS, parseLine, type CharacterRow } from "../ai/prompts";
import { synthesize } from "../ai/tts";
import { llmBudgetLeft } from "../ai/usage";
import { getActiveCharacters } from "../characters";
import { verifiedHoldings } from "../wallets";
import { emit, showState } from "./bus";

type Scene = { topic: string; remaining: number; lastSpeaker: string | null; kind: LineKind };

const store = globalThis as unknown as {
  __director?: {
    timer: NodeJS.Timeout | null; ticking: boolean; busyUntil: number; lastSceneEndedAt: number; scene: Scene | null;
    topicCursor: number; lastPrice: number | null; lastExpiry: number; sessionStartedAt: number | null; lastChatReplyAt: number;
  };
};
const d = (store.__director ??= {
  timer: null, ticking: false, busyUntil: 0, lastSceneEndedAt: 0, scene: null,
  topicCursor: Math.floor(Math.random() * BANTER_TOPICS.length), lastPrice: null, lastExpiry: 0, sessionStartedAt: null, lastChatReplyAt: 0,
});

const GAP_AFTER_LINE_MS = 900;

function setStatus(mode: ShowStatus["mode"], live: boolean, note?: string) {
  const prev = showState.status;
  if (prev.mode === mode && prev.live === live && prev.note === note) return;
  showState.status = { live, mode, viewers: showState.viewers, note };
  emit({ type: "status", status: showState.status });
}

async function recentLines(limit = 8) {
  const rows = await q(
    `select c.name, r.dialogue from character_responses r join characters c on c.id=r.character_id order by r.created_at desc limit $1`, [limit]);
  return rows.reverse().map((r) => `${r.name}: ${r.dialogue}`);
}

/** Generates, then checks. A line that fails twice is replaced with the character's written fallback. */
async function produceLine(character: CharacterRow, cast: CharacterRow[], prompt: string, purpose: string, mock: MockContext, maxChars: number) {
  const market = await getMarket();
  const system = characterSystemPrompt(character, cast);
  let provider = "fallback";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const retryNote = attempt ? "\n\nYour previous attempt broke a hard limit (advice, invented market figure, or unsafe content). Say something else entirely, with no numbers." : "";
      const result = await generateLine({ system, prompt: prompt + retryNote, purpose, mock });
      provider = result.provider;
      if (result.refused || !result.text.trim()) continue;
      const line = parseLine(result.text, maxChars);
      const safety = moderateOutput(line.text);
      if (!safety.ok) { await recordModeration(null, "llm_output", safety.category, line.text); continue; }
      if (hasUnverifiedFigures(line.text, market)) { await recordModeration(null, "llm_output", "unverified_market_figure", line.text); continue; }
      return { ...line, provider };
    } catch (e) {
      log("error", "llm.failed", { message: (e as Error).message, purpose });
      break;
    }
  }
  const fb = FALLBACKS[character.id]?.[0] ?? "[neutral] Yeah, no.";
  return { ...parseLine(fb, maxChars), provider: "fallback" };
}

async function broadcast(args: {
  character: CharacterRow; text: string; emotion: ShowLine["emotion"]; kind: LineKind; provider: string;
  messageId?: string | null; chatMessageId?: string | null; addressedTo?: string | null; question?: string | null;
}) {
  const speech = await synthesize(args.text, args.character.voice_config);
  const dbKind = args.kind === "system" ? "banter" : args.kind;
  const stored = await q1(
    `insert into character_responses (message_id, chat_message_id, character_id, dialogue, emotion, kind, audio_url, visemes, duration_ms, llm_provider, tts_provider)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11) returning id`,
    [args.messageId ?? null, args.chatMessageId ?? null, args.character.id, args.text, args.emotion, dbKind, speech.audioUrl, JSON.stringify(speech.visemes), speech.durationMs, args.provider, speech.provider],
  );
  const line: ShowLine = {
    id: stored!.id, characterId: args.character.id, characterName: args.character.name, text: args.text, emotion: args.emotion,
    kind: args.kind, addressedTo: args.addressedTo ?? null, question: args.question ?? null, audioUrl: speech.audioUrl,
    visemes: speech.visemes, durationMs: speech.durationMs, startedAt: Date.now(), llmProvider: args.provider, ttsProvider: speech.provider,
  };
  showState.lastLine = line;
  emit({ type: "line", line });
  d.busyUntil = Date.now() + speech.durationMs + GAP_AFTER_LINE_MS;
}

async function answerNext(cast: CharacterRow[]) {
  const msg = await claimNextQuestion();
  if (!msg) return false;
  setStatus("answering", true);
  const ai = await getSetting("ai");
  const character = cast.find((c) => c.id === msg.character_id) ?? cast[0];
  const market = await getMarket();
  const history = (await q(
    `select m.content, r.dialogue from messages m join character_responses r on r.message_id=m.id
     where m.user_id=$1 and m.character_id=$2 and m.id<>$3 order by m.created_at desc limit 3`,
    [msg.user_id, character.id, msg.id])).map((h) => ({ q: h.content, a: h.dialogue }));

  const prompt = answerPrompt({
    username: msg.username, tierLabel: TIER_LABEL[msg.tier_snapshot] ?? msg.tier_snapshot, holdings: Number(msg.balance_snapshot),
    simulatedHoldings: config.mock, question: msg.content, market: marketContext(market), recentLines: await recentLines(), history, maxChars: ai.maxResponseChars,
  });
  const marketLine = market.priceUsd !== null ? `Price feed says ${formatPrice(market.priceUsd)}${market.status === "simulated" ? ", which is fake test data" : ""}.` : "And the price feed is down, so don't ask me for numbers.";
  const line = await produceLine(character, cast, prompt, "answer", { characterId: character.id, username: msg.username, question: msg.content, marketLine }, ai.maxResponseChars);

  await broadcast({ character, text: line.text, emotion: line.emotion, kind: "answer", provider: line.provider, messageId: msg.id, addressedTo: msg.username, question: msg.content });
  await q(`update messages set status='answered', answered_at=now() where id=$1`, [msg.id]);
  emit({ type: "queue", queue: await getQueue() });
  return true;
}

/** Whoever the message names first answers ("Jade, is Tanner..." goes to Jade). Otherwise anyone but the last speaker jumps in. */
export function characterForChat(content: string, cast: CharacterRow[], last: string | null) {
  const text = content.toLowerCase();
  let named: CharacterRow | null = null;
  let at = Infinity;
  for (const c of cast) {
    for (const w of c.name.toLowerCase().replace("professor ", "").split(" ")) {
      const i = w.length > 3 ? text.search(new RegExp(`\\b${w}\\b`)) : -1;
      if (i >= 0 && i < at) { at = i; named = c; }
    }
  }
  return named ?? pickSpeaker(cast, last);
}

/** Replies to the live chat. Higher tiers go first, and messages older than a few minutes are left alone. */
async function answerChat(cast: CharacterRow[], cooldownSeconds: number) {
  if (Date.now() - d.lastChatReplyAt < cooldownSeconds * 1000) return false;
  const msg = await q1(
    `select c.id, c.user_id, c.content, c.tier_snapshot, u.username from chat_messages c
     join users u on u.id = c.user_id
     left join investor_tiers t on t.name = c.tier_snapshot
     where c.hidden = false and c.replied_at is null and c.created_at > now() - interval '5 minutes'
       and u.status = 'active' and u.is_demo = false
     order by coalesce(t.sort_order, 0) desc, c.created_at asc limit 1`);
  if (!msg) return false;
  const claimed = await q1(`update chat_messages set replied_at = now() where id = $1 and replied_at is null returning id`, [msg.id]);
  if (!claimed) return false;

  d.lastChatReplyAt = Date.now();
  setStatus("answering", true);
  const ai = await getSetting("ai");
  const market = await getMarket();
  const character = characterForChat(msg.content, cast, showState.lastLine?.characterId ?? null);
  const prompt = answerPrompt({
    username: msg.username, tierLabel: TIER_LABEL[msg.tier_snapshot] ?? msg.tier_snapshot, holdings: await verifiedHoldings(msg.user_id),
    simulatedHoldings: config.mock, question: msg.content, market: marketContext(market), recentLines: await recentLines(), history: [], maxChars: Math.min(ai.maxResponseChars, 220),
  });
  const marketLine = market.priceUsd !== null ? `Price feed says ${formatPrice(market.priceUsd)}${market.status === "simulated" ? ", which is fake test data" : ""}.` : "And the price feed is down, so don't ask me for numbers.";
  const line = await produceLine(character, cast, prompt, "chat_reply", { characterId: character.id, username: msg.username, question: msg.content, marketLine }, Math.min(ai.maxResponseChars, 220));
  await broadcast({ character, text: line.text, emotion: line.emotion, kind: "answer", provider: line.provider, chatMessageId: msg.id, addressedTo: msg.username, question: msg.content });
  // Usually the other one piles on before the next message.
  if (cast.length > 1 && Math.random() < 0.7 && (!d.scene || d.scene.kind === "banter")) {
    const said = sanitizeUserText(msg.content, 160);
    d.scene = { topic: `Viewer ${msg.username} just said "${said}" and ${character.name} answered them. Jump in: pile on the viewer, or turn it on ${character.name}.`, remaining: 1, lastSpeaker: character.id, kind: "banter" };
  }
  return true;
}

function pickSpeaker(cast: CharacterRow[], last: string | null) {
  const pool = cast.filter((c) => c.id !== last);
  return pool[Math.floor(Math.random() * pool.length)] ?? cast[0];
}

async function replayCached(cast: CharacterRow[]) {
  const row = await q1(
    `select * from character_responses where kind='banter' and llm_provider<>'fallback' and created_at < now() - interval '1 hour' order by random() limit 1`);
  const character = row && cast.find((c) => c.id === row.character_id);
  if (!row || !character) return false;
  const line: ShowLine = {
    id: randomUUID(), characterId: character.id, characterName: character.name, text: row.dialogue, emotion: row.emotion, kind: "banter",
    audioUrl: row.audio_url, visemes: row.visemes ?? textToVisemes(row.dialogue, row.duration_ms), durationMs: row.duration_ms || estimateDurationMs(row.dialogue),
    startedAt: Date.now(), llmProvider: "rerun", ttsProvider: row.tts_provider,
  };
  showState.lastLine = line;
  emit({ type: "line", line });
  d.busyUntil = Date.now() + line.durationMs + GAP_AFTER_LINE_MS;
  return true;
}

async function nextBanterLine(cast: CharacterRow[]) {
  const ai = await getSetting("ai");
  const market = await getMarket();
  const scene = d.scene!;
  const character = pickSpeaker(cast, scene.lastSpeaker);
  const excerpts = config.mock
    ? await q(`select u.username, c.content from chat_messages c join users u on u.id=c.user_id where c.hidden=false order by c.created_at desc limit 4`)
    : await q(`select u.username, c.content from chat_messages c join users u on u.id=c.user_id where c.hidden=false and u.is_demo=false order by c.created_at desc limit 4`);
  const opening = scene.lastSpeaker === null;
  const prompt = banterPrompt({
    topic: scene.topic, market: marketContext(market), recentLines: await recentLines(),
    chatExcerpt: excerpts.map((e) => sanitizeUserText(`${e.username}: ${e.content}`, 160)), maxChars: Math.min(ai.maxResponseChars, 220), opening,
  });
  const line = await produceLine(character, cast, prompt, scene.kind, { characterId: character.id }, Math.min(ai.maxResponseChars, 220));
  await broadcast({ character, text: line.text, emotion: line.emotion, kind: scene.kind, provider: line.provider });
  scene.lastSpeaker = character.id;
  scene.remaining -= 1;
  if (scene.remaining <= 0) { d.scene = null; d.lastSceneEndedAt = Date.now(); }
}

async function maybeStartMarketScene(threshold: number) {
  const market = await getMarket();
  const price = market.priceUsd;
  if (price === null) return;
  const previous = d.lastPrice;
  d.lastPrice = price;
  if (previous === null || d.scene) return;
  const move = ((price - previous) / previous) * 100;
  if (Math.abs(move) >= threshold) {
    d.scene = { topic: `The token price just moved ${move.toFixed(1)}% and everyone at the bar is reacting. Quote only the supplied data.`, remaining: 2, lastSpeaker: null, kind: "market" };
  }
}

export async function tick() {
  if (d.ticking || Date.now() < d.busyUntil) return;
  d.ticking = true;
  try {
    if (Date.now() - d.lastExpiry > 60000) { d.lastExpiry = Date.now(); await expireOldQuestions(); }
    const show = await getSetting("show");
    if (!show.liveMode) { d.sessionStartedAt = null; d.scene = null; return setStatus("off", false, "Live mode is off"); }

    d.sessionStartedAt ??= Date.now();
    if (show.sessionMaxMinutes > 0 && Date.now() - d.sessionStartedAt > show.sessionMaxMinutes * 60000) {
      return setStatus("off", false, "Broadcast session reached its time limit");
    }

    const cast = await getActiveCharacters();
    if (!cast.length) return setStatus("off", false, "No active characters");

    const withinBudget = await llmBudgetLeft();
    if (withinBudget && (await answerNext(cast))) return;
    if (withinBudget && show.chatRepliesEnabled && (await answerChat(cast, show.chatReplyCooldownSeconds))) return;

    // No audience means no spend: the stage idles until someone is watching.
    if (show.pauseWhenNoViewers && showState.viewers === 0) return setStatus("paused_no_viewers", true);
    if (!withinBudget) {
      setStatus("budget_exhausted", true, "Daily AI budget reached: reruns only");
      if (show.banterEnabled && Date.now() - d.lastSceneEndedAt > show.banterIntervalSeconds * 1000) {
        d.lastSceneEndedAt = Date.now();
        await replayCached(cast);
      }
      return;
    }

    await maybeStartMarketScene(show.marketMoveThresholdPct);
    if (!d.scene && show.banterEnabled && Date.now() - d.lastSceneEndedAt > show.banterIntervalSeconds * 1000) {
      d.topicCursor = (d.topicCursor + 1) % BANTER_TOPICS.length;
      d.scene = { topic: BANTER_TOPICS[d.topicCursor], remaining: 3 + Math.floor(Math.random() * 2), lastSpeaker: null, kind: "banter" };
    }
    if (d.scene) {
      setStatus("banter", true);
      await nextBanterLine(cast);
    } else {
      setStatus("idle", true);
    }
  } catch (e) {
    log("error", "director.tick_failed", { message: (e as Error).message });
  } finally {
    d.ticking = false;
  }
}

export function startDirector() {
  if (!config.directorEnabled || d.timer) return;
  d.timer = setInterval(() => void tick(), 1000);
  d.timer.unref?.();
  log("info", "director.started", { mock: config.mock });
}

/** Test helper: run the next step immediately. */
export function resetDirectorForTests() {
  d.busyUntil = 0; d.scene = null; d.lastSceneEndedAt = 0; d.ticking = false; d.lastChatReplyAt = 0;
}
