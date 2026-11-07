import { z } from "zod";
import { config } from "@/lib/server/config";
import { q, q1 } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import { body, route } from "@/lib/server/http";
import { moderateInput, recordModeration } from "@/lib/server/moderation";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";
import { getSetting } from "@/lib/server/settings";
import { emit } from "@/lib/server/show/bus";
import { userTier } from "@/lib/server/wallets";
import type { ChatItem, ShowLine } from "@/lib/shared/types";

export const GET = route(async () => {
  const rows = await q(
    `select c.id, c.content, c.created_at, c.tier_snapshot, u.username, u.avatar_seed from chat_messages c join users u on u.id=c.user_id
     where c.hidden=false and u.status<>'banned' and ($1 or u.is_demo=false) order by c.created_at desc limit 60`, [config.mock]);
  const messages: ChatItem[] = rows.reverse().map((r) => ({ id: r.id, username: r.username, avatarSeed: r.avatar_seed, tier: r.tier_snapshot, content: r.content, createdAt: new Date(r.created_at).toISOString() }));
  const lineRows = await q(
    `select r.id, r.character_id, ch.name, r.dialogue, r.emotion, r.kind, r.created_at, r.duration_ms, r.llm_provider, r.tts_provider,
            coalesce(mu.username, cu.username) as addressed, coalesce(m.content, cm.content) as question
     from character_responses r join characters ch on ch.id = r.character_id
     left join messages m on m.id = r.message_id left join users mu on mu.id = m.user_id
     left join chat_messages cm on cm.id = r.chat_message_id left join users cu on cu.id = cm.user_id
     where cm.hidden is not true and ch.active = true
     order by r.created_at desc limit 40`);
  const lines: ShowLine[] = lineRows.reverse().map((r) => ({
    id: r.id, characterId: r.character_id, characterName: r.name, text: r.dialogue, emotion: r.emotion, kind: r.kind,
    addressedTo: r.addressed, question: r.question, audioUrl: null, visemes: [], durationMs: r.duration_ms,
    startedAt: new Date(r.created_at).getTime(), llmProvider: r.llm_provider, ttsProvider: r.tts_provider,
  }));
  return { messages, lines };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  if (user.status !== "active") throw new ApiError(403, "muted", "You are muted.");
  rateLimit(`chat:${user.id}`, 5, 12);
  const { content } = await body(req, z.object({ content: z.string().min(1).max(600) }));
  const mod = moderateInput(content, 400);
  if (!mod.allowed) {
    await recordModeration(user.id, "chat", mod.category, content);
    throw new ApiError(422, "rejected", mod.message);
  }
  const { tier } = await userTier(user.id);
  const community = await getSetting("community");
  if (tier.name === "visitor" && !community.guestChatEnabled) throw new ApiError(403, "holders_only", "Chat is for verified holders right now.");
  const last = await q1(`select content from chat_messages where user_id=$1 order by created_at desc limit 1`, [user.id]);
  if (last?.content === mod.clean) throw new ApiError(409, "duplicate", "You just said that.");
  const row = await q1(`insert into chat_messages (user_id, content, tier_snapshot) values ($1,$2,$3) returning id, created_at`, [user.id, mod.clean, tier.name]);
  const message: ChatItem = { id: row!.id, username: user.username, avatarSeed: user.avatar_seed, tier: tier.name, content: mod.clean, createdAt: new Date(row!.created_at).toISOString() };
  emit({ type: "chat", message });
  return { message };
}, { limit: [30, 60] });
