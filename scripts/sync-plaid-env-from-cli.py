#!/usr/bin/env python3
"""Merge Plaid CLI credentials into the repo-root .env (never prints secrets)."""
from __future__ import annotations

import json
import re
import secrets
from pathlib import Path

REPO = Path("/mnt/c/Users/james/OneDrive/Documents/Github/costmcp")
ENV_PATH = REPO / ".env"
CLI_CONFIG = Path.home() / ".config/plaid-cli/config.json"


def upsert_env(text: str, key: str, value: str) -> str:
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    line = f"{key}={value}"
    if pattern.search(text):
        return pattern.sub(line, text)
    if not text.endswith("\n"):
        text += "\n"
    return text + line + "\n"


def main() -> None:
    data = json.loads(CLI_CONFIG.read_text())
    client_id = data["client_id"]
    prod_secret = data["environments"]["production"]["secret"]
    sandbox_secret = data["environments"]["sandbox"]["secret"]

    text = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else ""

    # Prefer production for Trial (real RBC).
    text = upsert_env(text, "PLAID_CLIENT_ID", client_id)
    text = upsert_env(text, "PLAID_SECRET", prod_secret)
    text = upsert_env(text, "PLAID_ENV", "production")
    text = upsert_env(text, "PLAID_COUNTRY_CODES", "CA")
    text = upsert_env(text, "PLAID_SANDBOX_SECRET", sandbox_secret)

    # Keep existing encryption key if present; otherwise generate.
    if not re.search(r"^PLAID_TOKEN_ENCRYPTION_KEY=.+$", text, re.MULTILINE) or re.search(
        r"^PLAID_TOKEN_ENCRYPTION_KEY=\s*$", text, re.MULTILINE
    ):
        text = upsert_env(text, "PLAID_TOKEN_ENCRYPTION_KEY", secrets.token_hex(32))

    # Local OAuth return for Canadian institutions.
    text = upsert_env(text, "PLAID_REDIRECT_URI", "http://localhost:3001/plaid/oauth")
    # Local webhooks can't receive Plaid callbacks; use manual Sync until deployed.
    # Production webhook set separately on Vercel.
    text = upsert_env(
        text,
        "PLAID_WEBHOOK_URL",
        "https://api.costmcp.com/api/v1/plaid/webhook",
    )

    ENV_PATH.write_text(text, encoding="utf-8")
    print("Updated .env with PLAID_* (production Trial). Secrets not printed.")
    print("Keys present:", ", ".join(sorted({
        m.group(1)
        for m in re.finditer(r"^(PLAID_[A-Z0-9_]+)=", text, re.MULTILINE)
    })))


if __name__ == "__main__":
    main()
