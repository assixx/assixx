/**
 * Global Header User Info Loading Function
 * Must be included in all pages with navigation
 */

import type { JWTPayload, User } from '../../types/api.types';
import { apiClient } from '../../utils/api-client';
import { getAuthToken, parseJwt } from '../auth/index';

/**
 * Update username element with token payload username
 */
function updateUsernameFromToken(payload: JWTPayload): void {
  const userNameElement = document.querySelector('#user-name');
  if (userNameElement === null) return;

  const currentText = userNameElement.textContent;
  if (currentText === '' || currentText.includes('@')) {
    userNameElement.textContent = payload.username;
  }
}

/**
 * Update role indicator badge
 * Uses Design System badge classes: badge--danger (root), badge--warning (admin), badge--info (employee)
 */
function updateRoleBadge(payload: JWTPayload): void {
  const roleIndicator = document.querySelector('#role-indicator');
  if (!roleIndicator || payload.role === '') return;

  const roleText = getRoleDisplayText(payload.role);
  const badgeVariant =
    payload.role === 'root' ? 'badge--danger' : payload.role === 'admin' ? 'badge--warning' : 'badge--info';

  roleIndicator.textContent = roleText;
  roleIndicator.className = `badge badge--sm ${badgeVariant}`;
}

/**
 * Get display text for role
 */
function getRoleDisplayText(role: string): string {
  if (role === 'admin') return 'Admin';
  if (role === 'root') return 'Root';
  return 'Mitarbeiter';
}

/**
 * Update username with full name from user data
 */
function updateUsernameWithFullName(user: User): void {
  const userNameElement = document.querySelector('#user-name');
  if (!userNameElement) return;
  if (user.firstName === undefined && user.lastName === undefined) return;

  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  userNameElement.textContent = fullName !== '' ? fullName : user.username;
}

/**
 * Update avatar with profile picture or initials
 */
function updateAvatar(user: User): void {
  const avatarElement = document.querySelector('#user-avatar');
  if (!(avatarElement instanceof HTMLImageElement)) return;

  const hasProfilePicture = hasValidProfilePicture(user);

  if (hasProfilePicture) {
    setAvatarImage(avatarElement, user);
  } else {
    replaceWithInitialsAvatar(avatarElement, user);
  }
}

/**
 * Check if user has valid profile picture
 * API v2 may return profilePicture (camelCase), handle both for transition
 */
function hasValidProfilePicture(user: User): boolean {
  const pic = (user as { profilePicture?: string }).profilePicture ?? user.profilePicture;
  return pic !== undefined && pic !== '';
}

/**
 * Set avatar image source
 */
function setAvatarImage(avatarElement: HTMLImageElement, user: User): void {
  // API v2 returns profilePicture (camelCase), fallback to snake_case for transition
  const picUrl = (user as { profilePicture?: string }).profilePicture ?? user.profilePicture ?? null;
  if (picUrl !== null && picUrl !== '') {
    avatarElement.src = picUrl;
  }
  avatarElement.classList.remove('avatar-initials');
}

/**
 * Replace avatar with initials display
 */
function replaceWithInitialsAvatar(avatarElement: HTMLImageElement, user: User): void {
  const initials = getUserInitials(user);

  const initialsDiv = document.createElement('div');
  initialsDiv.id = 'user-avatar';
  initialsDiv.className = 'avatar-initials';
  initialsDiv.textContent = initials;

  avatarElement.replaceWith(initialsDiv);
}

/**
 * Get user initials from name
 */
function getUserInitials(user: User): string {
  const firstInitial =
    user.firstName !== undefined && user.firstName !== '' ? user.firstName.charAt(0).toUpperCase() : '';
  const lastInitial = user.lastName !== undefined && user.lastName !== '' ? user.lastName.charAt(0).toUpperCase() : '';

  const initials = `${firstInitial}${lastInitial}`;
  return initials !== '' ? initials : 'U';
}

/**
 * Load and update full user profile
 */
async function loadFullProfile(payload: JWTPayload): Promise<void> {
  try {
    const userData = await apiClient.get<User>('/users/me');
    const user: User = userData;

    updateUsernameWithFullName(user);
    updateAvatar(user);

    if (payload.role === 'admin') {
      void loadDepartmentBadge();
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

/**
 * Load user info for header display
 */
async function loadHeaderUserInfo(): Promise<void> {
  const token = getAuthToken();
  if (token === null || token === '' || token === 'test-mode') return;

  try {
    const payload = parseJwt(token);
    if (!payload) return;

    updateUsernameFromToken(payload);
    updateRoleBadge(payload);

    await loadFullProfile(payload);
  } catch (error) {
    console.error('Error loading user info:', error);
  }
}

/**
 * Create department badge element
 */
function createDepartmentBadge(): HTMLElement | null {
  const userCard = document.querySelector('.user-info-card');
  if (!userCard) return null;

  const badgeContainer = document.createElement('div');
  badgeContainer.id = 'departmentBadge';
  badgeContainer.className = 'user-departments-badge';
  badgeContainer.innerHTML = `
    <i class="fas fa-building"></i>
    <span class="badge loading">Lade...</span>
  `;
  userCard.append(badgeContainer);
  return badgeContainer;
}

/**
 * Update department badge display
 * hasFullAccess from DB is the single source of truth
 */
function updateDepartmentBadge(
  badgeSpan: Element,
  data: { hasFullAccess?: boolean | number; departments?: { name: string }[] },
): void {
  const hasFullAccess = data.hasFullAccess === true || data.hasFullAccess === 1;

  if (hasFullAccess) {
    badgeSpan.className = 'badge badge--primary';
    badgeSpan.textContent = 'Vollzugriff';
    return;
  }

  const departmentCount = data.departments?.length ?? 0;

  if (departmentCount === 0) {
    badgeSpan.className = 'badge badge--warning';
    badgeSpan.textContent = 'Keine Abteilungen';
    return;
  }

  badgeSpan.className = 'badge badge--info';
  badgeSpan.textContent = `${departmentCount} Abteilungen`;
  if (data.departments) {
    (badgeSpan as HTMLElement).title = data.departments.map((d) => d.name).join(', ');
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
      hasFullAccess?: boolean | number;
      departments?: { name: string }[];
    }>('/admin-permissions/my');

    let badgeContainer = document.querySelector('#departmentBadge');
    badgeContainer ??= createDepartmentBadge();

    if (!badgeContainer) return;

    const badgeSpan = badgeContainer.querySelector('.badge');
    if (!badgeSpan) return;

    updateDepartmentBadge(badgeSpan, data);
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
