import type { Db } from "./db";
import { SIMULATED_MINT } from "./settings";

// Mock-mode content only: lives under a fake mint and a demo flag, and never appears once a real mint is set.
const DEMO = [
  { name: "BigWhaleEnergy", balance: 500_000_000, address: "DemoWha1e11111111111111111111111111111111111" },
  { name: "LiquidatedLarry", balance: 120_000_000, address: "DemoGary11111111111111111111111111111111111" },
  { name: "RugPullRachel", balance: 50_000_000, address: "DemoAnna11111111111111111111111111111111111" },
  { name: "PaperHandsPete", balance: 8_400_000, address: "DemoPowder1111111111111111111111111111111111" },
  { name: "ExitLiquidity", balance: 1_000_000, address: "DemoCarl11111111111111111111111111111111111" },
  { name: "BagHolderBen", balance: 42_000, address: "DemoBen111111111111111111111111111111111111" },
];
const CHAT = ["tanner how much did you lose today", "jade roast my username", "is that couch even legal", "who actually pays rent here"];

export async function seedDemoData(db: Db) {
  const existing = await db.query(`select 1 from users where is_demo = true limit 1`);
  if (existing.length) return;
  for (const d of DEMO) {
    const [u] = await db.query(`insert into users (username, is_demo) values ($1, true) returning id`, [d.name]);
    await db.query(`insert into wallets (user_id, address, wallet_type, verification_status, verification_method, last_verified_at)
      values ($1,$2,'demo','ownership_verified','signed_message',now())`, [u.id, d.address]);
    await db.query(`insert into token_balances (address, mint, raw_amount, decimals, normalized_balance, token_account_count, source)
      values ($1,$2,$3,6,$4,1,'simulated')`, [d.address, SIMULATED_MINT, String(BigInt(d.balance) * 1000000n), d.balance]);
    const line = CHAT[DEMO.indexOf(d) % CHAT.length];
    await db.query(`insert into chat_messages (user_id, content, tier_snapshot) values ($1,$2,$3)`,
      [u.id, line, d.balance >= 5e8 ? "whale" : d.balance >= 5e7 ? "vip" : d.balance >= 1e6 ? "investor" : "supporter"]);
  }
}
