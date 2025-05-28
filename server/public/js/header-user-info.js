/**
 * Globale Header User Info Loading Funktion
 * Muss in allen Seiten mit Navigation eingebunden werden
 */

// Cache für User-Daten
let userDataCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 60000; // 1 Minute

// Header User Info laden
async function loadHeaderUserInfo() {
  // Check cache first
  if (userDataCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    updateHeaderDisplay(userDataCache);
    return;
  }
  try {
    // Vollständiges Profil laden mit Cookie-Authentifizierung
    const response = await fetch('/api/auth/user', {
      credentials: 'include'
    });

    if (response.ok) {
      const userData = await response.json();
      const user = userData.user || userData;
      
      // Cache the data
      userDataCache = user;
      cacheTimestamp = Date.now();
      
      // Update display
      updateHeaderDisplay(user);
    } else if (response.status === 401) {
      // Nicht eingeloggt - zur Login-Seite weiterleiten
      window.location.href = '/login.html';
    }
  } catch (error) {
    console.error('Error loading user info:', error);
  }
}

// Helper function to update header display
function updateHeaderDisplay(user) {
  // Update Username/Name
  const userNameElement = document.getElementById('user-name');
  if (userNameElement) {
    if (user.first_name || user.last_name) {
      const fullName =
        `${user.first_name || ''} ${user.last_name || ''}`.trim();
      userNameElement.textContent =
        fullName || user.username || 'User';
    } else {
      userNameElement.textContent = user.username || 'User';
    }
  }

  // Avatar update
  const avatarElement = document.getElementById('user-avatar');
  if (avatarElement && user.profile_picture) {
    avatarElement.src = user.profile_picture;
  }
}

// Automatisch beim Laden der Seite ausführen
document.addEventListener('DOMContentLoaded', () => {
  loadHeaderUserInfo();
});
