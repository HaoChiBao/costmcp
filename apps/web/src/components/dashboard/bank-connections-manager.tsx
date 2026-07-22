"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { DashboardPanel, StatusBadge } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/client";

type PlaidAccount = {
  id: string;
  name: string | null;
  official_name: string | null;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  currency: string | null;
  current_balance: number | null;
  available_balance: number | null;
};

type PlaidItem = {
  id: string;
  institution_name: string | null;
  institution_id: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  last_synced_at: string | null;
  accounts: PlaidAccount[];
};

type PlaidTransaction = {
  id: string;
  date: string;
  name: string | null;
  merchant_name: string | null;
  amount: number;
  iso_currency_code: string | null;
  pending: boolean;
  plaid_item_id: string;
};

function formatMoney(amount: number, currency: string | null) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "CAD",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

function statusBadgeProps(status: string): { warn?: boolean; strong?: boolean } {
  if (status === "active") return { strong: true };
  if (status === "login_required" || status === "pending_expiration" || status === "error") {
    return { warn: true };
  }
  return {};
}

export function BankConnectionsManager({
  workspaceSlug,
  apiUrl,
}: {
  workspaceSlug: string;
  apiUrl: string;
}) {
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [transactions, setTransactions] = useState<PlaidTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [updateItemId, setUpdateItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
      const [itemsRes, txRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/workspaces/${workspaceSlug}/plaid/items`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(
          `${apiUrl}/api/v1/workspaces/${workspaceSlug}/plaid/transactions?limit=40`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      ]);
      if (!itemsRes.ok) {
        const body = (await itemsRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Failed to load banks (${itemsRes.status})`);
      }
      const itemsJson = (await itemsRes.json()) as { items: PlaidItem[] };
      setItems(itemsJson.items ?? []);
      if (txRes.ok) {
        const txJson = (await txRes.json()) as { transactions: PlaidTransaction[] };
        setTransactions(txJson.transactions ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bank connections.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, workspaceSlug, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestLinkToken = useCallback(
    async (itemId?: string) => {
      setBusy(itemId ? `update:${itemId}` : "link");
      setError(null);
      const accessToken = await token();
      if (!accessToken) {
        setError("Your session expired. Please sign in again.");
        setBusy(null);
        return;
      }
      try {
        const res = await fetch(
          `${apiUrl}/api/v1/workspaces/${workspaceSlug}/plaid/link-token`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(itemId ? { item_id: itemId } : {}),
          },
        );
        const body = (await res.json()) as { link_token?: string; error?: string };
        if (!res.ok || !body.link_token) {
          throw new Error(body.error ?? "Could not create Plaid Link token");
        }
        setUpdateItemId(itemId ?? null);
        setLinkToken(body.link_token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Link token failed");
        setBusy(null);
      }
    },
    [apiUrl, workspaceSlug, token],
  );

  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { institution_id: string; name: string } | null }) => {
      const accessToken = await token();
      if (!accessToken) return;
      setBusy("exchange");
      try {
        // Update mode reuses the existing Item; only exchange for new links.
        if (!updateItemId) {
          const res = await fetch(
            `${apiUrl}/api/v1/workspaces/${workspaceSlug}/plaid/exchange`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
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
          // After update mode, force a sync to clear login_required.
          await fetch(
            `${apiUrl}/api/v1/workspaces/${workspaceSlug}/plaid/items/${updateItemId}/sync`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          );
        }
        setLinkToken(null);
        setUpdateItemId(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not complete bank link");
      } finally {
        setBusy(null);
      }
    },
    [apiUrl, workspaceSlug, token, updateItemId, load],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => {
      setLinkToken(null);
      setUpdateItemId(null);
      setBusy(null);
    },
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  async function syncItem(id: string) {
    const accessToken = await token();
    if (!accessToken) return;
    setBusy(`sync:${id}`);
    try {
      const res = await fetch(
        `${apiUrl}/api/v1/workspaces/${workspaceSlug}/plaid/items/${id}/sync`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Sync failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  }

  async function disconnectItem(id: string) {
    if (!confirm("Disconnect this bank? Synced transactions stay until cleaned up later.")) {
      return;
    }
    const accessToken = await token();
    if (!accessToken) return;
    setBusy(`disconnect:${id}`);
    try {
      const res = await fetch(
        `${apiUrl}/api/v1/workspaces/${workspaceSlug}/plaid/items/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Disconnect failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-page__header">
        <h1 className="dashboard-page__title">Bank connections</h1>
        <p className="dashboard-page__sub">
          Link Canadian (and other) banks via Plaid. Transactions sync into CostMCP separately
          from your cost ledger — import to expenses comes next.
        </p>
      </header>

      <div className="dashboard-page__body">
        {error ? <p className="form-error">{error}</p> : null}

        <div className="dashboard-page__grid dashboard-page__grid--split">
          <DashboardPanel
            title="Linked institutions"
            description="Connect RBC or any Plaid-supported bank. Reconnect when MFA or consent breaks the Item."
          >
            <div className="bank-list__toolbar">
              <Button
                type="button"
                onClick={() => void requestLinkToken()}
                disabled={Boolean(busy)}
              >
                {busy === "link" ? "Opening…" : "Connect bank"}
              </Button>
            </div>
            {loading ? (
              <p className="muted">Loading…</p>
            ) : items.length === 0 ? (
              <p className="muted">No banks linked yet. Start with Sandbox, then RBC in Production.</p>
            ) : (
              <ul className="bank-list">
                {items.map((item) => (
                  <li key={item.id} className="bank-list__item">
                    <div className="bank-list__head">
                      <div>
                        <strong>{item.institution_name ?? "Bank"}</strong>
                        <div className="muted">
                          {item.accounts.length} account
                          {item.accounts.length === 1 ? "" : "s"}
                          {item.last_synced_at
                            ? ` · synced ${new Date(item.last_synced_at).toLocaleString()}`
                            : ""}
                        </div>
                      </div>
                      <StatusBadge {...statusBadgeProps(item.status)}>
                        {item.status.replaceAll("_", " ")}
                      </StatusBadge>
                    </div>

                    {item.error_message ? (
                      <p className="form-error">{item.error_message}</p>
                    ) : null}

                    <ul className="bank-list__accounts">
                      {item.accounts.map((account) => (
                        <li key={account.id}>
                          <span>
                            {account.name ?? account.official_name ?? "Account"}
                            {account.mask ? ` ····${account.mask}` : ""}
                          </span>
                          <span>
                            {account.current_balance != null
                              ? formatMoney(account.current_balance, account.currency)
                              : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="bank-list__actions">
                      {(item.status === "login_required" ||
                        item.status === "pending_expiration") && (
                        <Button
                          type="button"
                          onClick={() => void requestLinkToken(item.id)}
                          disabled={Boolean(busy)}
                        >
                          Reconnect
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => void syncItem(item.id)}
                        disabled={Boolean(busy)}
                      >
                        {busy === `sync:${item.id}` ? "Syncing…" : "Sync now"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void disconnectItem(item.id)}
                        disabled={Boolean(busy)}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="Recent bank transactions"
            description="Pulled via /transactions/sync. Not yet written to cost_messages."
          >
            {loading ? (
              <p className="muted">Loading…</p>
            ) : transactions.length === 0 ? (
              <p className="muted">No synced transactions yet.</p>
            ) : (
              <ul className="bank-tx-list">
                {transactions.map((tx) => (
                  <li key={tx.id}>
                    <div>
                      <strong>{tx.merchant_name ?? tx.name ?? "Transaction"}</strong>
                      <div className="muted">
                        {tx.date}
                        {tx.pending ? " · pending" : ""}
                      </div>
                    </div>
                    <span>
                      {formatMoney(tx.amount, tx.iso_currency_code)}
                    </span>
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
