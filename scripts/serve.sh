#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Mantra IMIS — Local Development Server
# ─────────────────────────────────────────────────────────────
# Usage: bash scripts/serve.sh [port]
# Default port: 3000
# ─────────────────────────────────────────────────────────────

set -euo pipefail

PORT="${1:-3000}"
SRC_DIR="$(cd "$(dirname "$0")/../src" && pwd)"

echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │   Mantra IMIS — Local Dev Server         │"
echo "  │   http://localhost:${PORT}                   │"
echo "  │   Serving: ${SRC_DIR}  │"
echo "  │   Press Ctrl+C to stop                   │"
echo "  └──────────────────────────────────────────┘"
echo ""

# Try npx serve first (preferred — adds proper MIME types and CORS)
if command -v npx &>/dev/null; then
  echo "  Using: npx serve"
  npx serve "$SRC_DIR" -p "$PORT" --no-clipboard
# Fall back to Python 3
elif command -v python3 &>/dev/null; then
  echo "  Using: Python 3 http.server"
  python3 -m http.server "$PORT" --directory "$SRC_DIR"
# Fall back to Python 2
elif command -v python &>/dev/null; then
  echo "  Using: Python 2 SimpleHTTPServer"
  cd "$SRC_DIR" && python -m SimpleHTTPServer "$PORT"
else
  echo "  ERROR: No suitable server found."
  echo "  Install Node.js (https://nodejs.org) or Python 3 to proceed."
  exit 1
fi
