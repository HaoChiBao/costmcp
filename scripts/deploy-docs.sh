#!/usr/bin/env bash
# Export Mintlify docs and deploy to Vercel project costmcp-docs (docs.costmcp.com).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_ZIP="${TMPDIR:-/tmp}/costmcp-docs-export.zip"
SITE_DIR="${TMPDIR:-/tmp}/costmcp-docs-site"
SCOPE="${VERCEL_SCOPE:-james-yangs-projects-9e4b4a04}"

cd "$ROOT/docs"
npx mint@latest validate
npx mint@latest export --output "$OUT_ZIP"

rm -rf "$SITE_DIR"
mkdir -p "$SITE_DIR"
unzip -q "$OUT_ZIP" -d "$SITE_DIR"
rm -f "$SITE_DIR/Start Docs.bat" "$SITE_DIR/Start Docs.command" "$SITE_DIR/serve.js"

# Strip Mintlify "Powered by" branding from the static export (Hobby watermark).
# Prefer HTML + CSS only — do not rewrite minified JS (that previously broke hydration).
SITE_DIR="$SITE_DIR" python3 <<'PY'
from pathlib import Path
import os
import re

root = Path(os.environ["SITE_DIR"])
html_pat = re.compile(
    r'<a[^>]*utm_campaign=poweredBy[^>]*>.*?</a>',
    re.I | re.S,
)
# Floating Mintlify hot-reloader pill (single fixed status div + mintlify svg).
hot_reloader_pat = re.compile(
    r'<div\s+role="status"\s+aria-live="polite"\s+class="fixed[^"]*z-\[999\][^"]*"[^>]*>'
    r'.*?</div>',
    re.I | re.S,
)

html_n = hot_n = 0
for path in root.rglob("*.html"):
    text = path.read_text(errors="ignore")
    text2, c = html_pat.subn("", text)
    html_n += c
    text3, c2 = hot_reloader_pat.subn("", text2)
    hot_n += c2
    if text3 != text:
        path.write_text(text3)

override = root / "branding-override.css"
override.write_text(
    "\n".join(
        [
            "/* Footer \"Powered by Mintlify\" */",
            'a[href*="utm_campaign=poweredBy"],',
            'a[href*="mintlify.com?utm_campaign=poweredBy"] {',
            "  display: none !important;",
            "  visibility: hidden !important;",
            "  pointer-events: none !important;",
            "  width: 0 !important;",
            "  height: 0 !important;",
            "  overflow: hidden !important;",
            "}",
            "",
            "/* Floating Mintlify hot-reloader logo (bottom-left pill) */",
            # Avoid [class*="z-[999]"] — the ] breaks CSS attribute selectors.
            'div[role="status"][aria-live="polite"].fixed.top-0.left-0,',
            'div[role="status"][aria-live="polite"][class*="cursor-grab"] {',
            "  display: none !important;",
            "  visibility: hidden !important;",
            "  pointer-events: none !important;",
            "  opacity: 0 !important;",
            "  width: 0 !important;",
            "  height: 0 !important;",
            "  overflow: hidden !important;",
            "}",
            "",
        ]
    )
)
link_tag = '<link rel="stylesheet" href="/branding-override.css"/>'
for path in root.rglob("*.html"):
    text = path.read_text(errors="ignore")
    if "branding-override.css" in text:
        continue
    if "</head>" in text:
        path.write_text(text.replace("</head>", f"{link_tag}</head>", 1))

print(f"Removed powered-by anchors: {html_n}; hot-reloader pills: {hot_n}")
PY

cat > "$SITE_DIR/vercel.json" <<'EOF'
{
  "cleanUrls": true,
  "trailingSlash": false
}
EOF

cd "$SITE_DIR"
if [[ ! -d .vercel ]]; then
  vercel link --yes --project costmcp-docs --scope "$SCOPE"
fi
vercel deploy --prod --yes --scope "$SCOPE"
echo "Live: https://docs.costmcp.com"
