#!/bin/bash

# Maintainability Progress Tracker
# Zeigt den Fortschritt der Code-Maintainability-Verbesserungen

cd /home/scs/projects/Assixx || exit 1

# Farben
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Progress Bar Funktion
progress_bar() {
    local current=$1
    local total=$2
    local width=30
    local percentage=$((current * 100 / total))
    local filled=$((width * current / total))
    local empty=$((width - filled))
    
    printf "["
    printf "%${filled}s" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '▒'
    printf "] %3d%%" "$percentage"
}

# Header
clear
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          CODE MAINTAINABILITY PROGRESS TRACKER                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
date
echo ""

# 1. CSS Variablen Konsolidierung
echo -e "${CYAN}═══ CSS Variablen Konsolidierung ═══${NC}"
total_vars=$(grep -h "^[[:space:]]*--" frontend/src/styles/**/*.css 2>/dev/null | sort -u | wc -l)
duplicate_vars=$(grep -h "^[[:space:]]*--" frontend/src/styles/*.css 2>/dev/null | sort | uniq -d | wc -l)
unique_vars=$((total_vars - duplicate_vars))

echo -n "Eindeutige Variablen: "
progress_bar $unique_vars $total_vars
echo " ($unique_vars/$total_vars)"

if [ "$duplicate_vars" -gt 0 ]; then
    echo -e "${YELLOW}⚠ $duplicate_vars doppelte Variablen gefunden${NC}"
fi
echo ""

# 2. Inline Styles Migration
echo -e "${CYAN}═══ Inline Styles Migration ═══${NC}"
initial_inline=481  # Aus dem Plan
current_inline=$(grep -h 'style=' frontend/src/**/*.html 2>/dev/null | wc -l)
migrated=$((initial_inline - current_inline))

echo -n "Migrierte Styles: "
progress_bar $migrated $initial_inline
echo " ($migrated/$initial_inline)"

echo "Verbleibende Inline Styles: $current_inline"
echo ""

# 3. Utility Classes Adoption
echo -e "${CYAN}═══ Utility Classes Adoption ═══${NC}"
utility_usage=$(grep -h 'class=".*u-' frontend/src/**/*.html 2>/dev/null | wc -l)
pages_using_utils=$(find frontend/src/pages -name "*.html" -exec grep -l 'class=".*u-' {} \; | wc -l)
total_pages=$(find frontend/src/pages -name "*.html" | wc -l)

echo -n "Seiten mit Utility Classes: "
progress_bar $pages_using_utils $total_pages
echo " ($pages_using_utils/$total_pages)"

echo "Gesamt Utility-Verwendungen: $utility_usage"
echo ""

# 4. Layout Shift Prevention
echo -e "${CYAN}═══ Layout Shift Prevention ═══${NC}"
pages_with_nav=$(find frontend/src/pages -name "*.html" -exec grep -l "navigation-container" {} \; | wc -l)
pages_with_fix=$(find frontend/src/pages -name "*.html" -exec grep -l "data-sidebar.*collapsed.*expanded" {} \; | wc -l)

echo -n "Layout-Shift Fix: "
progress_bar $pages_with_fix $pages_with_nav
echo " ($pages_with_fix/$pages_with_nav)"
echo ""

# 5. Container Migration
echo -e "${CYAN}═══ Container Migration ═══${NC}"
layout_container=$(grep -r "layout-container" frontend/src/pages --include="*.html" | wc -l)
main_content=$(grep -r "main-content" frontend/src/pages --include="*.html" | wc -l)

echo -n "Container Migration: "
progress_bar $layout_container $main_content
echo " ($layout_container/$main_content)"
echo ""

# 6. Modal/Dropdown Manager Usage
echo -e "${CYAN}═══ Component Manager Adoption ═══${NC}"
modal_manager_imports=$(grep -r "modal-manager" frontend/src --include="*.ts" --include="*.js" | wc -l)
dropdown_uses=$(grep -r "dropdown-manager\|toggleDropdown" frontend/src --include="*.html" | wc -l)

echo "Modal Manager Imports: $modal_manager_imports"
echo "Dropdown Manager Uses: $dropdown_uses"
echo ""

# 7. Glassmorphismus Integrität
echo -e "${CYAN}═══ Glassmorphismus Integrität ═══${NC}"
glass_checks=(
    "backdrop-filter|487"
    "rgba(255, 255, 255, 0.02)|178"
    "blur(20px)|228"
    "saturate(180%)|182"
)

integrity=100
for check in "${glass_checks[@]}"; do
    pattern="${check%|*}"
    expected="${check#*|}"
    actual=$(grep -r "$pattern" frontend/src --include="*.css" --include="*.html" 2>/dev/null | wc -l)
    
    if [ "$actual" -ge "$((expected * 90 / 100))" ]; then
        echo -e "${GREEN}✓${NC} $pattern: $actual (erwartet: ~$expected)"
    else
        echo -e "${RED}✗${NC} $pattern: $actual (erwartet: ~$expected)"
        integrity=$((integrity - 25))
    fi
done

echo -n "Glassmorphismus Integrität: "
progress_bar $integrity 100
echo " ($integrity%)"
echo ""

# 8. Gesamtfortschritt
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    GESAMTFORTSCHRITT                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

# Berechne Gesamtfortschritt
total_score=0
max_score=600

# CSS Vars (100 Punkte)
css_score=$((100 - duplicate_vars * 10))
[ $css_score -lt 0 ] && css_score=0
total_score=$((total_score + css_score))

# Inline Styles (100 Punkte)
inline_score=$((migrated * 100 / initial_inline))
total_score=$((total_score + inline_score))

# Utility Classes (100 Punkte)
util_score=$((pages_using_utils * 100 / total_pages))
total_score=$((total_score + util_score))

# Layout Shift (100 Punkte)
layout_score=$((pages_with_fix * 100 / pages_with_nav))
total_score=$((total_score + layout_score))

# Container Migration (100 Punkte)
container_score=$((layout_container * 100 / main_content))
[ $container_score -gt 100 ] && container_score=100
total_score=$((total_score + container_score))

# Glassmorphismus (100 Punkte)
total_score=$((total_score + integrity))

# Gesamtfortschritt
percentage=$((total_score * 100 / max_score))
echo ""
echo -n "Maintainability Score: "
progress_bar $total_score $max_score
echo " ($percentage%)"

# Bewertung
echo ""
if [ $percentage -ge 90 ]; then
    echo -e "${GREEN}★★★★★ Exzellent! Code-Qualität ist hervorragend.${NC}"
elif [ $percentage -ge 80 ]; then
    echo -e "${GREEN}★★★★☆ Sehr gut! Fast alle Ziele erreicht.${NC}"
elif [ $percentage -ge 70 ]; then
    echo -e "${YELLOW}★★★☆☆ Gut! Weiter so.${NC}"
elif [ $percentage -ge 60 ]; then
    echo -e "${YELLOW}★★☆☆☆ Akzeptabel, aber Verbesserung nötig.${NC}"
else
    echo -e "${RED}★☆☆☆☆ Mehr Arbeit erforderlich.${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Tipp: Führe './scripts/migrate-inline-styles-v2.sh' aus       ║"
echo "║        um weitere Inline-Styles zu migrieren.                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"