/**
 * Unit tests for Avatar Helpers
 *
 * Phase 7: Frontend utils — 1 test per function, pure functions, no mocks needed.
 */
import { describe, expect, it } from 'vitest';

import {
  getAvatarColor,
  getAvatarColorClass,
  getInitials,
  getProfilePictureUrl,
} from './avatar-helpers.js';

describe('avatar-helpers', () => {
  it('getAvatarColor should return 0-9 for number and consistent hash for string', () => {
    expect(getAvatarColor(5)).toBe(5);
    expect(getAvatarColor(123)).toBe(3); // 123 % 10
    expect(getAvatarColor(null)).toBe(0);
    expect(getAvatarColor(undefined)).toBe(0);

    // String hashing should be deterministic
    const color1 = getAvatarColor('john@test.de');
    const color2 = getAvatarColor('john@test.de');
    expect(color1).toBe(color2);
    expect(color1).toBeGreaterThanOrEqual(0);
    expect(color1).toBeLessThan(10);
  });

  it('getAvatarColorClass should return CSS class with color index', () => {
    expect(getAvatarColorClass(7)).toBe('avatar--color-7');
    expect(getAvatarColorClass(null)).toBe('avatar--color-0');
  });

  it('getInitials should generate 1-2 char initials from names', () => {
    expect(getInitials('John', 'Doe')).toBe('JD');
    expect(getInitials('Alice', null)).toBe('A');
    expect(getInitials(null, null)).toBe('?');
    expect(getInitials('', '')).toBe('?');
  });

  it('getProfilePictureUrl should normalize paths with leading slash', () => {
    expect(getProfilePictureUrl('uploads/pic.jpg')).toBe('/uploads/pic.jpg');
    expect(getProfilePictureUrl('/uploads/pic.jpg')).toBe('/uploads/pic.jpg');
    expect(getProfilePictureUrl('https://cdn.test/pic.jpg')).toBe('https://cdn.test/pic.jpg');
    expect(getProfilePictureUrl(null)).toBeNull();
    expect(getProfilePictureUrl('')).toBeNull();
  });
});
