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
  if (document.getElementById('breadcrumb-styles')) {
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
        -webkit-backdrop-filter: blur(20px) saturate(180%);
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
        transition: all 0.3s ease;
        padding: 4px 8px;
        border-radius: 6px;
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
        border-radius: 6px;
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

// Breadcrumb HTML generieren
function generateBreadcrumbHTML(items, config) {
  let html = '<nav class="breadcrumb">';

  items.forEach((item, index) => {
    html += '<div class="breadcrumb-item">';

    if (item.current) {
      // Aktuelle Seite (nicht klickbar)
      html += '<span class="breadcrumb-current">';
      if (config.showIcons && item.icon) {
        html += `<i class="fas ${item.icon} breadcrumb-icon"></i> `;
      }
      html += item.label;
      html += '</span>';
    } else {
      // Klickbarer Link
      html += `<a href="${item.href || '#'}" class="breadcrumb-link">`;
      if (config.showIcons && item.icon) {
        html += `<i class="fas ${item.icon} breadcrumb-icon"></i> `;
      }
      html += item.label;
      html += '</a>';
    }

    html += '</div>';

    // Separator (nicht nach dem letzten Item)
    if (index < items.length - 1) {
      html += `<div class="breadcrumb-separator">
        <i class="fas ${config.separator}"></i>
      </div>`;
    }
  });

  html += '</nav>';
  return html;
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
          // Fallback für unbekannte Sections
          items.push({
            label: section.charAt(0).toUpperCase() + section.slice(1),
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
      // Fallback für nicht gemappte Seiten
      const pageName = currentPage.split('/').pop().replace(/-/g, ' ');
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

  // HTML generieren und einfügen
  const html = generateBreadcrumbHTML(items, config);
  container.innerHTML = html;

  // Event für debugging
  console.log('Breadcrumb initialisiert:', items);
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
