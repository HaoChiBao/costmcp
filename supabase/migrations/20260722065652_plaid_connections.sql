-- Plaid bank connections: Items, accounts, and synced transactions.
-- Bank data is stored separately from cost_messages; import into the ledger is a later step.
-- Access tokens live in plaid_item_secrets (service-role only).

create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  institution_id text,
  institution_name text,
  status text not null default 'active'
    check (status in ('active', 'login_required', 'pending_expiration', 'error', 'removed')),
  error_code text,
  error_message text,
  transactions_cursor text,
  consent_expiration_time timestamptz,
  products text[] not null default array['transactions']::text[],
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id)
);

create index if not exists plaid_items_workspace_idx
  on public.plaid_items (workspace_id)
  where status <> 'removed';

create index if not exists plaid_items_user_idx
  on public.plaid_items (user_id);

create table if not exists public.plaid_item_secrets (
  plaid_item_id uuid primary key references public.plaid_items(id) on delete cascade,
  access_token_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plaid_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items(id) on delete cascade,
  account_id text not null,
  name text,
  official_name text,
  mask text,
  type text,
  subtype text,
  currency text,
  current_balance numeric(14, 4),
  available_balance numeric(14, 4),
  credit_limit numeric(14, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id)
);

create index if not exists plaid_accounts_workspace_item_idx
  on public.plaid_accounts (workspace_id, plaid_item_id);

create table if not exists public.plaid_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items(id) on delete cascade,
  plaid_account_id uuid not null references public.plaid_accounts(id) on delete cascade,
  transaction_id text not null,
  pending_transaction_id text,
  amount numeric(14, 4) not null,
  iso_currency_code text,
  unofficial_currency_code text,
  date date not null,
  authorized_date date,
  name text,
  merchant_name text,
  pending boolean not null default false,
  category text[],
  personal_finance_category jsonb,
  payment_channel text,
  raw jsonb,
  imported_message_id uuid references public.cost_messages(id) on delete set null,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transaction_id)
);

create index if not exists plaid_transactions_workspace_date_idx
  on public.plaid_transactions (workspace_id, date desc)
  where removed_at is null;

create index if not exists plaid_transactions_item_idx
  on public.plaid_transactions (plaid_item_id)
  where removed_at is null;

create index if not exists plaid_transactions_account_idx
  on public.plaid_transactions (plaid_account_id, date desc)
  where removed_at is null;

-- RLS: members can read item/account/tx metadata; secrets are service-role only.
alter table public.plaid_items enable row level security;
alter table public.plaid_item_secrets enable row level security;
alter table public.plaid_accounts enable row level security;
alter table public.plaid_transactions enable row level security;

drop policy if exists "authenticated_read_plaid_items" on public.plaid_items;
create policy "authenticated_read_plaid_items"
  on public.plaid_items for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "deny_anon_plaid_items" on public.plaid_items;
create policy "deny_anon_plaid_items"
  on public.plaid_items for all to anon
  using (false)
  with check (false);

-- No authenticated/anon policies on secrets → denied; service role bypasses RLS.
drop policy if exists "deny_authenticated_plaid_item_secrets" on public.plaid_item_secrets;
create policy "deny_authenticated_plaid_item_secrets"
  on public.plaid_item_secrets for all to authenticated
  using (false)
  with check (false);

drop policy if exists "deny_anon_plaid_item_secrets" on public.plaid_item_secrets;
create policy "deny_anon_plaid_item_secrets"
  on public.plaid_item_secrets for all to anon
  using (false)
  with check (false);

drop policy if exists "authenticated_read_plaid_accounts" on public.plaid_accounts;
create policy "authenticated_read_plaid_accounts"
  on public.plaid_accounts for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "deny_anon_plaid_accounts" on public.plaid_accounts;
create policy "deny_anon_plaid_accounts"
  on public.plaid_accounts for all to anon
  using (false)
  with check (false);

drop policy if exists "authenticated_read_plaid_transactions" on public.plaid_transactions;
create policy "authenticated_read_plaid_transactions"
  on public.plaid_transactions for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "deny_anon_plaid_transactions" on public.plaid_transactions;
create policy "deny_anon_plaid_transactions"
  on public.plaid_transactions for all to anon
  using (false)
  with check (false);

revoke all on table public.plaid_item_secrets from anon, authenticated;
