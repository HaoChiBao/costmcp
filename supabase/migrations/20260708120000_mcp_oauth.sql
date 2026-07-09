-- Remote MCP server: OAuth 2.1 authorization server + connection tracking
--
-- The MCP endpoint acts as an OAuth 2.1 Resource Server. This migration adds the
-- authorization-server storage (dynamically registered clients, PKCE auth codes,
-- issued access/refresh tokens) plus a user-facing mcp_connections record used by
-- the dashboard to list and revoke authorized AI clients (Cursor, Claude, ChatGPT).
--
-- All of these tables are managed exclusively by the API using the service role.
-- RLS denies anon/authenticated by default; mcp_connections additionally grants
-- each user read access to their own connections for defense in depth.

-- Dynamically registered OAuth clients (RFC 7591). MCP clients are public clients
-- using PKCE, so client_secret_hash is typically null.
create table if not exists oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  client_secret_hash text,
  client_name text,
  redirect_uris text[] not null default array[]::text[],
  grant_types text[] not null default array['authorization_code', 'refresh_token'],
  response_types text[] not null default array['code'],
  token_endpoint_auth_method text not null default 'none',
  scope text,
  logo_uri text,
  client_uri text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- User-facing record of an authorized MCP client connection. One row per approved
-- authorization grant; tokens hang off this so revoking cascades.
create table if not exists mcp_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references oauth_clients(client_id) on delete cascade,
  client_name text,
  scope text not null default '',
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists mcp_connections_user_idx on mcp_connections(user_id);
create index if not exists mcp_connections_workspace_idx on mcp_connections(workspace_id);

-- Short-lived PKCE authorization codes (RFC 7636). Consumed on token exchange.
create table if not exists oauth_authorization_codes (
  code_hash text primary key,
  client_id text not null references oauth_clients(client_id) on delete cascade,
  connection_id uuid references mcp_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  redirect_uri text not null,
  scope text not null default '',
  resource text,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Issued access + refresh tokens. Only SHA-256 hashes are stored.
create table if not exists oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references mcp_connections(id) on delete cascade,
  client_id text not null references oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  access_token_hash text not null unique,
  refresh_token_hash text unique,
  scope text not null default '',
  resource text,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists oauth_tokens_connection_idx on oauth_tokens(connection_id);
create index if not exists oauth_tokens_access_hash_idx on oauth_tokens(access_token_hash);
create index if not exists oauth_tokens_refresh_hash_idx on oauth_tokens(refresh_token_hash);

-- RLS: service role only, except users may view their own connections.
alter table oauth_clients enable row level security;
alter table mcp_connections enable row level security;
alter table oauth_authorization_codes enable row level security;
alter table oauth_tokens enable row level security;

create policy "deny_anon_oauth_clients" on oauth_clients for all to anon using (false);
create policy "deny_authenticated_oauth_clients" on oauth_clients for all to authenticated using (false);

create policy "deny_anon_oauth_codes" on oauth_authorization_codes for all to anon using (false);
create policy "deny_authenticated_oauth_codes" on oauth_authorization_codes for all to authenticated using (false);

create policy "deny_anon_oauth_tokens" on oauth_tokens for all to anon using (false);
create policy "deny_authenticated_oauth_tokens" on oauth_tokens for all to authenticated using (false);

create policy "deny_anon_mcp_connections" on mcp_connections for all to anon using (false);
create policy "mcp_connections_select_own"
  on mcp_connections for select to authenticated
  using (user_id = auth.uid());

-- Allow dashboard users to mint/revoke their own api keys via the API. Writes are
-- still funneled through the API (which sets created_by), but we relax the blanket
-- deny so RLS-scoped reads work if ever needed.
alter table api_keys
  add column if not exists created_by uuid references auth.users(id) on delete set null;
