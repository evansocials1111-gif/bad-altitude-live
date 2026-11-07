import { z } from "zod";
import { q } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import { body, route } from "@/lib/server/http";
import { moderateInput, sanitizeUserText } from "@/lib/server/moderation";
import { requireUser } from "@/lib/server/session";

const patch = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,20}$/, "Usernames are 3 to 20 letters, numbers or underscores.").optional(),
  bio: z.string().max(160).optional(),
  avatarSeed: z.string().max(40).optional(),
  hideWallet: z.boolean().optional(),
  hideFromLeaderboard: z.boolean().optional(),
});

export const GET = route(async () => {
  const user = await requireUser();
  const [questions, chats] = await Promise.all([
    q(`select m.id, m.content, m.status, m.character_id, m.tier_snapshot, m.created_at,
         (select r.dialogue from character_responses r where r.message_id=m.id limit 1) as response
       from messages m where m.user_id=$1 order by m.created_at desc limit 25`, [user.id]),
    q(`select id, content, created_at from chat_messages where user_id=$1 and hidden=false order by created_at desc limit 25`, [user.id]),
  ]);
  return { questions, chats };
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const p = await body(req, patch);
  if (p.username) {
    const check = moderateInput(p.username, 20);
    if (!check.allowed) throw new ApiError(422, "rejected", "Pick a different username.");
    const taken = await q(`select 1 from users where lower(username)=lower($1) and id<>$2`, [p.username, user.id]);
    if (taken.length) throw new ApiError(409, "taken", "That username is taken.");
  }
  await q(
    `update users set username=coalesce($2,username), bio=coalesce($3,bio), avatar_seed=coalesce($4,avatar_seed),
       hide_wallet=coalesce($5,hide_wallet), hide_from_leaderboard=coalesce($6,hide_from_leaderboard) where id=$1`,
    [user.id, p.username ?? null, p.bio === undefined ? null : sanitizeUserText(p.bio, 160), p.avatarSeed ?? null, p.hideWallet ?? null, p.hideFromLeaderboard ?? null],
  );
  return { ok: true };
}, { limit: [20, 20] });
