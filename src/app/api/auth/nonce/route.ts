import { z } from "zod";
import { ApiError } from "@/lib/server/errors";
import { body, route } from "@/lib/server/http";
import { isValidSolanaAddress } from "@/lib/server/solana/address";
import { createSignChallenge } from "@/lib/server/solana/proof";

export const POST = route(async (req) => {
  const { address } = await body(req, z.object({ address: z.string() }));
  if (!isValidSolanaAddress(address)) throw new ApiError(400, "invalid_address", "That is not a valid Solana public address.");
  return createSignChallenge(address);
}, { limit: [10, 20] });
