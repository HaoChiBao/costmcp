import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types.js";

export type PlaidItemRow = Database["public"]["Tables"]["plaid_items"]["Row"];
export type PlaidItemInsert = Database["public"]["Tables"]["plaid_items"]["Insert"];
export type PlaidItemUpdate = Database["public"]["Tables"]["plaid_items"]["Update"];
export type PlaidAccountRow = Database["public"]["Tables"]["plaid_accounts"]["Row"];
export type PlaidAccountInsert = Database["public"]["Tables"]["plaid_accounts"]["Insert"];
export type PlaidTransactionRow = Database["public"]["Tables"]["plaid_transactions"]["Row"];
export type PlaidTransactionInsert = Database["public"]["Tables"]["plaid_transactions"]["Insert"];

const PLAID_ITEM_SELECT =
  "id, workspace_id, user_id, item_id, institution_id, institution_name, status, error_code, error_message, transactions_cursor, consent_expiration_time, products, last_synced_at, created_at, updated_at";

const PLAID_ACCOUNT_SELECT =
  "id, workspace_id, plaid_item_id, account_id, name, official_name, mask, type, subtype, currency, current_balance, available_balance, credit_limit, created_at, updated_at";

const PLAID_TX_SELECT =
  "id, workspace_id, plaid_item_id, plaid_account_id, transaction_id, pending_transaction_id, amount, iso_currency_code, unofficial_currency_code, date, authorized_date, name, merchant_name, pending, category, personal_finance_category, payment_channel, imported_message_id, removed_at, created_at, updated_at";

export async function insertPlaidItem(
  client: SupabaseClient<Database>,
  input: PlaidItemInsert,
) {
  const { data, error } = await client
    .from("plaid_items")
    .insert(input)
    .select(PLAID_ITEM_SELECT)
    .single();
  if (error) throw error;
  return data as PlaidItemRow;
}

export async function upsertPlaidItemSecret(
  client: SupabaseClient<Database>,
  plaidItemId: string,
  accessTokenEncrypted: string,
) {
  const { error } = await client.from("plaid_item_secrets").upsert({
    plaid_item_id: plaidItemId,
    access_token_encrypted: accessTokenEncrypted,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getPlaidItemAccessTokenEncrypted(
  client: SupabaseClient<Database>,
  plaidItemId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("plaid_item_secrets")
    .select("access_token_encrypted")
    .eq("plaid_item_id", plaidItemId)
    .maybeSingle();
  if (error) throw error;
  return data?.access_token_encrypted ?? null;
}

export async function getPlaidItemById(
  client: SupabaseClient<Database>,
  workspaceId: string,
  id: string,
) {
  const { data, error } = await client
    .from("plaid_items")
    .select(PLAID_ITEM_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as PlaidItemRow | null;
}

export async function getPlaidItemByPlaidItemId(
  client: SupabaseClient<Database>,
  itemId: string,
) {
  const { data, error } = await client
    .from("plaid_items")
    .select(PLAID_ITEM_SELECT)
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw error;
  return data as PlaidItemRow | null;
}

export async function listPlaidItems(
  client: SupabaseClient<Database>,
  workspaceId: string,
) {
  const { data, error } = await client
    .from("plaid_items")
    .select(PLAID_ITEM_SELECT)
    .eq("workspace_id", workspaceId)
    .neq("status", "removed")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlaidItemRow[];
}

export async function updatePlaidItem(
  client: SupabaseClient<Database>,
  workspaceId: string,
  id: string,
  patch: PlaidItemUpdate,
) {
  const { data, error } = await client
    .from("plaid_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select(PLAID_ITEM_SELECT)
    .single();
  if (error) throw error;
  return data as PlaidItemRow;
}

export async function upsertPlaidAccount(
  client: SupabaseClient<Database>,
  input: PlaidAccountInsert,
) {
  const { data, error } = await client
    .from("plaid_accounts")
    .upsert(input, { onConflict: "account_id" })
    .select(PLAID_ACCOUNT_SELECT)
    .single();
  if (error) throw error;
  return data as PlaidAccountRow;
}

export async function listPlaidAccounts(
  client: SupabaseClient<Database>,
  workspaceId: string,
  plaidItemId?: string,
) {
  let query = client
    .from("plaid_accounts")
    .select(PLAID_ACCOUNT_SELECT)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  if (plaidItemId) query = query.eq("plaid_item_id", plaidItemId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PlaidAccountRow[];
}

export async function getPlaidAccountByAccountId(
  client: SupabaseClient<Database>,
  accountId: string,
) {
  const { data, error } = await client
    .from("plaid_accounts")
    .select(PLAID_ACCOUNT_SELECT)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data as PlaidAccountRow | null;
}

export async function upsertPlaidTransaction(
  client: SupabaseClient<Database>,
  input: PlaidTransactionInsert,
) {
  const { data, error } = await client
    .from("plaid_transactions")
    .upsert(
      { ...input, removed_at: null, updated_at: new Date().toISOString() },
      { onConflict: "transaction_id" },
    )
    .select(PLAID_TX_SELECT)
    .single();
  if (error) throw error;
  return data as PlaidTransactionRow;
}

export async function softRemovePlaidTransaction(
  client: SupabaseClient<Database>,
  transactionId: string,
) {
  const { error } = await client
    .from("plaid_transactions")
    .update({ removed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("transaction_id", transactionId);
  if (error) throw error;
}

export async function listPlaidTransactions(
  client: SupabaseClient<Database>,
  workspaceId: string,
  opts?: { plaidItemId?: string; limit?: number },
) {
  let query = client
    .from("plaid_transactions")
    .select(PLAID_TX_SELECT)
    .eq("workspace_id", workspaceId)
    .is("removed_at", null)
    .order("date", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.plaidItemId) query = query.eq("plaid_item_id", opts.plaidItemId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PlaidTransactionRow[];
}

export type { Json };
