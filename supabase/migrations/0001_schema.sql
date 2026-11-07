-- Core relational schema. Runs unchanged on Supabase Postgres and on embedded PGlite (local dev).

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  avatar_seed text not null default md5(random()::text),
  bio text not null default '',
  role text not null default 'user' check (role in ('user','moderator','admin')),
  status text not null default 'active' check (status in ('active','muted','banned')),
  hide_wallet boolean not null default true,
  hide_from_leaderboard boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create unique index if not exists users_username_lower_idx on users (lower(username));

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  address text not null,
  wallet_type text not null default 'unknown',
  verification_status text not null default 'ownership_not_verified'
    check (verification_status in ('ownership_verified','ownership_not_verified')),
  verification_method text check (verification_method in ('signed_message','transfer_proof')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, address)
);
-- A wallet can only be VERIFIED on one account: this is what prevents double counting.
create unique index if not exists wallets_verified_address_idx on wallets (address)
  where verification_status = 'ownership_verified';
create index if not exists wallets_user_idx on wallets (user_id);

create table if not exists token_balances (
  address text not null,
  mint text not null,
  raw_amount numeric(40,0) not null default 0,
  decimals int not null default 0,
  normalized_balance double precision not null default 0,
  token_account_count int not null default 0,
  source text not null default 'rpc' check (source in ('rpc','simulated')),
  last_updated timestamptz not null default now(),
  primary key (address, mint)
);

create table if not exists investor_tiers (
  name text primary key,
  label text not null,
  min_holdings double precision not null,
  max_holdings double precision,
  priority_weight double precision not null,
  cooldown_seconds int not null,
  sort_order int not null
);

create table if not exists characters (
  id text primary key,
  name text not null,
  tagline text not null default '',
  personality text not null,
  speaking_style text not null,
  humor text not null,
  behavior_rules text not null default '',
  voice_config jsonb not null default '{}',
  animation_config jsonb not null default '{}',
  license_status text not null default 'original' check (license_status in ('original','licensed')),
  active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  character_id text not null references characters(id),
  content text not null,
  content_hash text not null,
  balance_snapshot double precision not null default 0,
  tier_snapshot text not null default 'visitor',
  priority_score double precision not null default 0,
  status text not null default 'queued'
    check (status in ('queued','generating','answered','rejected','failed','expired')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists messages_status_idx on messages (status, created_at);
create index if not exists messages_user_idx on messages (user_id, created_at desc);
create index if not exists messages_dedupe_idx on messages (user_id, content_hash, created_at desc);

create table if not exists character_responses (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade,
  character_id text not null references characters(id),
  dialogue text not null,
  emotion text not null default 'neutral',
  kind text not null default 'answer' check (kind in ('answer','banter','market')),
  audio_url text,
  visemes jsonb,
  duration_ms int not null default 0,
  llm_provider text not null,
  tts_provider text not null default 'browser',
  created_at timestamptz not null default now()
);
create index if not exists responses_recent_idx on character_responses (created_at desc);
create index if not exists responses_char_idx on character_responses (character_id, created_at desc);
create index if not exists responses_message_idx on character_responses (message_id);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  content text not null,
  tier_snapshot text not null default 'visitor',
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists chat_recent_idx on chat_messages (created_at desc);

create table if not exists auth_challenges (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  kind text not null check (kind in ('signed_message','transfer_proof')),
  nonce text not null,
  message text,
  lamports bigint,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists challenges_addr_idx on auth_challenges (address, created_at desc);

create table if not exists admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id) on delete set null
);

create table if not exists ai_usage (
  id bigserial primary key,
  kind text not null check (kind in ('llm','tts')),
  provider text not null,
  model text,
  purpose text,
  input_units int not null default 0,
  output_units int not null default 0,
  estimated_cost_usd double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_time_idx on ai_usage (created_at desc);

create table if not exists moderation_events (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  source text not null,
  category text not null,
  excerpt text,
  created_at timestamptz not null default now()
);
create index if not exists moderation_time_idx on moderation_events (created_at desc);

create or replace view leaderboard as
  select u.id as user_id, u.username, u.avatar_seed, u.hide_wallet, u.is_demo, u.last_seen_at,
         b.mint,
         coalesce(sum(b.normalized_balance), 0) as verified_holdings,
         count(distinct w.address) as wallet_count,
         min(w.address) as primary_address,
         max(b.last_updated) as last_updated
  from users u
  join wallets w on w.user_id = u.id and w.verification_status = 'ownership_verified'
  join token_balances b on b.address = w.address
  where u.status <> 'banned' and u.hide_from_leaderboard = false
  group by u.id, u.username, u.avatar_seed, u.hide_wallet, u.is_demo, u.last_seen_at, b.mint;
