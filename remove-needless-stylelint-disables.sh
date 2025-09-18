#!/bin/bash

# Script to remove needless stylelint-disable comments after config update
# These rules are now null in .stylelintrc.json, so their disables are unnecessary

echo "Removing unnecessary stylelint-disable comments from CSS files..."

# Rules that are now null and don't need disables
NEEDLESS_RULES=(
  "no-descending-specificity"
  "selector-no-qualifying-type"
  "selector-id-pattern"
  "selector-max-specificity"
  "selector-max-id"
  "selector-class-pattern"
  "selector-nested-pattern"
  "selector-max-class"
  "time-min-milliseconds"
  "unit-allowed-list"
  "selector-max-attribute"
  "selector-max-combinators"
  "selector-max-compound-selectors"
  "selector-max-pseudo-class"
  "selector-max-type"
  "selector-max-universal"
)

# Process all CSS files in frontend/src/styles
for css_file in frontend/src/styles/*.css; do
  if [ -f "$css_file" ]; then
    echo "Processing: $css_file"

    # Create a temporary file
    temp_file=$(mktemp)

    # Read the file line by line
    while IFS= read -r line; do
      # Check if line contains stylelint-disable comment
      if [[ "$line" =~ .*stylelint-disable.* ]]; then
        # Store original line for comparison
        original_line="$line"
        modified_line="$line"

        # Remove each needless rule from the line
        for rule in "${NEEDLESS_RULES[@]}"; do
          # Remove the rule from disable comments (handling various formats)
          modified_line=$(echo "$modified_line" | sed -E "s/, ?$rule//g" | sed -E "s/$rule, ?//g" | sed -E "s/ $rule//g")
        done

        # Clean up any leftover commas and spaces
        modified_line=$(echo "$modified_line" | sed -E 's/, ,/,/g' | sed -E 's/ , /, /g' | sed -E 's/,,/,/g')
        modified_line=$(echo "$modified_line" | sed -E 's/stylelint-disable-next-line  /stylelint-disable-next-line /g')
        modified_line=$(echo "$modified_line" | sed -E 's/stylelint-disable-line  /stylelint-disable-line /g')
        modified_line=$(echo "$modified_line" | sed -E 's/stylelint-disable  /stylelint-disable /g')

        # Check if the disable comment is now empty (only has stylelint-disable with no rules)
        if [[ "$modified_line" =~ .*stylelint-disable-next-line[[:space:]]*--.*$ ]] || \
           [[ "$modified_line" =~ .*stylelint-disable-line[[:space:]]*--.*$ ]] || \
           [[ "$modified_line" =~ .*stylelint-disable[[:space:]]*\*/ ]]; then
          # If the disable is now empty, skip the entire line
          echo "  Removing empty disable comment: $(echo "$original_line" | head -c 80)..."
          continue
        elif [[ "$modified_line" != "$original_line" ]]; then
          echo "  Modified: $(echo "$original_line" | head -c 80)..."
          echo "$modified_line" >> "$temp_file"
        else
          echo "$line" >> "$temp_file"
        fi
      else
        echo "$line" >> "$temp_file"
      fi
    done < "$css_file"

    # Replace original file with modified one
    mv "$temp_file" "$css_file"
    echo "  ✓ Updated $css_file"
  fi
done

echo ""
echo "✓ Cleanup complete!"
echo ""
echo "Running stylelint to verify no more needless disables..."
npx stylelint "frontend/src/styles/*.css" --report-needless-disables 2>&1 | grep "Needless disable" | wc -l | while read count; do
  if [ "$count" -eq 0 ]; then
    echo "✓ Success: No more needless disable warnings!"
  else
    echo "⚠ Warning: Still $count needless disable warnings remaining"
    echo "  Run: npx stylelint 'frontend/src/styles/*.css' --report-needless-disables"
  fi
done