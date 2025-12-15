/**
 * Authentication helper functions for Assixx
 * Provides type-safe access to user authentication data
 */

// Valid user roles in the system
export type UserRole = 'root' | 'admin' | 'employee';

/**
 * Get the current user's role from localStorage
 * Returns null if no role is set or if the value is empty
 */
export function getUserRole(): UserRole | null {
  const role = localStorage.getItem('userRole');

  // Explicit null and empty string check as per TYPESCRIPT-STANDARDS.md
  if (role === null || role === '') {
    return null;
  }

  // Validate that the role is a valid UserRole
  if (role === 'root' || role === 'admin' || role === 'employee') {
    return role;
  }

  // Invalid role value, log warning and return null
  console.warn(`Invalid user role found in localStorage: ${role}`);
  return null;
}

/**
 * Get the active role (for role switching functionality)
 * Falls back to getUserRole if no active role is set
 */
export function getActiveRole(): UserRole | null {
  const activeRole = localStorage.getItem('activeRole');

  // Explicit null and empty string check and validate that the role is a valid UserRole
  if (
    activeRole !== null &&
    activeRole !== '' &&
    (activeRole === 'root' || activeRole === 'admin' || activeRole === 'employee')
  ) {
    return activeRole;
  }

  // Fall back to user's actual role
  return getUserRole();
}

/**
 * Check if the current user is an admin (admin or root)
 */
export function isAdmin(): boolean {
  const role = getUserRole();
  return role === 'admin' || role === 'root';
}

/**
 * Check if the current user is root
 */
export function isRoot(): boolean {
  const role = getUserRole();
  return role === 'root';
}

/**
 * Check if the current user is an employee
 */
export function isEmployee(): boolean {
  const role = getUserRole();
  return role === 'employee';
}

/**
 * Check if the user has at least the specified permission level
 * Permission hierarchy: root > admin > employee
 */
export function hasPermission(requiredRole: UserRole): boolean {
  const role = getUserRole();

  if (role === null) {
    return false;
  }

  // Root has all permissions
  if (role === 'root') {
    return true;
  }

  // Admin has admin and employee permissions
  if (role === 'admin') {
    return requiredRole === 'admin' || requiredRole === 'employee';
  }

  // Employee only has employee permission
  // At this point, role can only be 'employee' since we've checked all other cases
  return requiredRole === 'employee';
}

/**
 * Check if the user has exactly the specified role
 */
export function hasExactRole(targetRole: UserRole): boolean {
  const role = getUserRole();
  return role === targetRole;
}

/**
 * Get the display name for a role
 */
export function getRoleDisplayName(role: UserRole | null): string {
  if (role === null) {
    return 'Unbekannt';
  }

  switch (role) {
    case 'root':
      return 'Root';
    case 'admin':
      return 'Admin';
    case 'employee':
      return 'Mitarbeiter';
    default:
      return 'Unbekannt';
  }
}

/**
 * Check if user can perform administrative actions
 * (Same as isAdmin but more semantic)
 */
export function canPerformAdminActions(): boolean {
  return isAdmin();
}

/**
 * Check if user can access user management features
 */
export function canManageUsers(): boolean {
  return isAdmin();
}

/**
 * Check if user can access department management
 */
export function canManageDepartments(): boolean {
  return isAdmin();
}

/**
 * Check if user can access team management
 */
export function canManageTeams(): boolean {
  return isAdmin();
}

/**
 * Check if user can view all employees
 */
export function canViewAllEmployees(): boolean {
  return isAdmin();
}

/**
 * Check if user is authenticated (has any valid role)
 */
export function isAuthenticated(): boolean {
  const role = getUserRole();
  return role !== null;
}

/**
 * Clear user role from localStorage (for logout)
 */
export function clearUserRole(): void {
  localStorage.removeItem('userRole');
  localStorage.removeItem('activeRole');
}

/**
 * Set user role in localStorage (for login)
 * Returns true if successful, false if invalid role
 */
export function setUserRole(role: string): boolean {
  // Validate role
  if (role !== 'root' && role !== 'admin' && role !== 'employee') {
    console.error(`Attempted to set invalid user role: ${role}`);
    return false;
  }

  localStorage.setItem('userRole', role);
  return true;
}

/**
 * Set active role for role switching
 * Returns true if successful, false if invalid role or insufficient permissions
 */
export function setActiveRole(targetRole: UserRole): boolean {
  const currentRole = getUserRole();

  if (currentRole === null) {
    return false;
  }

  // Validate that user can switch to target role
  if (targetRole === 'root' && currentRole !== 'root') {
    console.warn('Only root users can switch to root role');
    return false;
  }

  if (targetRole === 'admin' && currentRole === 'employee') {
    console.warn('Employees cannot switch to admin role');
    return false;
  }

  localStorage.setItem('activeRole', targetRole);
  return true;
}
