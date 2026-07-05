#!/usr/bin/env bash
# =============================================================
# start-backend.sh – Arranca el servidor Go de simulación
# =============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
GO_BIN="$HOME/go/bin/go"

# Verificar que Go esté instalado
if ! command -v go &>/dev/null; then
  if [ -x "$GO_BIN" ]; then
    export PATH="$HOME/go/bin:$PATH"
  else
    echo "❌ Go no encontrado. Instalalo desde https://go.dev/dl/"
    exit 1
  fi
fi

echo "🩺 Iniciando backend de simulación (Go)..."
echo "   WebSocket: ws://localhost:8080/ws"
echo "   Health:    http://localhost:8080/health"
echo ""

cd "$BACKEND_DIR"
go run .
