#!/bin/bash

# Inline Styles Migration Script
# Replaces common inline styles with utility classes

cd /home/scs/projects/Assixx/frontend/src/pages || exit 1

# Counter for replacements
total_replacements=0

# Backup function
backup_file() {
    cp "$1" "$1.bak"
}

# Function to replace inline styles in a file
replace_inline_styles() {
    local file=$1
    local changes=0
    
    # Create temp file
    temp_file=$(mktemp)
    
    # Replace style="display: none" with class="u-hidden"
    # But preserve existing classes
    sed -E 's/style="display:\s*none"/class="u-hidden"/g' "$file" > "$temp_file"
    
    # Handle cases where there's already a class attribute
    # Replace class="something" style="display: none" with class="something u-hidden"
    sed -i -E 's/class="([^"]+)"\s+style="display:\s*none"/class="\1 u-hidden"/g' "$temp_file"
    
    # Replace style="margin: 0; margin-top: 4px" with class="u-mt-text"
    sed -i -E 's/style="margin:\s*0;\s*margin-top:\s*4px"/class="u-mt-text"/g' "$temp_file"
    
    # Handle cases with existing class
    sed -i -E 's/class="([^"]+)"\s+style="margin:\s*0;\s*margin-top:\s*4px"/class="\1 u-mt-text"/g' "$temp_file"
    
    # Replace style="padding: 24px" with class="u-p-container"
    sed -i -E 's/style="padding:\s*24px"/class="u-p-container"/g' "$temp_file"
    
    # Replace style="display: flex; gap: 12px" with class="u-flex-gap-md"
    sed -i -E 's/style="display:\s*flex;\s*gap:\s*12px"/class="u-flex-gap-md"/g' "$temp_file"
    
    # Replace style="max-width: 500px" with class="u-max-w-modal"
    sed -i -E 's/style="max-width:\s*500px"/class="u-max-w-modal"/g' "$temp_file"
    
    # Check if file changed
    if ! cmp -s "$file" "$temp_file"; then
        changes=1
        mv "$temp_file" "$file"
    else
        rm "$temp_file"
    fi
    
    return $changes
}

# Files to process (from our analysis)
echo "Starting inline styles migration..."
echo "=================================="

# Process each HTML file
for file in *.html; do
    if [ -f "$file" ]; then
        echo -n "Processing $file... "
        
        # Backup the file
        backup_file "$file"
        
        # Replace inline styles
        if replace_inline_styles "$file"; then
            echo "✅ Updated"
            ((total_replacements++))
        else
            echo "⏭️  No changes needed"
            rm "$file.bak"
        fi
    fi
done

echo ""
echo "Migration Summary:"
echo "=================="
echo "Total files updated: $total_replacements"
echo ""
echo "Note: Backup files created with .bak extension"
echo "To remove backups after verification: rm *.html.bak"