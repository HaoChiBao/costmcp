-- Map Google OAuth metadata into profile display name and avatar on signup.
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
  avatar text;
begin
  display := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  base_slug := public.slugify(display);
  final_slug := base_slug;

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

  insert into profiles (id, email, display_name, avatar_url, default_workspace_id)
  values (new.id, new.email, display, avatar, ws_id);

  insert into workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  perform public.seed_workspace_defaults(ws_id);

  return new;
end;
$$;
