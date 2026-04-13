/**
 * Breadcrumb navigation configuration and logic.
 * Extracted from Breadcrumb.svelte for maintainability (svelte/max-lines-per-block).
 * 1:1 logic — no behavioral changes, only closure dependencies became explicit params.
 */
import { resolve } from '$app/paths';

import type { HierarchyLabels } from '$lib/types/hierarchy-labels';

// =============================================================================
// CONSTANTS
// =============================================================================

const ICON_CALENDAR = 'fa-calendar-alt';
const ICON_INFO = 'fa-info-circle';
const ICON_SHIELD = 'fa-shield-alt';
const ICON_TOOLS = 'fa-tools';
const TPM_OVERVIEW_PATH = '/lean-management/tpm/overview';
const TPM_OVERVIEW_LABEL = 'TPM Übersicht';
const TPM_MAINTENANCE_LABEL = 'TPM Wartung';
const TPM_MAINTENANCE_PATH = '/lean-management/tpm';

const FULLSCREEN_PAGES: string[] = ['/chat'];

// =============================================================================
// TYPES
// =============================================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
  current?: boolean;
}

interface RouteMapping {
  label: string;
  icon: string;
}

interface IntermediateCrumb extends RouteMapping {
  href: string;
}

interface DynamicRoute extends RouteMapping {
  pattern: RegExp;
}

interface DynamicIntermediate extends IntermediateCrumb {
  pattern: RegExp;
}

// =============================================================================
// STATIC ROUTE CONFIGS
// =============================================================================

/**
 * Dynamic route patterns — for routes with parameters like /blackboard/[uuid]
 * Pattern: regex to match, result: label + icon
 */
const dynamicRoutes: DynamicRoute[] = [
  {
    pattern: /^\/blackboard\/[^/]+$/,
    label: 'Schwarzes Brett Details',
    icon: ICON_INFO,
  },
  { pattern: /^\/kvp\/[^/]+$/, label: 'KVP-Details', icon: ICON_INFO },
  {
    pattern: /^\/manage-employees\/availability\/[^/]+$/,
    label: 'Employee Name Placeholder',
    icon: ICON_CALENDAR,
  },
  {
    pattern: /^\/manage-admins\/availability\/[^/]+$/,
    label: 'Admin Name Placeholder',
    icon: ICON_CALENDAR,
  },
  {
    pattern: /^\/manage-root\/availability\/[^/]+$/,
    label: 'Root Name Placeholder',
    icon: ICON_CALENDAR,
  },
  {
    pattern: /^\/manage-assets\/availability\/[^/]+$/,
    label: 'Asset Name Placeholder',
    icon: ICON_CALENDAR,
  },
  {
    pattern: /^\/manage-employees\/permission\/[^/]+$/,
    label: 'Employee Name Placeholder',
    icon: ICON_SHIELD,
  },
  {
    pattern: /^\/manage-admins\/permission\/[^/]+$/,
    label: 'Employee Name Placeholder',
    icon: ICON_SHIELD,
  },
  {
    pattern: /^\/lean-management\/tpm\/plan\/[^/]+$/,
    label: 'Wartungsplan',
    icon: 'fa-clipboard-list',
  },
  {
    pattern: /^\/lean-management\/tpm\/cards\/[^/]+$/,
    label: 'Karten',
    icon: 'fa-th',
  },
  {
    pattern: /^\/lean-management\/tpm\/board\/[^/]+$/,
    label: 'Kamishibai Board',
    icon: 'fa-columns',
  },
  {
    pattern: /^\/lean-management\/tpm\/card\/[^/]+$/,
    label: 'Kartendetails',
    icon: 'fa-id-card',
  },
  {
    pattern: /^\/lean-management\/tpm\/card\/[^/]+\/history$/,
    label: 'Wartungsverlauf',
    icon: 'fa-history',
  },
  {
    pattern: /^\/lean-management\/tpm\/card\/[^/]+\/defects$/,
    label: 'Mängelliste',
    icon: 'fa-exclamation-triangle',
  },
  {
    pattern: /^\/lean-management\/tpm\/board\/[^/]+\/defects$/,
    label: 'Gesamtmängelliste',
    icon: 'fa-exclamation-triangle',
  },
  {
    pattern: /^\/lean-management\/tpm\/board\/[^/]+\/defect-chart$/,
    label: 'Mängelgrafik',
    icon: 'fa-chart-line',
  },
  {
    pattern: /^\/lean-management\/tpm\/locations\/[^/]+$/,
    label: 'Standorte',
    icon: 'fa-map-marker-alt',
  },
  {
    pattern: /^\/lean-management\/tpm\/plan\/[^/]+\/revisions$/,
    label: 'Versionshistorie',
    icon: 'fa-history',
  },
  {
    pattern: /^\/work-orders\/[0-9a-f-]+$/,
    label: 'Auftragsdetail',
    icon: ICON_INFO,
  },
  {
    pattern: /^\/user\/[^/]+$/,
    label: 'Benutzerprofil',
    icon: 'fa-id-card',
  },
  {
    pattern: /^\/inventory\/lists\/[^/]+$/,
    label: 'Inventarliste',
    icon: 'fa-list',
  },
  {
    pattern: /^\/inventory\/items\/[^/]+$/,
    label: 'Gegenstand',
    icon: 'fa-cube',
  },
];

/**
 * Pages that need an intermediate breadcrumb.
 * Key: current page path, Value: intermediate breadcrumb to insert.
 */
const intermediateBreadcrumbs: Partial<Record<string, IntermediateCrumb>> = {
  '/survey-results': {
    label: 'Umfragen',
    href: '/survey-admin',
    icon: 'fa-poll',
  },
  '/survey-create': {
    label: 'Umfragen',
    href: '/survey-admin',
    icon: 'fa-poll',
  },
  '/kvp-detail': { label: 'KVP', href: '/kvp', icon: 'fa-lightbulb' },
  '/kvp-categories': { label: 'KVP', href: '/kvp', icon: 'fa-lightbulb' },
  '/settings/design': {
    label: 'Einstellungen',
    href: '/settings/design',
    icon: 'fa-cog',
  },
  '/settings/organigram': {
    label: 'System',
    href: '/root-dashboard',
    icon: 'fa-cog',
  },
  '/settings/organigram/positions': {
    label: 'Organigramm',
    href: '/settings/organigram',
    icon: 'fa-sitemap',
  },
  '/settings/company': {
    label: 'System',
    href: '/root-dashboard',
    icon: 'fa-cog',
  },
  '/settings/company-profile': {
    label: 'System',
    href: '/root-dashboard',
    icon: 'fa-cog',
  },
  '/blackboard-detail': {
    label: 'Schwarzes Brett',
    href: '/blackboard',
    icon: 'fa-clipboard',
  },
  '/work-orders/admin': {
    label: 'Arbeitsaufträge',
    href: '/work-orders',
    icon: 'fa-clipboard-check',
  },
  '/lean-management/tpm/gesamtansicht': {
    label: TPM_OVERVIEW_LABEL,
    href: TPM_OVERVIEW_PATH,
    icon: ICON_TOOLS,
  },
};

/** Static URL mappings (hierarchy-independent) */
const staticUrlMappings: Partial<Record<string, RouteMapping>> = {
  '/': { label: 'Home', icon: 'fa-home' },
  '/root-dashboard': { label: 'Root Dashboard', icon: ICON_SHIELD },
  '/admin-dashboard': { label: 'Admin Dashboard', icon: 'fa-tachometer-alt' },
  '/employee-dashboard': { label: 'Mitarbeiter Dashboard', icon: 'fa-user' },
  '/manage-employees': { label: 'Mitarbeiter verwalten', icon: 'fa-users' },
  '/manage-admins': { label: 'Admins verwalten', icon: 'fa-user-shield' },
  '/manage-root': { label: 'Root User Verwaltung', icon: ICON_SHIELD },
  '/blackboard': { label: 'Schwarzes Brett', icon: 'fa-clipboard' },
  '/blackboard-detail': { label: 'Schwarzes Brett Details', icon: ICON_INFO },
  '/calendar': { label: 'Kalender', icon: ICON_CALENDAR },
  '/chat': { label: 'Chat', icon: 'fa-comments' },
  '/documents': { label: 'Dokumente', icon: 'fa-file-alt' },
  '/documents-explorer': { label: 'Dokumente', icon: 'fa-file-alt' },
  '/shifts': { label: 'Schichtplan', icon: 'fa-clock' },
  '/kvp': { label: 'KVP', icon: 'fa-lightbulb' },
  '/kvp-categories': { label: 'Definitionen', icon: 'fa-tags' },
  '/kvp-detail': { label: 'KVP-Details', icon: ICON_INFO },
  '/survey-admin': { label: 'Umfragen', icon: 'fa-poll' },
  '/survey-employee': { label: 'Mitarbeiter-Umfrage', icon: 'fa-poll-h' },
  '/survey-results': { label: 'Umfrage-Ergebnisse', icon: 'fa-chart-bar' },
  '/account-settings': { label: 'Konto-Einstellungen', icon: 'fa-user-cog' },
  '/settings/design': { label: 'Design', icon: 'fa-palette' },
  '/storage-upgrade': { label: 'Speicher-Upgrade', icon: 'fa-hdd' },
  '/admin-profile': { label: 'Admin-Profil', icon: 'fa-user-shield' },
  '/employee-profile': { label: 'Mitarbeiter-Profil', icon: 'fa-user' },
  '/root-profile': { label: 'Root-Profil', icon: 'fa-user-lock' },
  '/addons': { label: 'Module', icon: 'fas fa-puzzle-piece' },
  '/vacation': { label: 'Urlaubsverwaltung', icon: 'fa-umbrella-beach' },
  '/vacation/rules': { label: 'Urlaubsregeln', icon: ICON_SHIELD },
  '/vacation/entitlements': {
    label: 'Urlaubsansprüche',
    icon: 'fa-calculator',
  },
  '/vacation/holidays': { label: 'Feiertage', icon: 'fa-calendar-day' },
  '/vacation/overview': { label: 'Urlaubsübersicht', icon: ICON_CALENDAR },
  '/logs': { label: 'Logs', icon: 'fa-list-alt' },
  '/lean-management/tpm': { label: TPM_MAINTENANCE_LABEL, icon: ICON_TOOLS },
  '/lean-management/tpm/config': { label: 'TPM Konfiguration', icon: 'fa-cog' },
  '/lean-management/tpm/overview': {
    label: TPM_OVERVIEW_LABEL,
    icon: ICON_TOOLS,
  },
  '/lean-management/tpm/gesamtansicht': {
    label: 'Gesamtansicht',
    icon: 'fa-table',
  },
  '/tenant-deletion-status': {
    label: 'Tenant Löschstatus',
    icon: 'fa-trash-alt',
  },
  '/manage-approvals': {
    label: 'Freigaben verwalten',
    icon: 'fa-check-double',
  },
  '/settings/approvals': {
    label: 'Freigabe-Einstellungen',
    icon: 'fa-check-double',
  },
  '/work-orders': {
    label: 'Meine Arbeitsaufträge',
    icon: 'fa-clipboard-check',
  },
  '/work-orders/admin': { label: 'Alle Aufträge', icon: 'fa-clipboard-check' },
  '/manage-dummies': { label: 'Dummy-Benutzer verwalten', icon: 'fa-desktop' },
  '/inventory': { label: 'Inventar', icon: 'fa-boxes-stacked' },
  '/settings/organigram': { label: 'Organigramm', icon: 'fa-sitemap' },
  '/settings/organigram/positions': {
    label: 'Positionen',
    icon: 'fa-id-badge',
  },
  '/settings/company': { label: 'Addon-Einstellungen', icon: 'fa-sliders-h' },
  '/settings/company-profile': { label: 'Firmenprofil', icon: 'fa-building' },
};

/** Static dynamic intermediates (hierarchy-independent) */
const staticDynamicIntermediates: DynamicIntermediate[] = [
  {
    pattern: /^\/manage-employees\/availability\/[^/]+$/,
    label: 'Mitarbeiter verwalten',
    href: '/manage-employees',
    icon: 'fa-users',
  },
  {
    pattern: /^\/manage-admins\/availability\/[^/]+$/,
    label: 'Admins verwalten',
    href: '/manage-admins',
    icon: 'fa-user-shield',
  },
  {
    pattern: /^\/manage-root\/availability\/[^/]+$/,
    label: 'Root Benutzer Verwaltung',
    href: '/manage-root',
    icon: ICON_SHIELD,
  },
  {
    pattern: /^\/manage-employees\/permission\/[^/]+$/,
    label: 'Mitarbeiter verwalten',
    href: '/manage-employees',
    icon: 'fa-users',
  },
  {
    pattern: /^\/manage-admins\/permission\/[^/]+$/,
    label: 'Admins verwalten',
    href: '/manage-admins',
    icon: 'fa-user-shield',
  },
  {
    pattern: /^\/lean-management\/tpm\/plan\/[^/]+$/,
    label: TPM_MAINTENANCE_LABEL,
    href: TPM_MAINTENANCE_PATH,
    icon: ICON_TOOLS,
  },
  {
    pattern: /^\/lean-management\/tpm\/cards\/[^/]+$/,
    label: TPM_MAINTENANCE_LABEL,
    href: TPM_MAINTENANCE_PATH,
    icon: ICON_TOOLS,
  },
  {
    pattern: /^\/lean-management\/tpm\/plan\/[^/]+\/revisions$/,
    label: TPM_MAINTENANCE_LABEL,
    href: TPM_MAINTENANCE_PATH,
    icon: ICON_TOOLS,
  },
  {
    pattern: /^\/lean-management\/tpm\/board\/[^/]+$/,
    label: TPM_OVERVIEW_LABEL,
    href: TPM_OVERVIEW_PATH,
    icon: ICON_TOOLS,
  },
  {
    pattern: /^\/lean-management\/tpm\/card\/[^/]+$/,
    label: TPM_OVERVIEW_LABEL,
    href: TPM_OVERVIEW_PATH,
    icon: ICON_TOOLS,
  },
  {
    pattern: /^\/lean-management\/tpm\/card\/[^/]+\/history$/,
    label: TPM_OVERVIEW_LABEL,
    href: TPM_OVERVIEW_PATH,
    icon: ICON_TOOLS,
  },
  {
    pattern: /^\/lean-management\/tpm\/card\/[^/]+\/defects$/,
    label: TPM_OVERVIEW_LABEL,
    href: TPM_OVERVIEW_PATH,
    icon: ICON_TOOLS,
  },
  {
    pattern: /^\/lean-management\/tpm\/board\/[^/]+\/defects$/,
    label: TPM_MAINTENANCE_LABEL,
    href: TPM_MAINTENANCE_PATH,
    icon: ICON_TOOLS,
  },
  {
    pattern: /^\/lean-management\/tpm\/board\/[^/]+\/defect-chart$/,
    label: TPM_MAINTENANCE_LABEL,
    href: TPM_MAINTENANCE_PATH,
    icon: ICON_TOOLS,
  },
  {
    pattern: /^\/lean-management\/tpm\/locations\/[^/]+$/,
    label: TPM_OVERVIEW_LABEL,
    href: TPM_OVERVIEW_PATH,
    icon: ICON_TOOLS,
  },
  {
    pattern: /^\/work-orders\/[0-9a-f-]+$/,
    label: 'Arbeitsaufträge',
    href: '/work-orders',
    icon: 'fa-clipboard-check',
  },
  {
    pattern: /^\/inventory\/lists\/[^/]+$/,
    label: 'Inventar',
    href: '/inventory',
    icon: 'fa-boxes-stacked',
  },
  {
    pattern: /^\/inventory\/items\/[^/]+$/,
    label: 'Inventar',
    href: '/inventory',
    icon: 'fa-boxes-stacked',
  },
];

// =============================================================================
// FACTORY FUNCTIONS (merge hierarchy-dependent entries)
// =============================================================================

function buildUrlMappings(labels: HierarchyLabels): Partial<Record<string, RouteMapping>> {
  return {
    ...staticUrlMappings,
    '/manage-departments': {
      label: `${labels.department} verwalten`,
      icon: 'fa-sitemap',
    },
    '/manage-areas': { label: `${labels.area} verwalten`, icon: 'fa-building' },
    '/manage-halls': {
      label: `${labels.hall} verwalten`,
      icon: 'fa-warehouse',
    },
    '/manage-teams': { label: `${labels.team} verwalten`, icon: 'fa-users' },
    '/manage-assets': { label: `${labels.asset} verwalten`, icon: 'fa-cogs' },
    '/my-team': { label: `Meine ${labels.team}`, icon: 'fa-user-friends' },
  };
}

function buildDynamicIntermediateBreadcrumbs(labels: HierarchyLabels): DynamicIntermediate[] {
  return [
    ...staticDynamicIntermediates,
    {
      pattern: /^\/manage-assets\/availability\/[^/]+$/,
      label: `${labels.asset} verwalten`,
      href: '/manage-assets',
      icon: 'fa-cogs',
    },
    {
      pattern: /^\/user\/[^/]+$/,
      label: `Meine ${labels.team}`,
      href: '/my-team',
      icon: 'fa-user-friends',
    },
  ];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getHomeUrl(userRole: string): string {
  if (userRole === 'root') return '/root-dashboard';
  if (userRole === 'admin') return '/admin-dashboard';
  if (userRole === 'dummy') return '/blackboard';
  return '/employee-dashboard';
}

/** Resolve employee name from page data for availability/permission breadcrumb */
function resolveEmployeeName(pageData: Record<string, unknown>): string {
  const data = pageData as {
    employee?: { firstName?: string; lastName?: string };
  };
  const employee = data.employee;
  if (employee?.firstName !== undefined && employee.lastName !== undefined) {
    return `${employee.firstName} ${employee.lastName}`;
  }
  return 'Mitarbeiter';
}

/** Resolve asset name from page data for asset availability breadcrumb */
function resolveAssetName(
  pageData: Record<string, unknown>,
  hierarchyLabels: HierarchyLabels,
): string {
  const data = pageData as {
    asset?: { name?: string };
  };
  const asset = data.asset;
  if (asset?.name !== undefined) {
    return asset.name;
  }
  return hierarchyLabels.asset;
}

/** Build breadcrumb items for a matched dynamic route */
function buildDynamicRouteItems(
  dynamicMatch: DynamicRoute,
  currentPath: string,
  hasStaticIntermediate: boolean,
  hasDynamicIntermediate: boolean,
  pageData: Record<string, unknown>,
  hierarchyLabels: HierarchyLabels,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];

  const basePath = '/' + currentPath.split('/')[1];
  const baseIntermediate = intermediateBreadcrumbs[basePath + '-detail'];
  if (baseIntermediate && !hasStaticIntermediate && !hasDynamicIntermediate) {
    items.push({
      label: baseIntermediate.label,
      href: resolve(baseIntermediate.href),
      icon: baseIntermediate.icon,
    });
  }

  const isAvailabilityRoute = currentPath.includes('/availability/');
  const isAssetAvailabilityRoute = currentPath.startsWith('/manage-assets/availability/');
  const isPermissionRoute = currentPath.includes('/permission/');

  if (isAssetAvailabilityRoute) {
    items.push({ label: 'Verfügbarkeit', icon: ICON_CALENDAR });
    items.push({
      label: resolveAssetName(pageData, hierarchyLabels),
      icon: 'fa-cog',
      current: true,
    });
  } else if (isAvailabilityRoute) {
    items.push({ label: 'Verfügbarkeit', icon: ICON_CALENDAR });
    items.push({
      label: resolveEmployeeName(pageData),
      icon: 'fa-user',
      current: true,
    });
  } else if (isPermissionRoute) {
    items.push({ label: 'Berechtigungen', icon: ICON_SHIELD });
    items.push({
      label: resolveEmployeeName(pageData),
      icon: 'fa-user',
      current: true,
    });
  } else {
    items.push({
      label: dynamicMatch.label,
      icon: dynamicMatch.icon,
      current: true,
    });
  }

  return items;
}

/** Build a fallback breadcrumb from the last URL path segment */
function buildFallbackItem(currentPath: string): BreadcrumbItem {
  const pathSegments = currentPath.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] ?? '';
  const label = lastSegment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: label || 'Seite', current: true };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/** Check if current page is a fullscreen page (no breadcrumb) */
export function isFullscreenPage(pathname: string): boolean {
  return FULLSCREEN_PAGES.some((path) => pathname.startsWith(path));
}

/**
 * Generate breadcrumb items from current URL.
 * Structure: Home > [Intermediate] > Current Page
 */
export function generateBreadcrumbItems(
  currentPath: string,
  userRole: string,
  hierarchyLabels: HierarchyLabels,
  pageData: Record<string, unknown>,
): BreadcrumbItem[] {
  const urlMappings = buildUrlMappings(hierarchyLabels);
  const dynIntermediates = buildDynamicIntermediateBreadcrumbs(hierarchyLabels);
  const items: BreadcrumbItem[] = [];

  items.push({
    label: 'Home',
    href: resolve(getHomeUrl(userRole)),
    icon: 'fa-home',
  });

  const intermediate = intermediateBreadcrumbs[currentPath];
  if (intermediate) {
    items.push({
      label: intermediate.label,
      href: resolve(intermediate.href),
      icon: intermediate.icon,
    });
  }

  const dynIntermediate = dynIntermediates.find((route) => route.pattern.test(currentPath));
  if (dynIntermediate && !intermediate) {
    items.push({
      label: dynIntermediate.label,
      href: resolve(dynIntermediate.href),
      icon: dynIntermediate.icon,
    });
  }

  const mapping = urlMappings[currentPath];
  if (mapping) {
    items.push({ label: mapping.label, icon: mapping.icon, current: true });
  } else {
    const dynamicMatch = dynamicRoutes.find((route) => route.pattern.test(currentPath));
    if (dynamicMatch) {
      items.push(
        ...buildDynamicRouteItems(
          dynamicMatch,
          currentPath,
          intermediate !== undefined,
          dynIntermediate !== undefined,
          pageData,
          hierarchyLabels,
        ),
      );
    } else {
      items.push(buildFallbackItem(currentPath));
    }
  }

  return items;
}
