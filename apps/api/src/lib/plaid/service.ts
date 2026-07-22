import {
  createServiceClient,
  getPlaidAccountByAccountId,
  getPlaidItemAccessTokenEncrypted,
  getPlaidItemById,
  getPlaidItemByPlaidItemId,
  insertPlaidItem,
  listPlaidAccounts,
  listPlaidItems,
  listPlaidTransactions,
  softRemovePlaidTransaction,
  updatePlaidItem,
  upsertPlaidAccount,
  upsertPlaidItemSecret,
  upsertPlaidTransaction,
  type PlaidItemRow,
} from "@costmcp/db";
import type { AccountBase, RemovedTransaction, Transaction } from "plaid";
import {
  buildLinkTokenRequest,
  getPlaidClient,
  isPlaidConfigured,
} from "@/lib/plaid/client";
import { decryptSecret, encryptSecret } from "@/lib/plaid/crypto";

export class PlaidServiceError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "PlaidServiceError";
    this.status = status;
  }
}

function assertConfigured() {
  if (!isPlaidConfigured()) {
    throw new PlaidServiceError(
      "Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.",
      503,
    );
  }
}

async function requireAccessToken(plaidItemId: string): Promise<string> {
  const client = createServiceClient();
  const encrypted = await getPlaidItemAccessTokenEncrypted(client, plaidItemId);
  if (!encrypted) {
    throw new PlaidServiceError("Missing Plaid access token for item", 500);
  }
  return decryptSecret(encrypted);
}

export async function createLinkToken(input: {
  workspaceId: string;
  userId: string;
  plaidItemRowId?: string;
}) {
  assertConfigured();
  const plaid = getPlaidClient();

  let accessToken: string | undefined;
  if (input.plaidItemRowId) {
    const client = createServiceClient();
    const item = await getPlaidItemById(
      client,
      input.workspaceId,
      input.plaidItemRowId,
    );
    if (!item || item.status === "removed") {
      throw new PlaidServiceError("Bank connection not found", 404);
    }
    accessToken = await requireAccessToken(item.id);
  }

  const response = await plaid.linkTokenCreate(
    buildLinkTokenRequest({
      clientUserId: `${input.workspaceId}:${input.userId}`,
      accessToken,
    }),
  );

  return {
    link_token: response.data.link_token,
    expiration: response.data.expiration,
  };
}

export async function exchangePublicToken(input: {
  workspaceId: string;
  userId: string;
  publicToken: string;
  institution?: { institution_id?: string | null; name?: string | null } | null;
}) {
  assertConfigured();
  const plaid = getPlaidClient();
  const db = createServiceClient();

  const exchange = await plaid.itemPublicTokenExchange({
    public_token: input.publicToken,
  });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  const existing = await getPlaidItemByPlaidItemId(db, itemId);
  let item: PlaidItemRow;

  if (existing) {
    if (existing.workspace_id !== input.workspaceId) {
      throw new PlaidServiceError(
        "This bank connection is already linked to another workspace",
        409,
      );
    }
    item = await updatePlaidItem(db, input.workspaceId, existing.id, {
      user_id: input.userId,
      institution_id: input.institution?.institution_id ?? existing.institution_id,
      institution_name: input.institution?.name ?? existing.institution_name,
      status: "active",
      error_code: null,
      error_message: null,
    });
  } else {
    item = await insertPlaidItem(db, {
      workspace_id: input.workspaceId,
      user_id: input.userId,
      item_id: itemId,
      institution_id: input.institution?.institution_id ?? null,
      institution_name: input.institution?.name ?? null,
      status: "active",
      products: ["transactions"],
    });
  }

  await upsertPlaidItemSecret(db, item.id, encryptSecret(accessToken));
  await refreshAccountsForItem(item, accessToken);

  // Kick off an initial sync; failures are non-fatal (webhooks will retry).
  try {
    await syncTransactionsForItem(item.id, input.workspaceId);
  } catch {
    // ignore — Item is linked; sync can be retried
  }

  const accounts = await listPlaidAccounts(db, input.workspaceId, item.id);
  return { item, accounts };
}

async function refreshAccountsForItem(item: PlaidItemRow, accessToken: string) {
  const plaid = getPlaidClient();
  const db = createServiceClient();
  const accountsRes = await plaid.accountsGet({ access_token: accessToken });

  for (const account of accountsRes.data.accounts) {
    await upsertAccountRow(db, item, account);
  }

  const institution = accountsRes.data.item.institution_id;
  if (institution && !item.institution_id) {
    await updatePlaidItem(db, item.workspace_id, item.id, {
      institution_id: institution,
    });
  }
}

async function upsertAccountRow(
  db: ReturnType<typeof createServiceClient>,
  item: PlaidItemRow,
  account: AccountBase,
) {
  await upsertPlaidAccount(db, {
    workspace_id: item.workspace_id,
    plaid_item_id: item.id,
    account_id: account.account_id,
    name: account.name ?? null,
    official_name: account.official_name ?? null,
    mask: account.mask ?? null,
    type: account.type ?? null,
    subtype: account.subtype ?? null,
    currency:
      account.balances.iso_currency_code ??
      account.balances.unofficial_currency_code ??
      null,
    current_balance: account.balances.current ?? null,
    available_balance: account.balances.available ?? null,
    credit_limit: account.balances.limit ?? null,
    updated_at: new Date().toISOString(),
  });
}

export async function listBankConnections(workspaceId: string) {
  const db = createServiceClient();
  const items = await listPlaidItems(db, workspaceId);
  const accounts = await listPlaidAccounts(db, workspaceId);
  const byItem = new Map<string, typeof accounts>();
  for (const account of accounts) {
    const list = byItem.get(account.plaid_item_id) ?? [];
    list.push(account);
    byItem.set(account.plaid_item_id, list);
  }
  return items.map((item) => ({
    ...item,
    accounts: byItem.get(item.id) ?? [],
  }));
}

export async function listBankTransactions(
  workspaceId: string,
  opts?: { itemId?: string; limit?: number },
) {
  const db = createServiceClient();
  return listPlaidTransactions(db, workspaceId, {
    plaidItemId: opts?.itemId,
    limit: opts?.limit,
  });
}

export async function syncTransactionsForItem(
  plaidItemRowId: string,
  workspaceId: string,
) {
  assertConfigured();
  const db = createServiceClient();
  const item = await getPlaidItemById(db, workspaceId, plaidItemRowId);
  if (!item || item.status === "removed") {
    throw new PlaidServiceError("Bank connection not found", 404);
  }

  const accessToken = await requireAccessToken(item.id);
  const plaid = getPlaidClient();

  let cursor = item.transactions_cursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await plaid.transactionsSync({
        access_token: accessToken,
        cursor,
      });
      const data = response.data;

      for (const tx of data.added) {
        await persistTransaction(db, item, tx);
        added += 1;
      }
      for (const tx of data.modified) {
        await persistTransaction(db, item, tx);
        modified += 1;
      }
      for (const tx of data.removed) {
        await removeTransaction(tx);
        removed += 1;
      }

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    const updated = await updatePlaidItem(db, workspaceId, item.id, {
      transactions_cursor: cursor ?? null,
      last_synced_at: new Date().toISOString(),
      status: "active",
      error_code: null,
      error_message: null,
    });

    await refreshAccountsForItem(updated, accessToken);

    return { added, modified, removed, item: updated };
  } catch (err) {
    await markItemLoginRequiredIfNeeded(workspaceId, item.id, err);
    throw err;
  }
}

async function persistTransaction(
  db: ReturnType<typeof createServiceClient>,
  item: PlaidItemRow,
  tx: Transaction,
) {
  let account = await getPlaidAccountByAccountId(db, tx.account_id);
  if (!account) {
    const accessToken = await requireAccessToken(item.id);
    await refreshAccountsForItem(item, accessToken);
    account = await getPlaidAccountByAccountId(db, tx.account_id);
  }
  if (!account) {
    throw new PlaidServiceError(`Unknown Plaid account ${tx.account_id}`, 500);
  }

  await upsertPlaidTransaction(db, {
    workspace_id: item.workspace_id,
    plaid_item_id: item.id,
    plaid_account_id: account.id,
    transaction_id: tx.transaction_id,
    pending_transaction_id: tx.pending_transaction_id ?? null,
    amount: tx.amount,
    iso_currency_code: tx.iso_currency_code ?? null,
    unofficial_currency_code: tx.unofficial_currency_code ?? null,
    date: tx.date,
    authorized_date: tx.authorized_date ?? null,
    name: tx.name ?? null,
    merchant_name: tx.merchant_name ?? null,
    pending: Boolean(tx.pending),
    category: tx.category ?? null,
    personal_finance_category: (tx.personal_finance_category as never) ?? null,
    payment_channel: tx.payment_channel ?? null,
    raw: tx as never,
  });
}

async function removeTransaction(tx: RemovedTransaction) {
  if (!tx.transaction_id) return;
  const db = createServiceClient();
  await softRemovePlaidTransaction(db, tx.transaction_id);
}

async function markItemLoginRequiredIfNeeded(
  workspaceId: string,
  plaidItemRowId: string,
  err: unknown,
) {
  const code =
    err && typeof err === "object" && "response" in err
      ? (err as { response?: { data?: { error_code?: string; error_message?: string } } })
          .response?.data?.error_code
      : undefined;
  const message =
    err && typeof err === "object" && "response" in err
      ? (err as { response?: { data?: { error_message?: string } } }).response?.data
          ?.error_message
      : err instanceof Error
        ? err.message
        : undefined;

  if (code === "ITEM_LOGIN_REQUIRED") {
    const db = createServiceClient();
    await updatePlaidItem(db, workspaceId, plaidItemRowId, {
      status: "login_required",
      error_code: code,
      error_message: message ?? null,
    });
  }
}

export async function disconnectItem(workspaceId: string, plaidItemRowId: string) {
  assertConfigured();
  const db = createServiceClient();
  const item = await getPlaidItemById(db, workspaceId, plaidItemRowId);
  if (!item || item.status === "removed") {
    throw new PlaidServiceError("Bank connection not found", 404);
  }

  try {
    const accessToken = await requireAccessToken(item.id);
    const plaid = getPlaidClient();
    await plaid.itemRemove({ access_token: accessToken });
  } catch {
    // Still mark removed locally if Plaid revoke fails (already revoked, etc.)
  }

  return updatePlaidItem(db, workspaceId, plaidItemRowId, {
    status: "removed",
    error_code: null,
    error_message: null,
    transactions_cursor: null,
  });
}

export async function handlePlaidWebhook(body: {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
  error?: { error_code?: string; error_message?: string } | null;
}) {
  if (!body.item_id) return { handled: false, reason: "missing item_id" };

  const db = createServiceClient();
  const item = await getPlaidItemByPlaidItemId(db, body.item_id);
  if (!item || item.status === "removed") {
    return { handled: false, reason: "unknown item" };
  }

  const type = body.webhook_type;
  const code = body.webhook_code;

  if (type === "ITEM") {
    if (code === "ERROR" || code === "PENDING_DISCONNECT") {
      const errorCode = body.error?.error_code;
      const status =
        errorCode === "ITEM_LOGIN_REQUIRED" || code === "PENDING_DISCONNECT"
          ? code === "PENDING_DISCONNECT"
            ? "pending_expiration"
            : "login_required"
          : "error";
      await updatePlaidItem(db, item.workspace_id, item.id, {
        status,
        error_code: errorCode ?? code ?? null,
        error_message: body.error?.error_message ?? null,
      });
      return { handled: true, action: "status_updated", status };
    }
    if (code === "USER_PERMISSION_REVOKED") {
      await updatePlaidItem(db, item.workspace_id, item.id, {
        status: "removed",
        error_code: code,
        error_message: "User revoked bank access",
      });
      return { handled: true, action: "removed" };
    }
  }

  if (
    type === "TRANSACTIONS" &&
    (code === "SYNC_UPDATES_AVAILABLE" ||
      code === "DEFAULT_UPDATE" ||
      code === "INITIAL_UPDATE" ||
      code === "HISTORICAL_UPDATE")
  ) {
    const result = await syncTransactionsForItem(item.id, item.workspace_id);
    return { handled: true, action: "synced", ...result };
  }

  return { handled: false, reason: `unhandled ${type}/${code}` };
}

export function statusFromPlaidError(err: unknown): number {
  if (err instanceof PlaidServiceError) return err.status;
  if (err && typeof err === "object" && "response" in err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (typeof status === "number") return status;
  }
  return 500;
}

export function messageFromPlaidError(err: unknown): string {
  if (err instanceof PlaidServiceError) return err.message;
  if (err && typeof err === "object" && "response" in err) {
    const data = (err as { response?: { data?: { error_message?: string } } }).response
      ?.data;
    if (data?.error_message) return data.error_message;
  }
  return err instanceof Error ? err.message : "Plaid request failed";
}
