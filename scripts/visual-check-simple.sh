#!/bin/bash

# Simplified Visual Check Script
# Prüft auf Layout-Verschiebungen und CSS-Änderungen ohne Screenshots

cd /home/scs/projects/Assixx || exit 1

# Farben für Output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Prüfungen durchführen
echo "=================================="
echo "Visual Integrity Check (Simplified)"
echo "=================================="
echo ""

errors=0
warnings=0

# 1. Prüfe ob alle CSS-Dateien vorhanden sind
echo -e "${BLUE}1. Prüfe CSS-Dateien...${NC}"
css_files=(
    "frontend/src/styles/dashboard-theme.css"
    "frontend/src/styles/utilities.css"
    "frontend/src/styles/base/variables.css"
    "frontend/src/styles/breadcrumb-alignment.css"
)

for file in "${css_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file fehlt!"
        ((errors++))
    fi
done

echo ""

# 2. Prüfe auf doppelte CSS-Variablen
echo -e "${BLUE}2. Prüfe auf doppelte CSS-Variablen...${NC}"
duplicates=$(grep -h "^[[:space:]]*--" frontend/src/styles/*.css 2>/dev/null | sort | uniq -d | wc -l)
if [ "$duplicates" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠${NC} $duplicates doppelte CSS-Variablen gefunden"
    ((warnings++))
else
    echo -e "  ${GREEN}✓${NC} Keine doppelten CSS-Variablen"
fi

echo ""

# 3. Prüfe Layout-Shift Prevention
echo -e "${BLUE}3. Prüfe Layout-Shift Prevention...${NC}"
pages_with_nav=$(find frontend/src/pages -name "*.html" -exec grep -l "navigation-container" {} \; | wc -l)
pages_with_fix=$(find frontend/src/pages -name "*.html" -exec grep -l "data-sidebar.*collapsed.*expanded" {} \; | wc -l)

echo -e "  Seiten mit Navigation: $pages_with_nav"
echo -e "  Seiten mit Layout-Fix: $pages_with_fix"

if [ "$pages_with_nav" -eq "$pages_with_fix" ]; then
    echo -e "  ${GREEN}✓${NC} Alle Seiten haben Layout-Shift Prevention"
else
    echo -e "  ${YELLOW}⚠${NC} $(($pages_with_nav - $pages_with_fix)) Seiten fehlt Layout-Shift Prevention"
    ((warnings++))
fi

echo ""

# 4. Prüfe Inline Styles
echo -e "${BLUE}4. Prüfe Inline Styles...${NC}"
inline_count=$(grep -h 'style=' frontend/src/**/*.html 2>/dev/null | wc -l)
display_none_count=$(grep -h 'style="display:\s*none' frontend/src/**/*.html 2>/dev/null | wc -l)

echo -e "  Gesamt Inline Styles: $inline_count"
echo -e "  display:none Inline: $display_none_count"

if [ "$inline_count" -lt 250 ]; then
    echo -e "  ${GREEN}✓${NC} Inline Styles reduziert (unter 250)"
else
    echo -e "  ${YELLOW}⚠${NC} Noch viele Inline Styles vorhanden"
    ((warnings++))
fi

echo ""

# 5. Prüfe Utility Classes Verwendung
echo -e "${BLUE}5. Prüfe Utility Classes Verwendung...${NC}"
utility_usage=$(grep -h 'class=".*u-' frontend/src/**/*.html 2>/dev/null | wc -l)
echo -e "  Utility Classes verwendet: $utility_usage mal"

if [ "$utility_usage" -gt 50 ]; then
    echo -e "  ${GREEN}✓${NC} Utility Classes werden aktiv genutzt"
else
    echo -e "  ${YELLOW}⚠${NC} Utility Classes könnten mehr genutzt werden"
    ((warnings++))
fi

echo ""

# 6. Prüfe kritische CSS-Eigenschaften (Glassmorphismus)
echo -e "${BLUE}6. Prüfe Glassmorphismus-Eigenschaften...${NC}"
glass_properties=(
    "backdrop-filter"
    "rgba(255, 255, 255, 0.02)"
    "blur(20px)"
    "saturate(180%)"
)

for prop in "${glass_properties[@]}"; do
    count=$(grep -r "$prop" frontend/src --include="*.css" --include="*.html" 2>/dev/null | wc -l)
    if [ "$count" -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} '$prop' gefunden ($count mal)"
    else
        echo -e "  ${RED}✗${NC} '$prop' nicht gefunden!"
        ((errors++))
    fi
done

echo ""

# 7. Prüfe Container-Migration
echo -e "${BLUE}7. Prüfe Container-Migration...${NC}"
main_content=$(grep -r "main-content" frontend/src/pages --include="*.html" | wc -l)
layout_container=$(grep -r "layout-container" frontend/src/pages --include="*.html" | wc -l)

echo -e "  main-content: $main_content Verwendungen"
echo -e "  layout-container: $layout_container Verwendungen"

if [ "$layout_container" -gt 30 ]; then
    echo -e "  ${GREEN}✓${NC} Container-Migration durchgeführt"
else
    echo -e "  ${YELLOW}⚠${NC} Container-Migration unvollständig"
    ((warnings++))
fi

echo ""

# 8. Erstelle Zusammenfassung
echo "=================================="
echo "Zusammenfassung"
echo "=================================="
echo ""

if [ "$errors" -eq 0 ] && [ "$warnings" -eq 0 ]; then
    echo -e "${GREEN}✓ Alle Tests bestanden!${NC}"
    echo "Keine visuellen Änderungen erwartet."
elif [ "$errors" -eq 0 ]; then
    echo -e "${YELLOW}⚠ Tests mit Warnungen bestanden${NC}"
    echo "$warnings Warnungen gefunden."
else
    echo -e "${RED}✗ Tests fehlgeschlagen!${NC}"
    echo "$errors Fehler und $warnings Warnungen gefunden."
fi

echo ""
echo "Tipp: Für vollständige visuelle Tests verwende visual-regression-check.sh"

# Exit Code
if [ "$errors" -gt 0 ]; then
    exit 1
else
    exit 0
fi