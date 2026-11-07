import { route } from "@/lib/server/http";
import { getSessionUser, startSession } from "@/lib/server/session";
import { createUser } from "@/lib/server/wallets";

export const POST = route(async () => {
  const existing = await getSessionUser();
  if (existing) return { ok: true };
  await startSession(await createUser());
  return { ok: true };
}, { limit: [5, 5] });
