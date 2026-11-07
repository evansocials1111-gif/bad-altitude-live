import { z } from "zod";
import { ApiError } from "@/lib/server/errors";
import { body, route } from "@/lib/server/http";
import { getSessionUser, startSession } from "@/lib/server/session";
import { isValidSolanaAddress } from "@/lib/server/solana/address";
import { checkTransferChallenge } from "@/lib/server/solana/proof";
import { markWalletVerified } from "@/lib/server/wallets";

const schema = z.object({ address: z.string(), challengeId: z.string().max(64), walletType: z.string().max(32).default("trading"), simulate: z.boolean().default(false) });

export const POST = route(async (req) => {
  const b = await body(req, schema);
  if (!isValidSolanaAddress(b.address)) throw new ApiError(400, "invalid_address", "Invalid address.");
  const found = await checkTransferChallenge(b.address, b.challengeId, b.simulate);
  if (!found) return { verified: false, state: "ownership_not_verified" };
  const current = await getSessionUser();
  const userId = await markWalletVerified({ address: b.address, method: "transfer_proof", walletType: b.walletType, currentUserId: current?.id ?? null });
  await startSession(userId);
  return { verified: true, state: "ownership_verified" };
}, { limit: [10, 10] });
