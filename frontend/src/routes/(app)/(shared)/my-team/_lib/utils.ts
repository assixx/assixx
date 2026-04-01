/**
 * Utility functions for the My-Team page
 */
import { AVAILABILITY_LABELS, MESSAGES } from './constants.js';

import type { TeamMember } from './types.js';

/** Build a URL-safe slug from a team member's name + uuid */
export function buildUserSlug(member: TeamMember): string {
  const namePart = `${member.firstName}-${member.lastName}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zäöüß0-9-]/g, '');

  return `${namePart}-${member.uuid}`;
}

/** Get display label for team role */
export function getRoleLabel(role: string | undefined, leadLabel: string): string {
  if (role === 'lead') return leadLabel;
  return MESSAGES.ROLE_MEMBER;
}

/** Get badge class for team role */
export function getRoleBadgeClass(role: string | undefined): string {
  if (role === 'lead') return 'badge--primary';
  return 'badge--secondary';
}

/** Get availability label and badge class */
export function getAvailabilityInfo(status: string | undefined): {
  label: string;
  badgeClass: string;
} {
  if (status === undefined || status === '') {
    return { label: 'Verfügbar', badgeClass: 'badge--success' };
  }
  return AVAILABILITY_LABELS[status] ?? { label: status, badgeClass: 'badge--secondary' };
}

/** Format ISO date to German locale */
export function formatDate(dateStr: string | undefined): string {
  if (dateStr === undefined || dateStr === '') return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Get initials for avatar */
export function getInitials(firstName: string, lastName: string): string {
  const first = firstName.charAt(0).toUpperCase();
  const last = lastName.charAt(0).toUpperCase();
  return `${first}${last}`;
}

/** Get avatar color index (0–9) for design system avatar--color-{n} class */
export function getAvatarColorIndex(firstName: string, lastName: string): number {
  return (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % 10;
}

/** Filter members by search query */
export function filterBySearch(members: TeamMember[], query: string): TeamMember[] {
  if (query === '') return members;
  const lower = query.toLowerCase();
  return members.filter(
    (m: TeamMember) =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(lower) ||
      m.email.toLowerCase().includes(lower) ||
      (m.position?.toLowerCase().includes(lower) ?? false),
  );
}
