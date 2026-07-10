import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

export async function sumSpendForApiKey(
  client: SupabaseClient<Database>,
  apiKeyId: string,
  sinceIso: string,
): Promise<number> {
  const { data, error } = await client
    .from("cost_messages")
    .select("amount_usd")
    .eq("api_key_id", apiKeyId)
    .is("voided_at", null)
    .gte("occurred_at", sinceIso);

  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount_usd ?? 0), 0);
}

export function utcMonthStartIso(now = new Date()): string {
  const start = new Date(now);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}
