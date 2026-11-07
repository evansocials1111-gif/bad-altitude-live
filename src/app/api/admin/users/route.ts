import { z } from "zod";
import { q } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import { body, route } from "@/lib/server/http";
import { requireRole } from "@/lib/server/session";
import { getEffectiveMint } from "@/lib/server/settings";

export const GET = route(async () => {
  await requireRole("admin", "moderator");
  const mint = await getEffectiveMint();
  const users = await q(
    `select u.id, u.username, u.role, u.status, u.is_demo, u.created_at, u.last_seen_at,
       coalesce((select sum(b.normalized_balance) from wallets w join token_balances b on b.address=w.address and b.mint=$1
         where w.user_id=u.id and w.verification_status='ownership_verified'),0) as holdings,
       coalesce((select json_agg(json_build_object('address',w.address,'status',w.verification_status,'method',w.verification_method,'type',w.wallet_type)) from wallets w where w.user_id=u.id),'[]') as wallets
     from users u order by holdings desc, u.created_at desc limit 200`, [mint]);
  return { users };
});

export const PATCH = route(async (req) => {
  const me = await requireRole("admin", "moderator");
  const b = await body(req, z.object({ id: z.string().uuid(), status: z.enum(["active", "muted", "banned"]).optional(), role: z.enum(["user", "moderator", "admin"]).optional() }));
  if (b.role && me.role !== "admin") throw new ApiError(403, "forbidden", "Only admins change roles.");
  if (b.id === me.id && (b.role || b.status)) throw new ApiError(400, "self_change", "You can't change your own access.");
  await q(`update users set status=coalesce($2,status), role=coalesce($3,role) where id=$1`, [b.id, b.status ?? null, b.role ?? null]);
  return { ok: true };
});
