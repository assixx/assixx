/**
 * Manage Page Access Checks
 * @module server/manage-page-access
 *
 * Centralized scope-based access control for manage-* pages.
 * Called from +page.server.ts to enforce Defense-in-Depth (backend also checks).
 *
 * Two patterns:
 * - "team-level": Root | Admin (scoped) | Employee Team-Lead → manage-teams, manage-employees
 * - "admin-level": Root | Admin (scoped) → manage-areas, manage-departments (D1=NEIN)
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { OrganizationalScope } from '$lib/types/organizational-scope';

const log = createLogger('ManagePageAccess');
const DENIED = '/permission-denied';

interface AccessContext {
  role: string | undefined;
  pathname: string;
}

/** Access check for manage-teams + manage-employees (Employee-Leads allowed) */
export function assertTeamLevelAccess(orgScope: OrganizationalScope, ctx: AccessContext): void {
  if (ctx.role === 'root') return;

  if (ctx.role === 'admin') {
    if (orgScope.type === 'none') {
      log.warn({ pathname: ctx.pathname }, 'Scope denied: admin without scope');
      redirect(302, DENIED);
    }
    return;
  }

  if (ctx.role === 'employee') {
    if (!orgScope.isTeamLead) {
      log.warn({ pathname: ctx.pathname }, 'Scope denied: employee without lead');
      redirect(302, DENIED);
    }
    return;
  }

  redirect(302, DENIED);
}

/** Access check for manage-areas + manage-departments (NO Employee access, D1=NEIN) */
export function assertAdminLevelAccess(orgScope: OrganizationalScope, ctx: AccessContext): void {
  if (ctx.role === 'root') return;

  if (ctx.role === 'admin') {
    if (orgScope.type === 'none') {
      log.warn({ pathname: ctx.pathname }, 'Scope denied: admin without scope');
      redirect(302, DENIED);
    }
    return;
  }

  log.warn({ pathname: ctx.pathname, role: ctx.role }, 'Scope denied: not admin/root');
  redirect(302, DENIED);
}
