#!/bin/bash

# Script to update Font Awesome from 6.0.0 to 6.5.2 in all HTML files

echo "🔄 Updating Font Awesome from 6.0.0 to 6.5.2..."

# Find all HTML files and update Font Awesome CDN links
find /home/scs/projects/Assixx/frontend/src -name "*.html" -type f | while read file; do
    if grep -q "font-awesome/6.0.0" "$file"; then
        echo "✏️  Updating: $file"
        sed -i 's|font-awesome/6.0.0|font-awesome/6.5.2|g' "$file"
    fi
done

echo "✅ Font Awesome update complete!"
echo ""
echo "📊 Summary of updated files:"
grep -r "font-awesome/6.5.2" /home/scs/projects/Assixx/frontend/src --include="*.html" -l | wc -l
echo "files now use Font Awesome 6.5.2"