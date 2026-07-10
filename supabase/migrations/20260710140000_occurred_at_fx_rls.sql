-- Separate event time from ingest time; soft-delete; FX rates; member write policies.

alter table public.cost_messages
  add column if not exists occurred_at timestamptz,
  add column if not exists voided_at timestamptz;

update public.cost_messages
set occurred_at = created_at
where occurred_at is null;

alter table public.cost_messages
  alter column occurred_at set default now(),
  alter column occurred_at set not null;

create index if not exists cost_messages_workspace_occurred_idx
  on public.cost_messages (workspace_id, occurred_at desc)
  where voided_at is null;

create index if not exists cost_messages_project_occurred_idx
  on public.cost_messages (project_id, occurred_at desc)
  where voided_at is null;

-- FX rates: units of USD per 1 unit of currency (multiply amount * rate_to_usd).
create table if not exists public.fx_rates (
  currency text primary key,
  rate_to_usd numeric(18, 8) not null check (rate_to_usd > 0),
  updated_at timestamptz not null default now()
);

alter table public.fx_rates enable row level security;

drop policy if exists "fx_rates_select_authenticated" on public.fx_rates;
create policy "fx_rates_select_authenticated"
  on public.fx_rates for select to authenticated
  using (true);

drop policy if exists "deny_anon_fx_rates" on public.fx_rates;
create policy "deny_anon_fx_rates"
  on public.fx_rates for all to anon using (false);

insert into public.fx_rates (currency, rate_to_usd) values
  ('USD', 1),
  ('EUR', 1.08),
  ('GBP', 1.27),
  ('CAD', 0.73),
  ('AUD', 0.66),
  ('JPY', 0.0067),
  ('CHF', 1.12),
  ('CNY', 0.14),
  ('INR', 0.012),
  ('KRW', 0.00073),
  ('SGD', 0.74),
  ('HKD', 0.13),
  ('BRL', 0.18),
  ('MXN', 0.055),
  ('SEK', 0.095),
  ('NOK', 0.093),
  ('DKK', 0.145),
  ('NZD', 0.60),
  ('PLN', 0.25),
  ('TRY', 0.029)
on conflict (currency) do update set
  rate_to_usd = excluded.rate_to_usd,
  updated_at = now();

-- Member write access for ledger + vendors (dashboard manual entry).
drop policy if exists "cost_messages_insert_member" on public.cost_messages;
create policy "cost_messages_insert_member"
  on public.cost_messages for insert to authenticated
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "cost_messages_update_member" on public.cost_messages;
create policy "cost_messages_update_member"
  on public.cost_messages for update to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "cost_messages_delete_member" on public.cost_messages;
create policy "cost_messages_delete_member"
  on public.cost_messages for delete to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "vendors_insert_member" on public.vendors;
create policy "vendors_insert_member"
  on public.vendors for insert to authenticated
  with check (workspace_id in (select public.user_workspace_ids()));

drop policy if exists "vendors_update_member" on public.vendors;
create policy "vendors_update_member"
  on public.vendors for update to authenticated
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));
