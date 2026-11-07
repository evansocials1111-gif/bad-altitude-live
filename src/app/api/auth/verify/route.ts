import { z } from "zod";
import { ApiError } from "@/lib/server/errors";
import { body, route } from "@/lib/server/http";
import { getSessionUser, startSession } from "@/lib/server/session";
import { isValidSolanaAddress } from "@/lib/server/solana/address";
import { consumeSignChallenge } from "@/lib/server/solana/proof";
import { markWalletVerified } from "@/lib/server/wallets";

const schema = z.object({ address: z.string(), nonce: z.string().max(64), signature: z.string().max(128), walletType: z.string().max(32).default("unknown") });

export const POST = route(async (req) => {
  const b = await body(req, schema);
  if (!isValidSolanaAddress(b.address)) throw new ApiError(400, "invalid_address", "Invalid address.");
  await consumeSignChallenge(b.address, b.nonce, b.signature);
  const current = await getSessionUser();
  const userId = await markWalletVerified({ address: b.address, method: "signed_message", walletType: b.walletType, currentUserId: current?.id ?? null });
  await startSession(userId);
  return { ok: true, state: "ownership_verified" };
}, { limit: [10, 20] });
