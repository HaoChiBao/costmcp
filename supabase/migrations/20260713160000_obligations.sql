-- Payables / payment-due obligations (liabilities, not ledger spend).

create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  payee text not null,
  amount_original numeric(12, 6) not null,
  currency text not null default 'USD',
  amount_usd numeric(12, 6) not null,
  due_date date not null,
  remind_at date,
  status text not null default 'open'
    check (status in ('open', 'paid', 'cancelled')),
  notes text,
  paid_at timestamptz,
  settled_message_id uuid references public.cost_messages(id) on delete set null,
  source text not null default 'manual'
    check (source in ('manual', 'mcp', 'api')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists obligations_workspace_status_due_idx
  on public.obligations (workspace_id, status, due_date);

create index if not exists obligations_workspace_remind_idx
  on public.obligations (workspace_id, remind_at)
  where status = 'open' and remind_at is not null;

alter table public.obligations enable row level security;

drop policy if exists "authenticated_read_obligations" on public.obligations;
create policy "authenticated_read_obligations"
  on public.obligations for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "obligations_insert_member" on public.obligations;
create policy "obligations_insert_member"
  on public.obligations for insert to authenticated
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "obligations_update_member" on public.obligations;
create policy "obligations_update_member"
  on public.obligations for update to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "obligations_delete_member" on public.obligations;
create policy "obligations_delete_member"
  on public.obligations for delete to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "deny_anon_obligations" on public.obligations;
create policy "deny_anon_obligations"
  on public.obligations for all to anon
  using (false);
