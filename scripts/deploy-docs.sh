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
