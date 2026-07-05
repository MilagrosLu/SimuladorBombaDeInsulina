#!/usr/bin/env bash
# =============================================================
# start-frontend.sh – Arranca el servidor de desarrollo React
# =============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🌐 Iniciando frontend React (Vite)..."
echo "   URL: http://localhost:5173"
echo ""

cd "$SCRIPT_DIR"
npm run dev
