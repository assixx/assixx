<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';

  import {
    DEFAULT_HIERARCHY_LABELS,
    type HierarchyLabels,
  } from '$lib/types/hierarchy-labels';

  /**
   * Resolve a dynamic path with base prefix.
   * Casts to pathname type for dynamic runtime paths.
   */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  // =============================================================================
  // SVELTE 5 RUNES - Breadcrumb Navigation
  // 1:1 Copy from frontend/src/scripts/components/breadcrumb.js + breadcrumb-config.js
  // =============================================================================

  // Props
  interface Props {
    userRole?: 'root' | 'admin' | 'employee' | 'dummy';
    hierarchyLabels?: HierarchyLabels;
  }
  const {
    userRole = 'employee',
    hierarchyLabels = DEFAULT_HIERARCHY_LABELS,
  }: Props = $props();

  // Frequently used icon constants
  const ICON_CALENDAR = 'fa-calendar-alt';

  // =============================================================================
  // FULLSCREEN PAGES (no breadcrumb)
  // Pages that use fullscreen layout and don't need breadcrumb navigation
  // =============================================================================

  const fullscreenPages: string[] = ['/chat'];

  /**
   * Check if current page is a fullscreen page (no breadcrumb)
   */
  const isFullscreenPage = $derived(
    fullscreenPages.some((path) => $page.url.pathname.startsWith(path)),
  );

  // =============================================================================
  // URL MAPPINGS (from breadcrumb-config.js)
  // =============================================================================

  const urlMappings = $derived<
    Partial<Record<string, { label: string; icon: string }>>
  >({
    '/': { label: 'Home', icon: 'fa-home' },
    '/root-dashboard': { label: 'Root Dashboard', icon: 'fa-shield-alt' },
    '/admin-dashboard': {
      label: 'Admin Dashboard',
      icon: 'fa-tachometer-alt',
    },
    '/employee-dashboard': {
      label: 'Mitarbeiter Dashboard',
      icon: 'fa-user',
    },
    '/manage-employees': { label: 'Mitarbeiter verwalten', icon: 'fa-users' },
    '/manage-admins': { label: 'Admins verwalten', icon: 'fa-user-shield' },
    '/manage-departments': {
      label: `${hierarchyLabels.department} verwalten`,
      icon: 'fa-sitemap',
    },
    '/manage-areas': {
      label: `${hierarchyLabels.area} verwalten`,
      icon: 'fa-building',
    },
    '/manage-halls': {
      label: `${hierarchyLabels.hall} verwalten`,
      icon: 'fa-warehouse',
    },
    '/manage-teams': {
      label: `${hierarchyLabels.team} verwalten`,
      icon: 'fa-users',
    },
    '/manage-assets': {
      label: `${hierarchyLabels.asset} verwalten`,
      icon: 'fa-cogs',
    },
    '/manage-root': { label: 'Root User Verwaltung', icon: 'fa-shield-alt' },
    '/blackboard': { label: 'Schwarzes Brett', icon: 'fa-clipboard' },
    '/blackboard-detail': {
      label: 'Schwarzes Brett Details',
      icon: 'fa-info-circle',
    },
    '/calendar': { label: 'Kalender', icon: ICON_CALENDAR },
    '/chat': { label: 'Chat', icon: 'fa-comments' },
    '/documents': { label: 'Dokumente', icon: 'fa-file-alt' },
    '/documents-explorer': { label: 'Dokumente', icon: 'fa-file-alt' },
    '/shifts': { label: 'Schichtplan', icon: 'fa-clock' },
    '/kvp': { label: 'KVP', icon: 'fa-lightbulb' },
    '/kvp-categories': { label: 'Definitionen', icon: 'fa-tags' },
    '/kvp-detail': { label: 'KVP-Details', icon: 'fa-info-circle' },
    '/survey-admin': { label: 'Umfragen', icon: 'fa-poll' },
    '/survey-employee': { label: 'Mitarbeiter-Umfrage', icon: 'fa-poll-h' },
    '/survey-results': { label: 'Umfrage-Ergebnisse', icon: 'fa-chart-bar' },
    '/account-settings': {
      label: 'Konto-Einstellungen',
      icon: 'fa-user-cog',
    },
    '/settings/design': { label: 'Design', icon: 'fa-palette' },
    '/storage-upgrade': { label: 'Speicher-Upgrade', icon: 'fa-hdd' },
    '/admin-profile': { label: 'Admin-Profil', icon: 'fa-user-shield' },
    '/employee-profile': { label: 'Mitarbeiter-Profil', icon: 'fa-user' },
    '/root-profile': { label: 'Root-Profil', icon: 'fa-user-lock' },
    '/features': { label: 'Features', icon: 'fas fa-puzzle-piece' },
    '/vacation': { label: 'Urlaubsverwaltung', icon: 'fa-umbrella-beach' },
    '/vacation/rules': { label: 'Urlaubsregeln', icon: 'fa-shield-alt' },
    '/vacation/entitlements': {
      label: 'Urlaubsansprüche',
      icon: 'fa-calculator',
    },
    '/vacation/holidays': { label: 'Feiertage', icon: 'fa-calendar-day' },
    '/vacation/overview': {
      label: 'Urlaubsübersicht',
      icon: ICON_CALENDAR,
    },
    '/logs': { label: 'Logs', icon: 'fa-list-alt' },
    '/lean-management/tpm': { label: 'TPM Wartung', icon: 'fa-tools' },
    '/lean-management/tpm/config': {
      label: 'TPM Konfiguration',
      icon: 'fa-cog',
    },
    '/lean-management/tpm/overview': {
      label: 'TPM Übersicht',
      icon: 'fa-tools',
    },
    '/tenant-deletion-status': {
      label: 'Tenant Löschstatus',
      icon: 'fa-trash-alt',
    },
    '/work-orders': {
      label: 'Meine Arbeitsaufträge',
      icon: 'fa-clipboard-check',
    },
    '/work-orders/admin': {
      label: 'Alle Aufträge',
      icon: 'fa-clipboard-check',
    },
    '/manage-dummies': {
      label: 'Dummy-Benutzer verwalten',
      icon: 'fa-desktop',
    },
    '/settings/organigram': {
      label: 'Organigramm',
      icon: 'fa-sitemap',
    },
    '/settings/company': {
      label: 'Firmendaten',
      icon: 'fa-building',
    },
  });

  /**
   * Dynamic route patterns - for routes with parameters like /blackboard/[uuid]
   * Pattern: regex to match, result: label + icon
   */
  const dynamicRoutes: { pattern: RegExp; label: string; icon: string }[] = [
    {
      pattern: /^\/blackboard\/[^/]+$/,
      label: 'Schwarzes Brett Details',
      icon: 'fa-info-circle',
    },
    { pattern: /^\/kvp\/[^/]+$/, label: 'KVP-Details', icon: 'fa-info-circle' },
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
      icon: 'fa-shield-alt',
    },
    {
      pattern: /^\/manage-admins\/permission\/[^/]+$/,
      label: 'Employee Name Placeholder',
      icon: 'fa-shield-alt',
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
      pattern: /^\/lean-management\/tpm\/locations\/[^/]+$/,
      label: 'Standorte',
      icon: 'fa-map-marker-alt',
    },
    {
      pattern: /^\/work-orders\/[0-9a-f-]+$/,
      label: 'Auftragsdetail',
      icon: 'fa-info-circle',
    },
  ];

  /**
   * Pages that need an intermediate breadcrumb
   * Key: current page path, Value: intermediate breadcrumb to insert
   */
  const intermediateBreadcrumbs: Partial<
    Record<string, { label: string; href: string; icon: string }>
  > = {
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
    '/settings/company': {
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
  };

  /**
   * Dynamic intermediate breadcrumbs - for routes with parameters
   * Pattern: regex to match, result: intermediate breadcrumb to insert
   */
  const dynamicIntermediateBreadcrumbs = $derived<
    { pattern: RegExp; label: string; href: string; icon: string }[]
  >([
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
      label: 'Root User Verwaltung',
      href: '/manage-root',
      icon: 'fa-shield-alt',
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
      pattern: /^\/manage-assets\/availability\/[^/]+$/,
      label: `${hierarchyLabels.asset} verwalten`,
      href: '/manage-assets',
      icon: 'fa-cogs',
    },
    {
      pattern: /^\/lean-management\/tpm\/plan\/[^/]+$/,
      label: 'TPM Wartung',
      href: '/lean-management/tpm',
      icon: 'fa-tools',
    },
    {
      pattern: /^\/lean-management\/tpm\/cards\/[^/]+$/,
      label: 'TPM Wartung',
      href: '/lean-management/tpm',
      icon: 'fa-tools',
    },
    {
      pattern: /^\/lean-management\/tpm\/board\/[^/]+$/,
      label: 'TPM Übersicht',
      href: '/lean-management/tpm/overview',
      icon: 'fa-tools',
    },
    {
      pattern: /^\/lean-management\/tpm\/card\/[^/]+$/,
      label: 'TPM Übersicht',
      href: '/lean-management/tpm/overview',
      icon: 'fa-tools',
    },
    {
      pattern: /^\/lean-management\/tpm\/card\/[^/]+\/history$/,
      label: 'TPM Übersicht',
      href: '/lean-management/tpm/overview',
      icon: 'fa-tools',
    },
    {
      pattern: /^\/lean-management\/tpm\/card\/[^/]+\/defects$/,
      label: 'TPM Übersicht',
      href: '/lean-management/tpm/overview',
      icon: 'fa-tools',
    },
    {
      pattern: /^\/lean-management\/tpm\/locations\/[^/]+$/,
      label: 'TPM Übersicht',
      href: '/lean-management/tpm/overview',
      icon: 'fa-tools',
    },
    {
      pattern: /^\/work-orders\/[0-9a-f-]+$/,
      label: 'Arbeitsaufträge',
      href: '/work-orders',
      icon: 'fa-clipboard-check',
    },
  ]);

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /** Get home URL based on user role */
  function getHomeUrl(): string {
    if (userRole === 'root') return '/root-dashboard';
    if (userRole === 'admin') return '/admin-dashboard';
    if (userRole === 'dummy') return '/blackboard';
    return '/employee-dashboard';
  }

  interface BreadcrumbItem {
    label: string;
    href?: string;
    icon?: string;
    current?: boolean;
  }

  /** Resolve employee name from page data for availability breadcrumb */
  function getEmployeeNameFromPageData(): string {
    const pageData = $page.data as {
      employee?: { firstName?: string; lastName?: string };
    };
    const employee = pageData.employee;
    if (employee?.firstName !== undefined && employee.lastName !== undefined) {
      return `${employee.firstName} ${employee.lastName}`;
    }
    return 'Mitarbeiter';
  }

  /** Resolve asset name from page data for asset availability breadcrumb */
  function getAssetNameFromPageData(): string {
    const pageData = $page.data as {
      asset?: { name?: string };
    };
    const asset = pageData.asset;
    if (asset?.name !== undefined) {
      return asset.name;
    }
    return hierarchyLabels.asset;
  }

  /** Build breadcrumb items for a matched dynamic route */
  function buildDynamicRouteItems(
    dynamicMatch: { pattern: RegExp; label: string; icon: string },
    currentPath: string,
    hasStaticIntermediate: boolean,
    hasDynamicIntermediate: boolean,
  ): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [];

    // Check for intermediate based on base path (e.g., /blackboard-detail)
    const basePath = '/' + currentPath.split('/')[1];
    const baseIntermediate = intermediateBreadcrumbs[basePath + '-detail'];
    if (baseIntermediate && !hasStaticIntermediate && !hasDynamicIntermediate) {
      items.push({
        label: baseIntermediate.label,
        href: resolvePath(baseIntermediate.href),
        icon: baseIntermediate.icon,
      });
    }

    // Special handling for availability routes (employee vs asset)
    const isAvailabilityRoute = currentPath.includes('/availability/');
    const isAssetAvailabilityRoute = currentPath.startsWith(
      '/manage-assets/availability/',
    );

    // Special handling for permission routes (employees, admins, root)
    const isPermissionRoute = currentPath.includes('/permission/');

    if (isAssetAvailabilityRoute) {
      items.push({ label: 'Verfügbarkeit', icon: ICON_CALENDAR });
      items.push({
        label: getAssetNameFromPageData(),
        icon: 'fa-cog',
        current: true,
      });
    } else if (isAvailabilityRoute) {
      items.push({ label: 'Verfügbarkeit', icon: ICON_CALENDAR });
      items.push({
        label: getEmployeeNameFromPageData(),
        icon: 'fa-user',
        current: true,
      });
    } else if (isPermissionRoute) {
      items.push({ label: 'Berechtigungen', icon: 'fa-shield-alt' });
      items.push({
        label: getEmployeeNameFromPageData(),
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
    const label = lastSegment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { label: label || 'Seite', current: true };
  }

  /**
   * Generate breadcrumb items from current URL
   * Structure: Home > [Intermediate] > Current Page
   */
  function generateBreadcrumbItems(): BreadcrumbItem[] {
    const currentPath = $page.url.pathname;
    const items: BreadcrumbItem[] = [];

    // Always add Home first (always a link, never current)
    items.push({
      label: 'Home',
      href: resolvePath(getHomeUrl()),
      icon: 'fa-home',
    });

    // Static intermediate breadcrumb (e.g., Umfragen for survey-results)
    const intermediate = intermediateBreadcrumbs[currentPath];
    if (intermediate) {
      items.push({
        label: intermediate.label,
        href: resolvePath(intermediate.href),
        icon: intermediate.icon,
      });
    }

    // Dynamic intermediate breadcrumb (e.g., Mitarbeiter verwalten for availability/[uuid])
    const dynIntermediate = dynamicIntermediateBreadcrumbs.find((route) =>
      route.pattern.test(currentPath),
    );
    if (dynIntermediate && !intermediate) {
      items.push({
        label: dynIntermediate.label,
        href: resolvePath(dynIntermediate.href),
        icon: dynIntermediate.icon,
      });
    }

    // Current page: static mapping, dynamic route, or fallback
    const mapping = urlMappings[currentPath];
    if (mapping) {
      items.push({ label: mapping.label, icon: mapping.icon, current: true });
    } else {
      const dynamicMatch = dynamicRoutes.find((route) =>
        route.pattern.test(currentPath),
      );
      if (dynamicMatch) {
        items.push(
          ...buildDynamicRouteItems(
            dynamicMatch,
            currentPath,
            intermediate !== undefined,
            dynIntermediate !== undefined,
          ),
        );
      } else {
        items.push(buildFallbackItem(currentPath));
      }
    }

    return items;
  }

  // Reactive breadcrumb items based on current page
  const breadcrumbItems = $derived(generateBreadcrumbItems());
</script>

<!-- Breadcrumb Navigation (BEM from Design System) -->
<!-- Self-hides on fullscreen pages like /chat -->
{#if !isFullscreenPage}
  <nav
    class="breadcrumb"
    aria-label="Breadcrumb"
  >
    {#each breadcrumbItems as item, index (index)}
      {#if item.current}
        <!-- Current page (not clickable) -->
        <span
          class="breadcrumb__item breadcrumb__item--active"
          aria-current="page"
        >
          {#if item.icon}
            <i
              class="fas {item.icon} breadcrumb__icon"
              aria-hidden="true"
            ></i>
          {/if}
          {item.label}
        </span>
      {:else}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- pre-resolved -->
        <a
          href={item.href}
          class="breadcrumb__item"
        >
          {#if item.icon}
            <i
              class="fas {item.icon} breadcrumb__icon"
              aria-hidden="true"
            ></i>
          {/if}
          {item.label}
        </a>
      {/if}

      <!-- Separator (not after last item) -->
      {#if index < breadcrumbItems.length - 1}
        <span
          class="breadcrumb__separator"
          aria-hidden="true"
        >
          <i class="fas fa-chevron-right"></i>
        </span>
      {/if}
    {/each}
  </nav>
{/if}
