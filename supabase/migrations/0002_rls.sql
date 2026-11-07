-- Every table is locked down. The app talks to Postgres through its server-side connection only;
-- the browser never receives database credentials. If anyone exposes the Supabase anon key,
-- PostgREST sees no rows except the public read-only tables granted below.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

alter table users enable row level security;
alter table wallets enable row level security;
alter table token_balances enable row level security;
alter table investor_tiers enable row level security;
alter table characters enable row level security;
alter table messages enable row level security;
alter table character_responses enable row level security;
alter table chat_messages enable row level security;
alter table auth_challenges enable row level security;
alter table admin_settings enable row level security;
alter table ai_usage enable row level security;
alter table moderation_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- Public catalogue data only. No policy on any other table means default deny.
grant select on investor_tiers to anon, authenticated;
drop policy if exists tiers_public_read on investor_tiers;
create policy tiers_public_read on investor_tiers for select to anon, authenticated using (true);

-- The leaderboard view exposes wallet addresses, so it runs as the caller and stays private.
alter view leaderboard set (security_invoker = true);
