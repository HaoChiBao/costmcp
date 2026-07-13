"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form-field";
import { createClient } from "@/lib/supabase/client";
import type { MeResponse } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function ConsentInner() {
  const router = useRouter();
  const params = useSearchParams();

  const clientName = params.get("client_name") ?? "An MCP client";
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? "";

  const [workspaces, setWorkspaces] = useState<MeResponse["workspaces"]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "working" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const consentUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.pathname + window.location.search;
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(consentUrl)}`);
        return;
      }
      if (!clientId || !redirectUri) {
        setError("This authorization request is missing required parameters.");
        setStatus("error");
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/v1/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const me = (await res.json()) as MeResponse;
        setWorkspaces(me.workspaces);
        setWorkspaceId(me.profile?.default_workspace_id ?? me.workspaces[0]?.id ?? "");
        setStatus("ready");
      } catch {
        setError("Could not load your workspaces.");
        setStatus("error");
      }
    }
    void init();
  }, [clientId, redirectUri, consentUrl, router]);

  async function approve() {
    setStatus("working");
    setError(null);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(consentUrl)}`);
      return;
    }

    const res = await fetch(`${API_URL}/api/oauth/consent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: params.get("code_challenge"),
        code_challenge_method: params.get("code_challenge_method") ?? "S256",
        scope: params.get("scope") ?? "",
        state,
        resource: params.get("resource") ?? undefined,
        workspace_id: workspaceId,
      }),
    });

    if (!res.ok) {
      setError("Authorization failed. Please try again.");
      setStatus("ready");
      return;
    }
    const { redirect } = await res.json();
    window.location.href = redirect;
  }

  function deny() {
    if (!redirectUri) return;
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Authorize connection</p>
        <h1 className="auth-page__title">{clientName}</h1>
        <p className="text-muted">
          wants to connect to CostMCP and access your cost tools: log usage, add
          expenses and subscriptions, read spend summaries, and manage projects.
        </p>

        {status === "loading" ? (
          <p className="text-muted">Loading…</p>
        ) : status === "error" ? (
          <p className="form-error">{error}</p>
        ) : (
          <div className="auth-form">
            <SelectField
              label="Grant access to workspace"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              options={workspaces.map((w) => ({
                value: w.id,
                label: `${w.name}${w.slug ? ` (${w.slug})` : ""}`,
              }))}
            />
            {error ? <p className="form-error">{error}</p> : null}
            <div className="dashboard-form__actions">
              <Button
                variant="ink"
                onClick={approve}
                disabled={status === "working" || !workspaceId}
              >
                {status === "working" ? "Authorizing…" : "Authorize"}
              </Button>
              <Button variant="ghost" onClick={deny} disabled={status === "working"}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={null}>
      <ConsentInner />
    </Suspense>
  );
}
