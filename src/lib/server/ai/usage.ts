import { q, q1 } from "../db";
import { getSetting } from "../settings";

export async function recordUsage(u: { kind: "llm" | "tts"; provider: string; model?: string; purpose?: string; input: number; output: number; costUsd: number }) {
  await q(
    `insert into ai_usage (kind, provider, model, purpose, input_units, output_units, estimated_cost_usd) values ($1,$2,$3,$4,$5,$6,$7)`,
    [u.kind, u.provider, u.model ?? null, u.purpose ?? null, u.input, u.output, u.costUsd],
  );
}

export async function spendToday(kind: "llm" | "tts") {
  const r = await q1(`select coalesce(sum(estimated_cost_usd),0) as total from ai_usage where kind=$1 and created_at > date_trunc('day', now())`, [kind]);
  return Number(r?.total ?? 0);
}

export async function llmBudgetLeft() {
  const s = await getSetting("ai");
  return (await spendToday("llm")) < s.dailyLlmBudgetUsd;
}

export async function ttsBudgetLeft() {
  const s = await getSetting("ai");
  return (await spendToday("tts")) < s.dailyTtsBudgetUsd;
}
