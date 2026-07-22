#!/usr/bin/env bash
set -euo pipefail

VERSION="20260507-4d1b0ca0"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ASSET="plaid-cli_${VERSION}_linux_amd64.tar.gz" ;;
  aarch64|arm64) ASSET="plaid-cli_${VERSION}_linux_arm64.tar.gz" ;;
  *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
esac

URL="https://releases.plaid.com/plaid-cli/releases/${VERSION}/${ASSET}"
BIN_DIR="${HOME}/.local/bin"
mkdir -p "$BIN_DIR"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading ${URL}..."
curl -fsSL "$URL" -o "${TMP}/plaid.tgz"
tar -xzf "${TMP}/plaid.tgz" -C "$TMP"

install -m 755 "${TMP}/plaid" "${BIN_DIR}/plaid"

# Ensure ~/.local/bin is on PATH for interactive shells
if [ -f "${HOME}/.bashrc" ] && ! grep -q '\$HOME/.local/bin' "${HOME}/.bashrc"; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "${HOME}/.bashrc"
fi

export PATH="${BIN_DIR}:$PATH"
echo "Installed to ${BIN_DIR}/plaid"
plaid --version
