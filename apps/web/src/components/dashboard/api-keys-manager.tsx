"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, SelectField } from "@/components/ui/form-field";
import { DashboardPanel, StatusBadge } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/client";
import { CodeBlock, CopyRow } from "@/components/dashboard/dashboard-code";

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

type ProjectOption = { id: string; slug: string; name: string };

const ALL_PERMISSIONS: Array<{ id: string; label: string }> = [
  { id: "log_usage", label: "Log usage" },
  { id: "add_expenses", label: "Add expenses" },
  { id: "read_summaries", label: "Read summaries" },
  { id: "estimate_costs", label: "Estimate costs" },
];

const PERMISSION_LABEL = Object.fromEntries(ALL_PERMISSIONS.map((p) => [p.id, p.label]));

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

function buildMcpApiKeySnippet(mcpUrl: string, secret: string | null) {
  const key = secret ?? "cmcp_live_your_key_here";
  return JSON.stringify(
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
  );
}

function formatPermissions(permissions: string[]) {
  return permissions.map((p) => PERMISSION_LABEL[p] ?? p).join(" · ");
}

function KeyFormFields({
  form,
  setForm,
  projectOptions,
  idPrefix,
  showAdvancedToggle = true,
}: {
  form: KeyFormState;
  setForm: React.Dispatch<React.SetStateAction<KeyFormState>>;
  projectOptions: Array<{ value: string; label: string }>;
  idPrefix: string;
  showAdvancedToggle?: boolean;
}) {
  return (
    <>
      <FormField
        id={`${idPrefix}-name`}
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
          id={`${idPrefix}-project`}
          label="Project scope"
          value={form.project_id}
          onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
          options={projectOptions}
        />
        <FormField
          id={`${idPrefix}-limit`}
          label="Monthly limit (USD)"
          type="number"
          min="0"
          step="0.01"
          value={form.monthly_limit}
          onChange={(e) => setForm((f) => ({ ...f, monthly_limit: e.target.value }))}
          placeholder="Unlimited"
        />
        <FormField
          id={`${idPrefix}-expires`}
          label="Expires"
          type="datetime-local"
          value={form.expires_at}
          onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
        />
      </div>

      {showAdvancedToggle ? (
        <button
          type="button"
          className="key-advanced-toggle"
          onClick={() => setForm((f) => ({ ...f, showAdvanced: !f.showAdvanced }))}
        >
          {form.showAdvanced ? "Hide advanced" : "Advanced"}
        </button>
      ) : null}

      {form.showAdvanced || !showAdvancedToggle ? (
        <div className="key-form__row">
          {showAdvancedToggle ? (
            <SelectField
              id={`${idPrefix}-env`}
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
          ) : null}
          <FormField
            id={`${idPrefix}-rpm`}
            label="Rate limit (req/min)"
            type="number"
            min="1"
            step="1"
            value={form.rate_limit_rpm}
            onChange={(e) => setForm((f) => ({ ...f, rate_limit_rpm: e.target.value }))}
            placeholder="Unlimited"
          />
          <FormField
            id={`${idPrefix}-cidrs`}
            label="Allowed CIDRs"
            value={form.allowed_cidrs}
            onChange={(e) => setForm((f) => ({ ...f, allowed_cidrs: e.target.value }))}
            placeholder="203.0.113.0/24, 198.51.100.10"
          />
        </div>
      ) : null}
    </>
  );
}

export function ApiKeysManager({
  workspaceSlug,
  apiUrl,
  mcpUrl,
}: {
  workspaceSlug: string;
  apiUrl: string;
  mcpUrl: string;
}) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<KeyFormState>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<KeyFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

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
      const [keysRes, orgRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/api-keys`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/org`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      if (keysRes.ok) setKeys((await keysRes.json()).keys ?? []);
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
      setError("Could not load API keys.");
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

  const projectOptions = [
    { value: "", label: "All projects" },
    ...projects.map((p) => ({ value: p.id, label: `${p.name} (${p.slug})` })),
  ];

  const activeCount = keys.filter((k) => k.status === "active").length;

  return (
    <div className="dashboard-page">
      <header className="dashboard-page__header">
        <h1 className="dashboard-page__title">API keys</h1>
        <p className="dashboard-page__sub">
          For CI, SDKs, and scripts. Secrets are shown once.
        </p>
      </header>

      <div className="dashboard-page__body dashboard-page__body--narrow">
        {error ? <p className="form-error">{error}</p> : null}

        {freshSecret ? (
          <div className="key-reveal">
            <div className="key-reveal__content">
              <p className="key-reveal__label">Copy this key now — it won&apos;t be shown again</p>
              <CopyRow value={freshSecret} mono />
            </div>
            <Button variant="ghost" onClick={() => setFreshSecret(null)}>
              Done
            </Button>
          </div>
        ) : null}

        <DashboardPanel title="Create key">
          <form onSubmit={createKey} className="key-form key-form--stacked">
            <KeyFormFields
              form={form}
              setForm={setForm}
              projectOptions={projectOptions}
              idPrefix="create"
            />
            <div className="key-form__actions">
              <Button type="submit" variant="ink" disabled={creating || !form.permissions.length}>
                {creating ? "Creating…" : "Create key"}
              </Button>
            </div>
          </form>
        </DashboardPanel>

        <DashboardPanel
          title="Keys"
          description={
            keys.length ? `${activeCount} active · ${keys.length} total` : "No keys yet."
          }
        >
          {loading ? (
            <p className="dashboard-panel__empty">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="dashboard-panel__empty">Create a key above to get started.</p>
          ) : (
            <ul className="key-list">
              {keys.map((key) => {
                const project = key.project_id ? projectById.get(key.project_id) : null;
                const limit = key.monthly_limit;
                const spent = key.spent_usd ?? 0;
                const pct = limit && limit > 0 ? Math.min(1, spent / limit) : null;
                const isEditing = editingId === key.id;
                const metaParts = [
                  project ? project.slug : "All projects",
                  key.expires_at
                    ? `Expires ${new Date(key.expires_at).toLocaleDateString()}`
                    : null,
                  key.rate_limit_rpm ? `${key.rate_limit_rpm}/min` : null,
                ].filter(Boolean);

                return (
                  <li key={key.id} className="key-list__item">
                    <div className="key-list__row">
                      <div className="key-list__main">
                        <div className="key-list__title">
                          <span className="key-list__name">{key.name}</span>
                          <StatusBadge>{key.status}</StatusBadge>
                        </div>
                        <div className="key-list__meta">
                          <code>{key.key_prefix}…</code>
                          <span>
                            {key.last_used_at
                              ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}`
                              : "Never used"}
                          </span>
                        </div>
                        {(key.permissions?.length || metaParts.length) ? (
                          <p className="key-list__detail">
                            {formatPermissions(key.permissions ?? [])}
                            {metaParts.length ? ` · ${metaParts.join(" · ")}` : null}
                          </p>
                        ) : null}
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
                      </div>

                      {key.status === "active" ? (
                        <div className="key-list__actions">
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

                    {isEditing ? (
                      <form onSubmit={saveEdit} className="key-form key-form--stacked key-form--edit">
                        <KeyFormFields
                          form={editForm}
                          setForm={setEditForm}
                          projectOptions={projectOptions}
                          idPrefix={`edit-${key.id}`}
                          showAdvancedToggle={false}
                        />
                        <div className="key-form__actions">
                          <Button type="submit" variant="ink" disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
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
          title="MCP clients"
          description="For clients without OAuth, bridge with mcp-remote and pass the key as a header."
        >
          <CodeBlock code={buildMcpApiKeySnippet(mcpUrl, freshSecret)} />
          <p className="connections__hint">
            Prefer OAuth when possible — see{" "}
            <Link href={`/dashboard/${workspaceSlug}/connections`}>Connections</Link>.
          </p>
        </DashboardPanel>
      </div>
    </div>
  );
}
