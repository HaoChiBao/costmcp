"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type StoredLink = {
  linkToken: string;
  workspaceSlug: string;
  updateItemId?: string | null;
};

const STORAGE_KEY = "costmcp_plaid_link";

export default function PlaidOAuthReturnPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Completing bank connection…");
  const [stored, setStored] = useState<StoredLink | null>(null);
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReceivedRedirectUri(window.location.href);
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setError("Missing Link session. Go back to Banks and connect again.");
        return;
      }
      setStored(JSON.parse(raw) as StoredLink);
    } catch {
      setError("Could not restore Link session.");
    }
  }, []);

  const finish = useCallback(
    async (
      publicToken: string,
      metadata: { institution?: { institution_id: string; name: string } | null },
    ) => {
      if (!stored) return;
      setStatus("Saving connection…");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Your session expired. Sign in and try again.");
        return;
      }

      try {
        if (!stored.updateItemId) {
          const res = await fetch(
            `${API_URL}/api/v1/workspaces/${stored.workspaceSlug}/plaid/exchange`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                public_token: publicToken,
                institution: metadata.institution ?? null,
              }),
            },
          );
          const body = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(body.error ?? "Failed to link bank");
        } else {
          const res = await fetch(
            `${API_URL}/api/v1/workspaces/${stored.workspaceSlug}/plaid/items/${stored.updateItemId}/sync`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
            },
          );
          if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            throw new Error(body.error ?? "Reconnect sync failed");
          }
        }
        sessionStorage.removeItem(STORAGE_KEY);
        router.replace(`/dashboard/${stored.workspaceSlug}/bank-connections`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not finish linking");
      }
    },
    [stored, router],
  );

  const config = useMemo(
    () => ({
      token: stored?.linkToken ?? null,
      receivedRedirectUri: receivedRedirectUri ?? undefined,
      onSuccess: finish,
      onExit: () => {
        sessionStorage.removeItem(STORAGE_KEY);
        if (stored?.workspaceSlug) {
          router.replace(`/dashboard/${stored.workspaceSlug}/bank-connections`);
        } else {
          router.replace("/dashboard");
        }
      },
    }),
    [stored, receivedRedirectUri, finish, router],
  );

  const { open, ready } = usePlaidLink(config);
  const openRef = useRef(open);
  openRef.current = open;
  const openedRef = useRef(false);

  useEffect(() => {
    if (!ready || !stored || !receivedRedirectUri || openedRef.current) return;
    openedRef.current = true;
    openRef.current();
  }, [ready, stored, receivedRedirectUri]);

  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Plaid</h1>
      {error ? <p className="form-error">{error}</p> : <p className="muted">{status}</p>}
    </main>
  );
}
