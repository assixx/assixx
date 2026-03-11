/**
 * Navigation Configuration for App Layout
 * Extracted from +layout.svelte for maintainability
 * @module (app)/_lib/navigation-config
 */
import {
  DEFAULT_HIERARCHY_LABELS,
  type HierarchyLabels,
} from '$lib/types/hierarchy-labels';

// Shared labels to avoid duplication
const LABELS = {
  BLACKBOARD: 'Schwarzes Brett',
  ARCHIVE: 'Archiv',
  FILE_EXPLORER: 'Datei Explorer',
  KVP_SYSTEM: 'KVP System',
  SURVEYS: 'Umfragen',
} as const;

/** Navigation item type */
export interface NavItem {
  id: string;
  icon?: string;
  label: string;
  url?: string;
  submenu?: NavItem[];
  /** Badge type for real-time notification count */
  badgeType?:
    | 'surveys'
    | 'documents'
    | 'kvp'
    | 'chat'
    | 'blackboard'
    | 'calendar'
    | 'vacation'
    | 'tpm'
    | 'workOrders';
  /** Tenant feature code — items with this field are hidden when feature is not active */
  addonCode?: string;
}

export const ICONS: Record<string, string> = {
  home: '<i class="fas fa-home"></i>',
  pin: '<i class="fas fa-thumbtack"></i>',
  users: '<i class="fas fa-users"></i>',
  team: '<i class="fas fa-user-friends"></i>',
  generator: '<i class="fas fa-cogs"></i>',
  document: '<i class="fas fa-file-alt"></i>',
  calendar: '<i class="fas fa-calendar-alt"></i>',
  lean: '<i class="fas fa-chart-line"></i>',
  'clipboard-check': '<i class="fas fa-clipboard-check"></i>',
  clock: '<i class="fas fa-clock"></i>',
  vacation: '<i class="fas fa-umbrella-beach"></i>',
  chat: '<i class="fas fa-comments"></i>',
  settings: '<i class="fas fa-cog"></i>',
  user: '<i class="fas fa-user"></i>',
  'user-shield': '<i class="fas fa-user-shield"></i>',
  admin: '<i class="fas fa-user-tie"></i>',
  sitemap: '<i class="fas fa-sitemap"></i>',
  building: '<i class="fas fa-building"></i>',
  feature: '<i class="fas fa-puzzle-piece"></i>',
  logs: '<i class="fas fa-list-alt"></i>',
  desktop: '<i class="fas fa-desktop"></i>',
  warehouse: '<i class="fas fa-warehouse"></i>',
};

/** Shared blackboard submenu (root + admin) */
const BLACKBOARD_SUBMENU: NavItem[] = [
  {
    id: 'blackboard-main',
    label: LABELS.BLACKBOARD,
    url: '/blackboard',
    badgeType: 'blackboard',
  },
  {
    id: 'blackboard-archive',
    label: LABELS.ARCHIVE,
    url: '/blackboard/archived',
  },
];

/** Shared documents submenu (all roles) */
const DOCUMENTS_SUBMENU: NavItem[] = [
  {
    id: 'documents-explorer',
    label: LABELS.FILE_EXPLORER,
    url: '/documents-explorer',
    badgeType: 'documents',
  },
];

/** TPM submenu for root/admin */
const TPM_ADMIN_SUBMENU: NavItem[] = [
  {
    id: 'tpm-overview',
    label: 'Übersicht',
    url: '/lean-management/tpm',
    badgeType: 'tpm',
  },
  {
    id: 'tpm-config',
    label: 'Konfiguration',
    url: '/lean-management/tpm/config',
  },
];

/** Work orders submenu for root/admin */
const WORK_ORDERS_ADMIN_SUBMENU: NavItem[] = [
  {
    id: 'work-orders-my',
    label: 'Meine Arbeitsaufträge',
    url: '/work-orders',
    badgeType: 'workOrders',
  },
  {
    id: 'work-orders-admin',
    label: 'Verwaltung',
    url: '/work-orders/admin',
  },
];

/** KVP + Surveys + TPM submenu for root/admin (includes category management) */
const LEAN_ADMIN_SUBMENU: NavItem[] = [
  {
    id: 'kvp',
    label: LABELS.KVP_SYSTEM,
    addonCode: 'kvp',
    submenu: [
      {
        id: 'kvp-main',
        label: 'Vorschläge',
        url: '/kvp',
        badgeType: 'kvp',
      },
      {
        id: 'kvp-categories',
        label: 'Konfiguration',
        url: '/kvp-categories',
      },
    ],
  },
  {
    id: 'surveys',
    label: LABELS.SURVEYS,
    url: '/survey-admin',
    badgeType: 'surveys',
    addonCode: 'surveys',
  },
  {
    id: 'tpm',
    label: 'TPM Wartung',
    addonCode: 'tpm',
    submenu: TPM_ADMIN_SUBMENU,
  },
];

/** Vacation submenu for admin (requests + rules + entitlements + overview) */
const VACATION_ADMIN_SUBMENU: NavItem[] = [
  {
    id: 'vacation-overview',
    label: 'Übersicht',
    url: '/vacation/overview',
  },
  {
    id: 'vacation-requests',
    label: 'Anträge',
    url: '/vacation',
    badgeType: 'vacation',
  },
  {
    id: 'vacation-rules',
    label: 'Regeln & Einstellungen',
    url: '/vacation/rules',
  },
  {
    id: 'vacation-entitlements',
    label: 'Urlaubsansprüche',
    url: '/vacation/entitlements',
  },
];

/** Vacation submenu for root (admin items + holidays) */
const VACATION_ROOT_SUBMENU: NavItem[] = [
  {
    id: 'vacation-overview',
    label: 'Übersicht',
    url: '/vacation/overview',
  },
  {
    id: 'vacation-requests',
    label: 'Anträge',
    url: '/vacation',
    badgeType: 'vacation',
  },
  {
    id: 'vacation-rules',
    label: 'Regeln & Einstellungen',
    url: '/vacation/rules',
  },
  {
    id: 'vacation-entitlements',
    label: 'Urlaubsansprüche',
    url: '/vacation/entitlements',
  },
  {
    id: 'vacation-holidays',
    label: 'Feiertage',
    url: '/vacation/holidays',
  },
];

/** Admins submenu (root view) */
const ADMINS_SUBMENU: NavItem[] = [
  { id: 'admins-list', label: 'Administratoren', url: '/manage-admins' },
  {
    id: 'dummy-users',
    icon: ICONS.desktop,
    label: 'Dummy-Benutzer',
    url: '/manage-dummies',
  },
];

/** Organigram submenu (root only) */
const ORGANIGRAM_SUBMENU: NavItem[] = [
  { id: 'organigram-chart', label: 'Übersicht', url: '/settings/organigram' },
  {
    id: 'organigram-positions',
    label: 'Positionen',
    url: '/settings/organigram/positions',
  },
];

/** System settings submenu (root only) */
const SYSTEM_SUBMENU: NavItem[] = [
  { id: 'company', label: 'Firmendaten', url: '/settings/company' },
  { id: 'design', label: 'Design', url: '/settings/design' },
  {
    id: 'organigram',
    label: 'Organigramm',
    submenu: ORGANIGRAM_SUBMENU,
  },
  {
    id: 'account-settings',
    label: 'Kontoeinstellungen',
    url: '/account-settings',
  },
];

/** Static root menu items that don't depend on hierarchy labels */
const ROOT_STATIC_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    icon: ICONS.home,
    label: 'Root Dashboard',
    url: '/root-dashboard',
  },
  {
    id: 'blackboard',
    icon: ICONS.pin,
    label: LABELS.BLACKBOARD,
    addonCode: 'blackboard',
    submenu: BLACKBOARD_SUBMENU,
  },
  {
    id: 'root-users',
    icon: ICONS['user-shield'],
    label: 'Root User',
    url: '/manage-root',
  },
  {
    id: 'admins',
    icon: ICONS.admin,
    label: 'Administratoren',
    submenu: ADMINS_SUBMENU,
  },
];

/** Static root menu items after dynamic labels */
const ROOT_STATIC_BOTTOM: NavItem[] = [
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    badgeType: 'calendar',
    addonCode: 'calendar',
  },
  {
    id: 'vacation',
    icon: ICONS.vacation,
    label: 'Urlaub',
    addonCode: 'vacation',
    submenu: VACATION_ROOT_SUBMENU,
  },
  {
    id: 'documents',
    icon: ICONS.document,
    label: 'Dokumente',
    addonCode: 'documents',
    submenu: DOCUMENTS_SUBMENU,
  },
  {
    id: 'lean-management',
    icon: ICONS.lean,
    label: 'LEAN-Management',
    submenu: LEAN_ADMIN_SUBMENU,
  },
  {
    id: 'work-orders',
    icon: ICONS['clipboard-check'],
    label: 'Arbeitsaufträge',
    addonCode: 'work_orders',
    submenu: WORK_ORDERS_ADMIN_SUBMENU,
  },
  {
    id: 'chat',
    icon: ICONS.chat,
    label: 'Chat',
    url: '/chat',
    badgeType: 'chat',
    addonCode: 'chat',
  },
  { id: 'addons', icon: ICONS.feature, label: 'Module', url: '/addons' },
  { id: 'logs', icon: ICONS.logs, label: 'System-Logs', url: '/logs' },
  {
    id: 'profile',
    icon: ICONS.user,
    label: 'Mein Profil',
    url: '/root-profile',
  },
  {
    id: 'system',
    icon: ICONS.settings,
    label: 'System',
    submenu: SYSTEM_SUBMENU,
  },
];

function buildRootMenuItems(labels: HierarchyLabels): NavItem[] {
  return [
    ...ROOT_STATIC_ITEMS,
    {
      id: 'areas',
      icon: ICONS.sitemap,
      label: labels.area,
      url: '/manage-areas',
    },
    {
      id: 'departments',
      icon: ICONS.building,
      label: labels.department,
      url: '/manage-departments',
    },
    { id: 'teams', icon: ICONS.team, label: labels.team, url: '/manage-teams' },
    {
      id: 'halls',
      icon: ICONS.warehouse,
      label: labels.hall,
      url: '/manage-halls',
    },
    ...ROOT_STATIC_BOTTOM,
  ];
}

/** Employees submenu (admin view) */
const EMPLOYEES_SUBMENU: NavItem[] = [
  { id: 'employees-list', label: 'Mitarbeiter', url: '/manage-employees' },
  {
    id: 'dummy-users',
    icon: ICONS.desktop,
    label: 'Dummy-Benutzer',
    url: '/manage-dummies',
  },
];

/** Admin settings submenu */
const ADMIN_SETTINGS_SUBMENU: NavItem[] = [
  { id: 'design', label: 'Design', url: '/settings/design' },
];

/** Static admin menu items that don't depend on hierarchy labels */
const ADMIN_STATIC_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    icon: ICONS.home,
    label: 'Übersicht',
    url: '/admin-dashboard',
  },
  {
    id: 'blackboard',
    icon: ICONS.pin,
    label: LABELS.BLACKBOARD,
    addonCode: 'blackboard',
    submenu: BLACKBOARD_SUBMENU,
  },
  {
    id: 'employees',
    icon: ICONS.users,
    label: 'Mitarbeiter',
    submenu: EMPLOYEES_SUBMENU,
  },
];

/** Static admin menu items after dynamic labels */
const ADMIN_STATIC_BOTTOM: NavItem[] = [
  {
    id: 'documents',
    icon: ICONS.document,
    label: 'Dokumente',
    addonCode: 'documents',
    submenu: DOCUMENTS_SUBMENU,
  },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    badgeType: 'calendar',
    addonCode: 'calendar',
  },
  {
    id: 'vacation',
    icon: ICONS.vacation,
    label: 'Urlaub',
    addonCode: 'vacation',
    submenu: VACATION_ADMIN_SUBMENU,
  },
  {
    id: 'lean-management',
    icon: ICONS.lean,
    label: 'LEAN-Management',
    submenu: LEAN_ADMIN_SUBMENU,
  },
  {
    id: 'work-orders',
    icon: ICONS['clipboard-check'],
    label: 'Arbeitsaufträge',
    addonCode: 'work_orders',
    submenu: WORK_ORDERS_ADMIN_SUBMENU,
  },
  {
    id: 'shifts',
    icon: ICONS.clock,
    label: 'Schichtplanung',
    url: '/shifts',
    addonCode: 'shift_planning',
  },
  {
    id: 'chat',
    icon: ICONS.chat,
    label: 'Chat',
    url: '/chat',
    badgeType: 'chat',
    addonCode: 'chat',
  },
  {
    id: 'settings',
    icon: ICONS.settings,
    label: 'Einstellungen',
    submenu: ADMIN_SETTINGS_SUBMENU,
  },
  {
    id: 'profile',
    icon: ICONS.user,
    label: 'Mein Profil',
    url: '/admin-profile',
  },
];

function buildAdminMenuItems(labels: HierarchyLabels): NavItem[] {
  return [
    ...ADMIN_STATIC_ITEMS,
    {
      id: 'assets',
      icon: ICONS.generator,
      label: labels.asset,
      url: '/manage-assets',
    },
    {
      id: 'halls',
      icon: ICONS.warehouse,
      label: labels.hall,
      url: '/manage-halls',
    },
    ...ADMIN_STATIC_BOTTOM,
  ];
}

const employeeMenuItems: NavItem[] = [
  {
    id: 'dashboard',
    icon: ICONS.home,
    label: 'Dashboard',
    url: '/employee-dashboard',
  },
  {
    id: 'blackboard',
    icon: ICONS.pin,
    label: LABELS.BLACKBOARD,
    url: '/blackboard',
    badgeType: 'blackboard',
    addonCode: 'blackboard',
  },
  {
    id: 'documents',
    icon: ICONS.document,
    label: 'Dokumente',
    addonCode: 'documents',
    submenu: DOCUMENTS_SUBMENU,
  },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    badgeType: 'calendar',
    addonCode: 'calendar',
  },
  {
    id: 'vacation',
    icon: ICONS.vacation,
    label: 'Urlaub',
    url: '/vacation',
    badgeType: 'vacation',
    addonCode: 'vacation',
  },
  {
    id: 'lean-management',
    icon: ICONS.lean,
    label: 'LEAN-Management',
    submenu: [
      {
        id: 'kvp',
        label: LABELS.KVP_SYSTEM,
        url: '/kvp',
        badgeType: 'kvp',
        addonCode: 'kvp',
      },
      {
        id: 'surveys',
        label: LABELS.SURVEYS,
        url: '/survey-employee',
        badgeType: 'surveys',
        addonCode: 'surveys',
      },
      {
        id: 'tpm',
        label: 'TPM Wartung',
        url: '/lean-management/tpm/overview',
        badgeType: 'tpm',
        addonCode: 'tpm',
      },
    ],
  },
  {
    id: 'work-orders',
    icon: ICONS['clipboard-check'],
    label: 'Arbeitsaufträge',
    url: '/work-orders',
    badgeType: 'workOrders',
    addonCode: 'work_orders',
  },
  {
    id: 'chat',
    icon: ICONS.chat,
    label: 'Chat',
    url: '/chat',
    badgeType: 'chat',
    addonCode: 'chat',
  },
  {
    id: 'shifts',
    icon: ICONS.clock,
    label: 'Schichtplanung',
    url: '/shifts',
    addonCode: 'shift_planning',
  },
  {
    id: 'settings',
    icon: ICONS.settings,
    label: 'Einstellungen',
    submenu: [
      {
        id: 'design',
        label: 'Design',
        url: '/settings/design',
      },
    ],
  },
  {
    id: 'profile',
    icon: ICONS.user,
    label: 'Mein Profil',
    url: '/employee-profile',
  },
];

const dummyMenuItems: NavItem[] = [
  {
    id: 'blackboard',
    icon: ICONS.pin,
    label: LABELS.BLACKBOARD,
    url: '/blackboard',
    addonCode: 'blackboard',
  },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    addonCode: 'calendar',
  },
  {
    id: 'lean-management',
    icon: ICONS.lean,
    label: 'LEAN-Management',
    submenu: [
      {
        id: 'tpm',
        label: 'TPM Wartung',
        url: '/lean-management/tpm/overview',
        addonCode: 'tpm',
      },
    ],
  },
];

/**
 * Get menu items for a specific role with tenant-specific hierarchy labels.
 * Labels are used for dynamic sidebar entries (areas, departments, teams, assets).
 */
export function getMenuItemsForRole(
  role: 'root' | 'admin' | 'employee' | 'dummy',
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): NavItem[] {
  switch (role) {
    case 'root':
      return buildRootMenuItems(labels);
    case 'admin':
      return buildAdminMenuItems(labels);
    case 'employee':
      return employeeMenuItems;
    case 'dummy':
      return dummyMenuItems;
  }
}

/**
 * Filter menu items based on user access level.
 * Removes items requiring has_full_access (e.g. KVP category management).
 * Root users always pass. Recursive for nested submenus.
 */
export function filterMenuByAccess(
  items: NavItem[],
  hasFullAccess: boolean,
): NavItem[] {
  if (hasFullAccess) return items;

  return items.reduce<NavItem[]>((acc, item) => {
    if (item.id === 'kvp-categories') return acc;

    if (item.submenu !== undefined) {
      const filtered = filterMenuByAccess(item.submenu, hasFullAccess);
      if (filtered.length > 0 || item.url !== undefined) {
        acc.push({ ...item, submenu: filtered });
      }
      return acc;
    }

    acc.push(item);
    return acc;
  }, []);
}

/**
 * Filter menu items based on tenant addon activation.
 * Items without addonCode always pass through (core addons like dashboard, profile, settings).
 * Recursive for nested submenus — removes empty parent containers (e.g., LEAN-Management
 * disappears when both kvp and surveys are disabled).
 */
export function filterMenuByAddons(
  items: NavItem[],
  activeAddons: ReadonlySet<string>,
): NavItem[] {
  return items.reduce<NavItem[]>((acc, item) => {
    // Item has addonCode and addon is NOT active → skip entirely
    if (item.addonCode !== undefined && !activeAddons.has(item.addonCode)) {
      return acc;
    }

    // Recurse into submenus
    if (item.submenu !== undefined) {
      const filtered = filterMenuByAddons(item.submenu, activeAddons);
      // Keep parent only if it has remaining children OR its own URL
      if (filtered.length > 0 || item.url !== undefined) {
        acc.push({ ...item, submenu: filtered });
      }
      return acc;
    }

    acc.push(item);
    return acc;
  }, []);
}
