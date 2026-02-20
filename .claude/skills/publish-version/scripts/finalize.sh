#!/bin/bash

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cross-platform sed in-place edit (macOS uses -i '', Linux uses -i)
sed_inplace() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# Get script directory, plugin root, and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# From .claude/skills/<skill>/scripts/, go up 4 levels to project root
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
GITHUB_SCRIPT_DIR="$SCRIPT_DIR/../../github/scripts"

# Parse arguments
FROM_PUBLISH=false
INCREMENT_TYPE="patch"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --from-publish)
            FROM_PUBLISH=true
            shift
            ;;
        *)
            INCREMENT_TYPE="$1"
            shift
            ;;
    esac
done

echo -e "${BLUE}📦 Publish Finalization${NC}"
echo ""

# ============================================================================
# AUTO-DETECT BASE BRANCH
# ============================================================================

detect_base_branch() {
  local default_branch
  default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || true)

  if [ -n "$default_branch" ]; then
    echo "$default_branch"
    return
  fi

  # No default branch found - fail with helpful message
  echo -e "${RED}❌ Could not detect the default branch${NC}" >&2
  echo -e "   Run: ${GREEN}git remote set-head origin --auto${NC}" >&2
  echo -e "   Or:  ${GREEN}git remote set-head origin <branch-name>${NC}" >&2
  exit 1
}

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================

echo -e "${BLUE}📋 Quick pre-flight checks...${NC}"

# 1. Check clean working directory
echo -n "Checking working directory is clean... "
cd "$PROJECT_ROOT"
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}✗${NC}"
    echo -e "${RED}Error: Working directory is not clean. Please commit or stash changes first.${NC}"
    git status --short
    exit 1
fi
echo -e "${GREEN}✓${NC}"

# 2. Auto-detect base branch and check current branch
echo -n "Detecting base branch... "
BASE_BRANCH=$(detect_base_branch)
echo -e "${GREEN}$BASE_BRANCH${NC}"

echo -n "Checking current branch... "
CURRENT_BRANCH=$(git branch --show-current)

if [[ "$CURRENT_BRANCH" == "$BASE_BRANCH" ]] || [[ "$CURRENT_BRANCH" == "main" && "$BASE_BRANCH" != "main" ]]; then
    echo -e "${RED}✗${NC}"
    echo -e "${RED}Error: Must be on a feature branch, not on $CURRENT_BRANCH${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} (on $CURRENT_BRANCH)"

# 3. Confirm failed tests were verified individually (only when run directly)
if [[ "$FROM_PUBLISH" == "false" ]]; then
    echo ""
    echo -e "${YELLOW}⚠ IMPORTANT: Test Verification Required${NC}"
    echo "Before proceeding, you must have:"
    echo "  1. Run validate.sh (or publish.sh which runs it)"
    echo "  2. If any tests failed, run EACH failed test individually"
    echo "  3. Confirmed each failed test passes when run alone (resource contention)"
    echo ""
    echo -n "Have you verified ALL failed tests pass individually? [y/N] "
    read -r VERIFIED_TESTS

    if [[ "$VERIFIED_TESTS" != "y" && "$VERIFIED_TESTS" != "Y" ]]; then
        echo ""
        echo -e "${RED}❌ Cannot proceed without test verification.${NC}"
        echo ""
        echo -e "${YELLOW}Please run the following steps:${NC}"
        echo "  1. Run: bash \".claude/skills/publish-version/scripts/validate.sh\""
        echo "  2. For each failed test, run individually:"
        echo "     npm test -- <test-file> -t \"<test-name>\""
        echo "  3. Once all failed tests pass individually, re-run this script"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Test verification confirmed"
fi

# ============================================================================
# VERSION UPDATE
# ============================================================================

echo ""
echo -e "${BLUE}📦 Version update...${NC}"

# Get current version and determine new version
CURRENT_VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")
echo "Current version: $CURRENT_VERSION"

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Determine new version based on argument
SKIP_VERSION=false
case "$INCREMENT_TYPE" in
    none)
        SKIP_VERSION=true
        echo -e "${YELLOW}Skipping version update - changes will not trigger npm publish${NC}"
        ;;
    major)
        NEW_VERSION="$((MAJOR + 1)).0.0"
        ;;
    minor)
        NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
        ;;
    patch)
        NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
        ;;
    [0-9]*.[0-9]*.[0-9]*)
        # Custom version provided
        NEW_VERSION="$INCREMENT_TYPE"
        ;;
    *)
        echo -e "${RED}Error: Invalid increment type or version: $INCREMENT_TYPE${NC}"
        echo "Usage: $0 [none|patch|minor|major|X.Y.Z]"
        exit 1
        ;;
esac

if [[ "$SKIP_VERSION" == "false" ]]; then
    echo "New version: $NEW_VERSION"
    echo "Proceeding with version $NEW_VERSION..."
fi

# Update version in package.json files (skip if none mode)
if [[ "$SKIP_VERSION" == "false" ]]; then
    cd "$PROJECT_ROOT"

    # Find all tracked package.json files (excludes node_modules, gitignored dirs)
    PACKAGE_FILES=$(git ls-files '*/package.json' 'package.json' 2>/dev/null || echo "package.json")

    echo "Updating package.json files..."
    for pkg_file in $PACKAGE_FILES; do
        if [[ -f "$pkg_file" ]]; then
            node -e "const fs=require('fs'); const pkg=JSON.parse(fs.readFileSync('$pkg_file', 'utf8')); pkg.version='$NEW_VERSION'; fs.writeFileSync('$pkg_file', JSON.stringify(pkg, null, 2) + '\n');"
            echo -e "${GREEN}✓${NC} $pkg_file updated to $NEW_VERSION"
        fi
    done

    # Update package-lock.json if it exists
    if [[ -f "package-lock.json" ]]; then
        echo "Updating package-lock.json..."
        npm install --package-lock-only
        echo -e "${GREEN}✓${NC} package-lock.json updated"
    fi
fi

# ============================================================================
# CHANGELOG UPDATE
# ============================================================================

echo "Updating CHANGELOG.md..."

# Get commits in current branch that are not in base branch
echo "Getting commits from current branch (not in $BASE_BRANCH)..."
git fetch origin "$BASE_BRANCH" --quiet
COMMITS=$(git log origin/$BASE_BRANCH..HEAD --oneline --no-merges)

# Check if there are any commits
if [[ -z "$COMMITS" ]]; then
    echo -e "${YELLOW}Warning: No new commits in this branch.${NC}"
    CHANGELOG_ENTRY="No changes"
else
    # Format commits for changelog
    CHANGELOG_ENTRY=$(echo "$COMMITS" | sed 's/^/- /')
    COMMIT_COUNT=$(echo "$COMMITS" | wc -l)
    echo "Found $COMMIT_COUNT commit(s) to add to changelog"
fi

# Create or ensure CHANGELOG.md exists
if [[ ! -f CHANGELOG.md ]]; then
    echo "# Changelog" > CHANGELOG.md
    echo "" >> CHANGELOG.md
fi

# Add current branch commits to Unreleased section
if grep -q "^## \[Unreleased\]" CHANGELOG.md; then
    # Append to existing Unreleased section
    UNRELEASED_LINE=$(grep -n "^## \[Unreleased\]" CHANGELOG.md | head -1 | cut -d: -f1)
    {
        head -n $((UNRELEASED_LINE + 1)) CHANGELOG.md
        echo "$CHANGELOG_ENTRY"
        echo ""
        tail -n +$((UNRELEASED_LINE + 2)) CHANGELOG.md
    } > CHANGELOG.md.tmp
    mv CHANGELOG.md.tmp CHANGELOG.md
else
    # Create new Unreleased section
    NEW_ENTRY="## [Unreleased]

$CHANGELOG_ENTRY

"
    {
        head -n 2 CHANGELOG.md  # Keep "# Changelog" and blank line
        echo "$NEW_ENTRY"
        tail -n +3 CHANGELOG.md
    } > CHANGELOG.md.tmp
    mv CHANGELOG.md.tmp CHANGELOG.md
fi

# In version mode, rename Unreleased → [X.Y.Z]
if [[ "$SKIP_VERSION" == "false" ]]; then
    CHANGELOG_DATE=$(date +"%Y-%m-%d")
    sed_inplace "s/^## \[Unreleased\]/## [$NEW_VERSION] - $CHANGELOG_DATE/" CHANGELOG.md
    echo -e "${GREEN}✓${NC} CHANGELOG.md updated (version $NEW_VERSION)"
else
    echo -e "${GREEN}✓${NC} CHANGELOG.md updated (Unreleased section)"
fi

# ============================================================================
# PR PREPARATION
# ============================================================================

echo ""
echo -e "${BLUE}📝 Preparing PR...${NC}"

# Commit changes
echo "Committing changes..."
if [[ "$SKIP_VERSION" == "true" ]]; then
    git add -A
    git commit -m "chore: merge changes without version bump"
    echo -e "${GREEN}✓${NC} Changes committed (no version bump)"
else
    # Add all package.json files that were updated
    for pkg_file in $PACKAGE_FILES; do
        [[ -f "$pkg_file" ]] && git add "$pkg_file"
    done
    git add CHANGELOG.md
    [[ -f "package-lock.json" ]] && git add package-lock.json
    git commit -m "chore: bump version to $NEW_VERSION"
    echo -e "${GREEN}✓${NC} Changes committed"

    # Create version tag
    echo "Creating version tag v$NEW_VERSION..."
    git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

$CHANGELOG_ENTRY"
    echo -e "${GREEN}✓${NC} Tag v$NEW_VERSION created"
fi

# Push changes with tags
echo "Pushing changes and tags to remote..."
git push origin "$CURRENT_BRANCH" --follow-tags
echo -e "${GREEN}✓${NC} Changes and tags pushed"

# Generate PR title and body
if [[ "$SKIP_VERSION" == "true" ]]; then
    PR_TITLE="Merge changes (no version bump)"
    PR_BODY="## Changes (No Version Bump)

### Commits
$CHANGELOG_ENTRY

### Validation
- ✅ Build successful
- ✅ All tests passed (or verified individually)

**Note:** This PR does not bump the version and will not trigger npm publish. Changes have been added to the Unreleased section of CHANGELOG.md."
else
    PR_TITLE="Release v$NEW_VERSION"
    PR_BODY="## Version $NEW_VERSION

### Changes
$CHANGELOG_ENTRY

### Validation
- ✅ Build successful
- ✅ All tests passed (or verified individually)

This PR updates the version to $NEW_VERSION and prepares for release."
fi

# Create GitHub PR using github skill wrapper
echo "Creating pull request..."

# Write PR body to temp file for proper escaping
PR_BODY_FILE=$(mktemp)
echo "$PR_BODY" > "$PR_BODY_FILE"

PR_URL=$("$GITHUB_SCRIPT_DIR/gh-pr.sh" create --title "$PR_TITLE" --body-file "$PR_BODY_FILE" --base "$BASE_BRANCH" 2>&1 | grep -E "^https://|Created PR:" | tail -1 | sed 's/.*: //')
rm -f "$PR_BODY_FILE"

if [[ -z "$PR_URL" ]]; then
    echo -e "${YELLOW}⚠${NC} PR creation may have failed. Check output above."
else
    echo -e "${GREEN}✓${NC} Pull request created"
fi

# Display results
echo ""
if [[ "$SKIP_VERSION" == "true" ]]; then
    echo -e "${GREEN}✅ Finalization completed (no version bump)!${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Version:${NC} $CURRENT_VERSION (unchanged)"
    echo -e "${GREEN}Branch:${NC} $CURRENT_BRANCH"
    echo -e "${GREEN}Base:${NC} $BASE_BRANCH"
    echo -e "${GREEN}Status:${NC} ✅ Committed and pushed (no tag)"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Review the pull request in GitHub"
    echo "2. Merge the PR when ready - this will NOT trigger npm publish"
    echo ""
    echo -e "${GREEN}🔗 Pull Request:${NC}"
    echo "$PR_URL"
    echo ""
    echo -e "${BLUE}Note:${NC} No version tag was created. Changes added to Unreleased section in CHANGELOG.md."
else
    echo -e "${GREEN}✅ Finalization completed!${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Version:${NC} $CURRENT_VERSION → $NEW_VERSION"
    echo -e "${GREEN}Branch:${NC} $CURRENT_BRANCH"
    echo -e "${GREEN}Base:${NC} $BASE_BRANCH"
    echo -e "${GREEN}Status:${NC} ✅ Committed and pushed"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Review the pull request in GitHub"
    echo "2. Merge the PR when ready"
    echo ""
    echo -e "${GREEN}🔗 Pull Request:${NC}"
    echo "$PR_URL"
    echo ""
    echo -e "${BLUE}Note:${NC} GitHub Actions will automatically publish to npm when the tagged commit is merged."
fi
