import { config } from "@/lib/server/config";
import { getDb, q, q1 } from "@/lib/server/db";
import { route } from "@/lib/server/http";
import { llmProviderName } from "@/lib/server/ai/llm";
import { getMarket } from "@/lib/server/market";
import { requireRole } from "@/lib/server/session";
import { showState } from "@/lib/server/show/bus";
import { rpc } from "@/lib/server/solana/rpc";

export const GET = route(async () => {
  await requireRole("admin", "moderator");
  const [counts, usage, moderation, market, db] = await Promise.all([
    q1(`select (select count(*)::int from users where is_demo=false) as users,
               (select count(*)::int from wallets w join users u on u.id=w.user_id where w.verification_status='ownership_verified' and u.is_demo=false) as verified_wallets,
               (select count(*)::int from messages where status='queued') as queued,
               (select count(*)::int from messages where status='answered' and answered_at > now() - interval '24 hours') as answered_24h,
               (select count(*)::int from chat_messages where created_at > now() - interval '24 hours') as chat_24h`),
    q(`select kind, provider, coalesce(model,'') as model, count(*)::int as calls, sum(input_units)::bigint as input, sum(output_units)::bigint as output, sum(estimated_cost_usd) as cost,
         sum(case when created_at > date_trunc('day', now()) then estimated_cost_usd else 0 end) as cost_today
       from ai_usage where created_at > now() - interval '30 days' group by 1,2,3 order by cost desc`),
    q(`select category, source, excerpt, created_at from moderation_events order by created_at desc limit 30`),
    getMarket(),
    getDb(),
  ]);
  const rpcOk = config.mock ? null : await rpc("getHealth", []).then(() => true).catch(() => false);
  return {
    counts, usage, moderation,
    show: showState.status, viewers: showState.viewers,
    integrations: [
      { name: "Database", status: db.driver === "postgres" ? "connected" : "embedded", detail: db.driver === "postgres" ? "DATABASE_URL" : "PGlite (local only)" },
      { name: "Solana RPC", status: config.mock ? "simulated" : rpcOk ? "connected" : "error", detail: config.mock ? "DEV_MOCK_MODE" : new URL(config.solanaRpcUrl).host },
      { name: "Market data", status: market.status, detail: market.reason ?? "DexScreener" },
      { name: "Holder index", status: config.heliusApiKey ? "configured" : "missing", detail: "HELIUS_API_KEY" },
      { name: "LLM", status: llmProviderName() === "mock" ? "mock" : "configured", detail: { anthropic: config.llmModel, ollama: `Ollama, ${config.ollamaModel} (free, local)`, mock: "Set ANTHROPIC_API_KEY or run Ollama" }[llmProviderName()] },
      { name: "Voice", status: config.elevenLabsApiKey ? "configured" : "browser speech", detail: config.elevenLabsApiKey ? "ElevenLabs, per-character voice ID required" : "Set ELEVENLABS_API_KEY" },
      { name: "Transfer proof", status: config.verificationDepositAddress ? "configured" : config.mock ? "simulated" : "missing", detail: "VERIFICATION_DEPOSIT_ADDRESS" },
      { name: "Licensed roster", status: config.licensedRosterEnabled ? "enabled" : "disabled", detail: "LICENSED_ROSTER_ENABLED" },
    ],
  };
});
