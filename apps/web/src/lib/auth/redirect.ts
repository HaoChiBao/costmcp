/** Build the OAuth callback URL, preserving an optional post-login redirect. */
export function buildAuthCallbackUrl(next?: string | null): string {
  const origin = window.location.origin;
  const callback = new URL("/auth/callback", origin);
  if (next && next.startsWith("/")) {
    callback.searchParams.set("next", next);
  }
  return callback.toString();
}

/** Resolve redirect target after OAuth callback (relative paths only). */
export function resolvePostAuthPath(next: string | null, fallback = "/dashboard"): string {
  if (next && next.startsWith("/")) {
    return next;
  }
  return fallback;
}
