#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(resolve(root, ".env"), "utf8");
const get = (key) => {
  const m = envText.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
};

const clientId = get("PLAID_CLIENT_ID");
const secret = get("PLAID_SECRET");
const env = get("PLAID_ENV") || "production";
const redirect = get("PLAID_REDIRECT_URI");
const webhook = get("PLAID_WEBHOOK_URL");

if (!clientId || !secret) {
  console.error("Missing PLAID_CLIENT_ID / PLAID_SECRET");
  process.exit(1);
}

const client = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  }),
);

const req = {
  user: { client_user_id: "costmcp-verify" },
  client_name: "CostMCP",
  products: [Products.Transactions],
  country_codes: [CountryCode.Ca],
  language: "en",
  transactions: { days_requested: 90 },
};
if (redirect) req.redirect_uri = redirect;
if (webhook) req.webhook = webhook;

try {
  const res = await client.linkTokenCreate(req);
  console.log("OK link_token created");
  console.log("env:", env);
  console.log("expiration:", res.data.expiration);
  console.log("redirect_uri:", redirect || "(none)");
  console.log("webhook:", webhook || "(none)");
} catch (err) {
  const data = err?.response?.data;
  console.error("FAILED");
  console.error(JSON.stringify(data ?? { message: err.message }, null, 2));
  process.exit(1);
}
