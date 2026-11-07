import { randomBytes, randomInt } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { config } from "../config";
import { q, q1 } from "../db";
import { ApiError } from "../errors";
import { rpc } from "./rpc";

const SIGN_TTL_MS = 5 * 60 * 1000;
const TRANSFER_TTL_MS = 30 * 60 * 1000;

export function buildSignInMessage(domain: string, address: string, nonce: string, issuedAt: string, expiresAt: string) {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    address,
    "",
    "Sign this message to prove you control this wallet. It costs nothing, sends no transaction and grants no spending permission.",
    "",
    `URI: https://${domain}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
  ].join("\n");
}

export async function createSignChallenge(address: string) {
  const nonce = randomBytes(16).toString("hex");
  const issued = new Date();
  const expires = new Date(issued.getTime() + SIGN_TTL_MS);
  const domain = new URL(config.appUrl).host;
  const message = buildSignInMessage(domain, address, nonce, issued.toISOString(), expires.toISOString());
  await q(`insert into auth_challenges (address, kind, nonce, message, expires_at) values ($1,'signed_message',$2,$3,$4)`,
    [address, nonce, message, expires.toISOString()]);
  return { nonce, message };
}

export function verifyDetachedSignature(message: string, signatureB58: string, address: string) {
  try {
    const sig = bs58.decode(signatureB58);
    const key = bs58.decode(address);
    if (sig.length !== 64 || key.length !== 32) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, key);
  } catch {
    return false;
  }
}

/** Atomic single-use consumption: a replayed nonce matches zero rows. */
export async function consumeSignChallenge(address: string, nonce: string, signature: string) {
  const challenge = await q1(
    `select id, message from auth_challenges
     where address=$1 and nonce=$2 and kind='signed_message' and consumed_at is null and expires_at > now()`,
    [address, nonce],
  );
  if (!challenge) throw new ApiError(400, "invalid_nonce", "That sign-in challenge expired or was already used. Try again.");
  if (!verifyDetachedSignature(challenge.message, signature, address)) {
    throw new ApiError(401, "bad_signature", "That signature does not match this wallet.");
  }
  const consumed = await q(`update auth_challenges set consumed_at=now() where id=$1 and consumed_at is null returning id`, [challenge.id]);
  if (!consumed.length) throw new ApiError(400, "invalid_nonce", "That challenge was already used.");
}

export function depositAddress() {
  return config.verificationDepositAddress ?? (config.mock ? "SimuLatedDeposit111111111111111111111111111" : null);
}

export async function createTransferChallenge(address: string) {
  const deposit = depositAddress();
  if (!deposit) throw new ApiError(503, "transfer_proof_unavailable", "Transfer verification is not configured on this deployment.");
  // Dust amount, unique enough that only someone who read this challenge can match it.
  const lamports = randomInt(1000, 100000);
  const expires = new Date(Date.now() + TRANSFER_TTL_MS);
  const nonce = randomBytes(16).toString("hex");
  await q(`insert into auth_challenges (address, kind, nonce, lamports, expires_at) values ($1,'transfer_proof',$2,$3,$4)`,
    [address, nonce, lamports, expires.toISOString()]);
  return { challengeId: nonce, lamports, sol: lamports / 1e9, depositAddress: deposit, expiresAt: expires.toISOString() };
}

/** True when a parsed transaction contains a system transfer of exactly `lamports` from `from` to `to`. */
export function txContainsTransfer(tx: any, from: string, to: string, lamports: number) {
  if (!tx || tx.meta?.err) return false;
  const signers: string[] = (tx.transaction?.message?.accountKeys ?? [])
    .filter((k: any) => k.signer).map((k: any) => k.pubkey);
  if (!signers.includes(from)) return false;
  const top = tx.transaction?.message?.instructions ?? [];
  const inner = (tx.meta?.innerInstructions ?? []).flatMap((i: any) => i.instructions);
  return [...top, ...inner].some((ix: any) =>
    ix?.program === "system" && ix?.parsed?.type === "transfer" &&
    ix.parsed.info?.source === from && ix.parsed.info?.destination === to &&
    Number(ix.parsed.info?.lamports) === lamports,
  );
}

export async function checkTransferChallenge(address: string, challengeId: string, simulate: boolean) {
  const challenge = await q1(
    `select id, lamports, created_at from auth_challenges
     where address=$1 and nonce=$2 and kind='transfer_proof' and consumed_at is null and expires_at > now()`,
    [address, challengeId],
  );
  if (!challenge) throw new ApiError(400, "invalid_challenge", "That transfer challenge expired or was already used.");

  let found = false;
  if (config.mock) {
    found = simulate; // Dev button stands in for the on-chain transfer.
  } else {
    const deposit = depositAddress()!;
    const since = Math.floor(new Date(challenge.created_at).getTime() / 1000);
    const sigs = await rpc<any[]>("getSignaturesForAddress", [deposit, { limit: 50, commitment: "confirmed" }]);
    for (const s of sigs) {
      if (s.err || (s.blockTime && s.blockTime < since)) continue;
      const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
      if (txContainsTransfer(tx, address, deposit, Number(challenge.lamports))) { found = true; break; }
    }
  }
  if (!found) return false;
  const consumed = await q(`update auth_challenges set consumed_at=now() where id=$1 and consumed_at is null returning id`, [challenge.id]);
  return consumed.length > 0;
}
