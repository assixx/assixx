#!/bin/bash

# Button Migration Helper - Findet alle Buttons in HTML Files
echo "🔍 BUTTON MIGRATION HELPER"
echo "========================="
echo ""

# Finde alle HTML Files mit Buttons
echo "📊 BUTTON USAGE PER FILE:"
echo ""

for file in frontend/src/pages/*.html; do
    if [ -f "$file" ]; then
        count=$(grep -o 'class="[^"]*btn[^"]*"' "$file" 2>/dev/null | wc -l)
        if [ "$count" -gt 0 ]; then
            basename=$(basename "$file")
            printf "%-30s %3d buttons\n" "$basename:" "$count"
        fi
    fi
done

echo ""
echo "========================="
echo "📈 BUTTON VARIANT BREAKDOWN:"
echo ""

# Zähle Button-Varianten
echo "Primary:   $(grep -h 'btn-primary' frontend/src/pages/*.html 2>/dev/null | wc -l)"
echo "Secondary: $(grep -h 'btn-secondary' frontend/src/pages/*.html 2>/dev/null | wc -l)"
echo "Success:   $(grep -h 'btn-success' frontend/src/pages/*.html 2>/dev/null | wc -l)"
echo "Danger:    $(grep -h 'btn-danger' frontend/src/pages/*.html 2>/dev/null | wc -l)"
echo "Warning:   $(grep -h 'btn-warning' frontend/src/pages/*.html 2>/dev/null | wc -l)"
echo "Info:      $(grep -h 'btn-info' frontend/src/pages/*.html 2>/dev/null | wc -l)"
echo "Light:     $(grep -h 'btn-light' frontend/src/pages/*.html 2>/dev/null | wc -l)"
echo "Dark:      $(grep -h 'btn-dark' frontend/src/pages/*.html 2>/dev/null | wc -l)"
echo "Link:      $(grep -h 'btn-link' frontend/src/pages/*.html 2>/dev/null | wc -l)"

echo ""
echo "========================="
echo "🎯 SIZE MODIFIERS:"
echo ""
echo "Small (btn-sm):    $(grep -h 'btn-sm' frontend/src/pages/*.html 2>/dev/null | wc -l)"
echo "Large (btn-lg):    $(grep -h 'btn-lg' frontend/src/pages/*.html 2>/dev/null | wc -l)"
echo "Block (btn-block): $(grep -h 'btn-block' frontend/src/pages/*.html 2>/dev/null | wc -l)"

echo ""
echo "Total buttons: $(grep -o 'class="[^"]*btn[^"]*"' frontend/src/pages/*.html 2>/dev/null | wc -l)"