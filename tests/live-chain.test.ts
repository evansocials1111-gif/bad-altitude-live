import { describe, expect, it } from "vitest";

// Hits public mainnet, so it only runs when asked: LIVE_CHAIN=1 npx vitest run tests/live-chain.test.ts
const live = process.env.LIVE_CHAIN === "1";
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"; // SPL Token
const PYUSD = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"; // Token-2022

/** Pool addresses from DexScreener make handy known owners, and avoid heavily throttled RPC methods. */
async function holderFromPools(mint: string) {
  const { rpc } = await import("../src/lib/server/solana/rpc");
  const pairs = await (await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`)).json();
  for (const p of pairs.slice(0, 8)) {
    const accounts = await rpc<any>("getTokenAccountsByOwner", [p.pairAddress, { mint }, { encoding: "jsonParsed" }]);
    if (accounts.value.length) return { owner: p.pairAddress as string, program: accounts.value[0].account.owner as string };
  }
  throw new Error("No pool holder found");
}

describe.runIf(live)("real Solana mainnet", () => {
  it("reads an SPL Token balance", async () => {
    const { fetchChainHolding } = await import("../src/lib/server/solana/balance");
    const top = await holderFromPools(BONK);
    const h = await fetchChainHolding(top.owner, BONK);
    expect(h.source).toBe("rpc");
    expect(h.decimals).toBe(5);
    expect(h.normalized).toBeGreaterThan(0);
    expect(h.tokenAccountCount).toBeGreaterThan(0);
  });
  it("reads a Token-2022 balance", async () => {
    const { fetchChainHolding } = await import("../src/lib/server/solana/balance");
    const top = await holderFromPools(PYUSD);
    expect(top.program).toBe("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
    const h = await fetchChainHolding(top.owner, PYUSD);
    expect(h.decimals).toBe(6);
    expect(h.normalized).toBeGreaterThan(0);
  });
  it("returns zero with correct decimals for a wallet that holds none", async () => {
    const { fetchChainHolding } = await import("../src/lib/server/solana/balance");
    const h = await fetchChainHolding("11111111111111111111111111111112", BONK);
    expect(h).toMatchObject({ normalized: 0, decimals: 5, tokenAccountCount: 0 });
  });
});
