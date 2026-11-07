import { q } from "@/lib/server/db";
import { route } from "@/lib/server/http";
import { getEffectiveMint } from "@/lib/server/settings";
import { getTiers, tierForBalance } from "@/lib/server/tiers";
import { maskAddress } from "@/lib/shared/format";
import { config } from "@/lib/server/config";

export const GET = route(async () => {
  const mint = await getEffectiveMint();
  if (!mint) return { entries: [], reason: "No token mint configured.", simulated: false };
  const [rows, tiers] = await Promise.all([
    q(`select l.*,
         (select count(*)::int from messages m where m.user_id=l.user_id and m.created_at > now() - interval '7 days') as questions_7d,
         (select max(m.created_at) from messages m where m.user_id=l.user_id) as last_question
       from leaderboard l where l.mint=$1 and l.verified_holdings > 0 and ($2 or l.is_demo=false)
       order by l.verified_holdings desc limit 100`, [mint, config.mock]),
    getTiers(),
  ]);
  return {
    simulated: config.mock,
    entries: rows.map((r, i) => ({
      rank: i + 1, username: r.username, avatarSeed: r.avatar_seed, holdings: Number(r.verified_holdings),
      tier: tierForBalance(Number(r.verified_holdings), tiers).name, walletCount: Number(r.wallet_count),
      // Only ever a masked address, and only when the holder allows it.
      address: r.hide_wallet ? null : maskAddress(r.primary_address),
      questions7d: r.questions_7d, lastActive: r.last_question ?? r.last_seen_at, isDemo: r.is_demo,
    })),
  };
});
