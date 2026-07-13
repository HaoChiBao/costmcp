import { DEFAULT_INGEST_PERMISSIONS, type ApiPermission } from "@costmcp/core";
import {
  conditionsToJson,
  parseConditions,
  type KeyConditionsV1,
} from "@/lib/api-keys/conditions";

export const VALID_PERMISSIONS = new Set<string>([
  "log_usage",
  "add_expenses",
  "read_summaries",
  "estimate_costs",
  "manage_subscriptions",
  "manage_projects",
  "delete_records",
]);

export const API_KEY_SELECT =
  "id, name, key_prefix, permissions, environment, status, last_used_at, created_at, project_id, monthly_limit, expires_at, rate_limit_rpm, allowed_cidrs, conditions, created_by";

export type ApiKeyWriteBody = {
  name?: string;
  permissions?: string[];
  project_id?: string | null;
  project_slugs?: string[];
  monthly_limit?: number | null;
  expires_at?: string | null;
  rate_limit_rpm?: number | null;
  allowed_cidrs?: string[];
  environment?: string;
  conditions?: KeyConditionsV1;
};

export function parsePermissions(raw: unknown): ApiPermission[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_INGEST_PERMISSIONS];
  return raw.filter((p): p is ApiPermission => typeof p === "string" && VALID_PERMISSIONS.has(p));
}

export function parseWriteBody(body: ApiKeyWriteBody): {
  name?: string;
  permissions?: ApiPermission[];
  project_id: string | null | undefined;
  monthly_limit: number | null | undefined;
  expires_at: string | null | undefined;
  rate_limit_rpm: number | null | undefined;
  allowed_cidrs: string[] | undefined;
  environment: string | undefined;
  conditions: KeyConditionsV1 | undefined;
  error?: string;
} {
  const name = body.name?.trim();

  let monthly_limit: number | null | undefined = undefined;
  if (body.monthly_limit !== undefined) {
    if (body.monthly_limit === null) monthly_limit = null;
    else if (typeof body.monthly_limit === "number" && body.monthly_limit > 0) {
      monthly_limit = body.monthly_limit;
    } else {
      return { project_id: undefined, monthly_limit: undefined, expires_at: undefined, rate_limit_rpm: undefined, allowed_cidrs: undefined, environment: undefined, conditions: undefined, error: "monthly_limit must be a positive number or null" };
    }
  }

  let expires_at: string | null | undefined = undefined;
  if (body.expires_at !== undefined) {
    if (body.expires_at === null || body.expires_at === "") expires_at = null;
    else {
      const d = new Date(body.expires_at);
      if (Number.isNaN(d.getTime())) {
        return { project_id: undefined, monthly_limit: undefined, expires_at: undefined, rate_limit_rpm: undefined, allowed_cidrs: undefined, environment: undefined, conditions: undefined, error: "expires_at must be an ISO datetime" };
      }
      expires_at = d.toISOString();
    }
  }

  let rate_limit_rpm: number | null | undefined = undefined;
  if (body.rate_limit_rpm !== undefined) {
    if (body.rate_limit_rpm === null) rate_limit_rpm = null;
    else if (typeof body.rate_limit_rpm === "number" && Number.isInteger(body.rate_limit_rpm) && body.rate_limit_rpm > 0) {
      rate_limit_rpm = body.rate_limit_rpm;
    } else {
      return { project_id: undefined, monthly_limit: undefined, expires_at: undefined, rate_limit_rpm: undefined, allowed_cidrs: undefined, environment: undefined, conditions: undefined, error: "rate_limit_rpm must be a positive integer or null" };
    }
  }

  let allowed_cidrs: string[] | undefined = undefined;
  if (body.allowed_cidrs !== undefined) {
    if (!Array.isArray(body.allowed_cidrs)) {
      return { project_id: undefined, monthly_limit: undefined, expires_at: undefined, rate_limit_rpm: undefined, allowed_cidrs: undefined, environment: undefined, conditions: undefined, error: "allowed_cidrs must be an array of strings" };
    }
    allowed_cidrs = body.allowed_cidrs.map((c) => String(c).trim()).filter(Boolean);
  }

  let environment: string | undefined = undefined;
  if (body.environment !== undefined) {
    if (body.environment !== "live" && body.environment !== "test") {
      return { project_id: undefined, monthly_limit: undefined, expires_at: undefined, rate_limit_rpm: undefined, allowed_cidrs: undefined, environment: undefined, conditions: undefined, error: "environment must be live or test" };
    }
    environment = body.environment;
  }

  let project_id: string | null | undefined = undefined;
  if (body.project_id !== undefined) {
    project_id = body.project_id || null;
  }

  let conditions: KeyConditionsV1 | undefined = undefined;
  if (body.conditions !== undefined || body.project_slugs !== undefined) {
    const base = parseConditions(body.conditions ?? {});
    if (body.project_slugs !== undefined) {
      if (!Array.isArray(body.project_slugs)) {
        return { project_id: undefined, monthly_limit: undefined, expires_at: undefined, rate_limit_rpm: undefined, allowed_cidrs: undefined, environment: undefined, conditions: undefined, error: "project_slugs must be an array" };
      }
      const slugs = body.project_slugs.filter((s): s is string => typeof s === "string" && s.length > 0);
      conditions = { ...base, version: 1, ...(slugs.length ? { project_slugs: slugs } : { project_slugs: undefined }) };
      if (!slugs.length) delete conditions.project_slugs;
    } else {
      conditions = base;
    }
  }

  return {
    name: name || undefined,
    permissions: body.permissions !== undefined ? parsePermissions(body.permissions) : undefined,
    project_id,
    monthly_limit,
    expires_at,
    rate_limit_rpm,
    allowed_cidrs,
    environment,
    conditions,
  };
}

export { conditionsToJson };
