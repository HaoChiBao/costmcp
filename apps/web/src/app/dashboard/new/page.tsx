"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { FormError, FormField, SelectField } from "@/components/ui/form-field";
import { DashboardPanel } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("team");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const res = await fetch(`${API_URL}/api/v1/workspaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, type }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Could not create workspace. Try again.");
      return;
    }

    const { workspace } = await res.json();
    router.push(`/dashboard/${workspace.slug}`);
    router.refresh();
  }

  return (
    <DashboardShell userLabel="New account" workspaces={[]}>
      <header className="dashboard-page-header">
        <div>
          <p className="meta-label">Setup</p>
          <h1 className="heading-sm">New cost account</h1>
        </div>
      </header>

      <DashboardPanel
        title="Workspace details"
        description="Create a separate workspace for a team, client, or side project."
      >
        <form onSubmit={handleSubmit} className="dashboard-form">
          <FormField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client projects, Side hustles…"
            required
          />
          <SelectField
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[
              { value: "personal", label: "Personal" },
              { value: "team", label: "Team" },
              { value: "organization", label: "Organization" },
            ]}
          />
          {error ? <FormError message={error} /> : null}
          <div className="dashboard-form__actions">
            <Button type="submit" variant="ink" disabled={loading}>
              {loading ? "Creating…" : "Create workspace"}
            </Button>
            <Button href="/dashboard" variant="ghost">
              Cancel
            </Button>
          </div>
        </form>
      </DashboardPanel>
    </DashboardShell>
  );
}
