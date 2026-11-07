import { randomBytes } from "node:crypto";
import { config } from "./config";
import { q, q1 } from "./db";
import { log } from "./log";
import { getEffectiveMint } from "./settings";
import { refreshHolding } from "./solana/balance";
import { getTiers, tierForBalance } from "./tiers";
import type { OwnershipState } from "../shared/types";

export function randomUsername() {
  const a = ["Frozen", "Salty", "Numb", "Feral", "Lost", "Icy", "Doomed", "Sleepy", "Rusty", "Sober"];
  const b = ["Yeti", "Goat", "Skier", "Moose", "Plow", "Marmot", "Local", "Tourist", "Elk", "Gondola"];
  const r = randomBytes(3);
  return `${a[r[0] % a.length]}${b[r[1] % b.length]}${1000 + (r[2] * 37) % 9000}`;
}

export async function createUser(role: "user" | "admin" = "user", username?: string) {
  const row = await q1(`insert into users (username, role) values ($1, $2) returning id`, [username ?? randomUsername(), role]);
  return row!.id as string;
}

/** Sum over the user's VERIFIED wallets only, with each address counted once. */
export async function verifiedHoldings(userId: string) {
  const mint = await getEffectiveMint();
  if (!mint) return 0;
  const row = await q1(
    `select coalesce(sum(b.normalized_balance),0) as total from wallets w
     join token_balances b on b.address=w.address and b.mint=$2
     where w.user_id=$1 and w.verification_status='ownership_verified'`,
    [userId, mint],
  );
  return Number(row?.total ?? 0);
}

export async function userTier(userId: string) {
  const [balance, tiers] = await Promise.all([verifiedHoldings(userId), getTiers()]);
  return { balance, tier: tierForBalance(balance, tiers) };
}

/** Rechecks chain balances older than maxAgeSeconds. A failed read keeps the last value and is logged. */
export async function refreshUserBalances(userId: string, maxAgeSeconds = 60) {
  const mint = await getEffectiveMint();
  if (!mint) return;
  const stale = await q(
    `select w.address from wallets w
     left join token_balances b on b.address=w.address and b.mint=$2
     where w.user_id=$1 and w.verification_status='ownership_verified'
       and (b.last_updated is null or b.last_updated < now() - ($3 || ' seconds')::interval)`,
    [userId, mint, String(maxAgeSeconds)],
  );
  await Promise.all(stale.map(async (w) => {
    try { await refreshHolding(w.address, mint); }
    catch (e) { log("warn", "balance.refresh_failed", { message: (e as Error).message }); }
  }));
}

/** Public, read-only lookup. Reports what the chain says and explicitly proves nothing about who is asking. */
export async function lookupAddress(address: string) {
  const mint = await getEffectiveMint();
  if (!mint) {
    return { state: "address_submitted" as OwnershipState, ownership: "ownership_not_verified" as OwnershipState, holding: null, tierIfVerified: null, reason: "No token mint is configured yet." };
  }
  const [holding, tiers] = await Promise.all([refreshHolding(address, mint), getTiers()]);
  return {
    state: (holding.normalized > 0 ? "holdings_detected" : "address_submitted") as OwnershipState,
    ownership: "ownership_not_verified" as OwnershipState,
    holding,
    tierIfVerified: tierForBalance(holding.normalized, tiers).name,
    reason: holding.normalized > 0 ? null : "This address holds none of the token.",
  };
}

export async function trackUnverifiedWallet(userId: string, address: string, walletType: string) {
  await q(
    `insert into wallets (user_id, address, wallet_type) values ($1,$2,$3)
     on conflict (user_id, address) do update set wallet_type = excluded.wallet_type`,
    [userId, address, walletType],
  );
}

/**
 * Called only after a signature or transfer proof succeeded. Decides which account the wallet belongs to:
 * proof of control beats any previous claim, and a wallet only ever counts on one account.
 */
export async function markWalletVerified(args: { address: string; method: "signed_message" | "transfer_proof"; walletType: string; currentUserId: string | null }) {
  const { address, method, walletType, currentUserId } = args;
  const owner = await q1(`select user_id from wallets where address=$1 and verification_status='ownership_verified'`, [address]);
  let userId = currentUserId;

  if (owner) {
    if (!currentUserId) userId = owner.user_id;
    else if (owner.user_id !== currentUserId) {
      const mine = await q1(`select count(*)::int as n from wallets where user_id=$1 and verification_status='ownership_verified'`, [currentUserId]);
      if (mine?.n === 0) userId = owner.user_id; // A guest session signing a known wallet is logging back in.
      else await q(`delete from wallets where address=$1 and user_id=$2`, [address, owner.user_id]); // Moved between accounts.
    }
  }
  if (!userId) userId = await createUser();

  await q(
    `insert into wallets (user_id, address, wallet_type, verification_status, verification_method, last_verified_at)
     values ($1,$2,$3,'ownership_verified',$4,now())
     on conflict (user_id, address) do update set verification_status='ownership_verified',
       verification_method=excluded.verification_method, wallet_type=excluded.wallet_type, last_verified_at=now()`,
    [userId, address, walletType, method],
  );

  // Admin rights require a real signature from an allow-listed key.
  if (method === "signed_message" && config.adminWallets.includes(address)) {
    await q(`update users set role='admin' where id=$1`, [userId]);
  }
  const mint = await getEffectiveMint();
  if (mint) {
    try { await refreshHolding(address, mint); }
    catch (e) { log("warn", "balance.refresh_failed", { message: (e as Error).message }); }
  }
  return userId;
}

export async function listUserWallets(userId: string) {
  const mint = await getEffectiveMint();
  return q(
    `select w.address, w.wallet_type, w.verification_status, w.verification_method, w.last_verified_at,
            coalesce(b.normalized_balance,0) as balance, b.token_account_count, b.source, b.last_updated
     from wallets w left join token_balances b on b.address=w.address and b.mint=$2
     where w.user_id=$1 order by w.created_at`,
    [userId, mint],
  );
}

export async function leaderboardRank(userId: string) {
  const mint = await getEffectiveMint();
  const row = await q1(
    `select rank from (select user_id, rank() over (order by verified_holdings desc) as rank from leaderboard where mint=$1 and verified_holdings > 0) r where user_id=$2`,
    [mint, userId],
  );
  return row ? Number(row.rank) : null;
}
