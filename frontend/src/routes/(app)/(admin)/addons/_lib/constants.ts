/**
 * Addon Management Page — Constants
 * @module addons/_lib/constants
 */

/** FontAwesome icon class per addon code — must cover all 23 addons */
export const ADDON_ICONS: Record<string, string> = {
  dashboard: 'fas fa-tachometer-alt',
  employees: 'fas fa-users',
  departments: 'fas fa-sitemap',
  teams: 'fas fa-user-friends',
  settings: 'fas fa-cog',
  notifications: 'fas fa-bell',
  documents: 'fas fa-folder-open',
  blackboard: 'fas fa-chalkboard',
  chat: 'fas fa-comments',
  surveys: 'fas fa-poll',
  calendar: 'fas fa-calendar-alt',
  shift_planning: 'fas fa-clock',
  kvp: 'fas fa-lightbulb',
  vacation: 'fas fa-umbrella-beach',
  tpm: 'fas fa-tools',
  work_orders: 'fas fa-clipboard-list',
  assets: 'fas fa-industry',
  reports: 'fas fa-chart-line',
  audit_trail: 'fas fa-history',
  dummy_users: 'fas fa-user-slash',
  manage_hierarchy: 'fas fa-sitemap',
  approvals: 'fas fa-check-double',
  user_profiles: 'fas fa-id-card',
  halls: 'fas fa-warehouse',
};

/** Status badge configuration: label (German), CSS class, icon */
export const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  core_always_active: {
    label: 'Kern-Modul',
    badgeClass: 'badge--primary',
    icon: 'fas fa-shield-alt',
  },
  active: {
    label: 'Aktiv',
    badgeClass: 'badge--success',
    icon: 'fas fa-check-circle',
  },
  trial: {
    label: 'Testphase',
    badgeClass: 'badge--warning',
    icon: 'fas fa-hourglass-half',
  },
  expired: {
    label: 'Abgelaufen',
    badgeClass: 'badge--danger',
    icon: 'fas fa-clock',
  },
  cancelled: {
    label: 'Deaktiviert',
    badgeClass: 'badge--secondary',
    icon: 'fas fa-times-circle',
  },
  not_activated: {
    label: 'Verfügbar',
    badgeClass: 'badge--secondary',
    icon: 'fas fa-plus-circle',
  },
};
