import bs58 from "bs58";

/** A Solana public key is exactly 32 bytes of base58. Rejects everything else, including private keys. */
export function isValidSolanaAddress(input: string) {
  if (typeof input !== "string" || input.length < 32 || input.length > 44) return false;
  try {
    return bs58.decode(input).length === 32;
  } catch {
    return false;
  }
}
