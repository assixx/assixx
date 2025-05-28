const fs = require('fs').promises;
const path = require('path');

const htmlFiles = [
  'admin-config.html',
  'admin-dashboard.html',
  'archived-employees.html',
  'blackboard.html',
  'calendar.html',
  'chat.html',
  'document-upload.html',
  'employee-dashboard.html',
  'employee-documents.html',
  'feature-management.html',
  'kvp.html',
  'profile.html',
  'root-dashboard.html',
  'root-features.html',
  'root-profile.html',
  'salary-documents.html',
  'survey-admin.html',
  'survey-employee.html',
];

async function updateUserInfoStyles() {
  console.log('Updating user-info styles in all HTML files...\n');

  for (const file of htmlFiles) {
    const filePath = path.join(__dirname, 'public', file);

    try {
      let content = await fs.readFile(filePath, 'utf8');

      // Check if file already has the user-info-update.css
      if (content.includes('user-info-update.css')) {
        console.log(`✅ ${file} - Already updated`);
        continue;
      }

      // Add the CSS link before the closing </head> tag
      const cssLink =
        '    <link rel="stylesheet" href="/css/user-info-update.css">\n';
      content = content.replace('</head>', `${cssLink}</head>`);

      // Update logout button class if it doesn't have btn-logout class
      content = content.replace(
        /id="logout-btn"(?![^>]*class[^>]*btn-logout)/g,
        'id="logout-btn" class="btn-logout"'
      );

      // Add icon to logout button if not present
      content = content.replace(
        />Abmelden<\/button>/g,
        '><i class="fas fa-sign-out-alt"></i> Abmelden</button>'
      );

      // Save the updated file
      await fs.writeFile(filePath, content);
      console.log(`✅ ${file} - Updated successfully`);
    } catch (error) {
      console.error(`❌ ${file} - Error: ${error.message}`);
    }
  }

  console.log('\n✅ All files processed!');
}

updateUserInfoStyles().catch(console.error);
