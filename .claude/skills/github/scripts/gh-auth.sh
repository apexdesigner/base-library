#!/bin/bash
# Wrapper for gh auth commands - supports both curl (with GITHUB_TOKEN) and gh CLI

set -e

# Source .env file if it exists (for GITHUB_TOKEN)
ENV_FILE="${CLAUDE_PROJECT_DIR:-.}/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

COMMAND="$1"
shift 2>/dev/null || true

case "$COMMAND" in
  status)
    if [ -n "${GITHUB_TOKEN:-}" ]; then
      # Use curl with GITHUB_TOKEN
      RESPONSE=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/user")

      HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
      BODY=$(echo "$RESPONSE" | sed '$d')

      if [ "$HTTP_CODE" = "200" ]; then
        USERNAME=$(echo "$BODY" | grep -o '"login": *"[^"]*"' | cut -d'"' -f4)
        echo "✓ Authenticated to github.com as $USERNAME (via token)"
      else
        echo "❌ Authentication failed (HTTP $HTTP_CODE)"
        echo "$BODY"
        exit 1
      fi
    elif command -v gh &>/dev/null; then
      # Use gh CLI
      gh auth status "$@"
    else
      echo "❌ No GITHUB_TOKEN set and gh CLI not found"
      exit 1
    fi
    ;;
  *)
    echo "Usage: gh-auth.sh <status> [args...]"
    echo "Commands:"
    echo "  status    Check authentication status"
    exit 1
    ;;
esac
