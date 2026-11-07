import { z } from "zod";
import { ApiError } from "@/lib/server/errors";
import { body, route } from "@/lib/server/http";
import { requireRole } from "@/lib/server/session";
import { getSetting, setSetting } from "@/lib/server/settings";
import { isValidSolanaAddress } from "@/lib/server/solana/address";

const schemas = {
  token: z.object({ mint: z.string().trim().nullable(), symbol: z.string().trim().max(12).nullable() }),
  priority: z.object({ balanceWeight: z.number().min(0).max(100), tierWeight: z.number().min(0).max(100), waitWeight: z.number().min(0).max(100), waitCapSeconds: z.number().min(10).max(86400), recentPenalty: z.number().min(0).max(1000), recentWindowSeconds: z.number().min(0).max(86400), maxPendingPerUser: z.number().int().min(1).max(20), duplicateWindowSeconds: z.number().min(0).max(604800) }),
  ai: z.object({ llmModel: z.string().trim().max(60).nullable(), ttsEnabled: z.boolean(), dailyLlmBudgetUsd: z.number().min(0).max(100000), dailyTtsBudgetUsd: z.number().min(0).max(100000), maxResponseChars: z.number().int().min(60).max(1000) }),
  show: z.object({ liveMode: z.boolean(), banterEnabled: z.boolean(), banterIntervalSeconds: z.number().min(5).max(86400), pauseWhenNoViewers: z.boolean(), marketMoveThresholdPct: z.number().min(0.1).max(100), sessionMaxMinutes: z.number().min(0).max(100000), chatRepliesEnabled: z.boolean(), chatReplyCooldownSeconds: z.number().min(0).max(3600) }),
  community: z.object({ guestChatEnabled: z.boolean(), guestQuestionsEnabled: z.boolean() }),
};

export const GET = route(async () => {
  await requireRole("admin");
  const [token, priority, ai, show, community] = await Promise.all([getSetting("token"), getSetting("priority"), getSetting("ai"), getSetting("show"), getSetting("community")]);
  return { token, priority, ai, show, community };
});

export const PATCH = route(async (req) => {
  const admin = await requireRole("admin");
  const { key, value } = await body(req, z.object({ key: z.enum(["token", "priority", "ai", "show", "community"]), value: z.unknown() }));
  const parsed = schemas[key].parse(value) as any;
  if (key === "token" && parsed.mint && !isValidSolanaAddress(parsed.mint)) throw new ApiError(400, "invalid_mint", "That mint is not a valid Solana address.");
  await setSetting(key, parsed, admin.id);
  return { ok: true };
});
