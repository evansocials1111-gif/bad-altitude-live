import { q, q1 } from "./db";
import { config } from "./config";

export type PrioritySettings = {
  balanceWeight: number; tierWeight: number; waitWeight: number; waitCapSeconds: number;
  recentPenalty: number; recentWindowSeconds: number; maxPendingPerUser: number; duplicateWindowSeconds: number;
};
export type AiSettings = { llmModel: string | null; ttsEnabled: boolean; dailyLlmBudgetUsd: number; dailyTtsBudgetUsd: number; maxResponseChars: number };
export type ShowSettings = { liveMode: boolean; banterEnabled: boolean; banterIntervalSeconds: number; pauseWhenNoViewers: boolean; marketMoveThresholdPct: number; sessionMaxMinutes: number; chatRepliesEnabled: boolean; chatReplyCooldownSeconds: number };
export type TokenSettings = { mint: string | null; symbol: string | null };
export type CommunitySettings = { guestChatEnabled: boolean; guestQuestionsEnabled: boolean };

type SettingsMap = { priority: PrioritySettings; ai: AiSettings; show: ShowSettings; token: TokenSettings; community: CommunitySettings };

export async function getSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> {
  const row = await q1(`select value from admin_settings where key = $1`, [key]);
  return (row?.value ?? {}) as SettingsMap[K];
}

export async function setSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K], by: string | null) {
  await q(
    `insert into admin_settings (key, value, updated_by, updated_at) values ($1, $2::jsonb, $3, now())
     on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), by],
  );
}

/** Admin dashboard value wins over env. Returns null when no mint is configured anywhere. */
export async function getTokenConfig() {
  const s = await getSetting("token");
  return { mint: s.mint || config.tokenMint, symbol: s.symbol || config.tokenSymbol };
}

export const SIMULATED_MINT = "SimuLatedMint1111111111111111111111111111111";

/** The mint balances are keyed on. In mock mode with no mint, a clearly fake placeholder. */
export async function getEffectiveMint() {
  const { mint } = await getTokenConfig();
  return mint ?? (config.mock ? SIMULATED_MINT : null);
}
