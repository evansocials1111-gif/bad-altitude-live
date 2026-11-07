import { z } from "zod";
import { q } from "@/lib/server/db";
import { body, route } from "@/lib/server/http";
import { requireRole } from "@/lib/server/session";
import { getTiers } from "@/lib/server/tiers";

const schema = z.object({ tiers: z.array(z.object({ name: z.enum(["visitor", "supporter", "investor", "vip", "whale"]), min_holdings: z.number().min(0), priority_weight: z.number().min(0).max(1000), cooldown_seconds: z.number().int().min(0).max(86400) })).length(5) });

/** Public: the tier ladder is part of the product. Editing requires admin. */
export const GET = route(async () => ({ tiers: await getTiers() }));

export const PUT = route(async (req) => {
  await requireRole("admin");
  const { tiers } = await body(req, schema);
  const sorted = [...tiers].sort((a, b) => a.min_holdings - b.min_holdings);
  for (let i = 0; i < sorted.length; i++) {
    await q(`update investor_tiers set min_holdings=$2, max_holdings=$3, priority_weight=$4, cooldown_seconds=$5, sort_order=$6 where name=$1`,
      [sorted[i].name, sorted[i].min_holdings, sorted[i + 1]?.min_holdings ?? null, sorted[i].priority_weight, sorted[i].cooldown_seconds, i]);
  }
  return { ok: true };
});
