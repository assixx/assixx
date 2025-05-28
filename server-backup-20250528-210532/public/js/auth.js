/**
 * Authentication utilities for Assixx
 */

// Get authentication token from localStorage (kept for compatibility)
function getAuthToken() {
  // No longer used with cookie auth, but kept for backward compatibility
  return null;
}

// Set authentication token
function setAuthToken(token) {
  // No longer used with cookie auth
}

// Remove authentication token
function removeAuthToken() {
  // No longer used with cookie auth
}

// Check if user is authenticated (now checks via API)
async function isAuthenticated() {
  try {
    const response = await fetch('/api/auth/check', {
      credentials: 'include'
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Fetch with authentication (now uses cookies)
async function fetchWithAuth(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  // If unauthorized, redirect to login
  if (response.status === 401) {
    window.location.href = '/login.html';
    throw new Error('Unauthorized');
  }

  return response;
}

// Load user information
async function loadUserInfo() {
  try {
    console.log('loadUserInfo: Attempting to fetch user profile...');
    const response = await fetchWithAuth('/api/auth/user');
    console.log('loadUserInfo: Response status:', response.status);

    const data = await response.json();
    console.log('loadUserInfo: Response data:', data);

    if (response.ok) {
      // The API returns the user object directly, not wrapped in data.user
      const user = data.user || data;

      // Update user display
      const userName = document.getElementById('userName');
      if (userName) {
        const firstName = user.first_name || 'Admin';
        const lastName = user.last_name || '';
        userName.textContent = `${firstName} ${lastName}`.trim();
      }

      const userRole = document.getElementById('userRole');
      if (userRole) {
        userRole.textContent = user.role || 'Benutzer';
      }

      return user;
    } else {
      throw new Error(data.message || 'Fehler beim Laden der Benutzerdaten');
    }
  } catch (error) {
    console.error('Error loading user info:', error);

    // Fallback: Set default values if API fails
    const userName = document.getElementById('userName');
    if (userName) {
      userName.textContent = 'Benutzer';
    }

    const userRole = document.getElementById('userRole');
    if (userRole) {
      userRole.textContent = localStorage.getItem('role') || 'Benutzer';
    }

    // Don't throw error to prevent redirect loop
    return {
      first_name: 'Benutzer',
      role: localStorage.getItem('role') || 'admin',
    };
  }
}

// Logout function
async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  window.location.href = '/login.html';
}

// Show success message
function showSuccess(message) {
  // Simple alert for now, can be enhanced with toast notifications
  alert(`✅ ${message}`);
}

// Show error message
function showError(message) {
  // Simple alert for now, can be enhanced with toast notifications
  alert(`❌ ${message}`);
}

// Show info message
function showInfo(message) {
  // Simple alert for now, can be enhanced with toast notifications
  alert(`ℹ️ ${message}`);
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Auth check - Current path:', window.location.pathname);

  // Skip auth check on login page
  if (window.location.pathname.includes('login')) {
    return;
  }

  // Check if user is authenticated
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    console.log('Not authenticated, redirecting to login');
    window.location.href = '/login.html';
    return;
  }

  // Load user info if authenticated
  console.log('Loading user info...');
  loadUserInfo().catch((error) => {
    console.error('Failed to load user info:', error);
  });
});

// Export functions for global use
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.removeAuthToken = removeAuthToken;
window.isAuthenticated = isAuthenticated;
window.fetchWithAuth = fetchWithAuth;
window.loadUserInfo = loadUserInfo;
window.logout = logout;
window.showSuccess = showSuccess;
window.showError = showError;
window.showInfo = showInfo;
