import { config } from "@/lib/server/config";
import { q, q1 } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import { route } from "@/lib/server/http";
import { startSession } from "@/lib/server/session";

/** Mock mode only (never production): lets you open the admin dashboard without an allow-listed wallet. */
export const POST = route(async () => {
  if (!config.mock) throw new ApiError(404, "not_found", "Not found.");
  let row = await q1(`select id from users where username='dev_admin'`);
  if (!row) row = await q1(`insert into users (username, role, is_demo) values ('dev_admin','admin',true) returning id`);
  await q(`update users set role='admin' where id=$1`, [row!.id]);
  await startSession(row!.id);
  return { ok: true };
}, { limit: [10, 10] });
