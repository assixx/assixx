/**
 * Role-Based Redirect Paths
 * @module server/role-redirects
 *
 * Central mapping: role → dashboard/profile path.
 * Prevents hardcoded '/dashboard' redirects that 404.
 */

const DASHBOARD_PATH: Record<string, string> = {
  root: '/root-dashboard',
  admin: '/admin-dashboard',
  employee: '/employee-dashboard',
  dummy: '/blackboard',
};

const PROFILE_PATH: Record<string, string> = {
  root: '/root-profile',
  admin: '/admin-profile',
  employee: '/employee-profile',
  dummy: '/blackboard',
};

/** Returns the dashboard path for the given role, falls back to /login */
export function dashboardForRole(role: string): string {
  return DASHBOARD_PATH[role] ?? '/login';
}

/** Returns the profile path for the given role, falls back to /login */
export function profileForRole(role: string): string {
  return PROFILE_PATH[role] ?? '/login';
}
