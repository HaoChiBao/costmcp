import { createServiceClient } from "@costmcp/db";
import { policyError } from "@/lib/api-keys/conditions";

/**
 * Sliding 60s window counter in Postgres.
 * Returns a 429 Response when over limit, otherwise null.
 */
export async function enforceRateLimit(
  apiKeyId: string,
  rateLimitRpm: number | null | undefined,
): Promise<Response | null> {
  if (!rateLimitRpm || rateLimitRpm <= 0) return null;

  const client = createServiceClient();
  const now = Date.now();
  const windowMs = 60_000;

  const { data: existing, error: readError } = await client
    .from("api_key_rate_buckets")
    .select("window_start, request_count")
    .eq("api_key_id", apiKeyId)
    .maybeSingle();

  if (readError) {
    // Fail open on rate-store errors so ingest isn't blocked by infra blips.
    return null;
  }

  const windowStart = existing?.window_start
    ? new Date(existing.window_start as string).getTime()
    : 0;
  const inWindow = windowStart > 0 && now - windowStart < windowMs;
  const count = inWindow ? Number(existing?.request_count ?? 0) : 0;

  if (inWindow && count >= rateLimitRpm) {
    return policyError(429, "rate_limited", `Rate limit of ${rateLimitRpm} requests/minute exceeded`, {
      rate_limit_rpm: rateLimitRpm,
    });
  }

  const nextCount = inWindow ? count + 1 : 1;
  const nextStart = inWindow ? new Date(windowStart).toISOString() : new Date(now).toISOString();

  await client.from("api_key_rate_buckets").upsert({
    api_key_id: apiKeyId,
    window_start: nextStart,
    request_count: nextCount,
  });

  return null;
}
