const env = process.env;
const isProd = env.NODE_ENV === "production";

function flag(name: string, fallback: boolean) {
  const v = env[name];
  return v === undefined || v === "" ? fallback : v === "true" || v === "1";
}

const tokenMint = env.TOKEN_MINT?.trim() || null;
// Simulation can never run in production, whatever the env says.
const mock = !isProd && flag("DEV_MOCK_MODE", !tokenMint);

export const config = {
  isProd,
  mock,
  appUrl: env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000",
  showName: env.NEXT_PUBLIC_SHOW_NAME || "Degen Den",
  databaseUrl: env.DATABASE_URL || null,
  pglitePath: env.PGLITE_PATH ?? ".data/pglite",
  sessionSecret: env.SESSION_SECRET || (isProd ? null : "dev-only-session-secret-change-me-please"),
  tokenMint,
  tokenSymbol: env.TOKEN_SYMBOL || null,
  solanaRpcUrl: env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  heliusApiKey: env.HELIUS_API_KEY || null,
  verificationDepositAddress: env.VERIFICATION_DEPOSIT_ADDRESS || null,
  adminWallets: (env.ADMIN_WALLETS || "").split(",").map((s) => s.trim()).filter(Boolean),
  anthropicApiKey: env.ANTHROPIC_API_KEY || null,
  llmModel: env.LLM_MODEL || "claude-opus-5-5",
  // Free local dialogue. Used when there is no Anthropic key and an Ollama server answers.
  ollamaUrl: (env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
  ollamaModel: env.OLLAMA_MODEL || "llama3.2",
  ollamaEnabled: flag("OLLAMA_ENABLED", true),
  elevenLabsApiKey: env.ELEVENLABS_API_KEY || null,
  elevenLabsModel: env.ELEVENLABS_MODEL || "eleven_turbo_v2_5",
  supabaseUrl: env.SUPABASE_URL || null,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || null,
  supabaseAudioBucket: env.SUPABASE_AUDIO_BUCKET || "show-audio",
  licensedRosterEnabled: flag("LICENSED_ROSTER_ENABLED", false),
  directorEnabled: flag("DIRECTOR_ENABLED", true),
};

export function assertProductionConfig() {
  if (!config.isProd) return;
  const missing: string[] = [];
  if (!config.sessionSecret || config.sessionSecret.length < 32) missing.push("SESSION_SECRET (32+ chars)");
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
}
