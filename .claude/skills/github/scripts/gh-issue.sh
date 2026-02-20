#!/bin/bash
# Wrapper for gh issue commands - supports both curl (with GITHUB_TOKEN) and gh CLI

set -e

# Source common setup (loads .env, detects GH_REPO, sets USE_CURL)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Parse global --repo/-R option for cross-repo operations
OVERRIDE_REPO=""
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -R|--repo)
      OVERRIDE_REPO="$2"
      shift 2
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done
set -- "${ARGS[@]}"

# Apply repo override if specified
if [ -n "$OVERRIDE_REPO" ]; then
  GH_REPO="$OVERRIDE_REPO"
  API_BASE="https://api.github.com/repos/$GH_REPO"
  REPO_FLAG="--repo $GH_REPO"
fi

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
        "$API_BASE/issues?state=$STATE&per_page=$LIMIT")

      # Format output similar to gh issue list
      echo "$RESPONSE" | grep -o '"number": *[0-9]*\|"title": *"[^"]*"\|"state": *"[^"]*"' | \
        paste - - - | \
        sed 's/"number": *//g; s/"title": *"//g; s/"state": *"//g; s/"//g' | \
        awk -F'\t' '{printf "#%-6s %-50s %s\n", $1, substr($2,1,50), $3}'
    else
      gh issue list $REPO_FLAG "$@"
    fi
    ;;

  view)
    ISSUE_NUM="$1"
    if [ -z "$ISSUE_NUM" ]; then
      echo "Usage: gh-issue.sh view <issue-number>"
      exit 1
    fi
    shift

    if [ "$USE_CURL" = true ]; then
      RESPONSE=$(curl -s \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "$API_BASE/issues/$ISSUE_NUM")

      # Extract and display issue details
      TITLE=$(echo "$RESPONSE" | grep -o '"title": *"[^"]*"' | head -1 | cut -d'"' -f4)
      STATE=$(echo "$RESPONSE" | grep -o '"state": *"[^"]*"' | head -1 | cut -d'"' -f4)
      BODY=$(echo "$RESPONSE" | grep -o '"body": *"[^"]*"' | head -1 | cut -d'"' -f4)
      USER=$(echo "$RESPONSE" | grep -o '"login": *"[^"]*"' | head -1 | cut -d'"' -f4)

      echo "Issue #$ISSUE_NUM: $TITLE"
      echo "State: $STATE"
      echo "Author: $USER"
      echo ""
      echo "$BODY" | sed 's/\\n/\n/g; s/\\r//g'
    else
      gh issue view $REPO_FLAG "$ISSUE_NUM" "$@"
    fi
    ;;

  create)
    if [ "$USE_CURL" = true ]; then
      # Parse arguments
      TITLE=""
      BODY=""
      BODY_FILE=""
      while [[ $# -gt 0 ]]; do
        case "$1" in
          -t|--title) TITLE="$2"; shift 2 ;;
          -b|--body) BODY="$2"; shift 2 ;;
          -F|--body-file) BODY_FILE="$2"; shift 2 ;;
          *) shift ;;
        esac
      done

      # Read body from file if specified
      if [ -n "$BODY_FILE" ] && [ -f "$BODY_FILE" ]; then
        BODY=$(cat "$BODY_FILE")
      fi

      if [ -z "$TITLE" ]; then
        echo "Usage: gh-issue.sh create --title <title> [--body <body>] [--body-file <file>]"
        exit 1
      fi

      # Escape JSON special characters
      TITLE_JSON=$(echo "$TITLE" | sed 's/\\/\\\\/g; s/"/\\"/g')
      BODY_JSON=$(echo "$BODY" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/g' | tr -d '\n' | sed 's/\\n$//')

      RESPONSE=$(curl -s \
        -X POST \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -d "{\"title\":\"$TITLE_JSON\",\"body\":\"$BODY_JSON\"}" \
        "$API_BASE/issues")

      ISSUE_URL=$(echo "$RESPONSE" | grep -o '"html_url": *"[^"]*issue[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -n "$ISSUE_URL" ]; then
        echo "✓ Created issue: $ISSUE_URL"
      else
        echo "❌ Failed to create issue"
        echo "$RESPONSE"
        exit 1
      fi
    else
      gh issue create $REPO_FLAG "$@"
    fi
    ;;

  comment)
    ISSUE_NUM="$1"
    shift 2>/dev/null || true

    if [ -z "$ISSUE_NUM" ]; then
      echo "Usage: gh-issue.sh comment <issue-number> --body <comment>"
      exit 1
    fi

    if [ "$USE_CURL" = true ]; then
      # Parse arguments
      BODY=""
      BODY_FILE=""
      while [[ $# -gt 0 ]]; do
        case "$1" in
          -b|--body) BODY="$2"; shift 2 ;;
          -F|--body-file) BODY_FILE="$2"; shift 2 ;;
          *) shift ;;
        esac
      done

      # Read body from file if specified
      if [ -n "$BODY_FILE" ] && [ -f "$BODY_FILE" ]; then
        BODY=$(cat "$BODY_FILE")
      fi

      if [ -z "$BODY" ]; then
        echo "Usage: gh-issue.sh comment <issue-number> --body <comment> [--body-file <file>]"
        exit 1
      fi

      # Escape JSON special characters
      BODY_JSON=$(echo "$BODY" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/g' | tr -d '\n' | sed 's/\\n$//')

      RESPONSE=$(curl -s \
        -X POST \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -d "{\"body\":\"$BODY_JSON\"}" \
        "$API_BASE/issues/$ISSUE_NUM/comments")

      COMMENT_URL=$(echo "$RESPONSE" | grep -o '"html_url": *"[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -n "$COMMENT_URL" ]; then
        echo "✓ Added comment: $COMMENT_URL"
      else
        echo "❌ Failed to add comment"
        echo "$RESPONSE"
        exit 1
      fi
    else
      gh issue comment $REPO_FLAG "$ISSUE_NUM" "$@"
    fi
    ;;

  close)
    ISSUE_NUM="$1"
    if [ -z "$ISSUE_NUM" ]; then
      echo "Usage: gh-issue.sh close <issue-number>"
      exit 1
    fi

    if [ "$USE_CURL" = true ]; then
      RESPONSE=$(curl -s \
        -X PATCH \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -d '{"state":"closed"}' \
        "$API_BASE/issues/$ISSUE_NUM")

      STATE=$(echo "$RESPONSE" | grep -o '"state": *"[^"]*"' | head -1 | cut -d'"' -f4)
      if [ "$STATE" = "closed" ]; then
        echo "✓ Closed issue #$ISSUE_NUM"
      else
        echo "❌ Failed to close issue"
        echo "$RESPONSE"
        exit 1
      fi
    else
      gh issue close $REPO_FLAG "$ISSUE_NUM"
    fi
    ;;

  assign)
    ISSUE_NUM="$1"
    if [ -z "$ISSUE_NUM" ]; then
      echo "Usage: gh-issue.sh assign <issue-number>"
      exit 1
    fi

    if [ "$USE_CURL" = true ]; then
      # Get current user's login
      USER_RESPONSE=$(curl -s \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/user")

      USERNAME=$(echo "$USER_RESPONSE" | grep -o '"login": *"[^"]*"' | cut -d'"' -f4)
      if [ -z "$USERNAME" ]; then
        echo "❌ Failed to get current user"
        exit 1
      fi

      # Assign issue to current user
      RESPONSE=$(curl -s \
        -X POST \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -d "{\"assignees\":[\"$USERNAME\"]}" \
        "$API_BASE/issues/$ISSUE_NUM/assignees")

      ASSIGNED=$(echo "$RESPONSE" | grep -o '"login": *"'"$USERNAME"'"')
      if [ -n "$ASSIGNED" ]; then
        echo "✓ Assigned issue #$ISSUE_NUM to $USERNAME"
      else
        echo "❌ Failed to assign issue"
        echo "$RESPONSE"
        exit 1
      fi
    else
      # Get current user and assign
      USERNAME=$(gh api user --jq '.login')
      gh issue edit $REPO_FLAG "$ISSUE_NUM" --add-assignee "$USERNAME"
    fi
    ;;

  *)
    echo "Usage: gh-issue.sh [-R owner/repo] <command> [args...]"
    echo ""
    echo "Global options:"
    echo "  -R, --repo <owner/repo>  Target a different repository"
    echo ""
    echo "Commands:"
    echo "  list      List issues [--state open|closed|all] [-L limit]"
    echo "  view      View an issue <number>"
    echo "  create    Create an issue --title <title> [--body <body>] [--body-file <file>]"
    echo "  comment   Add comment to issue <number> --body <comment> [--body-file <file>]"
    echo "  close     Close an issue <number>"
    echo "  assign    Assign issue to yourself <number>"
    echo ""
    echo "Examples:"
    echo "  gh-issue.sh list                              # List issues in current repo"
    echo "  gh-issue.sh -R owner/repo list                # List issues in another repo"
    echo "  gh-issue.sh -R owner/repo create --title 'Bug'  # Create issue in another repo"
    exit 1
    ;;
esac
