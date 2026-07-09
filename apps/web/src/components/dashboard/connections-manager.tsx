"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { DashboardPanel, StatusBadge } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/client";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  environment: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
};

type Connection = {
  id: string;
  client_id: string;
  client_name: string | null;
  scope: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
};

type ClientId = "cursor" | "claude" | "chatgpt" | "apikey";

const CLIENT_TABS: Array<{ id: ClientId; label: string }> = [
  { id: "cursor", label: "Cursor" },
  { id: "claude", label: "Claude" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "apikey", label: "API key (any client)" },
];

export function ConnectionsManager({
  workspaceSlug,
  apiUrl,
  mcpUrl,
}: {
  workspaceSlug: string;
  apiUrl: string;
  mcpUrl: string;
}) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ClientId>("cursor");

  const token = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session expired. Please sign in again.");
      setLoading(false);
      return;
    }
    try {
      const [keysRes, connsRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/api-keys`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/connections`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      if (keysRes.ok) setKeys((await keysRes.json()).keys ?? []);
      if (connsRes.ok) setConnections((await connsRes.json()).connections ?? []);
    } catch {
      setError("Could not load connections.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, workspaceSlug, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session expired. Please sign in again.");
      setCreating(false);
      return;
    }
    const res = await fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/api-keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    setCreating(false);
    if (!res.ok) {
      setError("Could not create key.");
      return;
    }
    const { key } = await res.json();
    setFreshSecret(key.secret);
    setNewKeyName("");
    void load();
  }

  async function revokeKey(id: string) {
    const accessToken = await token();
    if (!accessToken) return;
    await fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/api-keys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    void load();
  }

  async function revokeConnection(id: string) {
    const accessToken = await token();
    if (!accessToken) return;
    await fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/connections/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    void load();
  }

  const snippet = buildSnippet(activeTab, mcpUrl, freshSecret);

  return (
    <div className="connections">
      <header className="headline-block headline-block--left">
        <h1 className="display">Connect to AI clients</h1>
        <p className="headline-block__sub">
          Give Cursor, Claude, or ChatGPT secure access to this workspace&rsquo;s cost
          tools over the Model Context Protocol.
        </p>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <DashboardPanel
        title="Remote MCP server URL"
        description="Point any MCP-compatible client at this URL. Clients that support OAuth will prompt you to sign in and pick a workspace — no key needed."
      >
        <CopyRow value={mcpUrl} />

        <div className="client-tabs" role="tablist">
          {CLIENT_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`client-tabs__tab${activeTab === tab.id ? " client-tabs__tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="connections__hint">{snippet.hint}</p>
        <CodeBlock code={snippet.code} />
      </DashboardPanel>

      <DashboardPanel
        title="API keys"
        description="Static keys for CI, scripts, or clients without OAuth. Shown once — store it somewhere safe."
      >
        {freshSecret ? (
          <div className="key-reveal">
            <p className="key-reveal__label">New key (copy it now):</p>
            <CopyRow value={freshSecret} mono />
            <Button variant="ghost" onClick={() => setFreshSecret(null)}>
              Done
            </Button>
          </div>
        ) : null}

        <form onSubmit={createKey} className="key-form">
          <FormField
            label="Key name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Production server, CI pipeline…"
          />
          <Button type="submit" variant="ink" disabled={creating}>
            {creating ? "Creating…" : "Create key"}
          </Button>
        </form>

        {loading ? (
          <p className="dashboard-panel__empty">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="dashboard-panel__empty">No API keys yet.</p>
        ) : (
          <ul className="connection-list">
            {keys.map((key) => (
              <li key={key.id} className="connection-list__item">
                <div className="connection-list__main">
                  <span className="connection-list__name">{key.name}</span>
                  <code className="connection-list__meta">{key.key_prefix}…</code>
                  <span className="connection-list__meta">
                    {key.last_used_at
                      ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}`
                      : "Never used"}
                  </span>
                </div>
                <Button variant="ghost" onClick={() => revokeKey(key.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>

      <DashboardPanel
        title="Authorized clients"
        description="AI clients that completed the OAuth flow for this workspace."
      >
        {loading ? (
          <p className="dashboard-panel__empty">Loading…</p>
        ) : connections.length === 0 ? (
          <p className="dashboard-panel__empty">No connected clients yet.</p>
        ) : (
          <ul className="connection-list">
            {connections.map((conn) => (
              <li key={conn.id} className="connection-list__item">
                <div className="connection-list__main">
                  <span className="connection-list__name">
                    {conn.client_name ?? "MCP client"}
                  </span>
                  <StatusBadge>{conn.scope.split(" ").length} scopes</StatusBadge>
                  <span className="connection-list__meta">
                    {conn.last_used_at
                      ? `Active ${new Date(conn.last_used_at).toLocaleDateString()}`
                      : `Added ${new Date(conn.created_at).toLocaleDateString()}`}
                  </span>
                </div>
                <Button variant="ghost" onClick={() => revokeConnection(conn.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>
    </div>
  );
}

function buildSnippet(
  tab: ClientId,
  mcpUrl: string,
  freshSecret: string | null,
): { hint: string; code: string } {
  const key = freshSecret ?? "cmcp_live_your_key_here";
  switch (tab) {
    case "cursor":
      return {
        hint: "Add to ~/.cursor/mcp.json (or the project .cursor/mcp.json). Cursor opens a browser to authorize.",
        code: JSON.stringify(
          { mcpServers: { costmcp: { url: mcpUrl } } },
          null,
          2,
        ),
      };
    case "claude":
      return {
        hint: "Claude → Settings → Connectors → Add custom connector. Paste the URL below; Claude will run the OAuth sign-in.",
        code: mcpUrl,
      };
    case "chatgpt":
      return {
        hint: "ChatGPT → Settings → Connectors → Create. Use Streamable HTTP transport with OAuth and this URL.",
        code: mcpUrl,
      };
    case "apikey":
      return {
        hint: "For clients without OAuth, bridge with mcp-remote and pass an API key as a header.",
        code: JSON.stringify(
          {
            mcpServers: {
              costmcp: {
                command: "npx",
                args: ["-y", "mcp-remote", mcpUrl, "--header", `Authorization: Bearer ${key}`],
              },
            },
          },
          null,
          2,
        ),
      };
  }
}

function CopyRow({ value, mono }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-row">
      <code className={`copy-row__value${mono ? " copy-row__value--mono" : ""}`}>{value}</code>
      <Button
        variant="ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <button
        className="code-block__copy"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="code-block__pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
