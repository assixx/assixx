/**
 * Avatar JavaScript Helper
 *
 * Utilities for:
 * - Generating initials from names
 * - Assigning consistent colors based on username
 * - Creating avatar elements programmatically
 *
 * USAGE:
 *   import { getInitials, getColorClass, createAvatar } from './avatar.js';
 *
 *   const initials = getInitials('John Doe');           // "JD"
 *   const color = getColorClass('john.doe');            // "avatar--color-4" (consistent)
 *   const avatar = createAvatar('John Doe', 'online');  // DOM element
 */

/**
 * Generate initials from full name
 * Takes first letter of first name and first letter of last name
 *
 * @param {string} name - Full name (e.g., "John Doe")
 * @returns {string} Initials (e.g., "JD")
 */
export function getInitials(name) {
  if (!name || typeof name !== 'string') return '?';

  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';

  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    // Single name: take first 2 letters
    return parts[0].substring(0, 2).toUpperCase();
  }

  // Multiple names: first letter of first + first letter of last
  const firstInitial = parts[0][0];
  const lastInitial = parts[parts.length - 1][0];

  return (firstInitial + lastInitial).toUpperCase();
}

/**
 * Simple hash function for consistent color assignment
 * Same string always returns same number
 *
 * @param {string} str - String to hash (username, email, etc.)
 * @returns {number} Hash value
 */
function hashString(str) {
  if (!str || typeof str !== 'string') return 0;

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash);
}

/**
 * Get consistent color class for a username
 * Same username always gets same color
 *
 * @param {string} username - Username or identifier
 * @returns {string} Color class (e.g., "avatar--color-4")
 */
export function getColorClass(username) {
  if (!username || typeof username !== 'string') {
    return 'avatar--color-0';
  }

  const hash = hashString(username.toLowerCase());
  const colorIndex = hash % 10; // We have 10 colors (0-9)

  return `avatar--color-${colorIndex}`;
}

/**
 * Create avatar element with initials
 *
 * @param {string} name - Full name
 * @param {string} username - Username for color assignment
 * @param {Object} options - Configuration options
 * @param {string} options.size - Size variant (xs, sm, md, lg, xl)
 * @param {string} options.status - Status indicator (online, offline, busy, away)
 * @param {string} options.shape - Shape variant (circle, square)
 * @param {string} options.imageUrl - Optional image URL
 * @returns {HTMLElement} Avatar element
 */
export function createAvatar(name, username, options = {}) {
  const { size = 'md', status = null, shape = 'circle', imageUrl = null } = options;

  // Create avatar container
  const avatar = document.createElement('div');
  avatar.className = 'avatar';

  // Add size class
  if (size !== 'md') {
    avatar.classList.add(`avatar--${size}`);
  }

  // Add shape class
  if (shape === 'square') {
    avatar.classList.add('avatar--square');
  }

  // Add color class (only if no image)
  if (!imageUrl) {
    avatar.classList.add(getColorClass(username));
  }

  // Add content (image OR initials)
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = name;
    img.className = 'avatar__image';
    avatar.appendChild(img);
  } else {
    const initials = document.createElement('span');
    initials.className = 'avatar__initials';
    initials.textContent = getInitials(name);
    avatar.appendChild(initials);
  }

  // Add status indicator
  if (status) {
    const statusEl = document.createElement('span');
    statusEl.className = `avatar__status avatar__status--${status}`;
    statusEl.setAttribute('aria-label', `Status: ${status}`);
    avatar.appendChild(statusEl);
  }

  // Add screen reader text
  const srText = document.createElement('span');
  srText.className = 'avatar__sr-only';
  srText.textContent = name;
  avatar.appendChild(srText);

  return avatar;
}
