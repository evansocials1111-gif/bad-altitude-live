import { createHash } from "node:crypto";
import { q, q1, type Row } from "./db";
import { emit } from "./show/bus";
import { ApiError } from "./errors";
import { moderateInput, recordModeration } from "./moderation";
import { priorityScore } from "./priority";
import { getSetting } from "./settings";
import { getTiers, tierForBalance } from "./tiers";
import { refreshUserBalances, verifiedHoldings } from "./wallets";
import type { QueueItem } from "../shared/types";
import type { SessionUser } from "./session";

export const MAX_QUESTION_CHARS = 280;

function hashContent(text: string) {
  return createHash("sha256").update(text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).digest("hex");
}

/** Every number here is read from the database or chain. Nothing about priority comes from the request. */
export async function submitQuestion(user: SessionUser, characterId: string, rawText: string) {
  if (user.status !== "active") throw new ApiError(403, "muted", "You are muted.");

  const moderation = moderateInput(rawText, MAX_QUESTION_CHARS);
  if (!moderation.allowed) {
    await recordModeration(user.id, "question", moderation.category, rawText);
    throw new ApiError(422, "rejected", moderation.message);
  }
  if (moderation.injectionSuspected) await recordModeration(user.id, "question", "prompt_injection_attempt", moderation.clean);

  const character = await q1(`select id from characters where id=$1 and active=true`, [characterId]);
  if (!character) throw new ApiError(404, "unknown_character", "That character is not on the show.");

  await refreshUserBalances(user.id, 60);
  const [balance, tiers, settings, community] = await Promise.all([verifiedHoldings(user.id), getTiers(), getSetting("priority"), getSetting("community")]);
  const tier = tierForBalance(balance, tiers);
  if (tier.name === "visitor" && !community.guestQuestionsEnabled) {
    throw new ApiError(403, "holders_only", "Questions are for verified holders right now.");
  }

  const last = await q1(
    `select extract(epoch from (now() - created_at)) as age from messages
     where user_id=$1 and status <> 'rejected' order by created_at desc limit 1`, [user.id]);
  if (last && Number(last.age) < tier.cooldown_seconds) {
    const retry = Math.ceil(tier.cooldown_seconds - Number(last.age));
    throw new ApiError(429, "cooldown", `Cooldown: ${retry}s until your next question.`, { retryAfter: retry });
  }

  const pending = await q1(`select count(*)::int as n from messages where user_id=$1 and status='queued'`, [user.id]);
  if ((pending?.n ?? 0) >= settings.maxPendingPerUser) {
    throw new ApiError(429, "too_many_pending", "You already have questions waiting.");
  }

  const hash = hashContent(moderation.clean);
  const dupe = await q1(
    `select id from messages where user_id=$1 and content_hash=$2 and created_at > now() - ($3 || ' seconds')::interval limit 1`,
    [user.id, hash, String(settings.duplicateWindowSeconds)]);
  if (dupe) throw new ApiError(409, "duplicate", "You already asked that.");

  const recent = await recentResponseCount(user.id, settings.recentWindowSeconds);
  const score = priorityScore({ balance, tierWeight: tier.priority_weight, waitSeconds: 0, recentResponses: recent }, settings);
  const row = await q1(
    `insert into messages (user_id, character_id, content, content_hash, balance_snapshot, tier_snapshot, priority_score)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [user.id, characterId, moderation.clean, hash, balance, tier.name, score]);

  const queue = await getQueue();
  emit({ type: "queue", queue });
  return { id: row!.id as string, tier: tier.name, position: queue.find((i) => i.id === row!.id)?.position ?? null };
}

async function recentResponseCount(userId: string, windowSeconds: number) {
  const r = await q1(
    `select count(*)::int as n from messages where user_id=$1 and status='answered'
     and answered_at > now() - ($2 || ' seconds')::interval`, [userId, String(windowSeconds)]);
  return r?.n ?? 0;
}

/** Scores change as people wait, so ranking is recomputed on demand rather than stored once. */
export async function rankedQueue() {
  const [settings, rows, tiers] = await Promise.all([
    getSetting("priority"),
    q(`select m.id, m.user_id, m.character_id, m.content, m.status, m.created_at, m.balance_snapshot, m.tier_snapshot,
              u.username, extract(epoch from (now() - m.created_at)) as wait_seconds,
              (select count(*)::int from messages a where a.user_id=m.user_id and a.status='answered'
                and a.answered_at > now() - ($1 || ' seconds')::interval) as recent
       from messages m join users u on u.id=m.user_id where m.status='queued'`,
      [String((await getSetting("priority")).recentWindowSeconds)]),
    getTiers(),
  ]);
  const weight = new Map(tiers.map((t) => [t.name as string, t.priority_weight]));
  return rows
    .map((r) => ({
      ...(r as Row),
      score: priorityScore({ balance: Number(r.balance_snapshot), tierWeight: weight.get(r.tier_snapshot) ?? 0, waitSeconds: Number(r.wait_seconds), recentResponses: r.recent }, settings),
    }))
    .sort((a, b) => b.score - a.score) as (Row & { score: number })[];
}

export async function getQueue(): Promise<QueueItem[]> {
  const ranked = await rankedQueue();
  const recent = await q(
    `select m.id, m.character_id, m.content, m.status, m.created_at, m.tier_snapshot, u.username,
            (select r.dialogue from character_responses r where r.message_id=m.id order by r.created_at limit 1) as response
     from messages m join users u on u.id=m.user_id
     where m.status in ('generating','answered') order by coalesce(m.answered_at, now()) desc limit 12`);
  const toItem = (r: any, position: number | null): QueueItem => ({
    id: r.id, position, username: r.username, tier: r.tier_snapshot, characterId: r.character_id,
    content: r.content, status: r.status, createdAt: new Date(r.created_at).toISOString(), response: r.response ?? null,
  });
  return [...ranked.slice(0, 30).map((r, i) => toItem(r, i + 1)), ...recent.map((r) => toItem(r, null))];
}

/** Takes the highest scoring question. The conditional update means two claimers can't take the same one. */
export async function claimNextQuestion() {
  const [top] = await rankedQueue();
  if (!top) return null;
  await refreshUserBalances(top.user_id, 300); // Selling after asking should not keep whale priority.
  const claimed = await q1(
    `update messages set status='generating', priority_score=$2 where id=$1 and status='queued' returning id`, [top.id, top.score]);
  return claimed ? top : null;
}

export async function expireOldQuestions() {
  await q(`update messages set status='expired' where status='queued' and created_at < now() - interval '6 hours'`);
}
