#!/bin/bash
# Wrapper for gh pr commands - supports both curl (with GITHUB_TOKEN) and gh CLI

set -e

# Source common setup (loads .env, detects GH_REPO, sets USE_CURL)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

COMMAND="$1"
shift 2>/dev/null || true

case "$COMMAND" in
  list)
    if [ "$USE_CURL" = true ]; then
      # Parse optional arguments
      STATE="open"
      LIMIT=30
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --state) STATE="$2"; shift 2 ;;
          -L|--limit) LIMIT="$2"; shift 2 ;;
          *) shift ;;
        esac
      done

      RESPONSE=$(curl -s \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "$API_BASE/pulls?state=$STATE&per_page=$LIMIT")

      # Format output similar to gh pr list (PR response has: number, state, title order)
      echo "$RESPONSE" | grep -o '"number": *[0-9]*\|"state": *"[^"]*"\|"title": *"[^"]*"' | \
        paste - - - | \
        sed 's/"number": *//g; s/"state": *"//g; s/"title": *"//g; s/"//g' | \
        awk -F'\t' '{printf "#%-6s %-50s %s\n", $1, substr($3,1,50), $2}'
    else
      gh pr list $REPO_FLAG "$@"
    fi
    ;;

  view)
    PR_NUM="$1"
    if [ -z "$PR_NUM" ]; then
      echo "Usage: gh-pr.sh view <pr-number>"
      exit 1
    fi
    shift

    if [ "$USE_CURL" = true ]; then
      RESPONSE=$(curl -s \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "$API_BASE/pulls/$PR_NUM")

      # Extract and display PR details
      TITLE=$(echo "$RESPONSE" | grep -o '"title": *"[^"]*"' | head -1 | cut -d'"' -f4)
      STATE=$(echo "$RESPONSE" | grep -o '"state": *"[^"]*"' | head -1 | cut -d'"' -f4)
      BODY=$(echo "$RESPONSE" | grep -o '"body": *"[^"]*"' | head -1 | cut -d'"' -f4)
      USER=$(echo "$RESPONSE" | grep -o '"login": *"[^"]*"' | head -1 | cut -d'"' -f4)
      HEAD_REF=$(echo "$RESPONSE" | grep -o '"ref": *"[^"]*"' | head -1 | cut -d'"' -f4)

      echo "PR #$PR_NUM: $TITLE"
      echo "State: $STATE"
      echo "Author: $USER"
      echo "Branch: $HEAD_REF"
      echo ""
      echo "$BODY" | sed 's/\\n/\n/g; s/\\r//g'
    else
      gh pr view $REPO_FLAG "$PR_NUM" "$@"
    fi
    ;;

  create)
    if [ "$USE_CURL" = true ]; then
      # Parse arguments
      TITLE=""
      BODY=""
      BODY_FILE=""
      BASE="main"
      HEAD=""
      while [[ $# -gt 0 ]]; do
        case "$1" in
          -t|--title) TITLE="$2"; shift 2 ;;
          -b|--body) BODY="$2"; shift 2 ;;
          -F|--body-file) BODY_FILE="$2"; shift 2 ;;
          -B|--base) BASE="$2"; shift 2 ;;
          -H|--head) HEAD="$2"; shift 2 ;;
          *) shift ;;
        esac
      done

      # Read body from file if specified
      if [ -n "$BODY_FILE" ] && [ -f "$BODY_FILE" ]; then
        BODY=$(cat "$BODY_FILE")
      fi

      # Get current branch if head not specified
      if [ -z "$HEAD" ]; then
        HEAD=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
      fi

      if [ -z "$TITLE" ] || [ -z "$HEAD" ]; then
        echo "Usage: gh-pr.sh create --title <title> [--body <body>] [--body-file <file>] [--base <base>] [--head <head>]"
        exit 1
      fi

      # Escape JSON special characters
      TITLE_JSON=$(echo "$TITLE" | sed 's/\\/\\\\/g; s/"/\\"/g')
      BODY_JSON=$(echo "$BODY" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/g' | tr -d '\n' | sed 's/\\n$//')

      RESPONSE=$(curl -s \
        -X POST \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -d "{\"title\":\"$TITLE_JSON\",\"body\":\"$BODY_JSON\",\"head\":\"$HEAD\",\"base\":\"$BASE\"}" \
        "$API_BASE/pulls")

      PR_URL=$(echo "$RESPONSE" | grep -o '"html_url": *"[^"]*pull[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -n "$PR_URL" ]; then
        echo "✓ Created PR: $PR_URL"
        echo "$PR_URL"
      else
        echo "❌ Failed to create PR"
        echo "$RESPONSE"
        exit 1
      fi
    else
      gh pr create $REPO_FLAG "$@"
    fi
    ;;

  *)
    echo "Usage: gh-pr.sh <command> [args...]"
    echo "Commands:"
    echo "  list      List PRs [--state open|closed|all] [-L limit]"
    echo "  view      View a PR <number>"
    echo "  create    Create a PR --title <title> [--body <body>] [--body-file <file>] [--base <base>]"
    exit 1
    ;;
esac
