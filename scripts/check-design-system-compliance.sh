#!/bin/bash
# Design System Compliance Check
# Prüft ob eine HTML-Datei Bootstrap/Legacy CSS verwendet

FILE="${1:-frontend/src/pages/signup.html}"

echo "🔍 Checking: $FILE"
echo ""

# 1. Bootstrap Classes (excluding Design System false positives)
echo "❌ Bootstrap Classes:"
# Exclude: card-body, card-header, card-title (these are Design System classes)
grep -n "class=\"[^\"]*\(btn-default\|btn-success\|btn-info\|form-control\|input-group\|modal-dialog\|table-striped\|alert-danger\)" "$FILE" || echo "  ✅ None found"
echo ""

# 2. Bootstrap JS
echo "❌ Bootstrap JavaScript:"
grep -n "bootstrap\.bundle\|bootstrap\.min\.js\|popper\.js" "$FILE" || echo "  ✅ None found"
echo ""

# 3. Inline Styles (sollten vermieden werden)
echo "⚠️  Inline Styles (should use Design System classes):"
grep -n "style=\"[^\"]*\(background\|padding\|margin\|border\):" "$FILE" | head -10 || echo "  ✅ None found"
echo ""

# 4. Legacy CSS ohne Design System Tokens
echo "⚠️  Custom CSS ohne Design System Tokens:"
CSS_FILE="${FILE/pages/styles}"
CSS_FILE="${CSS_FILE/.html/.css}"
if [ -f "$CSS_FILE" ]; then
  echo "  Checking: $CSS_FILE"
  # Suche nach hardcoded colors/sizes ohne var(--*)
  grep -n "^\.[a-zA-Z-].*{\|  \(color\|background\|padding\|margin\|border\): \(#\|[0-9]\)" "$CSS_FILE" | grep -v "var(--" | head -10 || echo "  ✅ All using Design System tokens"
else
  echo "  ℹ️  No CSS file found"
fi
echo ""

# 5. Design System Classes (gut!)
echo "✅ Design System Classes Found:"
grep -o "class=\"[^\"]*\(page-container\|form-field\|btn\|alert\|card\)[^\"]*\"" "$FILE" | sort -u | head -10
echo ""

# 6. Tailwind Utility Classes (gut!)
echo "✅ Tailwind Utilities Found:"
grep -o "class=\"[^\"]*\(max-w-\|p-\|m-\|flex\|grid\)[^\"]*\"" "$FILE" | sort -u | head -10
echo ""

echo "📊 Summary:"
BOOTSTRAP_COUNT=$(grep -c "btn-default\|btn-success\|form-control\|modal-dialog" "$FILE" 2>/dev/null || echo "0")
INLINE_STYLE_COUNT=$(grep -c "style=\"" "$FILE" 2>/dev/null || echo "0")
DESIGN_SYSTEM_COUNT=$(grep -c "page-container\|form-field\|btn\|alert\|card" "$FILE" 2>/dev/null || echo "0")

echo "  Bootstrap classes: $BOOTSTRAP_COUNT"
echo "  Inline styles: $INLINE_STYLE_COUNT"
echo "  Design System classes: $DESIGN_SYSTEM_COUNT"
echo ""

if [ "$BOOTSTRAP_COUNT" -eq 0 ] && [ "$DESIGN_SYSTEM_COUNT" -gt 0 ]; then
  echo "🎉 File is Design System compliant!"
  exit 0
else
  echo "⚠️  File needs migration work"
  exit 1
fi
