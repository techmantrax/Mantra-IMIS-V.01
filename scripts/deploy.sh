#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Mantra IMIS — Manual Deployment Helper
# ─────────────────────────────────────────────────────────────
# Usage: bash scripts/deploy.sh [target]
# Targets: gh-pages | netlify | rsync
# ─────────────────────────────────────────────────────────────

set -euo pipefail

TARGET="${1:-}"
SRC_DIR="$(cd "$(dirname "$0")/../src" && pwd)"

print_header() {
  echo ""
  echo "  ┌──────────────────────────────────────────┐"
  echo "  │   Mantra IMIS — Deploy                   │"
  echo "  └──────────────────────────────────────────┘"
  echo ""
}

print_header

case "$TARGET" in

  gh-pages)
    echo "  Deploying to GitHub Pages..."
    npx gh-pages -d "$SRC_DIR"
    echo "  Done. Check your repository's Pages settings for the URL."
    ;;

  netlify)
    echo "  Deploying to Netlify..."
    npx netlify-cli deploy --dir="$SRC_DIR" --prod
    ;;

  rsync)
    # Edit these variables for your server
    REMOTE_USER="${REMOTE_USER:-deploy}"
    REMOTE_HOST="${REMOTE_HOST:-your-server.com}"
    REMOTE_PATH="${REMOTE_PATH:-/var/www/mantra-imis-portal/src}"

    echo "  Deploying via rsync to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
    rsync -avz --delete \
      --exclude='.DS_Store' \
      "$SRC_DIR/" \
      "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"
    echo "  Done."
    ;;

  *)
    echo "  Usage: bash scripts/deploy.sh [gh-pages|netlify|rsync]"
    echo ""
    echo "  Targets:"
    echo "    gh-pages   Deploy to GitHub Pages (requires gh-pages npm package)"
    echo "    netlify    Deploy to Netlify (requires netlify-cli)"
    echo "    rsync      Deploy to a remote server via rsync"
    echo ""
    echo "  For rsync, set environment variables:"
    echo "    REMOTE_USER=deploy REMOTE_HOST=your-server.com REMOTE_PATH=/var/www/..."
    exit 1
    ;;
esac
