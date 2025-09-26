#!/bin/bash

# Script to remove redundant font references from HTML files
# Since Vite plugin now handles font loading centrally

HTML_DIR="/home/scs/projects/Assixx/frontend/src/pages"
COUNTER=0

echo "🧹 Removing redundant font references from HTML files..."
echo "================================================"

# Remove fonts-outfit.css references
echo "📝 Processing fonts-outfit.css references..."
for file in "$HTML_DIR"/*.html; do
  if [ -f "$file" ]; then
    if grep -q "fonts-outfit.css" "$file"; then
      # Remove the entire line containing fonts-outfit.css
      sed -i '/fonts-outfit\.css/d' "$file"
      echo "  ✅ Removed from: $(basename "$file")"
      ((COUNTER++))
    fi
  fi
done

# Remove Noto Color Emoji font
echo "📝 Processing Noto Color Emoji references..."
for file in "$HTML_DIR"/*.html; do
  if [ -f "$file" ]; then
    if grep -q "Noto.Color.Emoji" "$file"; then
      # Remove the entire line containing Noto Color Emoji
      sed -i '/Noto.Color.Emoji/d' "$file"
      echo "  ✅ Removed Noto Color Emoji from: $(basename "$file")"
      ((COUNTER++))
    fi
  fi
done

# Remove any remaining Google Fonts Outfit references (shouldn't be any, but let's check)
echo "📝 Checking for other Google Fonts Outfit references..."
for file in "$HTML_DIR"/*.html; do
  if [ -f "$file" ]; then
    if grep -q "fonts.googleapis.com.*Outfit" "$file"; then
      # Remove lines with Google Fonts Outfit
      sed -i '/fonts\.googleapis\.com.*Outfit/d' "$file"
      echo "  ✅ Removed Google Fonts Outfit from: $(basename "$file")"
      ((COUNTER++))
    fi
  fi
done

# Also remove empty comment lines that might be left
echo "📝 Cleaning up empty comment lines..."
for file in "$HTML_DIR"/*.html; do
  if [ -f "$file" ]; then
    # Remove lines that are just "<!-- Google Fonts - Outfit -->" or similar
    sed -i '/^[[:space:]]*<!-- Google Fonts.*-->[[:space:]]*$/d' "$file"
    sed -i '/^[[:space:]]*<!-- Load fonts first.*-->[[:space:]]*$/d' "$file"
    # Clean up multiple consecutive empty lines (keep max 1)
    sed -i '/^$/N;/^\n$/d' "$file"
  fi
done

echo "================================================"
echo "🎉 Done! Removed $COUNTER font references."
echo ""
echo "📌 Notes:"
echo "  - Font loading is now handled centrally by Vite plugin"
echo "  - All HTML files will get Outfit font automatically"
echo "  - Better performance with preconnect + parallel loading"