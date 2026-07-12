"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardPanel, StatusBadge } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/client";
import { CodeBlock, CopyRow } from "@/components/dashboard/dashboard-code";

type Connection = {
  id: string;
  client_id: string;
  client_name: string | null;
  scope: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
};

type ClientId = "cursor" | "claude" | "chatgpt";

const CLIENT_TABS: Array<{ id: ClientId; label: string }> = [
  { id: "cursor", label: "Cursor" },
  { id: "claude", label: "Claude" },
  { id: "chatgpt", label: "ChatGPT" },
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
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const res = await fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/connections`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) setConnections((await res.json()).connections ?? []);
    } catch {
      setError("Could not load connections.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, workspaceSlug, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revokeConnection(id: string) {
    const accessToken = await token();
    if (!accessToken) return;
    await fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/connections/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    void load();
  }

  const snippet = buildSnippet(activeTab, mcpUrl);

  return (
    <div className="dashboard-page">
      <header className="dashboard-page__header">
        <h1 className="dashboard-page__title">Connections</h1>
        <p className="dashboard-page__sub">
          Connect Cursor, Claude, or ChatGPT over MCP with OAuth. For CI and scripts, use{" "}
          <Link href={`/dashboard/${workspaceSlug}/api-keys`}>API keys</Link>.
        </p>
      </header>

      <div className="dashboard-page__body">
        {error ? <p className="form-error">{error}</p> : null}

        <div className="dashboard-page__grid dashboard-page__grid--split">
          <DashboardPanel
            title="Remote MCP server"
            description="Point any MCP-compatible client at this URL. Clients that support OAuth will prompt you to sign in and pick a workspace."
          >
            <CopyRow value={mcpUrl} />

            <div className="client-tabs" role="tablist">
              {CLIENT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
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
            title="Authorized clients"
            description="AI clients that completed the OAuth flow for this workspace."
          >
            {loading ? (
              <p className="dashboard-panel__empty">Loading…</p>
            ) : connections.length === 0 ? (
              <p className="dashboard-panel__empty">
                No connected clients yet. Add the MCP URL in Cursor, Claude, or ChatGPT to get
                started.
              </p>
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
      </div>
    </div>
  );
}

function buildSnippet(tab: ClientId, mcpUrl: string): { hint: string; code: string } {
  switch (tab) {
    case "cursor":
      return {
        hint: "Add to ~/.cursor/mcp.json (or the project .cursor/mcp.json). Cursor opens a browser to authorize.",
        code: JSON.stringify({ mcpServers: { costmcp: { url: mcpUrl } } }, null, 2),
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
  }
}
