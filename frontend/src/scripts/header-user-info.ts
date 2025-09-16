/**
 * Global Header User Info Loading Function
 * Must be included in all pages with navigation
 */

import type { User } from '../types/api.types';
import { apiClient } from '../utils/api-client';
import { getAuthToken, parseJwt } from './auth';

/**
 * Load user info for header display
 */
async function loadHeaderUserInfo(): Promise<void> {
  const token = getAuthToken();
  if (token === null || token === '' || token === 'test-mode') return;

  try {
    // Get username from token for immediate display
    const payload = parseJwt(token);
    if (!payload) return;

    const userNameElement = document.querySelector('#user-name');
    if (userNameElement !== null) {
      // Only set username if element is empty or shows email
      const currentText = userNameElement.textContent;
      if (currentText === '' || currentText.includes('@')) {
        userNameElement.textContent = payload.username;
      }
    }

    // Update role badge based on user role
    const roleIndicator = document.querySelector('#role-indicator');
    if (roleIndicator && payload.role !== '') {
      roleIndicator.textContent = payload.role === 'admin' ? 'Admin' : payload.role === 'root' ? 'Root' : 'Mitarbeiter';
      roleIndicator.className = `role-badge ${payload.role}`;
    }

    // Load full profile
    try {
      const userData = await apiClient.get<User>('/users/me');
      const user: User = userData;

      // Update with full name
      if (userNameElement && (user.first_name !== undefined || user.last_name !== undefined)) {
        const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
        userNameElement.textContent = fullName !== '' ? fullName : user.username;
      }

      // Update avatar
      const avatarElement = document.querySelector('#user-avatar');
      if (avatarElement instanceof HTMLImageElement) {
        if (
          (user.profile_picture !== undefined && user.profile_picture !== '') ||
          (user.profile_picture_url !== undefined && user.profile_picture_url !== '')
        ) {
          const picUrl = user.profile_picture ?? user.profile_picture_url ?? null;
          if (picUrl !== null && picUrl !== '') {
            avatarElement.src = picUrl;
          }
          avatarElement.classList.remove('avatar-initials');
        } else {
          // Display initials if no profile picture
          const firstInitial =
            user.first_name !== undefined && user.first_name !== '' ? user.first_name.charAt(0).toUpperCase() : '';
          const lastInitial =
            user.last_name !== undefined && user.last_name !== '' ? user.last_name.charAt(0).toUpperCase() : '';
          const initials = `${firstInitial}${lastInitial}` !== '' ? `${firstInitial}${lastInitial}` : 'U';

          // Convert img to div for initials display
          const initialsDiv = document.createElement('div');
          initialsDiv.id = 'user-avatar';
          initialsDiv.className = 'avatar-initials';
          initialsDiv.textContent = initials;

          avatarElement.replaceWith(initialsDiv);
        }
      }

      // Load department badge for admins
      if (payload.role === 'admin') {
        void loadDepartmentBadge();
      }
    } catch (error) {
      console.error('Error loading user info:', error);
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
  if (token === null || token === '') return;

  try {
    const data = await apiClient.get<{
      hasAllAccess?: boolean;
      departments?: { name: string }[];
    }>('/admin-permissions/my');

    // Look for department badge element in user info card
    let badgeContainer = document.querySelector('#departmentBadge');

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
        userCard.append(badgeContainer);
      }
    }

    if (badgeContainer) {
      const badgeSpan = badgeContainer.querySelector('.badge');
      if (badgeSpan) {
        if (data.hasAllAccess === true) {
          badgeSpan.className = 'badge badge-success';
          badgeSpan.textContent = 'Alle Abteilungen';
        } else if (data.departments && data.departments.length === 0) {
          badgeSpan.className = 'badge badge-warning';
          badgeSpan.textContent = 'Keine Abteilungen';
        } else if (data.departments && data.departments.length > 0) {
          badgeSpan.className = 'badge badge-info';
          badgeSpan.textContent = `${data.departments.length} Abteilungen`;
          (badgeSpan as HTMLElement).title = data.departments.map((d: { name: string }) => d.name).join(', ');
        }
      }
    }
  } catch (error) {
    console.error('Error loading department badge:', error);
  }
}

// Automatically execute when page loads
document.addEventListener('DOMContentLoaded', () => {
  void loadHeaderUserInfo();
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
