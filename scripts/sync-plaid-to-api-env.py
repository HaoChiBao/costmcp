#!/usr/bin/env python3
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
src = (root / ".env").read_text(encoding="utf-8")
keys = [
    "PLAID_CLIENT_ID",
    "PLAID_SECRET",
    "PLAID_ENV",
    "PLAID_COUNTRY_CODES",
    "PLAID_TOKEN_ENCRYPTION_KEY",
    "PLAID_WEBHOOK_URL",
    "PLAID_REDIRECT_URI",
    "PLAID_SANDBOX_SECRET",
]
vals = {}
for k in keys:
    m = re.search(rf"^{k}=(.*)$", src, re.M)
    if m:
        vals[k] = m.group(1).strip()

api_env = root / "apps" / "api" / ".env.local"
text = api_env.read_text(encoding="utf-8") if api_env.exists() else ""
for k, v in vals.items():
    pat = re.compile(rf"^{re.escape(k)}=.*$", re.M)
    line = f"{k}={v}"
    if pat.search(text):
        text = pat.sub(line, text)
    else:
        if text and not text.endswith("\n"):
            text += "\n"
        text += line + "\n"
api_env.write_text(text, encoding="utf-8")
present = sorted({m.group(1) for m in re.finditer(r"^(PLAID_[A-Z0-9_]+)=", text, re.M)})
print("Updated apps/api/.env.local")
print("PLAID keys:", ", ".join(present))
print("CLIENT_ID set:", bool(vals.get("PLAID_CLIENT_ID")))
print("SECRET set:", bool(vals.get("PLAID_SECRET")))
