#!/usr/bin/env bash
set -euo pipefail

DEBUG_STR=""
SERVER_ONLY=false
STOP_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --debug)
      DEBUG_STR="$2"
      shift 2
      ;;
    --server-only)
      SERVER_ONLY=true
      shift
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

# Resolve project root (4 levels up from scripts/dev.sh: scripts -> apex-designer -> skills -> .claude -> project)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"

# Read ports from .workspace.json, fall back to env vars, then defaults
WS_SERVER_PORT=""
WS_CLIENT_PORT=""
if [ -f "$PROJECT_DIR/.workspace.json" ]; then
  WS_SERVER_PORT=$(node -pe "try{JSON.parse(require('fs').readFileSync('$PROJECT_DIR/.workspace.json','utf8')).serverPort||''}catch(e){''}" 2>/dev/null || true)
  WS_CLIENT_PORT=$(node -pe "try{JSON.parse(require('fs').readFileSync('$PROJECT_DIR/.workspace.json','utf8')).clientPort||''}catch(e){''}" 2>/dev/null || true)
fi
SERVER_PORT="${WS_SERVER_PORT:-${PORT:-3000}}"
CLIENT_PORT="${WS_CLIENT_PORT:-${CLIENT_PORT:-4200}}"

mkdir -p "$LOG_DIR"

# --- helpers ---

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Killing processes on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

kill_project_processes() {
  local dir=$1
  local label=$2
  local pids
  pids=$(pgrep -f "$dir" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Killing stale $label processes: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

wait_for_port() {
  local port=$1
  local label=$2
  local timeout=${3:-30}
  local elapsed=0
  echo "Waiting for $label on port $port..."
  while ! nc -z localhost "$port" 2>/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "ERROR: $label did not start within ${timeout}s"
      echo "Check $LOG_DIR/${label}.log for details"
      exit 1
    fi
  done
  echo "$label is up on port $port (${elapsed}s)"
}

wait_for_log() {
  local logfile=$1
  local pattern=$2
  local label=$3
  local timeout=${4:-60}
  local fail_pattern="${5:-}"
  local elapsed=0
  echo "Waiting for $label to be ready..."
  while true; do
    if grep -q "$pattern" "$logfile" 2>/dev/null; then
      echo "$label is ready (${elapsed}s)"
      return 0
    fi
    if [ -n "$fail_pattern" ] && grep -q "$fail_pattern" "$logfile" 2>/dev/null; then
      echo "ERROR: $label failed to start"
      echo "Check $logfile for details"
      exit 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "ERROR: $label not ready within ${timeout}s"
      echo "Check $logfile for details"
      exit 1
    fi
  done
}

# --- main ---

# --stop: kill everything and exit
if [ "$STOP_ONLY" = true ]; then
  echo "=== Stopping dev environment ==="
  kill_project_processes "$PROJECT_DIR/server" "server"
  kill_project_processes "$PROJECT_DIR/client" "client"
  kill_port "$SERVER_PORT"
  kill_port "$CLIENT_PORT"
  echo "Done."
  exit 0
fi

echo "=== Dev startup ==="

# Kill any stale processes from previous runs of this project
kill_project_processes "$PROJECT_DIR/server" "server"
if [ "$SERVER_ONLY" = false ]; then
  kill_project_processes "$PROJECT_DIR/client" "client"
fi

# Kill anything on the ports (catches non-project processes too)
kill_port "$SERVER_PORT"
if [ "$SERVER_ONLY" = false ]; then
  kill_port "$CLIENT_PORT"
fi

# Clear previous logs
> "$LOG_DIR/server.log"
if [ "$SERVER_ONLY" = false ]; then
  > "$LOG_DIR/client.log"
fi

# Start server
echo "Starting server..."
(cd "$PROJECT_DIR/server" && DEBUG="$DEBUG_STR" npx tsx --watch src/index.ts) \
  >> "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!

wait_for_log "$LOG_DIR/server.log" "Server listening on port" "server" 30 "Failed running"

if [ "$SERVER_ONLY" = false ]; then
  # Start client
  echo "Starting client..."
  (cd "$PROJECT_DIR/client" && npx ng serve --port "$CLIENT_PORT") \
    >> "$LOG_DIR/client.log" 2>&1 &
  CLIENT_PID=$!

  wait_for_log "$LOG_DIR/client.log" "Compiled successfully" "client" 120 "Failed to compile"

  echo ""
  echo "=== Dev environment ready ==="
  echo "  Server: http://localhost:$SERVER_PORT  (PID $SERVER_PID)"
  echo "  Client: http://localhost:$CLIENT_PORT  (PID $CLIENT_PID)"
  echo "  Logs:   $LOG_DIR/server.log"
  echo "          $LOG_DIR/client.log"
  echo ""
  echo "To stop: kill $SERVER_PID $CLIENT_PID"
else
  echo ""
  echo "=== Server ready ==="
  echo "  Server: http://localhost:$SERVER_PORT  (PID $SERVER_PID)"
  echo "  Logs:   $LOG_DIR/server.log"
  echo ""
  echo "To stop: kill $SERVER_PID"
fi
