#!/bin/bash

# Layout Shift Fix Script
# Adds the critical layout shift prevention script to pages with navigation-container

LAYOUT_SHIFT_SCRIPT='    <!-- Critical Layout State - Prevents Layout Shift -->
    <script>
      // Set sidebar state IMMEDIATELY to prevent any layout shift
      (function () {
        const sidebarCollapsed = localStorage.getItem('\''sidebarCollapsed'\'') === '\''true'\'';
        document.documentElement.setAttribute('\''data-sidebar'\'', sidebarCollapsed ? '\''collapsed'\'' : '\''expanded'\'');
        // Also set CSS custom properties for immediate use
        document.documentElement.style.setProperty('\''--sidebar-width'\'', sidebarCollapsed ? '\''60px'\'' : '\''250px'\'');
        document.documentElement.style.setProperty('\''--content-margin'\'', sidebarCollapsed ? '\''60px'\'' : '\''250px'\'');
        document.documentElement.style.setProperty('\''--grid-columns'\'', sidebarCollapsed ? '\''4'\'' : '\''3'\'');
        document.documentElement.style.setProperty('\''--widget-columns'\'', sidebarCollapsed ? '\''5'\'' : '\''3'\'');
        document.documentElement.style.setProperty('\''--card-padding'\'', sidebarCollapsed ? '\''2rem'\'' : '\''1.5rem'\'');
      })();
    </script>'

# Change to the pages directory
cd /home/scs/projects/Assixx/frontend/src/pages || exit 1

# Files that need the layout shift fix
FILES=(
    "account-settings.html"
    "admin-config.html"
    "admin-profile.html"
    "archived-employees.html"
    "blackboard.html"
    "calendar.html"
    "chat.html"
    "departments.html"
    "design-standards.html"
    "document-upload.html"
    "documents-company.html"
    "documents-department.html"
    "documents-payroll.html"
    "documents-personal.html"
    "documents-search.html"
    "documents-team.html"
    "documents.html"
    "employee-documents.html"
    "employee-profile.html"
    "feature-management.html"
    "logs.html"
    "manage-department-groups.html"
    "org-management.html"
    "profile.html"
    "root-features.html"
    "root-profile.html"
    "salary-documents.html"
    "shifts.html"
    "storage-upgrade.html"
    "survey-admin.html"
    "survey-details.html"
    "survey-employee.html"
    "survey-results.html"
    "tenant-deletion-status.html"
)

# Counter for processed files
processed=0

# Process each file
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        # Check if the file already has the layout shift fix
        if grep -q "sidebarCollapsed" "$file"; then
            echo "✓ $file already has layout shift fix"
        else
            # Create a temporary file
            temp_file=$(mktemp)
            
            # Process the file line by line
            while IFS= read -r line || [ -n "$line" ]; do
                echo "$line" >> "$temp_file"
                
                # Insert the script after the favicon line
                if [[ "$line" =~ favicon\.ico ]]; then
                    echo "" >> "$temp_file"
                    echo "$LAYOUT_SHIFT_SCRIPT" >> "$temp_file"
                fi
            done < "$file"
            
            # Replace the original file
            mv "$temp_file" "$file"
            
            echo "✅ Added layout shift fix to $file"
            ((processed++))
        fi
    else
        echo "⚠️  File not found: $file"
    fi
done

echo ""
echo "Summary:"
echo "- Processed: $processed files"
echo "- Total files checked: ${#FILES[@]}"