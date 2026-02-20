#!/bin/bash

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# From .claude/skills/<skill>/scripts/, go up 4 levels to project root
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"

echo -e "${BLUE}🔍 Pre-Publish Validation${NC}"
echo ""

# ============================================================================
# AUTO-DETECT BASE BRANCH
# ============================================================================

detect_base_branch() {
  # Try to get default branch from remote
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
# AUTO-DETECT AVAILABLE SCRIPTS
# ============================================================================

has_script() {
  local script_name="$1"
  node -e "const pkg=require('$PROJECT_ROOT/package.json'); process.exit(pkg.scripts && pkg.scripts['$script_name'] ? 0 : 1)" 2>/dev/null
}

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================

echo -e "${BLUE}📋 Pre-flight checks...${NC}"

# 1. Auto-detect and check base branch
echo -n "Detecting base branch... "
BASE_BRANCH=$(detect_base_branch)
echo -e "${GREEN}$BASE_BRANCH${NC}"

echo -n "Checking current branch... "
CURRENT_BRANCH=$(git branch --show-current)

# Check if we're not on base branch or main
if [[ "$CURRENT_BRANCH" == "$BASE_BRANCH" ]] || [[ "$CURRENT_BRANCH" == "main" && "$BASE_BRANCH" != "main" ]]; then
    echo -e "${RED}✗${NC}"
    echo -e "${RED}Error: Must be on a feature branch, not on $CURRENT_BRANCH${NC}"
    exit 1
fi

# Check if branch is based on base branch (has it as an ancestor)
git fetch origin "$BASE_BRANCH" --quiet
if ! git merge-base --is-ancestor "origin/$BASE_BRANCH" HEAD 2>/dev/null; then
    echo -e "${RED}✗${NC}"
    echo -e "${RED}Error: Branch $CURRENT_BRANCH is not based on $BASE_BRANCH${NC}"
    echo -e "${RED}Please create your feature branch from $BASE_BRANCH${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} (on $CURRENT_BRANCH, based on $BASE_BRANCH)"

# Check if branch is up to date with remote
echo -n "Checking if branch is up to date with remote... "
BEHIND=$(git rev-list --count HEAD..origin/$BASE_BRANCH 2>/dev/null || echo "0")
if [[ "$BEHIND" -gt 0 ]]; then
    echo -e "${YELLOW}⚠${NC}"
    echo -e "${YELLOW}Warning: Branch is $BEHIND commits behind origin/$BASE_BRANCH${NC}"
    echo -n "Continue anyway? (y/N): "
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC}"
fi

# ============================================================================
# UPDATE @apexdesigner/* DEPENDENCIES
# ============================================================================

echo ""
echo -e "${BLUE}📦 Updating @apexdesigner/* dependencies...${NC}"

cd "$PROJECT_ROOT"

# Get all @apexdesigner/* dependencies
APEX_DEPS=$(node -e "
  const pkg = require('./package.json');
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  Object.keys(deps)
    .filter(name => name.startsWith('@apexdesigner/'))
    .forEach(name => console.log(name));
" 2>/dev/null)

# Check for exact versions (no ^ or ~ prefix) that won't be updated
EXACT_VERSIONS=$(node -e "
  const pkg = require('./package.json');
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  Object.entries(deps)
    .filter(([name, ver]) => name.startsWith('@apexdesigner/') && /^\d/.test(ver))
    .forEach(([name, ver]) => console.log('  ' + name + ': ' + ver));
" 2>/dev/null)

if [ -n "$EXACT_VERSIONS" ]; then
  echo -e "${YELLOW}⚠ Warning: The following have exact versions and won't auto-update:${NC}"
  echo "$EXACT_VERSIONS"
  echo -e "${YELLOW}  Add ^ prefix to enable semver updates (e.g., \"^1.0.30\")${NC}"
  echo ""
fi

if [ -n "$APEX_DEPS" ]; then
  echo "Updating: $APEX_DEPS"
  npm update $APEX_DEPS
  echo -e "${GREEN}✓${NC} @apexdesigner/* dependencies updated"
else
  echo -e "${GREEN}✓${NC} No @apexdesigner/* dependencies found"
fi

# ============================================================================
# VALIDATION
# ============================================================================

echo ""
echo -e "${BLUE}🔍 Running validation...${NC}"

# Track test status
TEST_STATUS="passed"

# Install dependencies
echo "Installing dependencies..."
cd "$PROJECT_ROOT"
npm install
echo -e "${GREEN}✓${NC} Dependencies installed"

# Build package (if available) - run before format/lint to generate code first
if has_script "build"; then
    echo "Building package..."
    npm run build
    echo -e "${GREEN}✓${NC} Build successful"
else
    echo -e "${YELLOW}⚠${NC} No build script found, skipping"
fi

# Run formatting (if available) - continue on error
if has_script "format"; then
    echo "Running formatting..."
    if npm run format; then
        echo -e "${GREEN}✓${NC} Formatting passed"
    else
        echo -e "${YELLOW}⚠${NC} Formatting failed, continuing anyway"
    fi
else
    echo -e "${YELLOW}⚠${NC} No format script found, skipping"
fi

# Run linting with auto-fix (if available)
if has_script "lint"; then
    echo "Running linting with auto-fix..."
    npm run lint -- --fix
    echo -e "${GREEN}✓${NC} Linting passed"
else
    echo -e "${YELLOW}⚠${NC} No lint script found, skipping"
fi

# ============================================================================
# CHECK FOR UNCOMMITTED CHANGES
# ============================================================================

# After dependency updates, formatting, and lint auto-fix, check if any files changed
echo ""
echo -n "Checking for uncommitted changes... "
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}found${NC}"
    echo ""
    echo -e "${YELLOW}⚠ The following files were modified during validation:${NC}"
    git status --short
    echo ""
    echo -e "${YELLOW}This can happen due to:${NC}"
    echo "  - @apexdesigner/* dependency updates"
    echo "  - package-lock.json changes from npm install"
    echo "  - Code generation from build"
    echo "  - Code formatting fixes"
    echo "  - Lint auto-fixes"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Review the changes above"
    echo "2. Commit them:"
    echo "   ${GREEN}git add -A && git commit -m \"chore: apply automated fixes\"${NC}"
    echo "3. Re-run validation:"
    echo "   ${GREEN}bash \".claude/skills/publish-version/scripts/validate.sh\"${NC}"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓${NC} Working directory is clean"

# ============================================================================
# RUN TESTS
# ============================================================================

echo ""
echo -e "${BLUE}🔍 Running tests...${NC}"

# Run tests (if available)
if has_script "test"; then
    echo "Running full test suite..."
    if npm test; then
        echo -e "${GREEN}✓${NC} All tests passed"
    else
        echo -e "${YELLOW}⚠${NC} Some tests failed"
        TEST_STATUS="failed"
    fi
else
    echo -e "${YELLOW}⚠${NC} No test script found, skipping"
fi

# ============================================================================
# RESULTS
# ============================================================================

echo ""
if [[ "$TEST_STATUS" == "passed" ]]; then
    echo -e "${GREEN}✅ Validation completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Status:${NC} ✅ All validation checks passed"
    echo -e "${GREEN}Branch:${NC} $CURRENT_BRANCH"
    echo -e "${GREEN}Base:${NC} $BASE_BRANCH"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Run finalize.sh to bump version and create PR:"
    echo "   ${GREEN}bash \".claude/skills/publish-version/scripts/finalize.sh\" patch${NC}    # or minor/major"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠ Validation completed with test failures${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Status:${NC} ⚠ Tests failed in full suite"
    echo -e "${GREEN}Branch:${NC} $CURRENT_BRANCH"
    echo -e "${GREEN}Base:${NC} $BASE_BRANCH"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Review failed tests above"
    echo "2. Run failed tests individually to check for resource contention:"
    echo "   ${GREEN}npm test -- <test-file> -t \"<test-name>\"${NC}"
    echo ""
    echo "3. If tests pass individually (resource contention), proceed with:"
    echo "   ${GREEN}bash \".claude/skills/publish-version/scripts/finalize.sh\" patch${NC}    # or minor/major"
    echo ""
    echo "4. If tests genuinely fail, fix issues and re-run:"
    echo "   ${GREEN}bash \".claude/skills/publish-version/scripts/validate.sh\"${NC}"
    echo ""
    exit 1
fi
