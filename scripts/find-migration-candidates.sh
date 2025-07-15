#!/bin/bash

# Find Migration Candidates
# Findet häufige Inline-Style Patterns die zu Utility Classes migriert werden sollten

cd /home/scs/projects/Assixx || exit 1

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           INLINE STYLE MIGRATION CANDIDATES                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Temporäre Datei für Ergebnisse
temp_file=$(mktemp)

# Sammle alle Inline Styles
echo -e "${CYAN}Analysiere Inline Styles...${NC}"
grep -h 'style=' frontend/src/**/*.html 2>/dev/null | \
    sed -E 's/.*style="([^"]+)".*/\1/' | \
    sed 's/;[[:space:]]*$//' > "$temp_file"

# Zähle häufigste Patterns
echo ""
echo -e "${YELLOW}Top 20 häufigste Inline Style Patterns:${NC}"
echo "════════════════════════════════════════"

sort "$temp_file" | uniq -c | sort -nr | head -20 | while read count pattern; do
    # Vorschlag für Utility Class
    utility_suggestion=""
    
    case "$pattern" in
        "display: none"*) utility_suggestion="u-hidden" ;;
        "display: block"*) utility_suggestion="u-block" ;;
        "display: flex"*) utility_suggestion="u-flex" ;;
        "margin: 0"*) utility_suggestion="u-m-0" ;;
        "padding: 0"*) utility_suggestion="u-p-0" ;;
        "text-align: center"*) utility_suggestion="u-text-center" ;;
        "text-align: left"*) utility_suggestion="u-text-left" ;;
        "text-align: right"*) utility_suggestion="u-text-right" ;;
        "font-weight: 600"*) utility_suggestion="u-fw-600" ;;
        "font-weight: 700"*) utility_suggestion="u-fw-700" ;;
        "cursor: pointer"*) utility_suggestion="u-cursor-pointer" ;;
        "position: relative"*) utility_suggestion="u-relative" ;;
        "position: absolute"*) utility_suggestion="u-absolute" ;;
        "width: 100%"*) utility_suggestion="u-w-full" ;;
        "flex: 1"*) utility_suggestion="u-flex-1" ;;
        *) utility_suggestion="(neue Utility Class erstellen)" ;;
    esac
    
    printf "%4d × %-40s → %s\n" "$count" "$pattern" "${GREEN}$utility_suggestion${NC}"
done

# Finde Dateien mit den meisten Inline Styles
echo ""
echo -e "${YELLOW}Dateien mit den meisten Inline Styles:${NC}"
echo "════════════════════════════════════════"

find frontend/src -name "*.html" -type f -exec bash -c '
    count=$(grep -c "style=" "$1" 2>/dev/null || echo 0)
    if [ "$count" -gt 0 ]; then
        echo "$count $1"
    fi
' _ {} \; | sort -nr | head -10 | while read count file; do
    printf "%4d × %s\n" "$count" "$file"
done

# Spezifische Pattern-Suche
echo ""
echo -e "${YELLOW}Spezifische Patterns zum Migrieren:${NC}"
echo "════════════════════════════════════════"

# Margin/Padding Patterns
margin_patterns=$(grep -h 'style="[^"]*margin:' frontend/src/**/*.html 2>/dev/null | wc -l)
padding_patterns=$(grep -h 'style="[^"]*padding:' frontend/src/**/*.html 2>/dev/null | wc -l)
echo "Margin Patterns: $margin_patterns"
echo "Padding Patterns: $padding_patterns"

# Font Patterns
font_patterns=$(grep -h 'style="[^"]*font-' frontend/src/**/*.html 2>/dev/null | wc -l)
echo "Font Patterns: $font_patterns"

# Color Patterns
color_patterns=$(grep -h 'style="[^"]*color:' frontend/src/**/*.html 2>/dev/null | wc -l)
echo "Color Patterns: $color_patterns"

# Display Patterns
display_patterns=$(grep -h 'style="[^"]*display:' frontend/src/**/*.html 2>/dev/null | wc -l)
echo "Display Patterns: $display_patterns"

# Neue Utility Classes vorschlagen
echo ""
echo -e "${CYAN}Vorgeschlagene neue Utility Classes:${NC}"
echo "════════════════════════════════════════"

# Finde einzigartige Patterns ohne existierende Utility
grep -h 'style=' frontend/src/**/*.html 2>/dev/null | \
    sed -E 's/.*style="([^"]+)".*/\1/' | \
    sort | uniq -c | sort -nr | head -30 | while read count pattern; do
    
    # Prüfe ob schon eine Utility existiert
    case "$pattern" in
        "display: none"*|"display: block"*|"display: flex"*|"margin: 0"*|"padding: 0"*|\
        "text-align: center"*|"text-align: left"*|"text-align: right"*|\
        "font-weight: 600"*|"font-weight: 700"*|"cursor: pointer"*|\
        "position: relative"*|"position: absolute"*|"width: 100%"*|"flex: 1"*)
            # Skip - bereits vorgeschlagen
            ;;
        *)
            if [ "$count" -gt 3 ]; then
                # Erstelle Utility-Vorschlag
                utility_name=$(echo "$pattern" | \
                    sed 's/: /-/g' | \
                    sed 's/;//g' | \
                    sed 's/ //g' | \
                    sed 's/[()]//g' | \
                    tr '[:upper:]' '[:lower:]' | \
                    cut -c1-20)
                
                echo ".u-$utility_name { $pattern !important; }  /* $count Verwendungen */"
            fi
            ;;
    esac
done | head -10

# Cleanup
rm -f "$temp_file"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Nächste Schritte:                                             ║"
echo "║  1. Füge neue Utility Classes zu utilities.css hinzu           ║"
echo "║  2. Führe migrate-inline-styles-v2.sh aus                      ║"
echo "║  3. Prüfe mit visual-check-simple.sh                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"