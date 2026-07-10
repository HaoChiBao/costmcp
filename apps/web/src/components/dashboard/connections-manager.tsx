"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, SelectField } from "@/components/ui/form-field";
import { DashboardPanel, StatusBadge } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/client";

type KeyConditions = {
  version?: 1;
  project_slugs?: string[];
  deny_project_slugs?: string[];
  features?: string[];
  sources?: string[];
  notes?: string;
};

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  environment: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
  project_id: string | null;
  monthly_limit: number | null;
  expires_at: string | null;
  rate_limit_rpm: number | null;
  allowed_cidrs: string[];
  conditions: KeyConditions;
  spent_usd: number | null;
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

type ProjectOption = { id: string; slug: string; name: string };

type ClientId = "cursor" | "claude" | "chatgpt" | "apikey";

const CLIENT_TABS: Array<{ id: ClientId; label: string }> = [
  { id: "cursor", label: "Cursor" },
  { id: "claude", label: "Claude" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "apikey", label: "API key (any client)" },
];

const ALL_PERMISSIONS: Array<{ id: string; label: string }> = [
  { id: "log_usage", label: "Log usage" },
  { id: "add_expenses", label: "Add expenses" },
  { id: "read_summaries", label: "Read summaries" },
  { id: "estimate_costs", label: "Estimate costs" },
];

const DEFAULT_PERMS = ALL_PERMISSIONS.map((p) => p.id);

type KeyFormState = {
  name: string;
  permissions: string[];
  project_id: string;
  monthly_limit: string;
  expires_at: string;
  rate_limit_rpm: string;
  allowed_cidrs: string;
  environment: "live" | "test";
  showAdvanced: boolean;
};

const emptyForm = (): KeyFormState => ({
  name: "",
  permissions: [...DEFAULT_PERMS],
  project_id: "",
  monthly_limit: "",
  expires_at: "",
  rate_limit_rpm: "",
  allowed_cidrs: "",
  environment: "live",
  showAdvanced: false,
});

function formToBody(form: KeyFormState) {
  return {
    name: form.name.trim(),
    permissions: form.permissions,
    project_id: form.project_id || null,
    monthly_limit: form.monthly_limit ? Number(form.monthly_limit) : null,
    expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    rate_limit_rpm: form.rate_limit_rpm ? Number(form.rate_limit_rpm) : null,
    allowed_cidrs: form.allowed_cidrs
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    environment: form.environment,
  };
}

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
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<KeyFormState>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<KeyFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<ClientId>("cursor");

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

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
      const [keysRes, connsRes, orgRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/api-keys`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/connections`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/org`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      if (keysRes.ok) setKeys((await keysRes.json()).keys ?? []);
      if (connsRes.ok) setConnections((await connsRes.json()).connections ?? []);
      if (orgRes.ok) {
        const org = await orgRes.json();
        const list: ProjectOption[] = [];
        for (const collection of org.collections ?? []) {
          for (const project of collection.projects ?? []) {
            list.push({ id: project.id, slug: project.slug, name: project.name });
          }
        }
        for (const project of org.ungrouped_projects ?? []) {
          list.push({ id: project.id, slug: project.slug, name: project.name });
        }
        setProjects(list);
      }
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
    if (!form.name.trim()) return;
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
      body: JSON.stringify(formToBody(form)),
    });
    setCreating(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create key.");
      return;
    }
    const { key } = await res.json();
    setFreshSecret(key.secret);
    setForm(emptyForm());
    void load();
  }

  function startEdit(key: ApiKey) {
    setEditingId(key.id);
    setEditForm({
      name: key.name,
      permissions: key.permissions?.length ? [...key.permissions] : [...DEFAULT_PERMS],
      project_id: key.project_id ?? "",
      monthly_limit: key.monthly_limit != null ? String(key.monthly_limit) : "",
      expires_at: key.expires_at ? key.expires_at.slice(0, 16) : "",
      rate_limit_rpm: key.rate_limit_rpm != null ? String(key.rate_limit_rpm) : "",
      allowed_cidrs: (key.allowed_cidrs ?? []).join(", "),
      environment: key.environment === "test" ? "test" : "live",
      showAdvanced: Boolean(key.rate_limit_rpm || key.allowed_cidrs?.length),
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError(null);
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session expired. Please sign in again.");
      setSaving(false);
      return;
    }
    const res = await fetch(
      `${apiUrl}/api/v1/workspaces/${workspaceSlug}/api-keys/${editingId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formToBody(editForm)),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not update key.");
      return;
    }
    setEditingId(null);
    void load();
  }

  async function rotateKey(id: string) {
    const accessToken = await token();
    if (!accessToken) return;
    const res = await fetch(
      `${apiUrl}/api/v1/workspaces/${workspaceSlug}/api-keys/${id}/rotate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) {
      setError("Could not rotate key.");
      return;
    }
    const { key } = await res.json();
    setFreshSecret(key.secret);
    void load();
  }

  async function revokeKey(id: string) {
    const accessToken = await token();
    if (!accessToken) return;
    await fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/api-keys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (editingId === id) setEditingId(null);
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
  const projectOptions = [
    { value: "", label: "All projects" },
    ...projects.map((p) => ({ value: p.id, label: `${p.name} (${p.slug})` })),
  ];

  return (
    <div className="connections">
      <header className="headline-block headline-block--left">
        <h1 className="display">Connections &amp; API keys</h1>
        <p className="headline-block__sub">
          Connect Cursor, Claude, or ChatGPT over MCP with OAuth, or create API keys for
          CI pipelines, SDKs, and scripts.
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
        title="API keys"
        description="Generate keys for CI, SDKs, and scripts. Attach permissions, project scope, spend caps, and expiry. Secrets are shown once."
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

        <form onSubmit={createKey} className="key-form key-form--stacked">
          <FormField
            label="Key name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Production server, CI pipeline…"
            required
          />

          <fieldset className="key-perms">
            <legend className="field__label">Permissions</legend>
            <div className="key-perms__grid">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm.id} className="key-check">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(perm.id)}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        permissions: e.target.checked
                          ? [...f.permissions, perm.id]
                          : f.permissions.filter((p) => p !== perm.id),
                      }));
                    }}
                  />
                  {perm.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="key-form__row">
            <SelectField
              label="Project scope"
              value={form.project_id}
              onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
              options={projectOptions}
            />
            <FormField
              label="Monthly limit (USD)"
              type="number"
              min="0"
              step="0.01"
              value={form.monthly_limit}
              onChange={(e) => setForm((f) => ({ ...f, monthly_limit: e.target.value }))}
              placeholder="Unlimited"
            />
            <FormField
              label="Expires"
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
            />
          </div>

          <button
            type="button"
            className="key-advanced-toggle"
            onClick={() => setForm((f) => ({ ...f, showAdvanced: !f.showAdvanced }))}
          >
            {form.showAdvanced ? "Hide advanced" : "Advanced conditions"}
          </button>

          {form.showAdvanced ? (
            <div className="key-form__row">
              <SelectField
                label="Environment"
                value={form.environment}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    environment: e.target.value === "test" ? "test" : "live",
                  }))
                }
                options={[
                  { value: "live", label: "Live" },
                  { value: "test", label: "Test" },
                ]}
              />
              <FormField
                label="Rate limit (req/min)"
                type="number"
                min="1"
                step="1"
                value={form.rate_limit_rpm}
                onChange={(e) => setForm((f) => ({ ...f, rate_limit_rpm: e.target.value }))}
                placeholder="Unlimited"
              />
              <FormField
                label="Allowed CIDRs"
                value={form.allowed_cidrs}
                onChange={(e) => setForm((f) => ({ ...f, allowed_cidrs: e.target.value }))}
                placeholder="203.0.113.0/24, 198.51.100.10"
              />
            </div>
          ) : null}

          <Button type="submit" variant="ink" disabled={creating || !form.permissions.length}>
            {creating ? "Creating…" : "Create key"}
          </Button>
        </form>

        {loading ? (
          <p className="dashboard-panel__empty">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="dashboard-panel__empty">No API keys yet.</p>
        ) : (
          <ul className="connection-list">
            {keys.map((key) => {
              const project = key.project_id ? projectById.get(key.project_id) : null;
              const limit = key.monthly_limit;
              const spent = key.spent_usd ?? 0;
              const pct = limit && limit > 0 ? Math.min(1, spent / limit) : null;
              const isEditing = editingId === key.id;

              return (
                <li key={key.id} className="connection-list__item connection-list__item--block">
                  <div className="connection-list__header">
                    <div className="connection-list__main">
                      <span className="connection-list__name">{key.name}</span>
                      <StatusBadge>{key.status}</StatusBadge>
                      <code className="connection-list__meta">{key.key_prefix}…</code>
                      <span className="connection-list__meta">
                        {key.last_used_at
                          ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}`
                          : "Never used"}
                      </span>
                    </div>
                    {key.status === "active" ? (
                      <div className="connection-list__actions">
                        <Button variant="ghost" onClick={() => startEdit(key)}>
                          Edit
                        </Button>
                        <Button variant="ghost" onClick={() => rotateKey(key.id)}>
                          Rotate
                        </Button>
                        <Button variant="ghost" onClick={() => revokeKey(key.id)}>
                          Revoke
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="key-meta-chips">
                    {(key.permissions ?? []).map((p) => (
                      <span key={p} className="key-chip">
                        {p}
                      </span>
                    ))}
                    <span className="key-chip">
                      {project ? `Project: ${project.slug}` : "All projects"}
                    </span>
                    {key.expires_at ? (
                      <span className="key-chip">
                        Expires {new Date(key.expires_at).toLocaleDateString()}
                      </span>
                    ) : null}
                    {key.rate_limit_rpm ? (
                      <span className="key-chip">{key.rate_limit_rpm}/min</span>
                    ) : null}
                  </div>

                  {pct != null ? (
                    <div className="key-usage">
                      <div className="key-usage__label">
                        ${spent.toFixed(2)} / ${limit!.toFixed(2)} this month
                      </div>
                      <div className="key-usage__track" aria-hidden>
                        <div
                          className="key-usage__fill"
                          style={{ width: `${Math.round(pct * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {isEditing ? (
                    <form onSubmit={saveEdit} className="key-form key-form--stacked key-form--edit">
                      <FormField
                        label="Key name"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        required
                      />
                      <fieldset className="key-perms">
                        <legend className="field__label">Permissions</legend>
                        <div className="key-perms__grid">
                          {ALL_PERMISSIONS.map((perm) => (
                            <label key={perm.id} className="key-check">
                              <input
                                type="checkbox"
                                checked={editForm.permissions.includes(perm.id)}
                                onChange={(e) => {
                                  setEditForm((f) => ({
                                    ...f,
                                    permissions: e.target.checked
                                      ? [...f.permissions, perm.id]
                                      : f.permissions.filter((p) => p !== perm.id),
                                  }));
                                }}
                              />
                              {perm.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div className="key-form__row">
                        <SelectField
                          label="Project scope"
                          value={editForm.project_id}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, project_id: e.target.value }))
                          }
                          options={projectOptions}
                        />
                        <FormField
                          label="Monthly limit (USD)"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.monthly_limit}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, monthly_limit: e.target.value }))
                          }
                        />
                        <FormField
                          label="Expires"
                          type="datetime-local"
                          value={editForm.expires_at}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, expires_at: e.target.value }))
                          }
                        />
                      </div>
                      <div className="key-form__row">
                        <FormField
                          label="Rate limit (req/min)"
                          type="number"
                          min="1"
                          value={editForm.rate_limit_rpm}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, rate_limit_rpm: e.target.value }))
                          }
                        />
                        <FormField
                          label="Allowed CIDRs"
                          value={editForm.allowed_cidrs}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, allowed_cidrs: e.target.value }))
                          }
                        />
                      </div>
                      <div className="connection-list__actions">
                        <Button type="submit" variant="ink" disabled={saving}>
                          {saving ? "Saving…" : "Save conditions"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </li>
              );
            })}
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
                args: [
                  "-y",
                  "mcp-remote",
                  mcpUrl,
                  "--header",
                  `Authorization: Bearer ${key}`,
                ],
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
        type="button"
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
