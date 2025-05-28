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

async function updateAllUserInfo() {
  console.log('Updating user-info structure in all HTML files...\n');

  for (const file of htmlFiles) {
    const filePath = path.join(__dirname, 'public', file);

    try {
      let content = await fs.readFile(filePath, 'utf8');
      let updated = false;

      // 1. Update user-info structure if it's just a span with text
      const oldUserInfoPattern = /<span id="user-info"[^>]*>([^<]+)<\/span>/g;
      if (oldUserInfoPattern.test(content)) {
        content = content.replace(
          oldUserInfoPattern,
          `<div id="user-info">
                <img id="user-avatar" src="/images/default-avatar.svg" alt="Avatar">
                <span id="user-name">Lade...</span>
            </div>`
        );
        updated = true;
      }

      // 2. Ensure Font Awesome is included
      if (
        !content.includes('fontawesome') &&
        !content.includes('font-awesome')
      ) {
        content = content.replace(
          '<link rel="stylesheet" href="/css/user-info-update.css">',
          '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">\n    <link rel="stylesheet" href="/css/user-info-update.css">'
        );
        updated = true;
      }

      // 3. Update logout button to include icon if missing
      const logoutBtnPattern =
        /id="logout-btn"[^>]*>(?!.*<i.*fa-sign-out-alt)/g;
      if (content.match(logoutBtnPattern)) {
        content = content.replace(
          />Abmelden<\/button>/g,
          '><i class="fas fa-sign-out-alt"></i> Abmelden</button>'
        );
        content = content.replace(
          />Ausloggen<\/button>/g,
          '><i class="fas fa-sign-out-alt"></i> Abmelden</button>'
        );
        updated = true;
      }

      // 4. Add loadUserInfo function if missing
      if (
        content.includes('checkAuth()') &&
        !content.includes('loadUserInfo')
      ) {
        // Add loadUserInfo function
        const loadUserInfoCode = `
        async function loadUserInfo() {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/user/profile', {
                    headers: {
                        'Authorization': \`Bearer \${token}\`
                    }
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    const userName = document.getElementById('user-name');
                    const userAvatar = document.getElementById('user-avatar');
                    
                    // Display first and last name
                    const displayName = \`\${userData.first_name || ''} \${userData.last_name || ''}\`.trim() || userData.username || 'Benutzer';
                    userName.textContent = displayName;
                    
                    // Update avatar if available
                    if (userData.profile_picture_url) {
                        userAvatar.src = userData.profile_picture_url;
                        userAvatar.onerror = function() {
                            this.src = '/images/default-avatar.svg';
                        };
                    }
                }
            } catch (error) {
                console.error('Error loading user info:', error);
                // Fallback to local storage
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const userName = document.getElementById('user-name');
                if (userName) {
                    userName.textContent = user.username || 'Benutzer';
                }
            }
        }`;

        // Insert before checkAuth function
        content = content.replace(
          /(\s+)(function checkAuth\(\))/,
          `$1${loadUserInfoCode}\n$1$2`
        );

        // Add loadUserInfo() call after checkAuth()
        content = content.replace(
          /checkAuth\(\);/g,
          'checkAuth();\n            loadUserInfo();'
        );

        updated = true;
      }

      if (updated) {
        await fs.writeFile(filePath, content);
        console.log(`✅ ${file} - Updated successfully`);
      } else {
        console.log(`⏭️  ${file} - Already up to date`);
      }
    } catch (error) {
      console.error(`❌ ${file} - Error: ${error.message}`);
    }
  }

  console.log('\n✅ All files processed!');
  console.log(
    '\nNote: The employee-dashboard.html already has the correct structure.'
  );
}

updateAllUserInfo().catch(console.error);
