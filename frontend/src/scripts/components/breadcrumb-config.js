/**
 * Breadcrumb Configuration and Utilities
 * Contains all constants, mappings, styles and DOM utilities for breadcrumb component
 */

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

// Standard-Konfiguration
export const defaultConfig = {
  container: '#breadcrumb-container',
  separator: 'fa-chevron-right',
  showIcons: true,
  homeLabel: 'Home',
  homeIcon: 'fa-home',
  homeHref: '/', // Will be dynamically updated based on user role
};

// Dashboard Label Constants
export const ADMIN_DASHBOARD_LABEL = 'Admin Dashboard';
export const MITARBEITER_DASHBOARD_LABEL = 'Mitarbeiter Dashboard';

// Label Constants
export const BENUTZER_VERWALTEN_LABEL = 'Benutzer verwalten';
export const ADMINS_VERWALTEN_LABEL = 'Admins verwalten';
export const KONFIGURATION_LABEL = 'Konfiguration';
export const UMFRAGEN_LABEL = 'Umfragen';
export const UMFRAGE_ERSTELLEN_LABEL = 'Umfrage erstellen';
export const UMFRAGE_ERGEBNISSE_LABEL = 'Umfrage-Ergebnisse';
export const DOKUMENTE_LABEL = 'Dokumente';
export const SCHWARZES_BRETT_LABEL = 'Schwarzes Brett';

// URL Constants
export const ADMIN_DASHBOARD_URL = '/admin-dashboard';

// Icon Constants
export const ICON_TACHOMETER = 'fa-tachometer-alt';
export const ICON_USER = 'fa-user';
export const ICON_USERS = 'fa-users';
export const ICON_USER_SHIELD = 'fa-user-shield';
export const ICON_COG = 'fa-cog';
export const ICON_POLL = 'fa-poll';
export const ICON_PLUS_CIRCLE = 'fa-plus-circle';
export const ICON_CHART_BAR = 'fa-chart-bar';
export const ICON_FILE_ALT = 'fa-file-alt';
export const ICON_CLIPBOARD = 'fa-clipboard';
export const ICON_COMMENTS = 'fa-comments';
export const ICON_CALENDAR_ALT = 'fa-calendar-alt';
export const ICON_CLOCK = 'fa-clock';
export const ICON_USER_CIRCLE = 'fa-user-circle';
export const ICON_SLIDERS = 'fa-sliders-h';
export const ICON_LIGHTBULB = 'fa-lightbulb';
export const ICON_TASKS = 'fa-tasks';
export const ICON_USER_LOCK = 'fa-user-lock';
export const ICON_SHIELD_ALT = 'fa-shield-alt';
export const ICON_TOOLS = 'fa-tools';
export const ICON_TRASH_ALT = 'fa-trash-alt';
export const ICON_BUILDING = 'fa-building';
export const ICON_SITEMAP = 'fa-sitemap';
export const ICON_INDUSTRY = 'fa-industry';
export const ICON_LAYER_GROUP = 'fa-layer-group';
export const ICON_ARCHIVE = 'fa-archive';
export const ICON_USER_COG = 'fa-user-cog';
export const ICON_HDD = 'fa-hdd';
export const ICON_INFO_CIRCLE = 'fa-info-circle';
export const ICON_POLL_H = 'fa-poll-h';
export const ICON_SEARCH = 'fa-search';
export const ICON_TOGGLE_ON = 'fa-toggle-on';

// ============================================================================
// URL MAPPINGS
// ============================================================================

export const urlMappings = {
  '/': { label: 'Home', icon: 'fa-home' },
  '/admin-dashboard': { label: ADMIN_DASHBOARD_LABEL, icon: ICON_TACHOMETER },
  '/employee-dashboard': { label: MITARBEITER_DASHBOARD_LABEL, icon: ICON_USER },
  '/manage-users': { label: BENUTZER_VERWALTEN_LABEL, icon: ICON_USERS },
  '/manage-admins': { label: ADMINS_VERWALTEN_LABEL, icon: ICON_USER_SHIELD },
  '/manage-employees': { label: 'Mitarbeiter verwalten', icon: ICON_USERS },
  '/admin-config': { label: KONFIGURATION_LABEL, icon: ICON_COG },
  '/survey-admin': { label: UMFRAGEN_LABEL, icon: ICON_POLL },
  '/survey-create': { label: UMFRAGE_ERSTELLEN_LABEL, icon: ICON_PLUS_CIRCLE },
  '/survey-results': { label: UMFRAGE_ERGEBNISSE_LABEL, icon: ICON_CHART_BAR },
  '/documents': { label: DOKUMENTE_LABEL, icon: ICON_FILE_ALT },
  '/blackboard': { label: SCHWARZES_BRETT_LABEL, icon: ICON_CLIPBOARD },
  '/blackboard-detail': { label: 'Schwarzes Brett Details', icon: ICON_INFO_CIRCLE },
  '/chat': { label: 'Chat', icon: ICON_COMMENTS },
  '/calendar': { label: 'Kalender', icon: ICON_CALENDAR_ALT },
  '/shifts': { label: 'Schichtplan', icon: ICON_CLOCK },
  '/settings': { label: 'Einstellungen', icon: ICON_SLIDERS },
  '/kvp': { label: 'KVP', icon: ICON_LIGHTBULB },
  '/kvp-admin': { label: 'KVP Verwaltung', icon: ICON_TASKS },
  '/manage-root': { label: 'Root User Verwaltung', icon: ICON_USER_LOCK },
  '/root-dashboard': { label: 'Root Dashboard', icon: ICON_SHIELD_ALT },
  '/root-features': { label: 'Root Features', icon: ICON_TOOLS },
  '/tenant-deletion-status': { label: 'Tenant Löschstatus', icon: ICON_TRASH_ALT },
  '/feature-management': { label: 'Feature Management', icon: ICON_TOGGLE_ON },
  '/org-management': { label: 'Organisation Verwaltung', icon: ICON_BUILDING },
  '/manage-departments': { label: 'Abteilungen verwalten', icon: ICON_SITEMAP },
  '/manage-areas': { label: 'Bereiche verwalten', icon: ICON_BUILDING },
  '/manage-teams': { label: 'Teams verwalten', icon: ICON_USERS },
  '/manage-machines': { label: 'Maschinen verwalten', icon: ICON_INDUSTRY },
  // NOTE: /manage-department-groups REMOVED - deprecated, use Areas
  '/archived-employees': { label: 'Archivierte Mitarbeiter', icon: ICON_ARCHIVE },
  '/account-settings': { label: 'Konto-Einstellungen', icon: ICON_USER_COG },
  '/storage-upgrade': { label: 'Speicher-Upgrade', icon: ICON_HDD },
  '/survey-details': { label: 'Umfrage-Details', icon: ICON_INFO_CIRCLE },
  '/survey-employee': { label: 'Mitarbeiter-Umfrage', icon: ICON_POLL_H },
  '/kvp-detail': { label: 'KVP-Details', icon: ICON_INFO_CIRCLE },
  '/documents-explorer': { label: 'Dokumente', icon: ICON_FILE_ALT },
  '/employee-documents': { label: 'Mitarbeiter-Dokumente', icon: ICON_FILE_ALT },
  '/admin-profile': { label: 'Admin-Profil', icon: 'fa-user-shield' },
  '/employee-profile': { label: 'Mitarbeiter-Profil', icon: 'fa-user' },
  '/root-profile': { label: 'Root-Profil', icon: 'fa-user-lock' },
  '/logs': { label: 'Logs', icon: 'fa-list-alt' },
};

// Section Mappings für Admin Dashboard
export const sectionMappings = {
  dashboard: { label: 'Übersicht', icon: ICON_TACHOMETER },
  'dashboard-section': { label: 'Übersicht', icon: ICON_TACHOMETER },
  employees: { label: 'Mitarbeiter', icon: ICON_USERS },
  'employees-section': { label: 'Mitarbeiter', icon: ICON_USERS },
  storage: { label: 'Speicherplatz', icon: 'fa-hdd' },
  'storage-section': { label: 'Speicherplatz', icon: 'fa-hdd' },
  activities: { label: 'Aktivitäten', icon: 'fa-history' },
  'activities-section': { label: 'Aktivitäten', icon: 'fa-history' },
  config: { label: KONFIGURATION_LABEL, icon: ICON_COG },
  'config-section': { label: KONFIGURATION_LABEL, icon: ICON_COG },
  blackboard: { label: SCHWARZES_BRETT_LABEL, icon: ICON_CLIPBOARD },
  'blackboard-section': { label: SCHWARZES_BRETT_LABEL, icon: ICON_CLIPBOARD },
  documents: { label: DOKUMENTE_LABEL, icon: ICON_FILE_ALT },
  'documents-section': { label: DOKUMENTE_LABEL, icon: ICON_FILE_ALT },
  teams: { label: 'Teams', icon: 'fa-users-cog' },
  'teams-section': { label: 'Teams', icon: 'fa-users-cog' },
  settings: { label: 'Einstellungen', icon: 'fa-sliders-h' },
  'settings-section': { label: 'Einstellungen', icon: 'fa-sliders-h' },
};

// ============================================================================
// STYLE INJECTION - REMOVED
// ============================================================================
// Styles are now handled by Design System: design-system/primitives/navigation/breadcrumb.css
// No inline style injection needed - keeping this comment for migration history

// ============================================================================
// DOM UTILITIES
// ============================================================================

// HTML-Entities escapen
export function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Breadcrumb DOM sicher generieren (BEM Notation)
 *
 * Output structure:
 * <nav class="breadcrumb">
 *   <a href="/" class="breadcrumb__item">
 *     <i class="fas fa-home breadcrumb__icon"></i> Home
 *   </a>
 *   <span class="breadcrumb__separator"><i class="fas fa-chevron-right"></i></span>
 *   <span class="breadcrumb__item breadcrumb__item--active">
 *     <i class="fas fa-users breadcrumb__icon"></i> Users
 *   </span>
 * </nav>
 */
export function generateBreadcrumbDOM(items, config) {
  const nav = document.createElement('nav');
  nav.className = 'breadcrumb';
  nav.setAttribute('aria-label', 'Breadcrumb');

  items.forEach((item, index) => {
    if (item.current) {
      // Aktuelle Seite (nicht klickbar)
      const span = document.createElement('span');
      span.className = 'breadcrumb__item breadcrumb__item--active';
      span.setAttribute('aria-current', 'page');

      if (config.showIcons && item.icon) {
        const icon = document.createElement('i');
        icon.className = `fas ${escapeHtml(item.icon)} breadcrumb__icon`;
        icon.setAttribute('aria-hidden', 'true');
        span.append(icon);
        span.append(document.createTextNode(' '));
      }
      span.append(document.createTextNode(item.label));
      nav.append(span);
    } else {
      // Klickbarer Link
      const link = document.createElement('a');
      link.href = item.href || '#';
      link.className = 'breadcrumb__item';

      if (config.showIcons && item.icon) {
        const icon = document.createElement('i');
        icon.className = `fas ${escapeHtml(item.icon)} breadcrumb__icon`;
        icon.setAttribute('aria-hidden', 'true');
        link.append(icon);
        link.append(document.createTextNode(' '));
      }
      link.append(document.createTextNode(item.label));
      nav.append(link);
    }

    // Separator (nicht nach dem letzten Item)
    if (index < items.length - 1) {
      const separator = document.createElement('span');
      separator.className = 'breadcrumb__separator';
      separator.setAttribute('aria-hidden', 'true');
      const sepIcon = document.createElement('i');
      sepIcon.className = `fas ${escapeHtml(config.separator)}`;
      separator.append(sepIcon);
      nav.append(separator);
    }
  });

  return nav;
}
