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

    // Update role badge based on user role
    const roleIndicator = document.getElementById('role-indicator') as HTMLElement;
    if (roleIndicator && payload.role) {
      roleIndicator.textContent = payload.role === 'admin' ? 'Admin' : payload.role === 'root' ? 'Root' : 'Mitarbeiter';
      roleIndicator.className = `role-badge ${payload.role}`;
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
      
      // Load department badge for admins
      if (payload.role === 'admin') {
        loadDepartmentBadge();
      }
    }
  } catch (error) {
    console.error('Error loading user info:', error);
  }
}

/**
 * Load department badge for admin users
 */
async function loadDepartmentBadge(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/admin-permissions/my-departments', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      // Look for department badge element in user info card
      let badgeContainer = document.getElementById('departmentBadge');
      
      // If not found, create it
      if (!badgeContainer && document.querySelector('.user-info-card')) {
        const userCard = document.querySelector('.user-info-card');
        if (userCard) {
          badgeContainer = document.createElement('div');
          badgeContainer.id = 'departmentBadge';
          badgeContainer.className = 'user-departments-badge';
          badgeContainer.innerHTML = `
            <i class="fas fa-building"></i>
            <span class="badge loading">Lade...</span>
          `;
          userCard.appendChild(badgeContainer);
        }
      }
      
      if (badgeContainer) {
        const badgeSpan = badgeContainer.querySelector('.badge');
        if (badgeSpan) {
          if (data.hasAllAccess) {
            badgeSpan.className = 'badge badge-success';
            badgeSpan.textContent = 'Alle Abteilungen';
          } else if (data.departments && data.departments.length === 0) {
            badgeSpan.className = 'badge badge-warning';
            badgeSpan.textContent = 'Keine Abteilungen';
          } else if (data.departments && data.departments.length > 0) {
            badgeSpan.className = 'badge badge-info';
            badgeSpan.textContent = `${data.departments.length} Abteilungen`;
            (badgeSpan as HTMLElement).title = data.departments.map((d: any) => d.name).join(', ');
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading department badge:', error);
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
