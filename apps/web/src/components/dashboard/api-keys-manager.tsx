"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CodeBlock, CopyRow } from "@/components/dashboard/dashboard-code";
import { Button } from "@/components/ui/button";
import { FieldSelect } from "@/components/ui/field-select";
import { FormField } from "@/components/ui/form-field";
import { LedgerModal } from "@/components/ui/ledger-modal";
import { MenuSelect } from "@/components/ui/menu-select";
import { DashboardPanel } from "@/components/ui/panel";
import { RowActions } from "@/components/ui/row-actions";
import { environmentTone } from "@/lib/org-colors";
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

type ProjectOption = { id: string; slug: string; name: string };

type StatusFilter = "all" | "active" | "revoked";

const ALL_PERMISSIONS: Array<{ id: string; label: string }> = [
  { id: "log_usage", label: "Log usage" },
  { id: "add_expenses", label: "Add expenses" },
  { id: "read_summaries", label: "Read summaries" },
  { id: "estimate_costs", label: "Estimate costs" },
];

const DEFAULT_PERMS = ALL_PERMISSIONS.map((p) => p.id);

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "revoked", label: "Revoked" },
];

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

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSpend(key: ApiKey) {
  const spent = key.spent_usd ?? 0;
  if (key.monthly_limit != null) {
    return `$${spent.toFixed(2)} / $${key.monthly_limit.toFixed(2)}`;
  }
  return `$${spent.toFixed(2)}`;
}

function keyInitial(name: string) {
  const trimmed = name.trim();
  return (trimmed.charAt(0) || "K").toUpperCase();
}

function keyEnvTone(environment: string) {
  return environmentTone(environment === "test" ? "development" : "production");
}

function keyMeta(key: ApiKey, projectSlug: string | null) {
  const parts = [`${key.key_prefix}…`];
  if (projectSlug) parts.push(projectSlug);
  else parts.push("all projects");
  if (key.environment === "test") parts.push("test");
  return parts.join(" · ");
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
        <FieldSelect
          label="Project scope"
          value={form.project_id}
          onChange={(value) => setForm((f) => ({ ...f, project_id: value }))}
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
            <FieldSelect
              label="Environment"
              value={form.environment}
              onChange={(value) =>
                setForm((f) => ({
                  ...f,
                  environment: value === "test" ? "test" : "live",
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
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

  const filteredKeys = useMemo(() => {
    if (statusFilter === "all") return keys;
    return keys.filter((key) => key.status === statusFilter);
  }, [keys, statusFilter]);

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

  function openCreate() {
    setForm(emptyForm());
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setForm(emptyForm());
  }

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
    closeCreate();
    void load();
  }

  function startEdit(key: ApiKey) {
    setCreateOpen(false);
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

  function closeEdit() {
    setEditingId(null);
    setEditForm(emptyForm());
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
    closeEdit();
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
    if (editingId === id) closeEdit();
    void load();
  }

  const projectOptions = [
    { value: "", label: "All projects" },
    ...projects.map((p) => ({ value: p.id, label: `${p.name} (${p.slug})` })),
  ];

  const editingKey = editingId ? keys.find((key) => key.id === editingId) : null;

  return (
    <div className="dashboard-page">
      <header className="dashboard-page__header">
        <div className="dashboard-page__header-row">
          <div>
            <h1 className="dashboard-page__title">API keys</h1>
            <p className="dashboard-page__sub">
              For CI, SDKs, and scripts. Secrets are shown once.
            </p>
          </div>
          <Button type="button" variant="ink" onClick={openCreate}>
            + Create key
          </Button>
        </div>
      </header>

      <div className="dashboard-page__body">
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

        <div className="dashboard-page__toolbar">
          <MenuSelect
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            ariaLabel="Filter by status"
            compact
            className="spend-filter"
          />
          <span className="dashboard-page__toolbar-count">
            {loading
              ? "Loading…"
              : `${filteredKeys.length} result${filteredKeys.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {loading ? (
          <p className="keys-feed__empty">Loading…</p>
        ) : !filteredKeys.length ? (
          <p className="keys-feed__empty">
            {keys.length
              ? "No keys match this filter."
              : "No API keys yet. Create a key to get started."}
          </p>
        ) : (
          <div className="keys-feed">
            <div className="keys-feed__head" aria-hidden="true">
              <span className="keys-feed__head-spacer" />
              <span>Name</span>
              <span>Key</span>
              <span>Status</span>
              <span className="keys-feed__head-date">Last used</span>
              <span className="keys-feed__head-amount">Spend</span>
              <span className="keys-feed__head-spacer keys-feed__head-spacer--actions" />
            </div>
            <ul className="keys-feed__list">
              {filteredKeys.map((key) => {
                const project = key.project_id ? projectById.get(key.project_id) : null;
                const tone = keyEnvTone(key.environment);
                const isSelected = key.id === editingId;
                const actions =
                  key.status === "active"
                    ? [
                        { label: "Edit", onClick: () => startEdit(key) },
                        { label: "Rotate", onClick: () => rotateKey(key.id) },
                        {
                          label: "Revoke",
                          onClick: () => revokeKey(key.id),
                          danger: true,
                        },
                      ]
                    : [];

                return (
                  <li key={key.id}>
                    <div
                      className={`keys-row${isSelected ? " keys-row--selected" : ""}`}
                    >
                      <span
                        className="keys-row__icon"
                        style={{ backgroundColor: tone.bg, color: tone.color }}
                        aria-hidden="true"
                      >
                        {keyInitial(key.name)}
                      </span>
                      <span className="keys-row__label">{key.name}</span>
                      <span className="keys-row__meta">
                        {keyMeta(key, project?.slug ?? null)}
                      </span>
                      <span className="keys-row__status">{key.status}</span>
                      <span className="keys-row__date">
                        {formatShortDate(key.last_used_at)}
                      </span>
                      <span className="keys-row__amount tabular-nums">
                        {formatSpend(key)}
                      </span>
                      <span className="keys-row__actions">
                        {actions.length ? <RowActions actions={actions} /> : null}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DashboardPanel
          title="MCP clients"
          description="For clients without OAuth, bridge with mcp-remote and pass the key as a header."
          className="keys-mcp-panel"
        >
          <CodeBlock code={buildMcpApiKeySnippet(mcpUrl, freshSecret)} />
          <p className="connections__hint">
            Prefer OAuth when possible — see{" "}
            <Link href={`/dashboard/${workspaceSlug}/connections`}>Connections</Link>.
          </p>
        </DashboardPanel>
      </div>

      <LedgerModal open={createOpen} title="Create key" onClose={closeCreate}>
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
            <Button type="button" variant="ghost" onClick={closeCreate}>
              Cancel
            </Button>
          </div>
        </form>
      </LedgerModal>

      <LedgerModal
        open={Boolean(editingId)}
        title={editingKey ? `Edit ${editingKey.name}` : "Edit key"}
        onClose={closeEdit}
      >
        <form onSubmit={saveEdit} className="key-form key-form--stacked">
          <KeyFormFields
            form={editForm}
            setForm={setEditForm}
            projectOptions={projectOptions}
            idPrefix={`edit-${editingId ?? "key"}`}
            showAdvancedToggle={false}
          />
          <div className="key-form__actions">
            <Button type="submit" variant="ink" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeEdit}>
              Cancel
            </Button>
          </div>
        </form>
      </LedgerModal>
    </div>
  );
}
