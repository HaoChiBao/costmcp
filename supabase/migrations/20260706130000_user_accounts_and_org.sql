-- User accounts + organized cost account hierarchy

-- Extend workspaces into first-class "cost accounts"
alter table workspaces
  add column if not exists slug text,
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists type text not null default 'personal'
    check (type in ('personal', 'team', 'organization')),
  add column if not exists description text,
  add column if not exists sort_order int not null default 0;

create unique index if not exists workspaces_slug_idx on workspaces(slug) where slug is not null;

update workspaces
set slug = 'demo', type = 'team'
where id = '00000000-0000-4000-8000-000000000001' and slug is null;

-- User profiles (1:1 with auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  default_workspace_id uuid references workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workspace membership + roles
create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member', 'viewer')),
  invited_email text,
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on workspace_members(user_id);

-- Collections group projects within a workspace (folders)
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  color text,
  icon text,
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index if not exists collections_workspace_idx on collections(workspace_id);

-- Hierarchical chart-of-accounts style categories
create table if not exists cost_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_id uuid references cost_categories(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index if not exists cost_categories_workspace_idx on cost_categories(workspace_id);
create index if not exists cost_categories_parent_idx on cost_categories(parent_id);

-- Enrich projects for organization
alter table projects
  add column if not exists collection_id uuid references collections(id) on delete set null,
  add column if not exists environment text not null default 'production'
    check (environment in ('development', 'staging', 'production', 'other')),
  add column if not exists cost_category_id uuid references cost_categories(id) on delete set null,
  add column if not exists sort_order int not null default 0;

create index if not exists projects_collection_idx on projects(collection_id);

-- Tag + categorize individual ledger entries
alter table cost_messages
  add column if not exists cost_category_id uuid references cost_categories(id) on delete set null,
  add column if not exists tags text[] not null default array[]::text[];

-- RLS helpers
create or replace function public.user_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from workspace_members where user_id = auth.uid();
$$;

create or replace function public.user_can_manage_workspace(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Enable RLS on new tables
alter table profiles enable row level security;
alter table workspace_members enable row level security;
alter table collections enable row level security;
alter table cost_categories enable row level security;

-- Profiles: users manage their own row
create policy "profiles_select_own"
  on profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on profiles for update to authenticated
  using (id = auth.uid());

create policy "profiles_insert_own"
  on profiles for insert to authenticated
  with check (id = auth.uid());

-- Workspace members: see memberships in your workspaces
create policy "workspace_members_select"
  on workspace_members for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_members_manage"
  on workspace_members for all to authenticated
  using (public.user_can_manage_workspace(workspace_id))
  with check (public.user_can_manage_workspace(workspace_id));

-- Replace permissive workspace policies
drop policy if exists "authenticated_read_workspaces" on workspaces;
drop policy if exists "deny_anon_workspaces" on workspaces;

create policy "workspaces_select_member"
  on workspaces for select to authenticated
  using (id in (select public.user_workspace_ids()));

create policy "workspaces_insert_authenticated"
  on workspaces for insert to authenticated
  with check (owner_id = auth.uid());

create policy "workspaces_update_manage"
  on workspaces for update to authenticated
  using (public.user_can_manage_workspace(id));

create policy "deny_anon_workspaces" on workspaces for all to anon using (false);

-- Projects: member read, admin write
drop policy if exists "authenticated_read_projects" on projects;
drop policy if exists "deny_anon_projects" on projects;

create policy "projects_select_member"
  on projects for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

create policy "projects_write_manage"
  on projects for insert to authenticated
  with check (public.user_can_manage_workspace(workspace_id));

create policy "projects_update_manage"
  on projects for update to authenticated
  using (public.user_can_manage_workspace(workspace_id));

create policy "projects_delete_manage"
  on projects for delete to authenticated
  using (public.user_can_manage_workspace(workspace_id));

create policy "deny_anon_projects" on projects for all to anon using (false);

-- Collections
create policy "collections_select_member"
  on collections for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

create policy "collections_write_manage"
  on collections for all to authenticated
  using (public.user_can_manage_workspace(workspace_id))
  with check (public.user_can_manage_workspace(workspace_id));

create policy "deny_anon_collections" on collections for all to anon using (false);

-- Cost categories
create policy "cost_categories_select_member"
  on cost_categories for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

create policy "cost_categories_write_manage"
  on cost_categories for all to authenticated
  using (public.user_can_manage_workspace(workspace_id))
  with check (public.user_can_manage_workspace(workspace_id));

create policy "deny_anon_cost_categories" on cost_categories for all to anon using (false);

-- Tighten existing read policies to membership scope
drop policy if exists "authenticated_read_vendors" on vendors;
drop policy if exists "authenticated_read_cost_messages" on cost_messages;
drop policy if exists "authenticated_read_budgets" on budgets;
drop policy if exists "authenticated_read_pricing_rules" on pricing_rules;

create policy "vendors_select_member"
  on vendors for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

create policy "cost_messages_select_member"
  on cost_messages for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

create policy "budgets_select_member"
  on budgets for select to authenticated
  using (workspace_id in (select public.user_workspace_ids()));

create policy "pricing_rules_select_member"
  on pricing_rules for select to authenticated
  using (workspace_id is null or workspace_id in (select public.user_workspace_ids()));

-- Slug helper for onboarding
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, 'workspace')), '[^a-z0-9]+', '-', 'g'));
$$;

-- Seed default categories for a workspace
create or replace function public.seed_workspace_defaults(ws_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into cost_categories (workspace_id, name, slug, sort_order) values
    (ws_id, 'AI Usage', 'ai-usage', 0),
    (ws_id, 'Subscriptions', 'subscriptions', 1),
    (ws_id, 'Infrastructure', 'infrastructure', 2),
    (ws_id, 'Other', 'other', 3)
  on conflict (workspace_id, slug) do nothing;

  insert into cost_categories (workspace_id, parent_id, name, slug, sort_order)
  select ws_id, c.id, v.name, v.slug, v.sort_order
  from cost_categories c
  cross join (values
    ('LLM Tokens', 'llm-tokens', 0),
    ('Image Generation', 'image-generation', 1),
    ('Voice & Audio', 'voice-audio', 2)
  ) as v(name, slug, sort_order)
  where c.workspace_id = ws_id and c.slug = 'ai-usage'
  on conflict (workspace_id, slug) do nothing;

  insert into collections (workspace_id, name, slug, description, sort_order) values
    (ws_id, 'Production', 'production', 'Live apps and services', 0),
    (ws_id, 'Experiments', 'experiments', 'Prototypes and R&D', 1)
  on conflict (workspace_id, slug) do nothing;

  insert into budgets (workspace_id, scope_type, name, amount, currency, period)
  select ws_id, 'global', 'Monthly spend', 100, 'USD', 'monthly'
  where not exists (
    select 1 from budgets where workspace_id = ws_id and scope_type = 'global'
  );
end;
$$;

-- Auto-provision profile + personal workspace on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  base_slug text;
  final_slug text;
  display text;
begin
  display := coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );
  base_slug := public.slugify(display);
  final_slug := base_slug;

  -- Ensure unique workspace slug
  while exists (select 1 from workspaces where slug = final_slug) loop
    final_slug := base_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into workspaces (name, slug, owner_id, type, description)
  values (
    display || '''s Costs',
    final_slug,
    new.id,
    'personal',
    'Your personal cost account'
  )
  returning id into ws_id;

  insert into profiles (id, email, display_name, default_workspace_id)
  values (new.id, new.email, display, ws_id);

  insert into workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  perform public.seed_workspace_defaults(ws_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
