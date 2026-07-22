import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type LinkTokenCreateRequest,
} from "plaid";

export type PlaidEnvName = "sandbox" | "production";

let cached: PlaidApi | null = null;

function plaidEnv(): PlaidEnvName {
  const raw = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  if (raw === "production" || raw === "sandbox") return raw;
  // Legacy "development" maps to production for modern Plaid accounts.
  if (raw === "development") return "production";
  return "sandbox";
}

export function getPlaidClient(): PlaidApi {
  if (cached) return cached;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET are required");
  }

  const env = plaidEnv();
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  cached = new PlaidApi(configuration);
  return cached;
}

export function plaidCountryCodes(): CountryCode[] {
  const raw = process.env.PLAID_COUNTRY_CODES ?? "CA";
  const codes = raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  const mapped: CountryCode[] = [];
  for (const code of codes) {
    if (code === "CA") mapped.push(CountryCode.Ca);
    else if (code === "US") mapped.push(CountryCode.Us);
  }
  return mapped.length ? mapped : [CountryCode.Ca];
}

export function plaidWebhookUrl(): string | undefined {
  const explicit = process.env.PLAID_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  const base =
    process.env.COSTMCP_PUBLIC_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) return undefined;
  return `${base}/api/v1/plaid/webhook`;
}

export function plaidRedirectUri(): string | undefined {
  const uri = process.env.PLAID_REDIRECT_URI?.trim();
  if (!uri) return undefined;
  // Production/Trial rejects non-HTTPS redirects. Keep http://localhost for sandbox only.
  if (uri.startsWith("https://")) return uri;
  if (plaidEnv() === "sandbox" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(uri)) {
    return uri;
  }
  return undefined;
}

export function buildLinkTokenRequest(input: {
  clientUserId: string;
  accessToken?: string;
  clientName?: string;
}): LinkTokenCreateRequest {
  const webhook = plaidWebhookUrl();
  const redirectUri = plaidRedirectUri();

  const request: LinkTokenCreateRequest = {
    user: { client_user_id: input.clientUserId },
    client_name: input.clientName ?? "CostMCP",
    language: "en",
    country_codes: plaidCountryCodes(),
  };

  if (input.accessToken) {
    request.access_token = input.accessToken;
  } else {
    request.products = [Products.Transactions];
    request.transactions = { days_requested: 90 };
  }

  if (webhook) request.webhook = webhook;
  if (redirectUri) request.redirect_uri = redirectUri;

  return request;
}

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}
