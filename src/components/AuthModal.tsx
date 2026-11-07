"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { api } from "@/lib/client/api";
import { useApp } from "@/lib/client/AppProvider";
import { formatCompact, TIER_LABEL } from "@/lib/shared/format";
import { TierBadge } from "./ui/bits";

type View = "home" | "address" | "transfer";

const STEPS = [
  ["address_submitted", "Address submitted"],
  ["holdings_detected", "Holdings detected"],
  ["ownership_verified", "Ownership verified"],
] as const;

function StateRail({ reached }: { reached: number }) {
  return (
    <ol className="flex items-center gap-1 text-[11px] font-bold">
      {STEPS.map(([id, label], i) => (
        <li key={id} className={`flex flex-1 flex-col gap-1 ${i < reached ? "text-neon" : "text-mist"}`}>
          <span className={`h-1 rounded-full ${i < reached ? "bg-neon" : "bg-white/12"}`} />{label}
        </li>
      ))}
    </ol>
  );
}

const DEV_KEY = "ba_dev_wallet";

/** Mock mode stand-in for a browser wallet: a real ed25519 key that really signs the server's nonce. */
function devKeypair() {
  let saved: string | null = null;
  try { saved = localStorage.getItem(DEV_KEY); } catch {}
  if (saved) return nacl.sign.keyPair.fromSecretKey(bs58.decode(saved));
  const kp = nacl.sign.keyPair();
  try { localStorage.setItem(DEV_KEY, bs58.encode(kp.secretKey)); } catch {}
  return kp;
}

export function AuthModal() {
  const { authOpen, closeAuth, me, refreshMe } = useApp();
  const { wallets } = useWallet();
  const [view, setView] = useState<View>("home");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [lookup, setLookup] = useState<any>(null);
  const [challenge, setChallenge] = useState<any>(null);
  const [transferNote, setTransferNote] = useState<string | null>(null);

  useEffect(() => { if (!authOpen) { setView("home"); setError(null); setLookup(null); setChallenge(null); setTransferNote(null); } }, [authOpen]);
  useEffect(() => {
    if (!authOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeAuth(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authOpen, closeAuth]);

  const usable = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setError(null);
    try { await fn(); } catch (e: any) { setError(e?.message ?? "Something went wrong."); } finally { setBusy(null); }
  }

  async function finish() {
    await refreshMe();
    closeAuth();
  }

  const signInWithWallet = (wallet: (typeof wallets)[number]) => run(wallet.adapter.name, async () => {
    const adapter = wallet.adapter as any;
    if (!adapter.connected) await adapter.connect();
    const addr = adapter.publicKey?.toBase58();
    if (!addr) throw new Error("The wallet did not share an address.");
    if (!adapter.signMessage) throw new Error("This wallet can't sign messages. Use the trading wallet option instead.");
    const { nonce, message } = await api("/api/auth/nonce", { body: { address: addr } });
    const sig: Uint8Array = await adapter.signMessage(new TextEncoder().encode(message));
    await api("/api/auth/verify", { body: { address: addr, nonce, signature: bs58.encode(sig), walletType: wallet.adapter.name.toLowerCase() } });
    await adapter.disconnect().catch(() => {});
    await finish();
  });

  const signInDev = () => run("dev", async () => {
    const kp = devKeypair();
    const addr = bs58.encode(kp.publicKey);
    const { nonce, message } = await api("/api/auth/nonce", { body: { address: addr } });
    const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
    await api("/api/auth/verify", { body: { address: addr, nonce, signature: bs58.encode(sig), walletType: "dev" } });
    await finish();
  });

  const doLookup = () => run("lookup", async () => {
    setLookup(null);
    setLookup(await api("/api/wallet/lookup", { body: { address: address.trim(), walletType: "trading" } }));
    await refreshMe();
  });

  const startTransfer = () => run("transfer", async () => {
    setChallenge(await api("/api/auth/transfer-proof/start", { body: { address: address.trim() } }));
    setTransferNote(null);
    setView("transfer");
  });

  const checkTransfer = (simulate = false) => run("check", async () => {
    const r = await api("/api/auth/transfer-proof/check", { body: { address: address.trim(), challengeId: challenge.challengeId, simulate } });
    if (r.verified) await finish();
    else setTransferNote("Not found on chain yet. Transfers can take a minute to confirm. Check the exact amount and try again.");
  });

  const guest = () => run("guest", async () => { await api("/api/auth/guest", { body: {} }); await finish(); });
  const reached = lookup ? (lookup.state === "holdings_detected" ? 2 : 1) : 0;

  return (
    <AnimatePresence>
      {authOpen && (
        <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeAuth}>
          <motion.div
            role="dialog" aria-modal="true" aria-label="Enter the community"
            initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="glass glass-strong scroll-thin max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow mb-1">{view === "home" ? (me?.user ? "Add a wallet" : "Enter the community") : view === "address" ? "Trading wallet" : "Prove control"}</p>
                <h2 className="display text-2xl sm:text-3xl">{view === "home" ? "Show us your bag" : view === "address" ? "Paste your public address" : "Send a dust transfer"}</h2>
              </div>
              <button onClick={closeAuth} className="btn btn-glass h-9 w-9 shrink-0 text-lg" aria-label="Close">×</button>
            </div>

            {view === "home" && (
              <div className="space-y-3">
                <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <h3 className="font-extrabold">Connect a wallet</h3>
                  <p className="mb-3 mt-0.5 text-sm text-frost">Sign one free message. Sends no transaction, grants no spending rights. This gives you verified status.</p>
                  <div className="flex flex-wrap gap-2">
                    {usable.map((w) => (
                      <button key={w.adapter.name} onClick={() => signInWithWallet(w)} disabled={!!busy} className="btn btn-ember px-4 py-2 text-sm">
                        {w.adapter.icon && <img src={w.adapter.icon} alt="" width={18} height={18} className="rounded" />}
                        {busy === w.adapter.name ? "Check your wallet…" : w.adapter.name}
                      </button>
                    ))}
                    {me?.mock && <button onClick={signInDev} disabled={!!busy} className="btn btn-glass px-4 py-2 text-sm">{busy === "dev" ? "Signing…" : "Dev wallet (mock mode)"}</button>}
                  </div>
                  {usable.length === 0 && <p className="mt-2 text-sm text-mist">No browser wallet detected. Install <a className="underline" href="https://phantom.com" target="_blank" rel="noreferrer">Phantom</a> or <a className="underline" href="https://solflare.com" target="_blank" rel="noreferrer">Solflare</a>, or use the option below.</p>}
                </section>
                <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <h3 className="font-extrabold">Enter a trading wallet address</h3>
                  <p className="mb-3 mt-0.5 text-sm text-frost">For GMGN, Padre, Pump.fun, Jupiter and other platforms. You don&apos;t need to move your tokens to Phantom. Copy the public address from your platform&apos;s wallet page.</p>
                  <button onClick={() => setView("address")} className="btn btn-glass px-4 py-2 text-sm">Use a trading wallet</button>
                </section>
                {!me?.user && <button onClick={guest} disabled={!!busy} className="w-full py-1 text-sm font-semibold text-frost underline-offset-2 hover:underline">Just look around as a Visitor</button>}
              </div>
            )}

            {view === "address" && (
              <div className="space-y-4">
                <form onSubmit={(e) => { e.preventDefault(); void doLookup(); }} className="flex flex-col gap-2 sm:flex-row">
                  <input value={address} onChange={(e) => { setAddress(e.target.value); setLookup(null); }} placeholder="Public Solana address" autoComplete="off" spellCheck={false} className="field numeric min-w-0 flex-1 text-sm" aria-label="Public Solana wallet address" />
                  <button disabled={!address.trim() || !!busy} className="btn btn-ember px-5 py-2.5 text-sm">{busy === "lookup" ? "Reading chain…" : "Check"}</button>
                </form>
                <StateRail reached={reached} />
                {lookup && (
                  <div className="rise rounded-2xl border border-white/10 bg-white/[.03] p-4">
                    {lookup.holding ? (
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="numeric text-2xl font-bold">{lookup.holding.normalized.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                        <span className="text-xs text-frost">tokens across {lookup.holding.tokenAccountCount} token account{lookup.holding.tokenAccountCount === 1 ? "" : "s"}{lookup.holding.source === "simulated" ? " · simulated" : ""}</span>
                      </div>
                    ) : <p className="text-sm text-frost">{lookup.reason}</p>}
                    <div className="mt-3 rounded-xl border border-ember/35 bg-ember/10 p-3 text-sm">
                      <p className="font-extrabold text-ember-soft">Ownership not verified</p>
                      <p className="mt-1 text-frost">Anyone can paste any address, so this balance earns no priority and no leaderboard spot yet. You&apos;re treated as a Visitor until you prove control.{lookup.tierIfVerified && lookup.tierIfVerified !== "visitor" && <> Verified, this wallet would be <TierBadge tier={lookup.tierIfVerified} size="xs" />.</>}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={startTransfer} disabled={!!busy || !me?.transferProofAvailable} className="btn btn-ember px-4 py-2 text-sm">Verify with a dust transfer</button>
                      <button onClick={finish} className="btn btn-glass px-4 py-2 text-sm">Continue unverified</button>
                    </div>
                    {!me?.transferProofAvailable && <p className="mt-2 text-xs text-mist">Transfer verification isn&apos;t configured on this site yet.</p>}
                  </div>
                )}
                <button onClick={() => setView("home")} className="text-sm font-semibold text-frost hover:underline">← Back</button>
              </div>
            )}

            {view === "transfer" && challenge && (
              <div className="space-y-4">
                <p className="text-sm text-frost">Trading platforms usually can&apos;t sign messages, but they can send. From the wallet you entered, send this exact amount to the address below. Only someone in control of that wallet can do it.</p>
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <div><p className="text-xs font-bold text-mist">Exact amount</p><p className="numeric text-xl font-bold text-ember-soft">{challenge.sol.toFixed(9)} SOL</p></div>
                  <div><p className="text-xs font-bold text-mist">Send to</p><p className="numeric break-all text-sm">{challenge.depositAddress}</p></div>
                  <button onClick={() => navigator.clipboard?.writeText(challenge.depositAddress)} className="btn btn-glass px-3 py-1 text-xs">Copy address</button>
                </div>
                <p className="text-xs text-mist">You pay the transfer and the network fee, and the dust isn&apos;t returned. This is optional: the alternative is to import the wallet into Phantom or Solflare and sign instead. Expires in 30 minutes.</p>
                {transferNote && <p className="text-sm text-ember-soft">{transferNote}</p>}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => checkTransfer(false)} disabled={!!busy} className="btn btn-ember px-4 py-2 text-sm">{busy === "check" ? "Checking chain…" : "I sent it, check now"}</button>
                  {me?.mock && <button onClick={() => checkTransfer(true)} disabled={!!busy} className="btn btn-glass px-4 py-2 text-sm">Simulate transfer (mock)</button>}
                  <button onClick={() => setView("address")} className="btn btn-glass px-4 py-2 text-sm">Back</button>
                </div>
              </div>
            )}

            {error && <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-snow">{error}</p>}
            <p className="mt-5 border-t border-white/10 pt-3 text-xs text-mist">We will never ask for your seed phrase, private key or platform password. Anyone who does is robbing you. We never hold your funds.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
