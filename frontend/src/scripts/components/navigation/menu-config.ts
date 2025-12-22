/**
 * Navigation Menu Configuration
 * Role-based navigation items for sidebar menu
 */

import type { NavItem, NavigationItems, Role } from './types';
import { getIcon } from './icons';
import { DASHBOARD_URLS } from './constants';

/**
 * Get document submenu items
 */
function getDocumentSubmenu(): NavItem[] {
  return [
    {
      id: 'documents-explorer',
      icon: getIcon('folder'),
      label: 'Datei Explorer',
      url: '/documents-explorer',
    },
  ];
}

/**
 * Get LEAN Management submenu items
 * @param isAdmin - Whether user is admin (determines survey URL)
 */
function getLeanManagementSubmenu(isAdmin: boolean): NavItem[] {
  return [
    {
      id: 'kvp',
      icon: getIcon('lightbulb'),
      label: 'KVP System',
      url: '/kvp',
      badge: 'new-kvp-suggestions',
    },
    {
      id: 'surveys',
      icon: getIcon('poll'),
      label: 'Umfragen',
      url: isAdmin ? '/survey-admin' : '/survey-employee',
      ...(isAdmin ? {} : { badge: 'pending-surveys' }),
    },
  ];
}

/**
 * Get departments navigation item
 */
function getDepartmentsNavItem(): NavItem {
  return {
    id: 'departments',
    icon: getIcon('building'),
    label: 'Abteilungen',
    url: '/manage-departments',
  };
}

/**
 * Get admin core items (dashboard, blackboard, employees, teams, machines)
 */
function getAdminCoreItems(): NavItem[] {
  return [
    {
      id: 'dashboard',
      icon: getIcon('home'),
      label: 'Übersicht',
      url: '/admin-dashboard',
      section: 'dashboard',
    },
    {
      id: 'blackboard',
      icon: getIcon('pin'),
      label: 'Schwarzes Brett',
      url: '/blackboard',
      section: 'blackboard',
    },
    {
      id: 'employees',
      icon: getIcon('users'),
      label: 'Mitarbeiter',
      url: '/manage-employees',
      section: 'employees',
      children: [
        {
          id: 'employees-list',
          label: 'Mitarbeiterliste',
          url: '/manage-employees',
          section: 'employees',
        },
      ],
    },
    {
      id: 'teams',
      icon: getIcon('team'),
      label: 'Teams',
      url: '/manage-teams',
      section: 'teams',
    },
    {
      id: 'machines',
      icon: getIcon('generator'),
      label: 'Maschinen',
      url: '/manage-machines',
      section: 'machines',
    },
  ];
}

/**
 * Get admin content items (documents, calendar, lean management, shifts)
 */
function getAdminContentItems(): NavItem[] {
  return [
    {
      id: 'documents',
      icon: getIcon('document'),
      label: 'Dokumente',
      hasSubmenu: true,
      submenu: getDocumentSubmenu(),
    },
    {
      id: 'calendar',
      icon: getIcon('calendar'),
      label: 'Kalender',
      url: '/calendar',
      badge: 'unread-calendar-events',
    },
    {
      id: 'lean-management',
      icon: getIcon('lean'),
      label: 'LEAN-Management',
      hasSubmenu: true,
      badge: 'lean-management-parent',
      submenu: getLeanManagementSubmenu(true),
    },
    {
      id: 'shifts',
      icon: getIcon('clock'),
      label: 'Schichtplanung',
      url: '/shifts',
    },
  ];
}

/**
 * Get admin communication items (chat, settings, profile)
 */
function getAdminCommunicationItems(): NavItem[] {
  return [
    {
      id: 'chat',
      icon: getIcon('chat'),
      label: 'Chat',
      url: '/chat',
      badge: 'unread-messages',
    },
    {
      id: 'settings',
      icon: getIcon('settings'),
      label: 'Einstellungen',
      url: '#settings',
      section: 'settings',
    },
    {
      id: 'profile',
      icon: getIcon('user'),
      label: 'Mein Profil',
      url: '/admin-profile',
    },
  ];
}

/**
 * Get admin navigation items (full list)
 */
function getAdminNavigationItems(): NavItem[] {
  return [...getAdminCoreItems(), ...getAdminContentItems(), ...getAdminCommunicationItems()];
}

/**
 * Get employee navigation items
 */
function getEmployeeNavigationItems(): NavItem[] {
  return [
    {
      id: 'dashboard',
      icon: getIcon('home'),
      label: 'Dashboard',
      url: DASHBOARD_URLS.employee,
    },
    {
      id: 'blackboard',
      icon: getIcon('pin'),
      label: 'Schwarzes Brett',
      url: '/blackboard',
    },
    {
      id: 'documents',
      icon: getIcon('document'),
      label: 'Dokumente',
      hasSubmenu: true,
      badge: 'unread-documents',
      submenu: getDocumentSubmenu(),
    },
    {
      id: 'calendar',
      icon: getIcon('calendar'),
      label: 'Kalender',
      url: '/calendar',
      badge: 'unread-calendar-events',
    },
    {
      id: 'lean-management',
      icon: getIcon('lean'),
      label: 'LEAN-Management',
      hasSubmenu: true,
      badge: 'lean-management-parent',
      submenu: getLeanManagementSubmenu(false),
    },
    {
      id: 'chat',
      icon: getIcon('chat'),
      label: 'Chat',
      url: '/chat',
      badge: 'unread-messages',
    },
    {
      id: 'shifts',
      icon: getIcon('clock'),
      label: 'Schichtplanung',
      url: '/shifts',
    },
    {
      id: 'profile',
      icon: getIcon('user'),
      label: 'Mein Profil',
      url: '/employee-profile',
    },
  ];
}

/**
 * Get root user management items
 */
function getRootUserManagementItems(): NavItem[] {
  return [
    {
      id: 'dashboard',
      icon: getIcon('home'),
      label: 'Root Dashboard',
      url: DASHBOARD_URLS.root,
    },
    {
      id: 'blackboard',
      icon: getIcon('pin'),
      label: 'Schwarzes Brett',
      url: '/blackboard',
    },
    {
      id: 'root-users',
      icon: getIcon('user-shield'),
      label: 'Root User',
      url: '/manage-root',
    },
    {
      id: 'admins',
      icon: getIcon('admin'),
      label: 'Administratoren',
      url: '/manage-admins',
    },
  ];
}

/**
 * Get root organization items
 */
function getRootOrganizationItems(): NavItem[] {
  return [
    {
      id: 'areas',
      icon: getIcon('sitemap'),
      label: 'Bereiche',
      url: '/manage-areas',
      section: 'areas',
    },
    getDepartmentsNavItem(),
    {
      id: 'chat',
      icon: getIcon('chat'),
      label: 'Chat',
      url: '/chat',
      badge: 'unread-messages',
    },
  ];
}

/**
 * Get root system items
 */
function getRootSystemItems(): NavItem[] {
  return [
    {
      id: 'features',
      icon: getIcon('feature'),
      label: 'Features',
      url: '/features',
    },
    {
      id: 'logs',
      icon: getIcon('logs'),
      label: 'System-Logs',
      url: '/logs',
    },
    {
      id: 'profile',
      icon: getIcon('user'),
      label: 'Mein Profil',
      url: '/root-profile',
    },
    {
      id: 'system',
      icon: getIcon('settings'),
      label: 'System',
      hasSubmenu: true,
      submenu: [
        {
          id: 'account-settings',
          icon: getIcon('user-shield'),
          label: 'Kontoeinstellungen',
          url: '/account-settings',
        },
      ],
    },
  ];
}

/**
 * Get root navigation items (full list)
 */
function getRootNavigationItems(): NavItem[] {
  return [...getRootUserManagementItems(), ...getRootOrganizationItems(), ...getRootSystemItems()];
}

/**
 * Get all navigation items organized by role
 */
export function getNavigationItems(): NavigationItems {
  return {
    admin: getAdminNavigationItems(),
    employee: getEmployeeNavigationItems(),
    root: getRootNavigationItems(),
  };
}

/**
 * Get navigation items for a specific role
 * @param role - User role
 * @returns Navigation items array for the role
 */
export function getNavigationForRole(role: Role | null): NavItem[] {
  if (role === null) return [];

  const items = getNavigationItems();

  switch (role) {
    case 'admin':
      return items.admin;
    case 'employee':
      return items.employee;
    case 'root':
      return items.root;
    default:
      return [];
  }
}
