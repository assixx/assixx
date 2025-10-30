#!/bin/bash
# Design System Compliance Check v2.0
# Enhanced for complete Bootstrap → Design System migration verification
# Checks: Bootstrap removal, Inline styles/JS, Design System compliance, BEM notation

FILE="${1:-frontend/src/pages/admin-dashboard.html}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "🔍 Design System Compliance Check v2.0"
echo "📄 Checking: $FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Initialize counters
ISSUES_FOUND=0
WARNINGS_FOUND=0

# 1. Bootstrap Classes (CRITICAL)
echo -e "${RED}❌ Bootstrap Classes (Must be 0):${NC}"
# NOTE: Excludes Design System buttons (btn-primary, btn-secondary, btn-danger, btn-modal)
# NOTE: Excludes Design System dropdown (uses BEM: dropdown__trigger, dropdown__menu)
# Only checks for Bootstrap-specific button classes and other Bootstrap components
BOOTSTRAP_PATTERNS="btn-default|btn-lg|btn-sm|btn-xs|btn-block|btn-outline-|btn-group|btn-toolbar|form-control|form-group|input-group|modal-dialog|modal-content|table-striped|alert-danger|alert-success|alert-info|alert-warning|container-fluid| row | col-md-|col-sm-|col-lg-|col-xs-|pull-right|pull-left|navbar|dropdown-toggle|dropdown-item|dropdown-divider|dropdown-header"
BOOTSTRAP_FOUND=$(grep -E "class=\"[^\"]*\b($BOOTSTRAP_PATTERNS)" "$FILE" 2>/dev/null | head -5)
if [ -n "$BOOTSTRAP_FOUND" ]; then
  echo "$BOOTSTRAP_FOUND" | while IFS= read -r line; do
    echo "  Line: $line"
  done
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
  echo -e "  ${GREEN}✅ None found${NC}"
fi
echo ""

# 2. Bootstrap JavaScript (CRITICAL)
echo -e "${RED}❌ Bootstrap JavaScript:${NC}"
BOOTSTRAP_JS=$(grep -n "bootstrap\.bundle\|bootstrap\.min\.js\|popper\.js\|bootstrap\.js" "$FILE" 2>/dev/null)
if [ -n "$BOOTSTRAP_JS" ]; then
  echo "$BOOTSTRAP_JS"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
  echo -e "  ${GREEN}✅ None found${NC}"
fi
echo ""

# 3. Inline Styles (CRITICAL)
echo -e "${RED}❌ Inline Styles (style=\"\"):${NC}"
INLINE_STYLES=$(grep -n "style=\"" "$FILE" 2>/dev/null | head -5)
if [ -n "$INLINE_STYLES" ]; then
  echo "$INLINE_STYLES"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
  echo -e "  ${GREEN}✅ None found${NC}"
fi
echo ""

# 4. Inline JavaScript (CRITICAL)
echo -e "${RED}❌ Inline JavaScript:${NC}"
INLINE_JS=$(grep -n "onclick=\|onload=\|onchange=\|onsubmit=\|onerror=\|onfocus=\|onblur=" "$FILE" 2>/dev/null)
if [ -n "$INLINE_JS" ]; then
  echo "$INLINE_JS"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
  echo -e "  ${GREEN}✅ None found${NC}"
fi
echo ""

# 5. Script tags with inline code (CRITICAL)
echo -e "${RED}❌ Inline Script Blocks:${NC}"
# Check for script tags that are not just src references
INLINE_SCRIPTS=$(awk '/<script[^>]*>/{p=1; line=$0} p && /<\/script>/{if(length(line) > 100 || line ~ /[{};()]/) print NR": "line; p=0; line=""} p && !/<\/script>/{line=line" "$0}' "$FILE" 2>/dev/null | head -5)
if [ -n "$INLINE_SCRIPTS" ]; then
  echo "$INLINE_SCRIPTS"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
  echo -e "  ${GREEN}✅ None found (only external modules)${NC}"
fi
echo ""

# 6. text-gray-* Classes (WARNING - should use CSS variables)
echo -e "${YELLOW}⚠️  Hardcoded Gray Classes (use CSS variables instead):${NC}"
GRAY_CLASSES=$(grep -n "text-gray-[0-9][0-9][0-9]\|bg-gray-[0-9][0-9][0-9]\|border-gray-[0-9][0-9][0-9]" "$FILE" 2>/dev/null | head -5)
if [ -n "$GRAY_CLASSES" ]; then
  echo "$GRAY_CLASSES"
  echo -e "  ${YELLOW}Should use: text-[var(--color-text-secondary)] etc.${NC}"
  WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
else
  echo -e "  ${GREEN}✅ None found${NC}"
fi
echo ""

# 7. Design System Components (GOOD!)
echo -e "${GREEN}✅ Design System Components Found:${NC}"
# Core components
echo "  📦 Cards:"
grep -o "card-stat\|card-accent\|card__\|card-accent__" "$FILE" 2>/dev/null | sort -u | head -10 | sed 's/^/    /'

echo "  🔘 Buttons:"
grep -o "btn btn-[a-z]*\|btn-[a-z]*" "$FILE" 2>/dev/null | sort -u | head -10 | sed 's/^/    /'

echo "  🎨 Design Tokens (CSS Variables):"
grep -o "var(--[a-z-]*)" "$FILE" 2>/dev/null | sort -u | head -10 | sed 's/^/    /'
echo ""

# 8. BEM Notation Check
echo -e "${BLUE}📐 BEM Notation Compliance:${NC}"
BEM_CORRECT=$(grep -o "class=\"[^\"]*__[^\"]*\"" "$FILE" 2>/dev/null | wc -l)
BEM_MODIFIER=$(grep -o "class=\"[^\"]*--[^\"]*\"" "$FILE" 2>/dev/null | wc -l)
echo "  Block__Element patterns: $BEM_CORRECT found"
echo "  Block--Modifier patterns: $BEM_MODIFIER found"
if [ "$BEM_CORRECT" -gt 0 ] || [ "$BEM_MODIFIER" -gt 0 ]; then
  echo -e "  ${GREEN}✅ BEM notation properly used${NC}"
else
  echo -e "  ${YELLOW}⚠️  No BEM patterns found${NC}"
fi
echo ""

# 9. TypeScript Modules Check
echo -e "${BLUE}📦 Module Scripts:${NC}"
TS_MODULES=$(grep -c "type=\"module\".*\.ts\"" "$FILE" 2>/dev/null || echo "0")
JS_MODULES=$(grep -c "type=\"module\".*\.js\"" "$FILE" 2>/dev/null | head -1 || echo "0")
REGULAR_SCRIPTS=$(grep -c "<script.*src=" "$FILE" 2>/dev/null | head -1 || echo "0")
echo "  TypeScript modules: $TS_MODULES"
echo "  JavaScript modules: $JS_MODULES"
CALC_REGULAR=$((REGULAR_SCRIPTS - TS_MODULES - JS_MODULES))
echo "  Regular scripts: $CALC_REGULAR"
if [ "$TS_MODULES" -gt 0 ]; then
  echo -e "  ${GREEN}✅ Using TypeScript modules${NC}"
fi
echo ""

# 10. Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 COMPLIANCE SUMMARY:${NC}"
echo ""

# Count various elements for scoring
BOOTSTRAP_COUNT=$(grep -c -E "\b($BOOTSTRAP_PATTERNS)" "$FILE" 2>/dev/null | head -1 || echo "0")
INLINE_STYLE_COUNT=$(grep -c "style=\"" "$FILE" 2>/dev/null | head -1 || echo "0")
INLINE_JS_COUNT=$(grep -c "onclick=\|onload=\|onchange=" "$FILE" 2>/dev/null | head -1 || echo "0")
DESIGN_SYSTEM_COUNT=$(grep -c "card-stat\|card-accent\|btn-modal\|card__\|card-accent__" "$FILE" 2>/dev/null || echo "0")
CSS_VAR_COUNT=$(grep -c "var(--" "$FILE" 2>/dev/null || echo "0")

echo "  🚫 Bootstrap remnants: $BOOTSTRAP_COUNT"
INLINE_STYLE_COUNT=$(echo "$INLINE_STYLE_COUNT" | head -1)
echo "  🚫 Inline styles: $INLINE_STYLE_COUNT"
INLINE_JS_COUNT=$(echo "$INLINE_JS_COUNT" | head -1)
echo "  🚫 Inline JavaScript: $INLINE_JS_COUNT"
echo "  ✅ Design System components: $DESIGN_SYSTEM_COUNT"
echo "  ✅ CSS variables used: $CSS_VAR_COUNT"
echo "  ⚠️  Warnings: $WARNINGS_FOUND"
echo ""

# Final verdict
if [ "$ISSUES_FOUND" -eq 0 ]; then
  if [ "$WARNINGS_FOUND" -eq 0 ]; then
    echo -e "${GREEN}🎉 PERFECT! File is 100% Design System compliant!${NC}"
    echo -e "${GREEN}   No Bootstrap, no inline styles/JS, proper BEM notation${NC}"
    exit 0
  else
    echo -e "${GREEN}✅ GOOD! File is Design System compliant${NC}"
    echo -e "${YELLOW}   Minor improvements suggested (see warnings above)${NC}"
    exit 0
  fi
else
  echo -e "${RED}❌ FAILED! File needs migration work${NC}"
  echo -e "${RED}   Found $ISSUES_FOUND critical issues that must be fixed${NC}"
  exit 1
fi