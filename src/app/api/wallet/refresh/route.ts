import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { refreshUserBalances, userTier } from "@/lib/server/wallets";

export const POST = route(async () => {
  const user = await requireUser();
  await refreshUserBalances(user.id, 15);
  const { balance, tier } = await userTier(user.id);
  return { balance, tier: tier.name };
}, { limit: [5, 6] });
