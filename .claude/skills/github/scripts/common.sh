#!/bin/bash
# Common functions and setup for GitHub skill scripts

# Source .env file if it exists (for GITHUB_TOKEN and GH_REPO)
ENV_FILE="${CLAUDE_PROJECT_DIR:-.}/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Detect GH_REPO from git remote if not set
if [ -z "${GH_REPO:-}" ]; then
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
  if [ -n "$REMOTE_URL" ]; then
    if echo "$REMOTE_URL" | grep -q '/git/'; then
      # Proxy URL: http://local_proxy@127.0.0.1:PORT/git/org/repo
      GH_REPO=$(echo "$REMOTE_URL" | sed 's|.*/git/||' | sed 's|\.git$||')
    elif echo "$REMOTE_URL" | grep -q 'git@github.com:'; then
      # SSH: git@github.com:org/repo.git
      GH_REPO=$(echo "$REMOTE_URL" | sed 's|git@github.com:||' | sed 's|\.git$||')
    elif echo "$REMOTE_URL" | grep -q 'github.com/'; then
      # HTTPS: https://github.com/org/repo.git
      GH_REPO=$(echo "$REMOTE_URL" | sed 's|.*github.com/||' | sed 's|\.git$||')
    fi
  fi
fi

# Determine which method to use (curl vs gh CLI)
USE_CURL=false
if [ -n "${GITHUB_TOKEN:-}" ]; then
  USE_CURL=true
  if [ -z "${GH_REPO:-}" ]; then
    echo "❌ Error: GH_REPO is not set and could not be detected from git remote"
    exit 1
  fi
  API_BASE="https://api.github.com/repos/$GH_REPO"
elif ! command -v gh &>/dev/null; then
  echo "❌ No GITHUB_TOKEN set and gh CLI not found"
  exit 1
fi

# Build repo flag for gh CLI
REPO_FLAG=""
if [ -n "${GH_REPO:-}" ]; then
  REPO_FLAG="--repo $GH_REPO"
fi
