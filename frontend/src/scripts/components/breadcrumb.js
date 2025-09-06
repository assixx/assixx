/**
 * Breadcrumb Navigation Component
 * Zentrale Komponente für konsistente Breadcrumb-Navigation
 */

// Breadcrumb Item Interface
// interface BreadcrumbItem {
//   label: string;
//   href?: string;
//   icon?: string;
//   current?: boolean;
// }

// Standard-Konfiguration
const defaultConfig = {
  container: '#breadcrumb-container',
  separator: 'fa-chevron-right',
  showIcons: true,
  homeLabel: 'Home',
  homeIcon: 'fa-home',
  homeHref: '/', // Will be dynamically updated based on user role
};

// URL zu Breadcrumb Mapping
const urlMappings = {
  '/': { label: 'Home', icon: 'fa-home' },
  '/pages/index': { label: 'Home', icon: 'fa-home' },
  '/admin-dashboard': { label: 'Admin Dashboard', icon: 'fa-tachometer-alt' },
  '/pages/admin-dashboard': { label: 'Admin Dashboard', icon: 'fa-tachometer-alt' },
  '/employee-dashboard': { label: 'Mitarbeiter Dashboard', icon: 'fa-user' },
  '/pages/employee-dashboard': { label: 'Mitarbeiter Dashboard', icon: 'fa-user' },
  '/manage-users': { label: 'Benutzer verwalten', icon: 'fa-users' },
  '/pages/manage-users': { label: 'Benutzer verwalten', icon: 'fa-users' },
  '/manage-admins': { label: 'Admins verwalten', icon: 'fa-user-shield' },
  '/pages/manage-admins': { label: 'Admins verwalten', icon: 'fa-user-shield' },
  '/admin-config': { label: 'Konfiguration', icon: 'fa-cog' },
  '/pages/admin-config': { label: 'Konfiguration', icon: 'fa-cog' },
  '/survey-admin': { label: 'Umfragen', icon: 'fa-poll' },
  '/pages/survey-admin': { label: 'Umfragen', icon: 'fa-poll' },
  '/survey-create': { label: 'Umfrage erstellen', icon: 'fa-plus-circle' },
  '/pages/survey-create': { label: 'Umfrage erstellen', icon: 'fa-plus-circle' },
  '/survey-results': { label: 'Umfrage-Ergebnisse', icon: 'fa-chart-bar' },
  '/pages/survey-results': { label: 'Umfrage-Ergebnisse', icon: 'fa-chart-bar' },
  '/documents': { label: 'Dokumente', icon: 'fa-file-alt' },
  '/pages/documents': { label: 'Dokumente', icon: 'fa-file-alt' },
  '/blackboard': { label: 'Schwarzes Brett', icon: 'fa-clipboard' },
  '/pages/blackboard': { label: 'Schwarzes Brett', icon: 'fa-clipboard' },
  '/chat': { label: 'Chat', icon: 'fa-comments' },
  '/pages/chat': { label: 'Chat', icon: 'fa-comments' },
  '/calendar': { label: 'Kalender', icon: 'fa-calendar-alt' },
  '/pages/calendar': { label: 'Kalender', icon: 'fa-calendar-alt' },
  '/shifts': { label: 'Schichtplan', icon: 'fa-clock' },
  '/pages/shifts': { label: 'Schichtplan', icon: 'fa-clock' },
  '/profile': { label: 'Profil', icon: 'fa-user-circle' },
  '/pages/profile': { label: 'Profil', icon: 'fa-user-circle' },
  '/settings': { label: 'Einstellungen', icon: 'fa-sliders-h' },
  '/pages/settings': { label: 'Einstellungen', icon: 'fa-sliders-h' },
  '/kvp': { label: 'KVP', icon: 'fa-lightbulb' },
  '/pages/kvp': { label: 'KVP', icon: 'fa-lightbulb' },
  '/kvp-admin': { label: 'KVP Verwaltung', icon: 'fa-tasks' },
  '/pages/kvp-admin': { label: 'KVP Verwaltung', icon: 'fa-tasks' },
  '/manage-root-users': { label: 'Root User Verwaltung', icon: 'fa-user-lock' },
  '/pages/manage-root-users': { label: 'Root User Verwaltung', icon: 'fa-user-lock' },
  '/root-dashboard': { label: 'Root Dashboard', icon: 'fa-shield-alt' },
  '/pages/root-dashboard': { label: 'Root Dashboard', icon: 'fa-shield-alt' },
  '/root-features': { label: 'Root Features', icon: 'fa-tools' },
  '/pages/root-features': { label: 'Root Features', icon: 'fa-tools' },
  '/tenant-deletion-status': { label: 'Tenant Löschstatus', icon: 'fa-trash-alt' },
  '/pages/tenant-deletion-status': { label: 'Tenant Löschstatus', icon: 'fa-trash-alt' },
  '/feature-management': { label: 'Feature Management', icon: 'fa-toggle-on' },
  '/pages/feature-management': { label: 'Feature Management', icon: 'fa-toggle-on' },
  '/org-management': { label: 'Organisation Verwaltung', icon: 'fa-building' },
  '/pages/org-management': { label: 'Organisation Verwaltung', icon: 'fa-building' },
  '/manage-departments': { label: 'Abteilungen verwalten', icon: 'fa-sitemap' },
  '/pages/manage-departments': { label: 'Abteilungen verwalten', icon: 'fa-sitemap' },
  '/manage-areas': { label: 'Bereiche verwalten', icon: 'fa-building' },
  '/pages/manage-areas': { label: 'Bereiche verwalten', icon: 'fa-building' },
  '/manage-teams': { label: 'Teams verwalten', icon: 'fa-users' },
  '/pages/manage-teams': { label: 'Teams verwalten', icon: 'fa-users' },
  '/manage-machines': { label: 'Maschinen verwalten', icon: 'fa-industry' },
  '/pages/manage-machines': { label: 'Maschinen verwalten', icon: 'fa-industry' },
  '/manage-department-groups': { label: 'Abteilungsgruppen', icon: 'fa-layer-group' },
  '/pages/manage-department-groups': { label: 'Abteilungsgruppen', icon: 'fa-layer-group' },
  '/archived-employees': { label: 'Archivierte Mitarbeiter', icon: 'fa-archive' },
  '/pages/archived-employees': { label: 'Archivierte Mitarbeiter', icon: 'fa-archive' },
  '/account-settings': { label: 'Konto-Einstellungen', icon: 'fa-user-cog' },
  '/pages/account-settings': { label: 'Konto-Einstellungen', icon: 'fa-user-cog' },
  '/storage-upgrade': { label: 'Speicher-Upgrade', icon: 'fa-hdd' },
  '/pages/storage-upgrade': { label: 'Speicher-Upgrade', icon: 'fa-hdd' },
  '/survey-details': { label: 'Umfrage-Details', icon: 'fa-info-circle' },
  '/pages/survey-details': { label: 'Umfrage-Details', icon: 'fa-info-circle' },
  '/survey-employee': { label: 'Mitarbeiter-Umfrage', icon: 'fa-poll-h' },
  '/pages/survey-employee': { label: 'Mitarbeiter-Umfrage', icon: 'fa-poll-h' },
  '/kvp-detail': { label: 'KVP-Details', icon: 'fa-info-circle' },
  '/pages/kvp-detail': { label: 'KVP-Details', icon: 'fa-info-circle' },
  '/documents-search': { label: 'Dokumente durchsuchen', icon: 'fa-search' },
  '/pages/documents-search': { label: 'Dokumente durchsuchen', icon: 'fa-search' },
  '/documents-personal': { label: 'Persönliche Dokumente', icon: 'fa-user-circle' },
  '/pages/documents-personal': { label: 'Persönliche Dokumente', icon: 'fa-user-circle' },
  '/documents-company': { label: 'Firmendokumente', icon: 'fa-building' },
  '/pages/documents-company': { label: 'Firmendokumente', icon: 'fa-building' },
  '/documents-department': { label: 'Abteilungsdokumente', icon: 'fa-sitemap' },
  '/pages/documents-department': { label: 'Abteilungsdokumente', icon: 'fa-sitemap' },
  '/documents-team': { label: 'Team-Dokumente', icon: 'fa-users' },
  '/pages/documents-team': { label: 'Team-Dokumente', icon: 'fa-users' },
  '/documents-payroll': { label: 'Gehaltsabrechnungen', icon: 'fa-money-check' },
  '/pages/documents-payroll': { label: 'Gehaltsabrechnungen', icon: 'fa-money-check' },
  '/employee-documents': { label: 'Mitarbeiter-Dokumente', icon: 'fa-file-alt' },
  '/pages/employee-documents': { label: 'Mitarbeiter-Dokumente', icon: 'fa-file-alt' },
  '/admin-profile': { label: 'Admin-Profil', icon: 'fa-user-shield' },
  '/pages/admin-profile': { label: 'Admin-Profil', icon: 'fa-user-shield' },
  '/employee-profile': { label: 'Mitarbeiter-Profil', icon: 'fa-user' },
  '/pages/employee-profile': { label: 'Mitarbeiter-Profil', icon: 'fa-user' },
  '/root-profile': { label: 'Root-Profil', icon: 'fa-user-lock' },
  '/pages/root-profile': { label: 'Root-Profil', icon: 'fa-user-lock' },
};

// Section Mappings für Admin Dashboard
const sectionMappings = {
  dashboard: { label: 'Übersicht', icon: 'fa-tachometer-alt' },
  'dashboard-section': { label: 'Übersicht', icon: 'fa-tachometer-alt' },
  employees: { label: 'Mitarbeiter', icon: 'fa-users' },
  'employees-section': { label: 'Mitarbeiter', icon: 'fa-users' },
  storage: { label: 'Speicherplatz', icon: 'fa-hdd' },
  'storage-section': { label: 'Speicherplatz', icon: 'fa-hdd' },
  activities: { label: 'Aktivitäten', icon: 'fa-history' },
  'activities-section': { label: 'Aktivitäten', icon: 'fa-history' },
  config: { label: 'Konfiguration', icon: 'fa-cog' },
  'config-section': { label: 'Konfiguration', icon: 'fa-cog' },
  blackboard: { label: 'Schwarzes Brett', icon: 'fa-clipboard' },
  'blackboard-section': { label: 'Schwarzes Brett', icon: 'fa-clipboard' },
  documents: { label: 'Dokumente', icon: 'fa-file-alt' },
  'documents-section': { label: 'Dokumente', icon: 'fa-file-alt' },
  teams: { label: 'Teams', icon: 'fa-users-cog' },
  'teams-section': { label: 'Teams', icon: 'fa-users-cog' },
  settings: { label: 'Einstellungen', icon: 'fa-sliders-h' },
  'settings-section': { label: 'Einstellungen', icon: 'fa-sliders-h' },
};

// CSS einmal einfügen
function injectStyles() {
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
        font-size: 16px;
      }

      /* Mobile Anpassungen */
      @media (max-width: 768px) {
        .breadcrumb {
          font-size: 12px;
          padding: 4px 12px;
          gap: 4px;
        }

        .breadcrumb-icon {
          font-size: 14px;
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

// HTML-Entities escapen
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Breadcrumb DOM sicher generieren
function generateBreadcrumbDOM(items, config) {
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

// Breadcrumbs aus URL generieren
function generateBreadcrumbsFromURL() {
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section');
  const items = [];

  // Determine home URL based on user role
  // Prüfe verschiedene mögliche Speicherorte für die Rolle
  const userRole =
    localStorage.getItem('userRole') ||
    localStorage.getItem('role') ||
    localStorage.getItem('activeRole') ||
    sessionStorage.getItem('userRole') ||
    sessionStorage.getItem('role');

  let homeHref = '/';

  // Rollenbasiertes Dashboard bestimmen
  if (userRole === 'root') {
    homeHref = '/pages/root-dashboard.html';
  } else if (userRole === 'admin') {
    homeHref = '/pages/admin-dashboard.html';
  } else if (userRole === 'employee') {
    homeHref = '/pages/employee-dashboard.html';
  } else {
    // Fallback: Versuche aus der aktuellen URL zu erkennen
    const currentPath = window.location.pathname;
    if (currentPath.includes('root')) {
      homeHref = '/pages/root-dashboard.html';
    } else if (currentPath.includes('admin')) {
      homeHref = '/pages/admin-dashboard.html';
    } else if (currentPath.includes('employee')) {
      homeHref = '/pages/employee-dashboard.html';
    }
  }

  // Home ist immer der erste Eintrag
  items.push({
    label: defaultConfig.homeLabel,
    href: homeHref,
    icon: defaultConfig.homeIcon,
  });

  // Aktuelle Seite ermitteln
  const currentPage = path.replace(/\.html$/, '');

  if (currentPage !== '/' && currentPage !== '/index' && currentPage !== '') {
    const mapping = urlMappings[currentPage];

    if (mapping) {
      // Spezielle Behandlung für Unterseiten
      if (currentPage === '/survey-create' || currentPage === '/survey-results') {
        items.push({
          label: 'Admin Dashboard',
          href: '/admin-dashboard',
          icon: 'fa-tachometer-alt',
        });
        items.push({
          label: 'Umfragen',
          href: '/survey-admin',
          icon: 'fa-poll',
        });
      } else if (
        currentPage === '/manage-users' ||
        currentPage === '/manage-admins' ||
        currentPage === '/admin-config'
      ) {
        items.push({
          label: 'Admin Dashboard',
          href: '/admin-dashboard',
          icon: 'fa-tachometer-alt',
        });
      } else if (
        currentPage === '/manage-root-users' ||
        currentPage === '/pages/manage-root-users' ||
        currentPage === '/root-features' ||
        currentPage === '/pages/root-features' ||
        currentPage === '/tenant-deletion-status' ||
        currentPage === '/pages/tenant-deletion-status' ||
        currentPage === '/feature-management' ||
        currentPage === '/pages/feature-management'
      ) {
        items.push({
          label: 'Root Dashboard',
          href: '/root-dashboard',
          icon: 'fa-shield-alt',
        });
      } else if (
        currentPage === '/documents' ||
        currentPage === '/blackboard' ||
        currentPage === '/chat' ||
        currentPage === '/shifts'
      ) {
        // Prüfen ob Admin oder Employee
        const isAdmin = localStorage.getItem('userRole') === 'admin';
        if (!isAdmin) {
          items.push({
            label: 'Mitarbeiter Dashboard',
            href: '/employee-dashboard',
            icon: 'fa-user',
          });
        }
      } else if (currentPage.includes('/documents-') || currentPage.includes('/employee-documents')) {
        // Dokument-Unterseiten
        items.push({
          label: 'Dokumente',
          href: '/documents',
          icon: 'fa-file-alt',
        });
      } else if (currentPage === '/archived-employees' || currentPage === '/pages/archived-employees') {
        items.push({
          label: 'Admin Dashboard',
          href: '/admin-dashboard',
          icon: 'fa-tachometer-alt',
        });
        items.push({
          label: 'Benutzer verwalten',
          href: '/manage-users',
          icon: 'fa-users',
        });
      } else if (currentPage === '/manage-department-groups' || currentPage === '/pages/manage-department-groups') {
        items.push({
          label: 'Admin Dashboard',
          href: '/admin-dashboard',
          icon: 'fa-tachometer-alt',
        });
        items.push({
          label: 'Abteilungen verwalten',
          href: '/manage-departments',
          icon: 'fa-sitemap',
        });
      } else if (
        currentPage === '/account-settings' ||
        currentPage === '/pages/account-settings' ||
        currentPage === '/storage-upgrade' ||
        currentPage === '/pages/storage-upgrade'
      ) {
        // Diese Seiten können von verschiedenen Dashboards aus erreicht werden
        const currentUserRole = localStorage.getItem('userRole');
        if (currentUserRole === 'root') {
          items.push({
            label: 'Root Dashboard',
            href: '/root-dashboard',
            icon: 'fa-shield-alt',
          });
        } else if (currentUserRole === 'admin') {
          items.push({
            label: 'Admin Dashboard',
            href: '/admin-dashboard',
            icon: 'fa-tachometer-alt',
          });
        } else {
          items.push({
            label: 'Mitarbeiter Dashboard',
            href: '/employee-dashboard',
            icon: 'fa-user',
          });
        }
      }

      // Prüfen ob Section-Parameter vorhanden ist (für Admin Dashboard)
      if ((currentPage === '/admin-dashboard' || currentPage === '/pages/admin-dashboard') && section) {
        // Bei Sections nur Home → Section anzeigen (ohne Admin Dashboard dazwischen)
        const sectionMapping = sectionMappings[section];
        if (sectionMapping) {
          items.push({
            ...sectionMapping,
            current: true,
          });
        } else {
          // Fallback für unbekannte Sections - sicher escapen
          items.push({
            label: section.charAt(0).toUpperCase() + section.slice(1).replace(/[^\s\w\-]/g, ''),
            current: true,
          });
        }
      } else {
        // Normale Seite ohne Section
        items.push({
          ...mapping,
          current: true,
        });
      }
    } else {
      // Fallback für nicht gemappte Seiten - sicher escapen
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
  }

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
