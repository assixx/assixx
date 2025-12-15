#!/bin/bash
# Test runner that ensures Jest summary appears at the end

echo "🚀 Running tests..."
echo ""

# Run tests and capture output
TEST_OUTPUT=$(pnpm test 2>&1)
EXIT_CODE=$?

# Print the full output
echo "$TEST_OUTPUT"

# Extract and display summary at the end
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 JEST TEST SUMMARY:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$TEST_OUTPUT" | grep -E "(Test Suites:|Tests:|Snapshots:|Time:)" | tail -4
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit $EXIT_CODE