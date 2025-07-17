/**
 * Page Protection - Client-side validation
 * This adds an extra layer of security by checking permissions on page load
 */

import { getAuthToken, parseJwt } from './auth';

// Define page permissions (same as server-side)
const pagePermissions: Record<string, string[]> = {
  // Admin pages
  'admin-dashboard': ['admin', 'root'],
  'admin-profile': ['admin', 'root'],
  'admin-config': ['admin', 'root'],
  'feature-management': ['admin', 'root'],
  'survey-admin': ['admin', 'root'],
  'org-management': ['admin', 'root'],
  'archived-employees': ['admin', 'root'],

  // Employee pages
  'employee-dashboard': ['employee', 'admin', 'root'],
  documents: ['employee', 'admin', 'root'],
  'employee-profile': ['employee'],
  profile: ['employee', 'admin', 'root'],
  'salary-documents': ['employee', 'admin', 'root'],
  'survey-employee': ['employee'],

  // Root pages
  'root-dashboard': ['root'],
  'root-profile': ['root'],
  'root-features': ['root'],
  'manage-admins': ['root'],
  'storage-upgrade': ['root'],

  // Shared pages
  blackboard: ['employee', 'admin', 'root'],
  calendar: ['employee', 'admin', 'root'],
  chat: ['employee', 'admin', 'root'],
  shifts: ['employee', 'admin', 'root'],
  kvp: ['employee', 'admin', 'root'],
};

/**
 * Get dashboard URL for a specific role
 */
function getDashboardForRole(role: string): string {
  switch (role) {
    case 'employee':
      return '/pages/employee-dashboard.html';
    case 'admin':
      return '/pages/admin-dashboard.html';
    case 'root':
      return '/pages/root-dashboard.html';
    default:
      return '/pages/login.html';
  }
}

/**
 * Check if current page is accessible by user
 */
export function checkPageAccess(): void {
  // Get current page name from URL
  const path = window.location.pathname;
  const pageName = path.split('/').pop()?.replace('.html', '') ?? '';

  // Skip check for public pages
  const publicPages = ['login', 'signup', 'index', ''];
  if (publicPages.includes(pageName)) {
    return;
  }

  // Get user token and role
  const token = getAuthToken();

  if (!token) {
    console.warn('No token found, redirecting to login');
    window.location.href = '/login';
    return;
  }

  // Parse token to get user role
  const tokenData = parseJwt(token);
  if (!tokenData?.role) {
    console.error('Invalid token data, redirecting to login');
    window.location.href = '/login';
    return;
  }

  // Check if page exists in permissions
  const allowedRoles = pagePermissions[pageName];

  if (!allowedRoles) {
    // Page not in permissions list, allow access
    console.warn(`Page ${pageName} not in permissions list`);
    return;
  }

  // Check if user's role is allowed
  if (!allowedRoles.includes(tokenData.role)) {
    console.warn(`User role ${tokenData.role} not allowed on page ${pageName}`);

    // Redirect to appropriate dashboard
    const redirectUrl = getDashboardForRole(tokenData.role);
    window.location.href = redirectUrl;
    return;
  }

  // Access allowed
  console.log(`Access granted to ${pageName} for role ${tokenData.role}`);
}

/**
 * Initialize page protection
 */
export function initPageProtection(): void {
  // Check access immediately
  checkPageAccess();

  // Also check when page becomes visible (tab switching)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkPageAccess();
    }
  });

  // Check every 5 minutes to ensure token is still valid
  setInterval(
    () => {
      const token = getAuthToken();
      if (token) {
        const tokenData = parseJwt(token);
        if (tokenData && tokenData.exp) {
          const now = Date.now() / 1000;
          if (tokenData.exp < now) {
            console.warn('Token expired, redirecting to login');
            window.location.href = '/login';
          }
        }
      }
    },
    5 * 60 * 1000,
  );
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initPageProtection);
}
