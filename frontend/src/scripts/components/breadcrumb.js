/* eslint-disable max-lines */
/**
 * Breadcrumb Navigation Component
 * Business logic for breadcrumb generation and initialization
 */

// Import configuration and utilities from breadcrumb-config.js
import {
  defaultConfig,
  urlMappings,
  sectionMappings,
  injectStyles,
  generateBreadcrumbDOM,
  // Constants
  ADMIN_DASHBOARD_LABEL,
  MITARBEITER_DASHBOARD_LABEL,
  BENUTZER_VERWALTEN_LABEL,
  UMFRAGEN_LABEL,
  ADMIN_DASHBOARD_URL,
  DOKUMENTE_LABEL,
  // Icons
  ICON_TACHOMETER,
  ICON_POLL,
  ICON_USERS,
  ICON_FILE_ALT,
} from './breadcrumb-config.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Breadcrumbs aus URL generieren
// Helper: Get user role from storage
function getUserRole() {
  return (
    localStorage.getItem('userRole') ||
    localStorage.getItem('role') ||
    localStorage.getItem('activeRole') ||
    sessionStorage.getItem('userRole') ||
    sessionStorage.getItem('role')
  );
}

// Helper: Get home URL based on role
function getHomeUrl(userRole) {
  const roleMap = {
    root: '/pages/root-dashboard.html',
    admin: '/pages/admin-dashboard.html',
    employee: '/pages/employee-dashboard.html',
  };

  // Safe lookup to avoid object injection
  if (userRole === 'root') return roleMap.root;
  if (userRole === 'admin') return roleMap.admin;
  if (userRole === 'employee') return roleMap.employee;

  // Fallback: check current path
  const currentPath = window.location.pathname;
  if (currentPath.includes('root')) return roleMap.root;
  if (currentPath.includes('admin')) return roleMap.admin;
  if (currentPath.includes('employee')) return roleMap.employee;
  return '/';
}

// Helper: Find mapping safely
function findMapping(mappings, key) {
  for (const [mapKey, value] of Object.entries(mappings)) {
    if (mapKey === key) {
      return value;
    }
  }
  return null;
}

// Helper: Add dashboard breadcrumb
function addDashboardBreadcrumb(items, role) {
  const dashboardMap = {
    root: { label: 'Root Dashboard', href: '/root-dashboard', icon: 'fa-shield-alt' },
    admin: { label: ADMIN_DASHBOARD_LABEL, href: ADMIN_DASHBOARD_URL, icon: ICON_TACHOMETER },
    employee: { label: MITARBEITER_DASHBOARD_LABEL, href: '/employee-dashboard', icon: 'fa-user' },
  };

  // Safe lookup to avoid object injection
  if (role === 'root' && dashboardMap.root) {
    items.push(dashboardMap.root);
  } else if (role === 'admin' && dashboardMap.admin) {
    items.push(dashboardMap.admin);
  } else if (role === 'employee' && dashboardMap.employee) {
    items.push(dashboardMap.employee);
  }
}

// Helper: Handle survey pages
function handleSurveyPages(items, currentPage) {
  if (currentPage === '/survey-create' || currentPage === '/survey-results') {
    items.push({
      label: ADMIN_DASHBOARD_LABEL,
      href: ADMIN_DASHBOARD_URL,
      icon: ICON_TACHOMETER,
    });
    items.push({
      label: UMFRAGEN_LABEL,
      href: '/survey-admin',
      icon: ICON_POLL,
    });
    return true;
  }
  return false;
}

// Helper: Handle admin pages
function handleAdminPages(items, currentPage) {
  // manage-admins is now standalone, not under admin-dashboard anymore
  const adminPages = ['/manage-users', '/admin-config'];
  if (adminPages.includes(currentPage)) {
    items.push({
      label: ADMIN_DASHBOARD_LABEL,
      href: ADMIN_DASHBOARD_URL,
      icon: ICON_TACHOMETER,
    });
    return true;
  }
  return false;
}

// Helper: Handle root pages
function handleRootPages(items, currentPage) {
  const rootPages = [
    '/manage-root-users',
    '/pages/manage-root-users',
    '/root-features',
    '/pages/root-features',
    '/tenant-deletion-status',
    '/pages/tenant-deletion-status',
    '/feature-management',
    '/pages/feature-management',
  ];

  if (rootPages.includes(currentPage)) {
    items.push({
      label: 'Root Dashboard',
      href: '/root-dashboard',
      icon: 'fa-shield-alt',
    });
    return true;
  }
  return false;
}

// Helper: Handle document pages
function handleDocumentPages(items, currentPage) {
  if (currentPage.includes('/documents-') || currentPage.includes('/employee-documents')) {
    items.push({
      label: DOKUMENTE_LABEL,
      href: '/documents',
      icon: ICON_FILE_ALT,
    });
    return true;
  }
  return false;
}

// Helper: Handle common pages
function handleCommonPages(items, currentPage) {
  const commonPages = ['/documents', '/blackboard', '/chat', '/shifts'];
  if (commonPages.includes(currentPage)) {
    const isAdmin = localStorage.getItem('userRole') === 'admin';
    if (!isAdmin) {
      items.push({
        label: MITARBEITER_DASHBOARD_LABEL,
        href: '/employee-dashboard',
        icon: 'fa-user',
      });
    }
    return true;
  }
  return false;
}

/**
 * Add home breadcrumb item
 */
function addHomeBreadcrumb(items) {
  const userRole = getUserRole();
  const homeHref = getHomeUrl(userRole);

  items.push({
    label: defaultConfig.homeLabel,
    href: homeHref,
    icon: defaultConfig.homeIcon,
  });
}

/**
 * Handle archived employees breadcrumb
 */
function handleArchivedEmployees(items) {
  items.push({
    label: ADMIN_DASHBOARD_LABEL,
    href: ADMIN_DASHBOARD_URL,
    icon: ICON_TACHOMETER,
  });
  items.push({
    label: BENUTZER_VERWALTEN_LABEL,
    href: '/manage-users',
    icon: ICON_USERS,
  });
}

/**
 * Handle department groups breadcrumb
 */
function handleDepartmentGroups(items) {
  items.push({
    label: ADMIN_DASHBOARD_LABEL,
    href: ADMIN_DASHBOARD_URL,
    icon: ICON_TACHOMETER,
  });
  items.push({
    label: 'Abteilungen verwalten',
    href: '/manage-departments',
    icon: 'fa-sitemap',
  });
}

/**
 * Handle account settings breadcrumb
 */
function handleAccountSettings(items) {
  const currentUserRole = getUserRole();
  addDashboardBreadcrumb(items, currentUserRole);
}

/**
 * Process special page handlers
 */
function processSpecialHandlers(items, currentPage) {
  return (
    handleSurveyPages(items, currentPage) ||
    handleAdminPages(items, currentPage) ||
    handleRootPages(items, currentPage) ||
    handleCommonPages(items, currentPage) ||
    handleDocumentPages(items, currentPage)
  );
}

/**
 * Process special case pages
 */
function processSpecialCases(items, currentPage) {
  const isArchivedEmployees = currentPage === '/archived-employees' || currentPage === '/pages/archived-employees';
  const isDepartmentGroups =
    currentPage === '/manage-department-groups' || currentPage === '/pages/manage-department-groups';
  const isAccountRelated = [
    '/account-settings',
    '/pages/account-settings',
    '/storage-upgrade',
    '/pages/storage-upgrade',
  ].includes(currentPage);

  if (isArchivedEmployees) {
    handleArchivedEmployees(items);
    return true;
  }

  if (isDepartmentGroups) {
    handleDepartmentGroups(items);
    return true;
  }

  if (isAccountRelated) {
    handleAccountSettings(items);
    return true;
  }

  return false;
}

/**
 * Add section breadcrumb for admin dashboard
 */
function addSectionBreadcrumb(items, section) {
  const sectionMapping = findMapping(sectionMappings, section);

  if (sectionMapping) {
    items.push({
      ...sectionMapping,
      current: true,
    });
  } else {
    items.push({
      label: section.charAt(0).toUpperCase() + section.slice(1).replace(/[^\s\w-]/g, ''),
      current: true,
    });
  }
}

/**
 * Add current page breadcrumb
 */
function addCurrentPageBreadcrumb(items, currentPage, mapping, section) {
  const isAdminDashboard = currentPage === '/admin-dashboard' || currentPage === '/pages/admin-dashboard';

  if (isAdminDashboard && section) {
    addSectionBreadcrumb(items, section);
    return;
  }

  items.push({
    ...mapping,
    current: true,
  });
}

/**
 * Add fallback breadcrumb for unmapped pages
 */
function addFallbackBreadcrumb(items, currentPage) {
  const pageName = currentPage
    .split('/')
    .pop()
    .replace(/-/g, ' ')
    .replace(/[^\s0-9A-Za-z]/g, '');

  items.push({
    label: pageName.charAt(0).toUpperCase() + pageName.slice(1),
    current: true,
  });
}

/**
 * Check if current page is a root page
 */
function isRootPage(currentPage) {
  return currentPage === '/' || currentPage === '/index' || currentPage === '';
}

// Main function
function generateBreadcrumbsFromURL() {
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section');
  const items = [];

  addHomeBreadcrumb(items);

  const currentPage = path.replace(/\.html$/, '');

  if (isRootPage(currentPage)) {
    return items;
  }

  const mapping = findMapping(urlMappings, currentPage);

  if (!mapping) {
    addFallbackBreadcrumb(items, currentPage);
    return items;
  }

  const handledBySpecial = processSpecialHandlers(items, currentPage);

  if (!handledBySpecial) {
    processSpecialCases(items, currentPage);
  }

  addCurrentPageBreadcrumb(items, currentPage, mapping, section);

  return items;
}

// Hauptfunktion zum Initialisieren der Breadcrumbs
export function initBreadcrumb(customItems = null, customConfig = {}) {
  // Styles einfügen
  injectStyles();

  // Konfiguration zusammenführen
  const config = { ...defaultConfig, ...customConfig };

  // Items bestimmen (custom oder auto-generated)
  const items = customItems || generateBreadcrumbsFromURL();

  // Container finden
  const container = document.querySelector(config.container);
  if (!container) {
    console.warn(`Breadcrumb container '${config.container}' nicht gefunden`);
    return;
  }

  // DOM sicher generieren und einfügen
  const breadcrumbElement = generateBreadcrumbDOM(items, config);
  container.innerHTML = '';
  container.append(breadcrumbElement);

  // Event für debugging
  console.info('Breadcrumb initialisiert:', items);
}

// Auto-Init wenn DOM geladen
document.addEventListener('DOMContentLoaded', () => {
  // Nur auto-init wenn Container existiert und leer ist
  const container = document.querySelector(defaultConfig.container);

  if (container && container.innerHTML.trim() === '') {
    initBreadcrumb();
  }
});

// Für direkten Import
export default initBreadcrumb;
