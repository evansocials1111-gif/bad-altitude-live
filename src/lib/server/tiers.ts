import { q } from "./db";
import type { TierName } from "../shared/types";

export type Tier = { name: TierName; label: string; min_holdings: number; max_holdings: number | null; priority_weight: number; cooldown_seconds: number; sort_order: number };

export async function getTiers() {
  const rows = await q<Tier>(`select * from investor_tiers order by sort_order`);
  return rows.map((t) => ({ ...t, min_holdings: Number(t.min_holdings), max_holdings: t.max_holdings === null ? null : Number(t.max_holdings), priority_weight: Number(t.priority_weight) }));
}

/** Highest tier whose minimum the balance meets. Unverified users always pass balance 0. */
export function tierForBalance(balance: number, tiers: Tier[]): Tier {
  const sorted = [...tiers].sort((a, b) => b.min_holdings - a.min_holdings);
  return sorted.find((t) => balance >= t.min_holdings) ?? sorted[sorted.length - 1];
}
