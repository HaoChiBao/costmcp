-- CostMCP Phase 0 schema (YAN-181)

create extension if not exists "pgcrypto";

-- Workspaces
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects (everything attaches here)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  status text not null default 'active',
  budget numeric(12, 4),
  currency text not null default 'USD',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index if not exists projects_workspace_id_idx on projects(workspace_id);

-- Vendors
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  category text,
  website text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

-- Append-only cost ledger
create table if not exists cost_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  message_type text not null check (message_type in ('usage', 'expense', 'subscription', 'allocation', 'batch')),
  amount_usd numeric(12, 6) not null default 0,
  currency text not null default 'USD',
  amount_original numeric(12, 6),
  unit_type text,
  quantity numeric(18, 6),
  unit_cost numeric(12, 6),
  feature text,
  batch_id text,
  environment text,
  source text not null default 'api' check (source in ('api', 'mcp', 'manual', 'import')),
  idempotency_key text,
  parent_message_id uuid references cost_messages(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cost_messages_workspace_created_idx on cost_messages(workspace_id, created_at desc);
create index if not exists cost_messages_project_created_idx on cost_messages(project_id, created_at desc);
create index if not exists cost_messages_batch_id_idx on cost_messages(batch_id) where batch_id is not null;
create unique index if not exists cost_messages_idempotency_idx
  on cost_messages(workspace_id, idempotency_key)
  where idempotency_key is not null;

-- Budgets
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  scope_type text not null check (scope_type in ('global', 'project', 'category', 'vendor', 'feature')),
  scope_id uuid,
  name text not null,
  amount numeric(12, 4) not null,
  currency text not null default 'USD',
  period text not null default 'monthly' check (period in ('monthly', 'quarterly', 'yearly')),
  alert_thresholds numeric[] default array[0.8, 1.0],
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- API keys (hash only)
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  permissions text[] not null default array['log_usage', 'add_expenses', 'read_summaries', 'estimate_costs'],
  environment text not null default 'live',
  monthly_limit numeric(12, 2),
  last_used_at timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now()
);

create index if not exists api_keys_workspace_idx on api_keys(workspace_id);
create unique index if not exists api_keys_hash_idx on api_keys(key_hash);

-- Pricing rules (estimate endpoint)
create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  provider text not null,
  model text,
  unit_type text not null,
  rate_usd numeric(12, 8) not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS
alter table workspaces enable row level security;
alter table projects enable row level security;
alter table vendors enable row level security;
alter table cost_messages enable row level security;
alter table budgets enable row level security;
alter table api_keys enable row level security;
alter table pricing_rules enable row level security;

-- Service role bypasses RLS; dashboard policies added in YAN-187

-- Seed demo workspace (local dev)
insert into workspaces (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Demo Workspace')
on conflict do nothing;

insert into projects (workspace_id, slug, name, budget)
values
  ('00000000-0000-4000-8000-000000000001', 'slideshow-studio', 'Slideshow Studio', 200),
  ('00000000-0000-4000-8000-000000000001', 'progressgoat', 'ProgressGoat', 100),
  ('00000000-0000-4000-8000-000000000001', 'experiments', 'Experiments', 50),
  ('00000000-0000-4000-8000-000000000001', 'shared-tools', 'Shared Tools', null)
on conflict (workspace_id, slug) do nothing;

insert into pricing_rules (provider, model, unit_type, rate_usd, notes)
select * from (values
  ('openai', 'gpt-image-2', 'image', 0.04::numeric, 'Per image estimate'),
  ('openai', 'gpt-4o-mini', 'input_tokens', 0.00000015::numeric, 'Per token'),
  ('openai', 'gpt-4o-mini', 'output_tokens', 0.0000006::numeric, 'Per token'),
  ('elevenlabs', null::text, 'voice_character', 0.00000012::numeric, 'Per character USD estimate'),
  ('fish', null::text, 'voice_byte', 0.000000015::numeric, 'Per byte USD estimate')
) as v(provider, model, unit_type, rate_usd, notes)
where not exists (select 1 from pricing_rules limit 1);
