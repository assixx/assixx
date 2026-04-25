/**
 * Admin Group Layout - Fail-Closed RBAC
 * @module (app)/(admin)/+layout.server
 *
 * SECURITY: Only 'admin' and 'root' roles can access routes in this group.
 * Uses parent() to get user data from (app)/+layout.server.ts.
 * Fail-closed: if role check fails for ANY reason, access is denied.
 *
 * @see ADR-012: Frontend Route Security Groups
 */
import { redirect } from '@sveltejs/kit';

import { buildLoginUrl } from '$lib/utils/build-apex-url';
import { createLogger } from '$lib/utils/logger';

import type { LayoutServerLoad } from './$types';

const log = createLogger('AdminGroupLayout');

/** Roles allowed to access admin routes */
const ALLOWED_ROLES: ReadonlySet<string> = new Set(['admin', 'root']);

export const load: LayoutServerLoad = async ({ parent, url }) => {
  const { user } = await parent();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defense-in-depth: parent guarantees user, but security checks must not rely on upstream alone
  if (user === null || user === undefined) {
    log.warn({ pathname: url.pathname }, 'RBAC(admin): No user data, redirecting to login');
    // ADR-050 Amendment 2026-04-22: cross-origin redirect to apex login.
    // Defense-in-depth — parent layout already redirects when user is null.
    // If we reach here, parent guarantee was bypassed; treat as session loss.
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  if (!ALLOWED_ROLES.has(user.role)) {
    log.warn(
      { pathname: url.pathname, userRole: user.role },
      `RBAC(admin): Access denied - ${user.role} tried to access admin route`,
    );
    redirect(302, '/permission-denied');
  }

  log.debug({ pathname: url.pathname }, 'RBAC(admin): Access granted');

  return {};
};
