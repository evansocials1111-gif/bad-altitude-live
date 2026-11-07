import { z } from "zod";
import { body, route } from "@/lib/server/http";
import { getQueue, MAX_QUESTION_CHARS, submitQuestion } from "@/lib/server/queue";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

// Only these two fields are read. Any balance or tier in the request body is dropped by the schema.
const schema = z.object({ characterId: z.string().max(40), content: z.string().min(1).max(MAX_QUESTION_CHARS * 2) });

export const GET = route(async () => ({ queue: await getQueue() }));

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`ask:${user.id}`, 4, 6);
  const b = await body(req, schema);
  return submitQuestion(user, b.characterId, b.content);
}, { limit: [20, 30] });
