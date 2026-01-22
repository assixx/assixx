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
  hasSubmenu?: boolean;
  submenu?: NavItem[];
  /** Badge type for real-time notification count */
  badgeType?: 'surveys' | 'documents' | 'kvp' | 'chat' | 'blackboard' | 'calendar';
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
  chat: '<i class="fas fa-comments"></i>',
  settings: '<i class="fas fa-cog"></i>',
  user: '<i class="fas fa-user"></i>',
  'user-shield': '<i class="fas fa-user-shield"></i>',
  admin: '<i class="fas fa-user-tie"></i>',
  sitemap: '<i class="fas fa-sitemap"></i>',
  building: '<i class="fas fa-building"></i>',
  feature: '<i class="fas fa-puzzle-piece"></i>',
  logs: '<i class="fas fa-list-alt"></i>',
  folder: '<i class="fas fa-folder"></i>',
  lightbulb: '<i class="fas fa-lightbulb"></i>',
  poll: '<i class="fas fa-poll"></i>',
};

export const rootMenuItems: NavItem[] = [
  { id: 'dashboard', icon: ICONS.home, label: 'Root Dashboard', url: '/root-dashboard' },
  {
    id: 'blackboard',
    icon: ICONS.pin,
    label: LABELS.BLACKBOARD,
    hasSubmenu: true,
    submenu: [
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
    ],
  },
  { id: 'root-users', icon: ICONS['user-shield'], label: 'Root User', url: '/manage-root' },
  { id: 'admins', icon: ICONS.admin, label: 'Administratoren', url: '/manage-admins' },
  { id: 'areas', icon: ICONS.sitemap, label: 'Bereiche', url: '/manage-areas' },
  { id: 'departments', icon: ICONS.building, label: 'Abteilungen', url: '/manage-departments' },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    badgeType: 'calendar',
  },
  { id: 'chat', icon: ICONS.chat, label: 'Chat', url: '/chat', badgeType: 'chat' },
  { id: 'features', icon: ICONS.feature, label: 'Features', url: '/features' },
  { id: 'logs', icon: ICONS.logs, label: 'System-Logs', url: '/logs' },
  { id: 'profile', icon: ICONS.user, label: 'Mein Profil', url: '/root-profile' },
  {
    id: 'system',
    icon: ICONS.settings,
    label: 'System',
    hasSubmenu: true,
    submenu: [{ id: 'account-settings', label: 'Kontoeinstellungen', url: '/account-settings' }],
  },
];

export const adminMenuItems: NavItem[] = [
  { id: 'dashboard', icon: ICONS.home, label: 'Übersicht', url: '/admin-dashboard' },
  {
    id: 'blackboard',
    icon: ICONS.pin,
    label: LABELS.BLACKBOARD,
    hasSubmenu: true,
    submenu: [
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
    ],
  },
  { id: 'employees', icon: ICONS.users, label: 'Mitarbeiter', url: '/manage-employees' },
  { id: 'teams', icon: ICONS.team, label: 'Teams', url: '/manage-teams' },
  { id: 'machines', icon: ICONS.generator, label: 'Maschinen', url: '/manage-machines' },
  {
    id: 'documents',
    icon: ICONS.document,
    label: 'Dokumente',
    hasSubmenu: true,
    submenu: [
      {
        id: 'documents-explorer',
        label: LABELS.FILE_EXPLORER,
        url: '/documents-explorer',
        badgeType: 'documents',
      },
    ],
  },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    badgeType: 'calendar',
  },
  {
    id: 'lean-management',
    icon: ICONS.lean,
    label: 'LEAN-Management',
    hasSubmenu: true,
    submenu: [
      { id: 'kvp', label: LABELS.KVP_SYSTEM, url: '/kvp', badgeType: 'kvp' },
      { id: 'surveys', label: LABELS.SURVEYS, url: '/survey-admin', badgeType: 'surveys' },
    ],
  },
  { id: 'shifts', icon: ICONS.clock, label: 'Schichtplanung', url: '/shifts' },
  { id: 'chat', icon: ICONS.chat, label: 'Chat', url: '/chat', badgeType: 'chat' },
  { id: 'settings', icon: ICONS.settings, label: 'Einstellungen', url: '#settings' },
  { id: 'profile', icon: ICONS.user, label: 'Mein Profil', url: '/admin-profile' },
];

export const employeeMenuItems: NavItem[] = [
  { id: 'dashboard', icon: ICONS.home, label: 'Dashboard', url: '/employee-dashboard' },
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
    hasSubmenu: true,
    submenu: [
      {
        id: 'documents-explorer',
        label: LABELS.FILE_EXPLORER,
        url: '/documents-explorer',
        badgeType: 'documents',
      },
    ],
  },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    badgeType: 'calendar',
  },
  {
    id: 'lean-management',
    icon: ICONS.lean,
    label: 'LEAN-Management',
    hasSubmenu: true,
    submenu: [
      { id: 'kvp', label: LABELS.KVP_SYSTEM, url: '/kvp', badgeType: 'kvp' },
      { id: 'surveys', label: LABELS.SURVEYS, url: '/survey-employee', badgeType: 'surveys' },
    ],
  },
  { id: 'chat', icon: ICONS.chat, label: 'Chat', url: '/chat', badgeType: 'chat' },
  { id: 'shifts', icon: ICONS.clock, label: 'Schichtplanung', url: '/shifts' },
  { id: 'profile', icon: ICONS.user, label: 'Mein Profil', url: '/employee-profile' },
];

/**
 * Get menu items for a specific role
 */
export function getMenuItemsForRole(role: 'root' | 'admin' | 'employee'): NavItem[] {
  switch (role) {
    case 'root':
      return rootMenuItems;
    case 'admin':
      return adminMenuItems;
    case 'employee':
      return employeeMenuItems;
  }
}
