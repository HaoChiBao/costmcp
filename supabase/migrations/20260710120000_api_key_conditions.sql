-- API key conditions: expiry, rate limits, CIDR allowlists, JSON conditions,
-- per-key spend attribution, rate buckets, and audit events.

alter table public.api_keys
  add column if not exists expires_at timestamptz,
  add column if not exists rate_limit_rpm integer
    check (rate_limit_rpm is null or rate_limit_rpm > 0),
  add column if not exists allowed_cidrs text[] not null default '{}'::text[],
  add column if not exists conditions jsonb not null default '{}'::jsonb;

comment on column public.api_keys.expires_at is 'Hard expiry; null = never';
comment on column public.api_keys.rate_limit_rpm is 'Max requests per rolling minute; null = unlimited';
comment on column public.api_keys.allowed_cidrs is 'Empty = allow all client IPs';
comment on column public.api_keys.conditions is 'Extensible policy JSON (project_slugs, sources, features, …)';

alter table public.cost_messages
  add column if not exists api_key_id uuid references public.api_keys(id) on delete set null;

create index if not exists cost_messages_api_key_created_idx
  on public.cost_messages (api_key_id, created_at)
  where api_key_id is not null;

create table if not exists public.api_key_rate_buckets (
  api_key_id uuid primary key references public.api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0
);

alter table public.api_key_rate_buckets enable row level security;

create policy deny_anon_all_api_key_rate_buckets
  on public.api_key_rate_buckets
  for all to anon
  using (false)
  with check (false);

create policy deny_authenticated_all_api_key_rate_buckets
  on public.api_key_rate_buckets
  for all to authenticated
  using (false)
  with check (false);

create table if not exists public.api_key_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created', 'updated', 'rotated', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists api_key_audit_workspace_idx
  on public.api_key_audit_events (workspace_id, created_at desc);

alter table public.api_key_audit_events enable row level security;

create policy deny_anon_all_api_key_audit_events
  on public.api_key_audit_events
  for all to anon
  using (false)
  with check (false);

create policy deny_authenticated_all_api_key_audit_events
  on public.api_key_audit_events
  for all to authenticated
  using (false)
  with check (false);
