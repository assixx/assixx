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
  '/pages/index': { label: 'Home', icon: 'fa-home' },
  '/admin-dashboard': { label: ADMIN_DASHBOARD_LABEL, icon: ICON_TACHOMETER },
  '/pages/admin-dashboard': { label: ADMIN_DASHBOARD_LABEL, icon: ICON_TACHOMETER },
  '/employee-dashboard': { label: MITARBEITER_DASHBOARD_LABEL, icon: ICON_USER },
  '/pages/employee-dashboard': { label: MITARBEITER_DASHBOARD_LABEL, icon: ICON_USER },
  '/manage-users': { label: BENUTZER_VERWALTEN_LABEL, icon: ICON_USERS },
  '/pages/manage-users': { label: BENUTZER_VERWALTEN_LABEL, icon: ICON_USERS },
  '/manage-admins': { label: ADMINS_VERWALTEN_LABEL, icon: ICON_USER_SHIELD },
  '/pages/manage-admins': { label: ADMINS_VERWALTEN_LABEL, icon: ICON_USER_SHIELD },
  '/admin-config': { label: KONFIGURATION_LABEL, icon: ICON_COG },
  '/pages/admin-config': { label: KONFIGURATION_LABEL, icon: ICON_COG },
  '/survey-admin': { label: UMFRAGEN_LABEL, icon: ICON_POLL },
  '/pages/survey-admin': { label: UMFRAGEN_LABEL, icon: ICON_POLL },
  '/survey-create': { label: UMFRAGE_ERSTELLEN_LABEL, icon: ICON_PLUS_CIRCLE },
  '/pages/survey-create': { label: UMFRAGE_ERSTELLEN_LABEL, icon: ICON_PLUS_CIRCLE },
  '/survey-results': { label: UMFRAGE_ERGEBNISSE_LABEL, icon: ICON_CHART_BAR },
  '/pages/survey-results': { label: UMFRAGE_ERGEBNISSE_LABEL, icon: ICON_CHART_BAR },
  '/documents': { label: DOKUMENTE_LABEL, icon: ICON_FILE_ALT },
  '/pages/documents': { label: DOKUMENTE_LABEL, icon: ICON_FILE_ALT },
  '/blackboard': { label: SCHWARZES_BRETT_LABEL, icon: ICON_CLIPBOARD },
  '/pages/blackboard': { label: SCHWARZES_BRETT_LABEL, icon: ICON_CLIPBOARD },
  '/chat': { label: 'Chat', icon: ICON_COMMENTS },
  '/pages/chat': { label: 'Chat', icon: ICON_COMMENTS },
  '/calendar': { label: 'Kalender', icon: ICON_CALENDAR_ALT },
  '/pages/calendar': { label: 'Kalender', icon: ICON_CALENDAR_ALT },
  '/shifts': { label: 'Schichtplan', icon: ICON_CLOCK },
  '/pages/shifts': { label: 'Schichtplan', icon: ICON_CLOCK },
  '/profile': { label: 'Profil', icon: ICON_USER_CIRCLE },
  '/pages/profile': { label: 'Profil', icon: ICON_USER_CIRCLE },
  '/settings': { label: 'Einstellungen', icon: ICON_SLIDERS },
  '/pages/settings': { label: 'Einstellungen', icon: ICON_SLIDERS },
  '/kvp': { label: 'KVP', icon: ICON_LIGHTBULB },
  '/pages/kvp': { label: 'KVP', icon: ICON_LIGHTBULB },
  '/kvp-admin': { label: 'KVP Verwaltung', icon: ICON_TASKS },
  '/pages/kvp-admin': { label: 'KVP Verwaltung', icon: ICON_TASKS },
  '/manage-root-users': { label: 'Root User Verwaltung', icon: ICON_USER_LOCK },
  '/pages/manage-root-users': { label: 'Root User Verwaltung', icon: ICON_USER_LOCK },
  '/root-dashboard': { label: 'Root Dashboard', icon: ICON_SHIELD_ALT },
  '/pages/root-dashboard': { label: 'Root Dashboard', icon: ICON_SHIELD_ALT },
  '/root-features': { label: 'Root Features', icon: ICON_TOOLS },
  '/pages/root-features': { label: 'Root Features', icon: ICON_TOOLS },
  '/tenant-deletion-status': { label: 'Tenant Löschstatus', icon: ICON_TRASH_ALT },
  '/pages/tenant-deletion-status': { label: 'Tenant Löschstatus', icon: ICON_TRASH_ALT },
  '/feature-management': { label: 'Feature Management', icon: ICON_TOGGLE_ON },
  '/pages/feature-management': { label: 'Feature Management', icon: ICON_TOGGLE_ON },
  '/org-management': { label: 'Organisation Verwaltung', icon: ICON_BUILDING },
  '/pages/org-management': { label: 'Organisation Verwaltung', icon: ICON_BUILDING },
  '/manage-departments': { label: 'Abteilungen verwalten', icon: ICON_SITEMAP },
  '/pages/manage-departments': { label: 'Abteilungen verwalten', icon: ICON_SITEMAP },
  '/manage-areas': { label: 'Bereiche verwalten', icon: ICON_BUILDING },
  '/pages/manage-areas': { label: 'Bereiche verwalten', icon: ICON_BUILDING },
  '/manage-teams': { label: 'Teams verwalten', icon: ICON_USERS },
  '/pages/manage-teams': { label: 'Teams verwalten', icon: ICON_USERS },
  '/manage-machines': { label: 'Maschinen verwalten', icon: ICON_INDUSTRY },
  '/pages/manage-machines': { label: 'Maschinen verwalten', icon: ICON_INDUSTRY },
  '/manage-department-groups': { label: 'Abteilungsgruppen', icon: ICON_LAYER_GROUP },
  '/pages/manage-department-groups': { label: 'Abteilungsgruppen', icon: ICON_LAYER_GROUP },
  '/archived-employees': { label: 'Archivierte Mitarbeiter', icon: ICON_ARCHIVE },
  '/pages/archived-employees': { label: 'Archivierte Mitarbeiter', icon: ICON_ARCHIVE },
  '/account-settings': { label: 'Konto-Einstellungen', icon: ICON_USER_COG },
  '/pages/account-settings': { label: 'Konto-Einstellungen', icon: ICON_USER_COG },
  '/storage-upgrade': { label: 'Speicher-Upgrade', icon: ICON_HDD },
  '/pages/storage-upgrade': { label: 'Speicher-Upgrade', icon: ICON_HDD },
  '/survey-details': { label: 'Umfrage-Details', icon: ICON_INFO_CIRCLE },
  '/pages/survey-details': { label: 'Umfrage-Details', icon: ICON_INFO_CIRCLE },
  '/survey-employee': { label: 'Mitarbeiter-Umfrage', icon: ICON_POLL_H },
  '/pages/survey-employee': { label: 'Mitarbeiter-Umfrage', icon: ICON_POLL_H },
  '/kvp-detail': { label: 'KVP-Details', icon: ICON_INFO_CIRCLE },
  '/pages/kvp-detail': { label: 'KVP-Details', icon: ICON_INFO_CIRCLE },
  '/documents-search': { label: 'Dokumente durchsuchen', icon: ICON_SEARCH },
  '/pages/documents-search': { label: 'Dokumente durchsuchen', icon: ICON_SEARCH },
  '/documents-personal': { label: 'Persönliche Dokumente', icon: ICON_USER_CIRCLE },
  '/pages/documents-personal': { label: 'Persönliche Dokumente', icon: ICON_USER_CIRCLE },
  '/documents-company': { label: 'Firmendokumente', icon: 'fa-building' },
  '/pages/documents-company': { label: 'Firmendokumente', icon: 'fa-building' },
  '/documents-department': { label: 'Abteilungsdokumente', icon: 'fa-sitemap' },
  '/pages/documents-department': { label: 'Abteilungsdokumente', icon: 'fa-sitemap' },
  '/documents-team': { label: 'Team-Dokumente', icon: ICON_USERS },
  '/pages/documents-team': { label: 'Team-Dokumente', icon: ICON_USERS },
  '/documents-payroll': { label: 'Gehaltsabrechnungen', icon: 'fa-money-check' },
  '/pages/documents-payroll': { label: 'Gehaltsabrechnungen', icon: 'fa-money-check' },
  '/employee-documents': { label: 'Mitarbeiter-Dokumente', icon: ICON_FILE_ALT },
  '/pages/employee-documents': { label: 'Mitarbeiter-Dokumente', icon: ICON_FILE_ALT },
  '/admin-profile': { label: 'Admin-Profil', icon: 'fa-user-shield' },
  '/pages/admin-profile': { label: 'Admin-Profil', icon: 'fa-user-shield' },
  '/employee-profile': { label: 'Mitarbeiter-Profil', icon: 'fa-user' },
  '/pages/employee-profile': { label: 'Mitarbeiter-Profil', icon: 'fa-user' },
  '/root-profile': { label: 'Root-Profil', icon: 'fa-user-lock' },
  '/pages/root-profile': { label: 'Root-Profil', icon: 'fa-user-lock' },
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
// STYLE INJECTION
// ============================================================================

export function injectStyles() {
  // Prüfen ob Styles bereits eingefügt wurden
  if (document.querySelector('#breadcrumb-styles')) {
    return;
  }

  const styles = `
    <style id="breadcrumb-styles">
      #breadcrumb-container,
      .breadcrumb-container {
        margin-bottom: 24px;
        padding: 0;
      }

      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        /*backdrop-filter: blur(20px) saturate(180%);*/
        border-radius: 12px;
        /*box-shadow: 0 0px 4px rgba(33,150,243,.3),inset 0 1px 0 hsla(0,0%,100%,.2);*/
        color: #fff;
        font-size: 14px;
        padding: 6px 20px;
      }

      .breadcrumb-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .breadcrumb-link {
        color: var(--text-secondary);
        text-decoration: none;
        /*  */
        padding: 4px 8px;
        border-radius: var(--radius-md);
      }

      .breadcrumb-link:hover {
        color: var(--primary-color);
        background: rgba(33, 150, 243, 0.1);
      }

      .breadcrumb-separator {
        color: rgba(255, 255, 255, 0.3);
        font-size: 12px;
      }

      .breadcrumb-current {
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-weight: 600;
        padding: 4px 8px;
      }

      .breadcrumb-icon {
        font-size: 14px;
        margin-right: 3px;
      }

      /* Mobile Anpassungen */
      @media (max-width: 768px) {
        .breadcrumb {
          font-size: 12px;
          padding: 4px 12px;
          gap: 4px;
        }



        .breadcrumb-link {
          padding: 2px 6px;
        }

        /* Verstecke mittlere Items auf sehr kleinen Bildschirmen */
        @media (max-width: 480px) {
          .breadcrumb-item:not(:first-child):not(:last-child):not(:nth-last-child(2)) {
            display: none;
          }
        }
      }
    </style>
  `;

  document.head.insertAdjacentHTML('beforeend', styles);
}

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

// Breadcrumb DOM sicher generieren
export function generateBreadcrumbDOM(items, config) {
  const nav = document.createElement('nav');
  nav.className = 'breadcrumb';

  items.forEach((item, index) => {
    const breadcrumbItem = document.createElement('div');
    breadcrumbItem.className = 'breadcrumb-item';

    if (item.current) {
      // Aktuelle Seite (nicht klickbar)
      const span = document.createElement('span');
      span.className = 'breadcrumb-current';

      if (config.showIcons && item.icon) {
        const icon = document.createElement('i');
        icon.className = `fas ${escapeHtml(item.icon)} breadcrumb-icon`;
        span.append(icon);
        span.append(document.createTextNode(' '));
      }
      span.append(document.createTextNode(item.label));
      breadcrumbItem.append(span);
    } else {
      // Klickbarer Link
      const link = document.createElement('a');
      link.href = item.href || '#';
      link.className = 'breadcrumb-link';

      if (config.showIcons && item.icon) {
        const icon = document.createElement('i');
        icon.className = `fas ${escapeHtml(item.icon)} breadcrumb-icon`;
        link.append(icon);
        link.append(document.createTextNode(' '));
      }
      link.append(document.createTextNode(item.label));
      breadcrumbItem.append(link);
    }

    nav.append(breadcrumbItem);

    // Separator (nicht nach dem letzten Item)
    if (index < items.length - 1) {
      const separator = document.createElement('div');
      separator.className = 'breadcrumb-separator';
      const sepIcon = document.createElement('i');
      sepIcon.className = `fas ${escapeHtml(config.separator)}`;
      separator.append(sepIcon);
      nav.append(separator);
    }
  });

  return nav;
}
