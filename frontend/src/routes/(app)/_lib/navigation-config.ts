/**
 * Navigation Configuration for App Layout
 * Extracted from +layout.svelte for maintainability
 * @module (app)/_lib/navigation-config
 */

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
    | 'calendar';
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

/** KVP + Surveys submenu for root/admin (includes category management) */
const LEAN_ADMIN_SUBMENU: NavItem[] = [
  {
    id: 'kvp',
    label: LABELS.KVP_SYSTEM,
    submenu: [
      {
        id: 'kvp-main',
        label: 'Vorschläge',
        url: '/kvp',
        badgeType: 'kvp',
      },
      {
        id: 'kvp-categories',
        label: 'Definitionen',
        url: '/kvp-categories',
      },
    ],
  },
  {
    id: 'surveys',
    label: LABELS.SURVEYS,
    url: '/survey-admin',
    badgeType: 'surveys',
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

export const rootMenuItems: NavItem[] = [
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
    url: '/manage-admins',
  },
  { id: 'areas', icon: ICONS.sitemap, label: 'Bereiche', url: '/manage-areas' },
  {
    id: 'departments',
    icon: ICONS.building,
    label: 'Abteilungen',
    url: '/manage-departments',
  },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    badgeType: 'calendar',
  },
  {
    id: 'vacation',
    icon: ICONS.vacation,
    label: 'Urlaub',
    submenu: VACATION_ROOT_SUBMENU,
  },
  {
    id: 'documents',
    icon: ICONS.document,
    label: 'Dokumente',
    submenu: DOCUMENTS_SUBMENU,
  },
  {
    id: 'lean-management',
    icon: ICONS.lean,
    label: 'LEAN-Management',
    submenu: LEAN_ADMIN_SUBMENU,
  },
  {
    id: 'chat',
    icon: ICONS.chat,
    label: 'Chat',
    url: '/chat',
    badgeType: 'chat',
  },
  { id: 'features', icon: ICONS.feature, label: 'Features', url: '/features' },
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
    submenu: [
      {
        id: 'design',
        label: 'Design',
        url: '/settings/design',
      },
      {
        id: 'account-settings',
        label: 'Kontoeinstellungen',
        url: '/account-settings',
      },
    ],
  },
];

export const adminMenuItems: NavItem[] = [
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
    submenu: BLACKBOARD_SUBMENU,
  },
  {
    id: 'employees',
    icon: ICONS.users,
    label: 'Mitarbeiter',
    url: '/manage-employees',
  },
  { id: 'teams', icon: ICONS.team, label: 'Teams', url: '/manage-teams' },
  {
    id: 'machines',
    icon: ICONS.generator,
    label: 'Maschinen',
    url: '/manage-machines',
  },
  {
    id: 'documents',
    icon: ICONS.document,
    label: 'Dokumente',
    submenu: DOCUMENTS_SUBMENU,
  },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    badgeType: 'calendar',
  },
  {
    id: 'vacation',
    icon: ICONS.vacation,
    label: 'Urlaub',
    submenu: VACATION_ADMIN_SUBMENU,
  },
  {
    id: 'lean-management',
    icon: ICONS.lean,
    label: 'LEAN-Management',
    submenu: LEAN_ADMIN_SUBMENU,
  },
  { id: 'shifts', icon: ICONS.clock, label: 'Schichtplanung', url: '/shifts' },
  {
    id: 'chat',
    icon: ICONS.chat,
    label: 'Chat',
    url: '/chat',
    badgeType: 'chat',
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
    url: '/admin-profile',
  },
];

export const employeeMenuItems: NavItem[] = [
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
  },
  {
    id: 'documents',
    icon: ICONS.document,
    label: 'Dokumente',
    submenu: DOCUMENTS_SUBMENU,
  },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    badgeType: 'calendar',
  },
  {
    id: 'vacation',
    icon: ICONS.vacation,
    label: 'Urlaub',
    url: '/vacation',
  },
  {
    id: 'lean-management',
    icon: ICONS.lean,
    label: 'LEAN-Management',
    submenu: [
      { id: 'kvp', label: LABELS.KVP_SYSTEM, url: '/kvp', badgeType: 'kvp' },
      {
        id: 'surveys',
        label: LABELS.SURVEYS,
        url: '/survey-employee',
        badgeType: 'surveys',
      },
    ],
  },
  {
    id: 'chat',
    icon: ICONS.chat,
    label: 'Chat',
    url: '/chat',
    badgeType: 'chat',
  },
  { id: 'shifts', icon: ICONS.clock, label: 'Schichtplanung', url: '/shifts' },
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

/**
 * Get menu items for a specific role
 */
export function getMenuItemsForRole(
  role: 'root' | 'admin' | 'employee',
): NavItem[] {
  switch (role) {
    case 'root':
      return rootMenuItems;
    case 'admin':
      return adminMenuItems;
    case 'employee':
      return employeeMenuItems;
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
