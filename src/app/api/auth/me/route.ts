import { route } from "@/lib/server/http";
import { getSessionUser } from "@/lib/server/session";
import { leaderboardRank, listUserWallets, refreshUserBalances, userTier } from "@/lib/server/wallets";
import { getEffectiveMint } from "@/lib/server/settings";
import { config } from "@/lib/server/config";
import { depositAddress } from "@/lib/server/solana/proof";

export const GET = route(async () => {
  const meta = { mock: config.mock, mintConfigured: Boolean(await getEffectiveMint()), transferProofAvailable: Boolean(depositAddress()) };
  const user = await getSessionUser();
  if (!user) return { user: null, ...meta };
  await refreshUserBalances(user.id, 300);
  const [wallets, { balance, tier }, rank] = await Promise.all([listUserWallets(user.id), userTier(user.id), leaderboardRank(user.id)]);
  return {
    user: { id: user.id, username: user.username, role: user.role, status: user.status, avatarSeed: user.avatar_seed, bio: user.bio, hideWallet: user.hide_wallet, hideFromLeaderboard: user.hide_from_leaderboard, createdAt: user.created_at },
    wallets, balance, tier: tier.name, rank, ...meta,
  };
});
