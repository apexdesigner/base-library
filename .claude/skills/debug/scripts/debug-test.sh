#!/bin/bash

# Run a test with DEBUG output enabled
#
# Usage:
#   debug-test.sh <debug-pattern> [test-args...]
#
# Examples:
#   debug-test.sh '*OrderService*' -- src/order.spec.ts
#   debug-test.sh '*processOrder*' -- -t "should process order"
#   debug-test.sh 'MyApp:*' -- src/services/

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}Error: Debug pattern required${NC}"
    echo ""
    echo "Usage: debug-test.sh <debug-pattern> [test-args...]"
    echo ""
    echo "Examples:"
    echo "  debug-test.sh '*OrderService*' -- src/order.spec.ts"
    echo "  debug-test.sh '*processOrder*' -- -t \"should process order\""
    echo "  debug-test.sh 'MyApp:*' -- src/services/"
    exit 1
fi

DEBUG_PATTERN="$1"
shift

echo -e "${BLUE}Running tests with DEBUG=${DEBUG_PATTERN}${NC}"
echo ""

DEBUG="$DEBUG_PATTERN" npm test -- "$@"
