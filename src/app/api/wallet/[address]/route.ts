import { q } from "@/lib/server/db";
import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const DELETE = route<{ params: Promise<{ address: string }> }>(async (_req, ctx) => {
  const user = await requireUser();
  const { address } = await ctx.params;
  await q(`delete from wallets where user_id=$1 and address=$2`, [user.id, address]);
  return { ok: true };
});
