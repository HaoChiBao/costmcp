#!/usr/bin/env node
/**
 * Push PLAID_* from repo-root .env to Vercel project costmcp-api.
 * Does not print secret values.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(resolve(root, ".env"), "utf8");

function get(key) {
  const m = envText.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

const vars = {
  PLAID_CLIENT_ID: get("PLAID_CLIENT_ID"),
  PLAID_SECRET: get("PLAID_SECRET"),
  PLAID_ENV: "production",
  PLAID_COUNTRY_CODES: get("PLAID_COUNTRY_CODES") || "CA",
  PLAID_TOKEN_ENCRYPTION_KEY: get("PLAID_TOKEN_ENCRYPTION_KEY"),
  PLAID_WEBHOOK_URL:
    get("PLAID_WEBHOOK_URL") || "https://api.costmcp.com/api/v1/plaid/webhook",
  PLAID_REDIRECT_URI: "https://costmcp.com/plaid/oauth",
};

for (const [k, v] of Object.entries(vars)) {
  if (!v) {
    console.error(`Missing ${k} in .env`);
    process.exit(1);
  }
}

const project = "costmcp-api";
const scope = "james-yangs-projects-9e4b4a04";
const environments = ["production", "preview"];

for (const [key, value] of Object.entries(vars)) {
  for (const environment of environments) {
    const add = spawnSync(
      "vercel",
      [
        "env",
        "add",
        key,
        environment,
        "--value",
        value,
        "--force",
        "--yes",
        "--sensitive",
        "--scope",
        scope,
      ],
      {
        cwd: resolve(root, "apps/api"),
        encoding: "utf8",
        shell: true,
      },
    );
    if (add.status !== 0) {
      console.error(`Failed ${key}/${environment}`);
      console.error(add.stderr || add.stdout);
      process.exit(add.status ?? 1);
    }
    console.log(`Set ${key} → ${environment}`);
  }
}

console.log("Done. Redeploy costmcp-api to pick up env.");
