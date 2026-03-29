#!/usr/bin/env bash
set -euo pipefail

STOP_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
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
PID_FILE="$LOG_DIR/client.pid"

# Read ports from .workspace.json
WS_CLIENT_PORT=""
WS_SERVER_PORT=""
if [ -f "$PROJECT_DIR/.workspace.json" ]; then
  WS_CLIENT_PORT=$(node -pe "try{var w=JSON.parse(require('fs').readFileSync('$PROJECT_DIR/.workspace.json','utf8'));w.ports&&w.ports.client||''}catch(e){''}" 2>/dev/null || true)
  WS_SERVER_PORT=$(node -pe "try{var w=JSON.parse(require('fs').readFileSync('$PROJECT_DIR/.workspace.json','utf8'));w.ports&&w.ports.server||''}catch(e){''}" 2>/dev/null || true)
fi
CLIENT_PORT="${WS_CLIENT_PORT:-${CLIENT_PORT:-4200}}"
SERVER_PORT="${WS_SERVER_PORT:-${PORT:-3000}}"

mkdir -p "$LOG_DIR"

stop_client() {
  # Kill by PID file first
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping client (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi
  # Kill anything on the client port
  local pids
  pids=$(lsof -ti :"$CLIENT_PORT" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Killing processes on port $CLIENT_PORT: $pids"
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
  fi
}

if [ "$STOP_ONLY" = true ]; then
  stop_client
  echo "Client stopped."
  exit 0
fi

# Stop any existing client
stop_client

# Clear previous log
> "$LOG_DIR/client.log"

# Start client
echo "Starting client on port $CLIENT_PORT (proxying to server on $SERVER_PORT)..."
(cd "$PROJECT_DIR/client" && PORT="$SERVER_PORT" npx ng serve --port "$CLIENT_PORT") \
  >> "$LOG_DIR/client.log" 2>&1 &
CLIENT_PID=$!
echo "$CLIENT_PID" > "$PID_FILE"

# Wait for client to be ready
local_timeout=120
elapsed=0
echo "Waiting for client..."
while true; do
  if grep -q "Compiled successfully" "$LOG_DIR/client.log" 2>/dev/null; then
    break
  fi
  if grep -q "Failed to compile" "$LOG_DIR/client.log" 2>/dev/null; then
    echo "ERROR: Client failed to compile. Check $LOG_DIR/client.log"
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
  if [ "$elapsed" -ge "$local_timeout" ]; then
    echo "ERROR: Client not ready within ${local_timeout}s. Check $LOG_DIR/client.log"
    exit 1
  fi
done

echo ""
echo "=== Client ready ==="
echo "  Client: http://localhost:$CLIENT_PORT  (PID $CLIENT_PID)"
echo "  Log:    $LOG_DIR/client.log"
echo ""
echo "To stop: bash $0 --stop"
