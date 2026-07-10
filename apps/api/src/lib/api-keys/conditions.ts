import type { Json } from "@costmcp/db";

export type KeyConditionsV1 = {
  version?: 1;
  project_slugs?: string[];
  deny_project_slugs?: string[];
  features?: string[];
  sources?: Array<"api" | "mcp" | "manual" | "import">;
  notes?: string;
};

export type ApiKeyPolicy = {
  apiKeyId: string;
  projectId: string | null;
  monthlyLimit: number | null;
  expiresAt: string | null;
  rateLimitRpm: number | null;
  allowedCidrs: string[];
  conditions: KeyConditionsV1;
  environment: string;
};

export function parseConditions(raw: unknown): KeyConditionsV1 {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const project_slugs = Array.isArray(obj.project_slugs)
    ? obj.project_slugs.filter((s): s is string => typeof s === "string" && s.length > 0)
    : undefined;
  const deny_project_slugs = Array.isArray(obj.deny_project_slugs)
    ? obj.deny_project_slugs.filter((s): s is string => typeof s === "string" && s.length > 0)
    : undefined;
  const features = Array.isArray(obj.features)
    ? obj.features.filter((s): s is string => typeof s === "string" && s.length > 0)
    : undefined;
  const sources = Array.isArray(obj.sources)
    ? obj.sources.filter(
        (s): s is "api" | "mcp" | "manual" | "import" =>
          s === "api" || s === "mcp" || s === "manual" || s === "import",
      )
    : undefined;
  const notes = typeof obj.notes === "string" ? obj.notes : undefined;
  return {
    version: 1,
    ...(project_slugs?.length ? { project_slugs } : {}),
    ...(deny_project_slugs?.length ? { deny_project_slugs } : {}),
    ...(features?.length ? { features } : {}),
    ...(sources?.length ? { sources } : {}),
    ...(notes ? { notes } : {}),
  };
}

export function conditionsToJson(conditions: KeyConditionsV1): Json {
  return conditions as Json;
}

export function policyError(
  status: number,
  error: string,
  error_description: string,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json({ error, error_description, ...extra }, { status });
}

/** Extract client IP from Vercel / proxy headers. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  return real || null;
}

export function ipAllowed(ip: string | null, cidrs: string[]): boolean {
  if (!cidrs.length) return true;
  if (!ip) return false;
  return cidrs.some((cidr) => matchCidr(ip, cidr.trim()));
}

function matchCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) {
    return ip === cidr;
  }
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  if (!base || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipNum = ipv4ToInt(ip);
  const baseNum = ipv4ToInt(base);
  if (ipNum === null || baseNum === null) {
    // Non-IPv4: exact match only
    return ip === base;
  }
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

export function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

/**
 * Project access for a key.
 * - `project_id` column wins (single project)
 * - else allow-list `conditions.project_slugs`
 * - else deny-list `conditions.deny_project_slugs`
 * - else all projects
 */
export function projectAllowed(
  policy: Pick<ApiKeyPolicy, "projectId" | "conditions"> | null | undefined,
  project: { id: string; slug: string },
): boolean {
  if (!policy) return true;
  if (policy.projectId) return policy.projectId === project.id;
  const allow = policy.conditions.project_slugs;
  if (allow?.length) return allow.includes(project.slug);
  const deny = policy.conditions.deny_project_slugs;
  if (deny?.length) return !deny.includes(project.slug);
  return true;
}

export function sourceAllowed(
  policy: Pick<ApiKeyPolicy, "conditions"> | null | undefined,
  source: string,
): boolean {
  const allowed = policy?.conditions.sources;
  if (!allowed?.length) return true;
  return allowed.includes(source as KeyConditionsV1["sources"] extends (infer S)[] | undefined ? S : never);
}

export function featureAllowed(
  policy: Pick<ApiKeyPolicy, "conditions"> | null | undefined,
  feature: string | undefined,
): boolean {
  const allowed = policy?.conditions.features;
  if (!allowed?.length) return true;
  if (!feature) return false;
  return allowed.includes(feature);
}

/** Filter project slugs visible to a scoped key (null = unrestricted). */
export function allowedProjectFilter(
  policy: Pick<ApiKeyPolicy, "projectId" | "conditions"> | null | undefined,
): { projectId: string | null; slugs: string[] | null } {
  if (!policy) return { projectId: null, slugs: null };
  if (policy.projectId) return { projectId: policy.projectId, slugs: null };
  if (policy.conditions.project_slugs?.length) {
    return { projectId: null, slugs: policy.conditions.project_slugs };
  }
  return { projectId: null, slugs: null };
}
