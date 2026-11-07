# Degen Den

A live animated comedy for a Solana token community. An original cast of four cartoon adults talks among themselves and answers holders on air. Verified holdings decide who gets answered first.

"Degen Den" is a working title. To change it, set `NEXT_PUBLIC_SHOW_NAME`. The logo is in `src/components/Nav.tsx`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. No keys or database are needed: it runs in mock mode on an embedded Postgres (PGlite, stored in `.data/`).

In mock mode, the "Dev wallet" login signs with a real key held in your browser, chain balances and market numbers are simulated and labelled, and dialogue comes from labelled templates. Open `/admin` and use "Sign in as dev admin".

```bash
npm test                                            # unit + integration, no network
LIVE_CHAIN=1 npx vitest run tests/live-chain.test.ts # reads real Solana mainnet
```

Stop the dev server before running `next build`, and delete `.next` before starting it again. They share that folder, and mixing them can put the page in a reload loop.

## Go live

Copy `.env.example` to `.env.local`, then:

| To get | Set |
|---|---|
| Real balances and market data | `TOKEN_MINT` and a dedicated `SOLANA_RPC_URL` |
| Supabase Postgres | `DATABASE_URL`. Migrations in `supabase/migrations` run automatically at startup |
| Sessions | `SESSION_SECRET` |
| Admin access | `ADMIN_WALLETS` |
| AI dialogue | `ANTHROPIC_API_KEY` |
| Real voices | `ELEVENLABS_API_KEY`, plus a voice ID per character in Admin |
| Holder count | `HELIUS_API_KEY` |
| Trading wallet verification | `VERIFICATION_DEPOSIT_ADDRESS` |

**Hosting:** run `npm run build && npm start` on one long-lived Node server (Fly, Railway, Render, a VPS). The show director, live event stream and rate limiter live in that process, so this version doesn't run on serverless or across several instances. Scaling out means moving those to Redis, LiveKit or similar.

## How it works

**Wallet states.** Pasting an address is a read-only lookup (`address_submitted`, then `holdings_detected`) and stays `ownership_not_verified`, with no tier, priority or rank. `ownership_verified` needs one of:

- **Signed message:** a single-use nonce signed by the wallet (Phantom, Solflare, any Wallet Standard wallet).
- **Dust transfer:** for trading wallets that can't sign messages. The user sends an exact random lamport amount from that wallet to `VERIFICATION_DEPOSIT_ADDRESS`, and the server finds it on chain with that wallet as a signer.

A wallet can be verified on only one account (enforced by a database index), so balances can't double count. Verified wallets on an account add together.

**Priority.** `src/lib/server/priority.ts`:

```
score = balanceWeight × log10(1 + tokens) + tierWeight × tierWeight
      + waitWeight × min(wait, cap) / 10 − recentPenalty × recentAnswers
```

Scores are recomputed at claim time. Balances are rechecked when a question is submitted and when it's picked up. All weights are editable in Admin.

**The show.** `src/lib/server/show/director.ts` runs one step per second: queued question first, then live chat replies, then idle scenes one line at a time, so a question can cut in between lines. Cost controls: no generation with zero viewers, idle scene spacing, daily LLM and voice budgets (then reruns only), a session limit, a live mode switch, and audio cached by text.

**Character rigs.** SVG rigs in `src/components/rigs/` with idle, blink, emotion and per-character gestures. Mouths follow a viseme timeline, from ElevenLabs timing when available and estimated from text otherwise. To add a character, register a rig in `RIGS` and add a row to `characters`.

**Safety.** Prompts treat viewer text as data inside delimited tags, and tag characters are stripped. Generated lines are checked for prohibited content, financial advice, credential requests and market figures that aren't in the live snapshot. Failing lines are retried once, then replaced with a written fallback. Input containing seed phrases or private keys is refused and not stored.

## Licensed characters

The default cast is entirely original. Characters with `license_status='licensed'` stay off the show unless `LICENSED_ROSTER_ENABLED=true`. Only set that with a license covering the characters, names, likenesses and voices.

## Layout

```
supabase/migrations/   schema, RLS, seed data
src/lib/server/        wallets, solana/, queue, priority, moderation, market, ai/, show/
src/lib/client/        session, live stream and audio provider
src/lib/shared/        types, lip-sync timelines, formatting
src/app/api/           route handlers
src/app/               pages: home (live chat), community, leaderboard, token, about, profile, admin
src/components/        stage, town scene, rigs, wallet modal, panels
```

## The stream (Tanner and Jade)

The homepage is one live scene: two original AI roommates, Tanner and Jade, on the same couch. Every message in the shared chat can get a reply. Whoever is named first answers, the other usually piles on, and when chat is quiet they go after each other. Verified holders are answered first. An "AI characters · 18+" label stays on screen.

**Free dialogue.** With no `ANTHROPIC_API_KEY`, the server asks a local [Ollama](https://ollama.com) model for every line:

```bash
ollama pull llama3.2
```

If Ollama isn't running, they fall back to a short list of written lines and try Ollama again after a minute. Voices use the viewer's built-in browser speech, which is also free.

**Real footage.** By default the scene is drawn. To show real people instead, film short clips of one couch from a fixed camera and drop them in `public/scene/`. [FILMING.md](FILMING.md) has the shot list, file names and setup.
