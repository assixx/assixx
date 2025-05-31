/**
 * Global Header User Info Loading Function
 * Must be included in all pages with navigation
 */

import type { User } from '../types/api.types';
import { getAuthToken, parseJwt } from './auth';

/**
 * Load user info for header display
 */
async function loadHeaderUserInfo(): Promise<void> {
  const token = getAuthToken();
  if (!token || token === 'test-mode') return;

  try {
    // Get username from token for immediate display
    const payload = parseJwt(token);
    if (!payload) return;

    const userNameElement = document.getElementById('user-name') as HTMLElement;
    if (userNameElement) {
      userNameElement.textContent = payload.username || 'User';
    }

    // Load full profile
    const response = await fetch('/api/user/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const userData = await response.json();
      const user: User = userData.user || userData;

      // Update with full name
      if (userNameElement && (user.first_name || user.last_name)) {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        userNameElement.textContent = fullName || user.username || payload.username;
      }

      // Update avatar
      const avatarElement = document.getElementById('user-avatar') as HTMLImageElement;
      if (avatarElement && user.profile_picture) {
        avatarElement.src = user.profile_picture;
      }
    }
  } catch (error) {
    console.error('Error loading user info:', error);
  }
}

// Automatically execute when page loads
document.addEventListener('DOMContentLoaded', () => {
  loadHeaderUserInfo();
});

// Export function for manual calls
export { loadHeaderUserInfo };

// Extend window for header user info function
declare global {
  interface Window {
    loadHeaderUserInfo: typeof loadHeaderUserInfo;
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadHeaderUserInfo = loadHeaderUserInfo;
}
