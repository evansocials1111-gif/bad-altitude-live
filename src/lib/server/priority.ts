import type { PrioritySettings } from "./settings";

export type PriorityInput = { balance: number; tierWeight: number; waitSeconds: number; recentResponses: number };

/**
 * Weighted score, not a sort by balance:
 *  - balance counts on a log scale, so 10x the tokens is a steady step and not 10x the attention
 *  - tier adds a configurable step
 *  - waiting time rises until a cap, which is what stops small holders starving
 *  - each recent answer to the same user subtracts, which spreads the characters' attention around
 */
export function priorityScore(i: PriorityInput, s: PrioritySettings) {
  const balance = s.balanceWeight * Math.log10(1 + Math.max(0, i.balance));
  const tier = s.tierWeight * i.tierWeight;
  const wait = s.waitWeight * (Math.min(Math.max(0, i.waitSeconds), s.waitCapSeconds) / 10);
  const penalty = s.recentPenalty * i.recentResponses;
  return Math.round((balance + tier + wait - penalty) * 100) / 100;
}
