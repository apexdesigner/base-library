#!/usr/bin/env bash
set -euo pipefail

DEBUG_STR=""
STOP_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --debug)
      DEBUG_STR="$2"
      shift 2
      ;;
    --stop)
      STOP_ONLY=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$LOG_DIR/server.pid"

# Read server port from .workspace.json
WS_SERVER_PORT=""
if [ -f "$PROJECT_DIR/.workspace.json" ]; then
  WS_SERVER_PORT=$(node -pe "try{var w=JSON.parse(require('fs').readFileSync('$PROJECT_DIR/.workspace.json','utf8'));w.ports&&w.ports.server||''}catch(e){''}" 2>/dev/null || true)
fi
SERVER_PORT="${WS_SERVER_PORT:-${PORT:-3000}}"

mkdir -p "$LOG_DIR"

stop_server() {
  # Kill by PID file first
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping server (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi
  # Kill anything on the server port
  local pids
  pids=$(lsof -ti :"$SERVER_PORT" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Killing processes on port $SERVER_PORT: $pids"
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
  fi
}

if [ "$STOP_ONLY" = true ]; then
  stop_server
  echo "Server stopped."
  exit 0
fi

# Stop any existing server
stop_server

# Clear previous log
> "$LOG_DIR/server.log"

# Start server
echo "Starting server on port $SERVER_PORT..."
(cd "$PROJECT_DIR/server" && PORT="$SERVER_PORT" DEBUG="$DEBUG_STR" npx tsx --watch src/index.ts) \
  >> "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

# Wait for server to be ready
local_timeout=30
elapsed=0
echo "Waiting for server..."
while ! grep -q "Server listening on port" "$LOG_DIR/server.log" 2>/dev/null; do
  if grep -q "Failed running" "$LOG_DIR/server.log" 2>/dev/null; then
    echo "ERROR: Server failed to start. Check $LOG_DIR/server.log"
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
  if [ "$elapsed" -ge "$local_timeout" ]; then
    echo "ERROR: Server did not start within ${local_timeout}s. Check $LOG_DIR/server.log"
    exit 1
  fi
done

echo ""
echo "=== Server ready ==="
echo "  Server: http://localhost:$SERVER_PORT  (PID $SERVER_PID)"
echo "  Log:    $LOG_DIR/server.log"
echo ""
echo "To stop: bash $0 --stop"
