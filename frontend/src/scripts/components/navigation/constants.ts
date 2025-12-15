/**
 * Navigation Constants
 * URLs, selectors, CSS classes, and access control configuration
 */

import type { Role } from './types';

// Dashboard URLs
export const DASHBOARD_URLS = {
  employee: '/employee-dashboard',
  admin: '/admin-dashboard',
  root: '/root-dashboard',
} as const;

// CSS Selectors
export const SELECTORS = {
  sidebar: '.sidebar',
  sidebarItem: '.sidebar-item',
  mainContent: '.main-content',
  submenu: '.submenu',
  navBadge: '.nav-badge',
  layoutContainer: '.layout-container',
  header: '.header',
} as const;

// CSS Classes
export const CSS_CLASSES = {
  collapsed: 'collapsed',
  sidebarCollapsed: 'sidebar-collapsed',
  hidden: 'u-hidden',
  active: 'active',
  open: 'open',
  modalActive: 'modal-overlay--active',
  submenuOpen: 'submenu--open',
  employeeNumberVisible: 'employee-number--visible',
  employeeNumberText: 'employee-number__text',
  employeeNumberTemp: 'employee-number--temp',
  logoClickable: 'logo-container--clickable',
  progressBarDynamic: 'storage-progress-bar--dynamic',
  bannerDismissed: 'sidebar--banner-dismissed',
  marginRight2: 'mr-2',
} as const;

// Badge IDs
export const BADGE_IDS = {
  chat: '#chat-unread-badge',
  kvp: '#kvp-badge',
  surveys: '#surveys-pending-badge',
  leanManagement: '#lean-management-badge',
  documents: '#documents-unread-badge',
  calendar: '#calendar-unread-badge',
} as const;

// Element IDs
export const ELEMENT_IDS = {
  logoutModal: '#logoutModal',
  confirmLogout: '#confirmLogout',
  cancelLogout: '#cancelLogout',
  roleSwitchBanner: '#role-switch-warning-banner',
  sidebarUserPosition: '#sidebar-user-position',
  sidebarEmployeeNumber: '#sidebar-employee-number',
  storageProgressBar: '#storage-progress-bar',
  storageUsed: '#storage-used',
  storageTotal: '#storage-total',
  storagePercentage: '#storage-percentage',
} as const;

// Access Control Map - defines which roles can access which pages
const accessControlData: Record<string, Role[]> = {
  // Root-only pages
  [DASHBOARD_URLS.root]: ['root'],
  '/manage-root': ['root'],
  '/root-features': ['root'],
  '/root-profile': ['root'],
  '/tenant-deletion-status': ['root'],
  '/storage-upgrade': ['root'],
  '/logs': ['root'],

  // Admin/Root pages
  [DASHBOARD_URLS.admin]: ['admin', 'root'],
  '/manage-admins': ['admin', 'root'],
  '/manage-employees': ['admin', 'root'],
  '/manage-departments': ['admin', 'root'],
  '/manage-areas': ['admin', 'root'],
  '/manage-teams': ['admin', 'root'],
  '/manage-machines': ['admin', 'root'],
  '/survey-admin': ['admin', 'root'],
  '/admin-profile': ['admin', 'root'],

  // All users
  [DASHBOARD_URLS.employee]: ['employee', 'admin', 'root'],
  '/employee-profile': ['employee', 'admin', 'root'],
  '/blackboard': ['employee', 'admin', 'root'],
  '/kvp': ['employee', 'admin', 'root'],
  '/calendar': ['employee', 'admin', 'root'],
  '/shifts': ['employee', 'admin', 'root'],
  '/chat': ['employee', 'admin', 'root'],
  '/documents-explorer': ['employee', 'admin', 'root'],
  '/account-settings': ['employee', 'admin', 'root'],
};

export const ACCESS_CONTROL = new Map<string, Role[]>(Object.entries(accessControlData));

// Update intervals (in milliseconds)
export const UPDATE_INTERVALS = {
  userInfo: 600000, // 10 minutes
  tokenTimer: 1000, // 1 second
  storage: 300000, // 5 minutes
} as const;

// Token warning thresholds (in seconds)
export const TOKEN_THRESHOLDS = {
  warning: 120, // 2 minutes
  critical: 60, // 1 minute
} as const;
