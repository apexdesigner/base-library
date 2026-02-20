#!/bin/bash
# Restart Storybook with logging and build monitoring
#
# Usage: .claude/skills/storybook/scripts/restart-storybook.sh
#
# Features:
# - Kills any existing Storybook process
# - Starts Storybook in background with logging
# - Monitors build for success/failure (90s timeout)
# - Outputs build status and URL on completion

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Find project root (look for package.json)
PROJECT_DIR="$PWD"
while [[ "$PROJECT_DIR" != "/" ]]; do
  if [[ -f "$PROJECT_DIR/package.json" ]]; then
    break
  fi
  PROJECT_DIR="$(dirname "$PROJECT_DIR")"
done

if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
  echo "Error: Could not find package.json in parent directories"
  exit 1
fi

LOGFILE="$PROJECT_DIR/logs/storybook.log"

mkdir -p "$PROJECT_DIR/logs"
> "$LOGFILE"

echo "Stopping storybook..."
pkill -f storybook 2>/dev/null
sleep 2

echo "Starting storybook..."
cd "$PROJECT_DIR"
npm run storybook > "$LOGFILE" 2>&1 &
STORYBOOK_PID=$!

echo "Waiting for build to complete..."
for i in {1..90}; do
  # Check for failure
  if grep -q "Failed to build" "$LOGFILE" 2>/dev/null; then
    echo ""
    echo "=== BUILD FAILED ==="
    tail -30 "$LOGFILE"
    echo ""
    echo "Full log: $LOGFILE"
    exit 1
  fi
  # Check for success
  if grep -q "Local:.*localhost:" "$LOGFILE" 2>/dev/null; then
    echo ""
    echo "=== Build complete ==="
    grep -A2 -B5 "Local:.*localhost:" "$LOGFILE" | head -10
    echo ""
    STORYBOOK_URL=$(grep -o "http://localhost:[0-9]*" "$LOGFILE" | head -1)
    echo "Storybook running at $STORYBOOK_URL (PID: $STORYBOOK_PID)"
    echo "Full log: $LOGFILE"
    exit 0
  fi
  sleep 1
done

echo "Timeout waiting for build. Last 20 lines:"
tail -20 "$LOGFILE"
echo ""
echo "Storybook PID: $STORYBOOK_PID"
echo "Full log: $LOGFILE"
