import { z } from "zod";
import { q } from "@/lib/server/db";
import { body, route } from "@/lib/server/http";
import { getQueue } from "@/lib/server/queue";
import { requireRole } from "@/lib/server/session";
import { emit } from "@/lib/server/show/bus";

export const GET = route(async () => {
  await requireRole("admin", "moderator");
  const [questions, chat] = await Promise.all([
    q(`select m.id, u.username, m.user_id, m.character_id, m.content, m.status, m.tier_snapshot, m.priority_score, m.balance_snapshot, m.created_at,
         (select r.dialogue from character_responses r where r.message_id=m.id limit 1) as response
       from messages m join users u on u.id=m.user_id order by m.created_at desc limit 100`),
    q(`select c.id, u.username, c.user_id, c.content, c.hidden, c.created_at from chat_messages c join users u on u.id=c.user_id order by c.created_at desc limit 100`),
  ]);
  return { questions, chat };
});

export const PATCH = route(async (req) => {
  const me = await requireRole("admin", "moderator");
  const b = await body(req, z.object({ kind: z.enum(["question", "chat"]), id: z.string().uuid(), action: z.enum(["reject", "hide", "unhide"]) }));
  if (b.kind === "question") {
    await q(`update messages set status='rejected', rejection_reason=$2 where id=$1 and status='queued'`, [b.id, `Moderator ${me.username}`]);
    emit({ type: "queue", queue: await getQueue() });
  } else {
    const hidden = b.action === "hide";
    await q(`update chat_messages set hidden=$2 where id=$1`, [b.id, hidden]);
    if (hidden) emit({ type: "chat_removed", id: b.id });
  }
  return { ok: true };
});
