/**
 * Avatar Helpers
 * Centralized utilities for avatar color assignment and initials generation.
 * Uses Design System avatar--color-0 through avatar--color-9 classes.
 *
 * @see frontend-svelte/src/design-system/primitives/avatar/avatar.css
 */

/**
 * Get avatar color index (0-9) based on identifier
 * Simple modulo ensures consistent color per user
 *
 * @param identifier - User ID (number) or string (email, username)
 * @returns Color index 0-9
 *
 * @example
 * getAvatarColor(5) // returns 5
 * getAvatarColor(123) // returns 3
 * getAvatarColor('john@example.com') // returns consistent hash-based index
 */
export function getAvatarColor(identifier: number | string | undefined | null): number {
  if (identifier === undefined || identifier === null) return 0;

  // If number, simple modulo
  if (typeof identifier === 'number') {
    return Math.abs(identifier) % 10;
  }

  // If string, hash it for consistent color
  const str = String(identifier);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 10;
}

/**
 * Get full avatar color class for Design System
 *
 * @param identifier - User ID or string identifier
 * @returns CSS class like 'avatar--color-5'
 *
 * @example
 * <div class="avatar avatar--sm {getAvatarColorClass(user.id)}">
 */
export function getAvatarColorClass(identifier: number | string | undefined | null): string {
  return `avatar--color-${getAvatarColor(identifier)}`;
}

/**
 * Generate initials from first and last name
 *
 * @param firstName - First name (optional)
 * @param lastName - Last name (optional)
 * @returns 1-2 character initials, uppercase
 *
 * @example
 * getInitials('John', 'Doe') // returns 'JD'
 * getInitials('Alice', undefined) // returns 'A'
 * getInitials(undefined, undefined) // returns '?'
 */
export function getInitials(
  firstName: string | undefined | null,
  lastName: string | undefined | null,
): string {
  const first = firstName?.charAt(0)?.toUpperCase() ?? '';
  const last = lastName?.charAt(0)?.toUpperCase() ?? '';
  return first + last || '?';
}
