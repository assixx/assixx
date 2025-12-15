/**
 * Employee Profile Management - UI Layer
 * DOM manipulation, rendering, and display logic
 */

import { $$id } from '../../../utils/dom-utils';
import storageService from '../../services/storage.service';
import type { EmployeeProfile } from './types';

// ===== POSITION DISPLAY MAPPING =====

type PositionMap = Record<string, string>;

// Position display mapping (German)
const positionMap: PositionMap = {
  bereichsleiter: 'Bereichsleiter',
  personalleiter: 'Personalleiter',
  geschaeftsfuehrer: 'Geschäftsführer',
  werksleiter: 'Werksleiter',
  produktionsleiter: 'Produktionsleiter',
  qualitaetsleiter: 'Qualitätsleiter',
  'it-leiter': 'IT-Leiter',
  vertriebsleiter: 'Vertriebsleiter',
};

// ===== PROFILE FORM RENDERING =====

/**
 * Fill profile form fields with user data (readonly for employees)
 */
export function fillFormFields(userData: EmployeeProfile): void {
  const emailInput = $$id('email') as HTMLInputElement | null;
  const firstNameInput = $$id('first_name') as HTMLInputElement | null;
  const lastNameInput = $$id('last_name') as HTMLInputElement | null;
  const positionInput = $$id('position') as HTMLInputElement | null;
  const departmentInput = $$id('department') as HTMLInputElement | null;

  if (emailInput !== null) {
    emailInput.value = userData.email;
  }

  if (firstNameInput !== null) {
    firstNameInput.value = userData.firstName ?? '';
  }

  if (lastNameInput !== null) {
    lastNameInput.value = userData.lastName ?? '';
  }

  if (positionInput !== null) {
    const position = userData.position ?? '';
    positionInput.value = position !== '' ? (positionMap[position.toLowerCase()] ?? position) : '-';
  }

  if (departmentInput !== null) {
    departmentInput.value = userData.departmentName ?? '-';
  }
}

// ===== PROFILE PICTURE DISPLAY =====

/**
 * Display user initials when no profile picture
 * Uses Design System avatar component
 * OPTIMIZATION: Clears cached profile picture URL
 */
export function displayInitials(firstName: string, lastName: string): void {
  const container = $$id('profile-picture-display');
  if (container === null) {
    return;
  }

  // OPTIMIZATION: Clear cached profile picture (no picture anymore)
  try {
    storageService.remove('profilePictureCache');
    // Also remove legacy direct localStorage key for migration
    localStorage.removeItem('profilePictureCache');
  } catch (e) {
    console.warn('[EmployeeProfile] Failed to clear profile picture cache:', e);
  }

  const firstInitial = firstName.charAt(0).toUpperCase() !== '' ? firstName.charAt(0).toUpperCase() : '';
  const lastInitial = lastName.charAt(0).toUpperCase() !== '' ? lastName.charAt(0).toUpperCase() : '';
  const initials = firstInitial !== '' || lastInitial !== '' ? `${firstInitial}${lastInitial}` : 'U';

  console.info('[EmployeeProfile] Setting initials:', { firstName, lastName, initials });

  // Use Design System avatar pattern XXL (150px for profile page)
  container.className = 'avatar avatar--xxl avatar--color-5';
  container.innerHTML = '';

  const initialsSpan = document.createElement('span');
  initialsSpan.className = 'avatar__initials';
  initialsSpan.textContent = initials;
  container.append(initialsSpan);
}

/**
 * Display profile picture
 * Uses Design System avatar component
 * OPTIMIZATION: Caches URL to localStorage for instant loading on next visit
 */
export function displayProfilePicture(url: string): void {
  const container = $$id('profile-picture-display');
  if (container === null) {
    return;
  }

  // OPTIMIZATION: Cache profile picture URL for instant loading (next page load)
  // Matches backend HTTP cache duration (7 days)
  try {
    storageService.set('profilePictureCache', url, 7 * 24 * 60); // 7 days in minutes
    // Also set legacy direct localStorage key for inline script compatibility
    localStorage.setItem('profilePictureCache', url);
  } catch (e) {
    console.warn('[EmployeeProfile] Failed to cache profile picture URL:', e);
  }

  // Use Design System avatar pattern XXL (no color class for images)
  container.className = 'avatar avatar--xxl';
  container.innerHTML = '';

  // Create image element with Design System class
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Profilbild';
  img.className = 'avatar__image';
  container.append(img);

  // Show remove button
  const removeBtn = $$id('remove-picture-btn');
  if (removeBtn !== null) {
    removeBtn.classList.remove('u-hidden');
  }
}

/**
 * Handle profile picture display - show picture or initials
 */
export function handleProfilePicture(profilePicture: string, firstName: string, lastName: string): void {
  if (profilePicture !== '') {
    displayProfilePicture(profilePicture);
  } else {
    displayInitials(firstName, lastName);
  }
}

/**
 * Get initials from token for initial placeholder
 */
export function getInitialsFromToken(token: string | null): string {
  if (token === null || token === '') {
    return '...';
  }

  try {
    // Parse JWT token
    const base64Url = token.split('.')[1];
    // Runtime validation for malformed JWT tokens

    if (base64Url === undefined) {
      return '...';
    }

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const userInfo = JSON.parse(jsonPayload) as {
      first_name?: string;
      firstName?: string;
      last_name?: string;
      lastName?: string;
    };

    const firstName = userInfo.first_name ?? userInfo.firstName ?? '';
    const lastName = userInfo.last_name ?? userInfo.lastName ?? '';
    const firstInitial = firstName.charAt(0).toUpperCase() !== '' ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName.charAt(0).toUpperCase() !== '' ? lastName.charAt(0).toUpperCase() : '';

    return firstInitial !== '' || lastInitial !== '' ? `${firstInitial}${lastInitial}` : '...';
  } catch {
    return '...';
  }
}

/**
 * Set initial placeholder while loading
 * Uses Design System avatar component
 * OPTIMIZATION: Shows avatar immediately from token data (optimistic rendering)
 */
export function setInitialPlaceholder(): void {
  const container = $$id('profile-picture-display');
  if (container === null) {
    return;
  }

  const token = localStorage.getItem('token');
  const initials = getInitialsFromToken(token);

  // Use Design System avatar pattern XXL (profile page)
  container.className = 'avatar avatar--xxl avatar--color-5';
  const initialsSpan = container.querySelector('.avatar__initials');

  if (initialsSpan !== null) {
    initialsSpan.textContent = initials;
  }
}
