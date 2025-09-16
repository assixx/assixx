#!/bin/bash

# Enhanced Inline Styles Migration Script V2
# Replaces common inline styles with utility classes

cd /home/scs/projects/Assixx/frontend/src || exit 1

# Counter for replacements
total_replacements=0
files_updated=0

# Define all replacement patterns
declare -A replacements=(
    # Display patterns
    ['style="display: none"']='class="u-hidden"'
    ['style="display:none"']='class="u-hidden"'
    ['style="display: none;"']='class="u-hidden"'
    ['style="display:none;"']='class="u-hidden"'
    ['style="display: block"']='class="u-block"'
    ['style="display: flex"']='class="u-flex"'
    ['style="display: flex; gap: 10px"']='class="u-flex-gap-sm"'
    ['style="margin-top: 4px"']='class="u-mt-text"'
    ['style="text-align: center"']='class="u-text-center"'
    ['style="text-align: center;"']='class="u-text-center"'

    # Common patterns from analysis
    ['style="flex: 1"']='class="u-flex-1"'
    ['style="margin-right: 8px"']='class="u-mr-8"'
    ['style="font-size: 0.9rem"']='class="u-fs-09rem"'
    ['style="font-size: 11px"']='class="u-fs-11"'
    ['style="font-size: 12px; font-weight: 400"']='class="u-fs-12 u-fw-400"'
    ['style="font-size: 3rem; margin-bottom: var(--spacing-md)"']='class="u-fs-3xl u-mb-md"'
    ['style="color: var(--text-primary); margin: 20px 0 15px 0"']='class="u-color-text-primary u-my-20-15"'
    ['style="color: var(--primary-color); margin-bottom: var(--spacing-md); text-align: center"']='class="u-color-primary u-mb-md u-text-center"'
    ['style="color: var(--text-secondary)"']='class="u-color-text-secondary"'
    ['style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 8px"']='class="u-color-text-primary u-fw-500 u-block u-mb-8"'
    ['style="margin: 0"']='class="u-m-0"'
    ['style="font-weight: 600"']='class="u-fw-600"'
    ['style="font-size: 1.5rem; margin-bottom: var(--spacing-sm)"']='class="u-fs-xl u-mb-sm"'
    ['style="font-size: 0.9rem; opacity: 0.8"']='class="u-fs-09rem u-opacity-80"'
    ['style="display: block; margin-bottom: 12px; cursor: pointer"']='class="u-block u-mb-12 u-cursor-pointer"'

    # Additional patterns
    ['style="padding: 0"']='class="u-p-0"'
    ['style="padding: 24px"']='class="u-p-container"'
    ['style="position: relative"']='class="u-relative"'
    ['style="position: absolute"']='class="u-absolute"'
    ['style="cursor: pointer"']='class="u-cursor-pointer"'
    ['style="width: 100%"']='class="u-w-full"'
    ['style="overflow: hidden"']='class="u-overflow-hidden"'
    ['style="visibility: hidden"']='class="u-invisible"'
    ['style="text-align: left"']='class="u-text-left"'
    ['style="text-align: right"']='class="u-text-right"'
)

# Function to handle complex replacements where element already has a class
merge_classes() {
    local file=$1
    local pattern=$2
    local new_classes=$3

    # Extract just the class names from the replacement
    local classes_only=$(echo "$new_classes" | sed -E 's/class="([^"]+)"/\1/')

    # Replace pattern when there's already a class attribute
    sed -i -E "s/class=\"([^\"]+)\"\s+${pattern}/class=\"\1 ${classes_only}\"/g" "$file"
    # Replace pattern when class comes after
    sed -i -E "s/${pattern}\s+class=\"([^\"]+)\"/class=\"${classes_only} \1\"/g" "$file"
}

# Function to replace inline styles in a file
replace_inline_styles() {
    local file=$1
    local changes=0
    local replacements_made=0

    # Create temp file
    temp_file=$(mktemp)
    cp "$file" "$temp_file"

    # Process each replacement pattern
    for pattern in "${!replacements[@]}"; do
        local replacement="${replacements[$pattern]}"

        # Count occurrences before replacement
        local before_count=$(grep -c "$pattern" "$temp_file" || true)

        if [ $before_count -gt 0 ]; then
            # Simple replacement
            sed -i "s/${pattern}/${replacement}/g" "$temp_file"

            # Handle cases where element already has a class
            merge_classes "$temp_file" "$pattern" "$replacement"

            # Count how many replacements were made
            local after_count=$(grep -c "$pattern" "$temp_file" || true)
            local replaced=$((before_count - after_count))
            replacements_made=$((replacements_made + replaced))
        fi
    done

    # Check if file changed
    if ! cmp -s "$file" "$temp_file"; then
        changes=1
        total_replacements=$((total_replacements + replacements_made))
        mv "$temp_file" "$file"
    else
        rm "$temp_file"
    fi

    return $changes
}

# Process files
echo "Enhanced Inline Styles Migration V2"
echo "==================================="
echo ""
echo "Scanning for HTML files..."

# Find all HTML files recursively
html_files=$(find . -name "*.html" -type f | sort)
total_files=$(echo "$html_files" | wc -l)

echo "Found $total_files HTML files"
echo ""
echo "Starting migration..."
echo ""

# Process each HTML file
while IFS= read -r file; do
    if [ -f "$file" ]; then
        # Skip backup files
        if [[ "$file" == *.bak ]]; then
            continue
        fi

        echo -n "Processing ${file#./}... "

        # Replace inline styles
        if replace_inline_styles "$file"; then
            echo "✅ Updated"
            ((files_updated++))
        else
            echo "⏭️  No changes needed"
        fi
    fi
done <<< "$html_files"

echo ""
echo "Migration Summary:"
echo "=================="
echo "Total files processed: $total_files"
echo "Files updated: $files_updated"
echo "Total replacements made: $total_replacements"
echo ""

# Check remaining inline styles
remaining=$(grep -h 'style=' **/*.html 2>/dev/null | wc -l || echo "0")
echo "Remaining inline styles: $remaining"

echo ""
echo "✅ Migration completed!"
