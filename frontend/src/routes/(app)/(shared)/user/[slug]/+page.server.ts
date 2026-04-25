/**
 * User Profile Page — Server-Side Data Loading
 *
 * Loads another user's profile by UUID extracted from the slug.
 * Uses GET /users/profile/:uuid which is gated by @RequirePermission
 * (user_profiles / user-profiles-view / canRead). The PermissionGuard
 * auto-bypasses for root users and users with hasFullAccess.
 *
 * Own profile → redirect to /employee-profile (always allowed).
 */
import { error, redirect } from '@sveltejs/kit';

import { apiFetchWithPermission } from '$lib/server/api-fetch.js';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import { UUID_REGEX } from './_lib/constants.js';

import type { PageServerLoad } from './$types.js';
import type { UserProfile } from './_lib/types.js';

const PROFILE_REDIRECTS: Record<string, string> = {
  root: '/root-profile',
  admin: '/admin-profile',
  employee: '/employee-profile',
};

function extractUuid(slug: string): string {
  const match = UUID_REGEX.exec(slug);
  if (match === null) error(400, 'Ungültiger Profil-Link');
  return match[1];
}

function redirectToOwnProfile(role: string): never {
  const target = PROFILE_REDIRECTS[role] ?? '/employee-profile';
  redirect(302, target);
}

export const load: PageServerLoad = async ({ cookies, fetch, params, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '')
    redirect(302, buildLoginUrl('session-expired', undefined, url));

  const { user } = await parent();
  const uuid = extractUuid(params.slug);

  if (user?.uuid === uuid) redirectToOwnProfile(user.role);

  const { data: profile, permissionDenied } = await apiFetchWithPermission<UserProfile>(
    `/users/profile/${uuid}`,
    token,
    fetch,
  );

  if (permissionDenied) return { profile: null, permissionDenied: true };
  if (profile === null) error(404, 'Benutzer nicht gefunden');

  return { profile, permissionDenied: false };
};
