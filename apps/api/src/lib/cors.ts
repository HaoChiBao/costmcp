const DEFAULT_ORIGINS = ["http://localhost:3001"];

function allowedOrigins(): string[] {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_WEB_URL;
  if (!fromEnv) return DEFAULT_ORIGINS;
  return fromEnv.split(",").map((o) => o.trim()).filter(Boolean);
}

export function resolveCorsOrigin(requestOrigin: string | null): string | null {
  const allowed = allowedOrigins();
  if (!requestOrigin) return allowed[0] ?? null;
  if (allowed.includes(requestOrigin)) return requestOrigin;
  return null;
}

export function corsHeaders(requestOrigin: string | null): HeadersInit {
  const origin = resolveCorsOrigin(requestOrigin);
  if (!origin) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function withCors(response: Response, requestOrigin: string | null): Response {
  const headers = corsHeaders(requestOrigin);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
