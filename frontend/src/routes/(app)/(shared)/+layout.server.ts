/**
 * Shared Group Layout - Fail-Closed RBAC
 * @module (app)/(shared)/+layout.server
 *
 * SECURITY: All authenticated users can access routes in this group.
 * Still fail-closed: verifies user data exists (authentication check).
 * Uses parent() to get user data from (app)/+layout.server.ts.
 *
 * @see ADR-012: Frontend Route Security Groups
 */
import { redirect } from '@sveltejs/kit';

import { buildLoginUrl } from '$lib/utils/build-apex-url';
import { createLogger } from '$lib/utils/logger';

import type { LayoutServerLoad } from './$types';

const log = createLogger('SharedGroupLayout');

export const load: LayoutServerLoad = async ({ parent, url }) => {
  const { user } = await parent();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defense-in-depth: parent guarantees user, but security checks must not rely on upstream alone
  if (user === null || user === undefined) {
    log.warn({ pathname: url.pathname }, 'RBAC(shared): No user data, redirecting to login');
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  log.debug({ pathname: url.pathname }, 'RBAC(shared): Access granted');

  return {};
};
