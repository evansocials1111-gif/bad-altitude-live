import { z } from "zod";
import { ApiError } from "@/lib/server/errors";
import { body, route } from "@/lib/server/http";
import { log } from "@/lib/server/log";
import { getSessionUser, startSession } from "@/lib/server/session";
import { isValidSolanaAddress } from "@/lib/server/solana/address";
import { createUser, lookupAddress, trackUnverifiedWallet } from "@/lib/server/wallets";

const schema = z.object({ address: z.string().trim(), walletType: z.string().max(32).default("trading"), track: z.boolean().default(true) });

/** Read-only chain lookup. It can track an address on a profile, but nothing here confers tier, priority or rank. */
export const POST = route(async (req) => {
  const b = await body(req, schema);
  if (!isValidSolanaAddress(b.address)) throw new ApiError(400, "invalid_address", "That is not a valid Solana public address. Paste the public address only, never a private key.");
  let result;
  try {
    result = await lookupAddress(b.address);
  } catch (e) {
    log("warn", "lookup.failed", { message: (e as Error).message });
    throw new ApiError(502, "chain_unavailable", "Could not reach Solana right now, so no balance is shown. Try again shortly.");
  }
  if (b.track) {
    let user = await getSessionUser();
    let userId = user?.id;
    if (!userId) { userId = await createUser(); await startSession(userId); }
    await trackUnverifiedWallet(userId, b.address, b.walletType);
  }
  return result;
}, { limit: [10, 15] });
