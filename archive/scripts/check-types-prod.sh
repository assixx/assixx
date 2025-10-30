#!/bin/sh
# Script to check TypeScript types only for production code (excluding tests)

echo "🔍 Checking TypeScript types for production code only..."
echo "ℹ️  Test files are excluded (56 known errors in tests for v0.1.0)"
echo ""

# Change to project root
cd "$(dirname "$0")/.." || exit 1

# Create temporary tsconfig for production only
cat > tsconfig.prod.temp.json << EOF
{
  "extends": "./tsconfig.json",
  "exclude": [
    "node_modules",
    "dist",
    "backend/dist",
    "frontend/dist",
    "uploads",
    "logs",
    "**/*.test.ts",
    "**/*.test.js",
    "**/*.spec.ts",
    "**/*.spec.js",
    "**/__tests__/**",
    "**/test/**",
    "**/tests/**",
    "backend/src/__tests__/**",
    "backend/src/**/__tests__/**",
    "frontend/src/__tests__/**",
    "frontend/src/**/__tests__/**"
  ]
}
EOF

# Run TypeScript check with production config
if [ -f /.dockerenv ]; then
    # Running inside Docker
    npx tsc --noEmit -p tsconfig.prod.temp.json
else
    # Running locally
    npx tsc --noEmit -p tsconfig.prod.temp.json
fi

RESULT=$?

# Clean up
rm -f tsconfig.prod.temp.json

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "✅ Production code has no TypeScript errors!"
    echo "ℹ️  Note: Test files with 56 known errors are excluded from this check."
else
    echo ""
    echo "❌ TypeScript errors found in production code!"
    echo "   These need to be fixed immediately."
fi

exit $RESULT