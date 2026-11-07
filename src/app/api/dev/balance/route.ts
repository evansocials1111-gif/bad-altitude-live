import { z } from "zod";
import { config } from "@/lib/server/config";
import { ApiError } from "@/lib/server/errors";
import { body, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { getEffectiveMint } from "@/lib/server/settings";
import { saveHolding } from "@/lib/server/solana/balance";
import { q1 } from "@/lib/server/db";

/** Mock mode only: sets the simulated balance on a wallet you have already verified. */
export const POST = route(async (req) => {
  if (!config.mock) throw new ApiError(404, "not_found", "Not found.");
  const user = await requireUser();
  const b = await body(req, z.object({ address: z.string(), amount: z.number().min(0).max(1e12) }));
  const owned = await q1(`select 1 as ok from wallets where user_id=$1 and address=$2`, [user.id, b.address]);
  if (!owned) throw new ApiError(403, "forbidden", "Not your wallet.");
  await saveHolding(b.address, (await getEffectiveMint())!, { rawAmount: String(BigInt(Math.round(b.amount)) * 1000000n), decimals: 6, normalized: b.amount, tokenAccountCount: b.amount ? 1 : 0, source: "simulated" });
  return { ok: true };
});
