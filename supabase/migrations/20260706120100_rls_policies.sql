-- RLS policies for authenticated dashboard users (service role bypasses RLS)

create policy "authenticated_read_workspaces"
  on workspaces for select
  to authenticated
  using (true);

create policy "authenticated_read_projects"
  on projects for select
  to authenticated
  using (true);

create policy "authenticated_read_vendors"
  on vendors for select
  to authenticated
  using (true);

create policy "authenticated_read_cost_messages"
  on cost_messages for select
  to authenticated
  using (true);

create policy "authenticated_read_budgets"
  on budgets for select
  to authenticated
  using (true);

create policy "authenticated_read_pricing_rules"
  on pricing_rules for select
  to authenticated
  using (true);

create policy "deny_anon_all_api_keys"
  on api_keys for all
  to anon
  using (false);

create policy "deny_authenticated_write_api_keys"
  on api_keys for all
  to authenticated
  using (false);

create policy "deny_anon_workspaces" on workspaces for all to anon using (false);
create policy "deny_anon_projects" on projects for all to anon using (false);
create policy "deny_anon_vendors" on vendors for all to anon using (false);
create policy "deny_anon_cost_messages" on cost_messages for all to anon using (false);
create policy "deny_anon_budgets" on budgets for all to anon using (false);
create policy "deny_anon_pricing_rules" on pricing_rules for all to anon using (false);

insert into budgets (workspace_id, scope_type, name, amount, currency, period)
select '00000000-0000-4000-8000-000000000001', 'global', 'Monthly AI spend', 600, 'USD', 'monthly'
where not exists (
  select 1 from budgets
  where workspace_id = '00000000-0000-4000-8000-000000000001'
    and scope_type = 'global'
);
