import { z } from "zod";
import { q } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import { body, route } from "@/lib/server/http";
import { config } from "@/lib/server/config";
import { requireRole } from "@/lib/server/session";

const patch = z.object({
  id: z.string().max(40), name: z.string().min(1).max(60).optional(), tagline: z.string().max(120).optional(), personality: z.string().min(1).max(4000).optional(),
  speaking_style: z.string().min(1).max(2000).optional(), humor: z.string().min(1).max(2000).optional(), behavior_rules: z.string().max(4000).optional(),
  voice_config: z.object({ elevenlabsVoiceId: z.string().max(64).nullable(), browserPitch: z.number().min(0).max(2), browserRate: z.number().min(0.1).max(3) }).optional(),
  active: z.boolean().optional(), license_status: z.enum(["original", "licensed"]).optional(),
});

export const GET = route(async () => {
  await requireRole("admin");
  return { characters: await q(`select * from characters order by sort_order`), licensedRosterEnabled: config.licensedRosterEnabled };
});

export const PATCH = route(async (req) => {
  await requireRole("admin");
  const b = await body(req, patch);
  if (b.license_status === "licensed" && !config.licensedRosterEnabled) {
    throw new ApiError(400, "license_required", "Licensed characters stay off until LICENSED_ROSTER_ENABLED is set for this deployment.");
  }
  await q(
    `update characters set name=coalesce($2,name), tagline=coalesce($3,tagline), personality=coalesce($4,personality), speaking_style=coalesce($5,speaking_style),
       humor=coalesce($6,humor), behavior_rules=coalesce($7,behavior_rules), voice_config=coalesce($8::jsonb,voice_config), active=coalesce($9,active), license_status=coalesce($10,license_status) where id=$1`,
    [b.id, b.name ?? null, b.tagline ?? null, b.personality ?? null, b.speaking_style ?? null, b.humor ?? null, b.behavior_rules ?? null, b.voice_config ? JSON.stringify(b.voice_config) : null, b.active ?? null, b.license_status ?? null],
  );
  return { ok: true };
});
