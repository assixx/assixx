<script>
  import { page } from '$app/stores';
  import { base } from '$app/paths';

  // =============================================================================
  // SVELTE 5 RUNES - Breadcrumb Navigation
  // 1:1 Copy from frontend/src/scripts/components/breadcrumb.js + breadcrumb-config.js
  // =============================================================================

  // Props
  /** @type {{ userRole?: 'root' | 'admin' | 'employee' }} */
  const { userRole = 'employee' } = $props();

  // =============================================================================
  // FULLSCREEN PAGES (no breadcrumb)
  // Pages that use fullscreen layout and don't need breadcrumb navigation
  // =============================================================================

  /** @type {string[]} */
  const fullscreenPages = ['/chat'];

  /**
   * Check if current page is a fullscreen page (no breadcrumb)
   */
  const isFullscreenPage = $derived(
    fullscreenPages.some((path) => $page.url.pathname.startsWith(path)),
  );

  // =============================================================================
  // URL MAPPINGS (from breadcrumb-config.js)
  // =============================================================================

  /** @type {Record<string, { label: string; icon: string }>} */
  const urlMappings = {
    '/': { label: 'Home', icon: 'fa-home' },
    '/root-dashboard': { label: 'Root Dashboard', icon: 'fa-shield-alt' },
    '/admin-dashboard': { label: 'Admin Dashboard', icon: 'fa-tachometer-alt' },
    '/employee-dashboard': { label: 'Mitarbeiter Dashboard', icon: 'fa-user' },
    '/manage-employees': { label: 'Mitarbeiter verwalten', icon: 'fa-users' },
    '/manage-admins': { label: 'Admins verwalten', icon: 'fa-user-shield' },
    '/manage-departments': { label: 'Abteilungen verwalten', icon: 'fa-sitemap' },
    '/manage-areas': { label: 'Bereiche verwalten', icon: 'fa-building' },
    '/manage-teams': { label: 'Teams verwalten', icon: 'fa-users' },
    '/manage-machines': { label: 'Maschinen verwalten', icon: 'fa-industry' },
    '/manage-root': { label: 'Root User Verwaltung', icon: 'fa-shield-alt' },
    '/blackboard': { label: 'Schwarzes Brett', icon: 'fa-clipboard' },
    '/blackboard-detail': { label: 'Schwarzes Brett Details', icon: 'fa-info-circle' },
    '/calendar': { label: 'Kalender', icon: 'fa-calendar-alt' },
    '/chat': { label: 'Chat', icon: 'fa-comments' },
    '/documents': { label: 'Dokumente', icon: 'fa-file-alt' },
    '/documents-explorer': { label: 'Dokumente', icon: 'fa-file-alt' },
    '/shifts': { label: 'Schichtplan', icon: 'fa-clock' },
    '/kvp': { label: 'KVP', icon: 'fa-lightbulb' },
    '/kvp-detail': { label: 'KVP-Details', icon: 'fa-info-circle' },
    '/survey-admin': { label: 'Umfragen', icon: 'fa-poll' },
    '/survey-employee': { label: 'Mitarbeiter-Umfrage', icon: 'fa-poll-h' },
    '/survey-results': { label: 'Umfrage-Ergebnisse', icon: 'fa-chart-bar' },
    '/account-settings': { label: 'Konto-Einstellungen', icon: 'fa-user-cog' },
    '/storage-upgrade': { label: 'Speicher-Upgrade', icon: 'fa-hdd' },
    '/admin-profile': { label: 'Admin-Profil', icon: 'fa-user-shield' },
    '/employee-profile': { label: 'Mitarbeiter-Profil', icon: 'fa-user' },
    '/root-profile': { label: 'Root-Profil', icon: 'fa-user-lock' },
    '/features': { label: 'Features', icon: 'fa-tools' },
    '/logs': { label: 'Logs', icon: 'fa-list-alt' },
    '/tenant-deletion-status': { label: 'Tenant Löschstatus', icon: 'fa-trash-alt' },
  };

  /**
   * Dynamic route patterns - for routes with parameters like /blackboard/[uuid]
   * Pattern: regex to match, result: label + icon
   * @type {Array<{ pattern: RegExp; label: string; icon: string }>}
   */
  const dynamicRoutes = [
    { pattern: /^\/blackboard\/[^/]+$/, label: 'Schwarzes Brett Details', icon: 'fa-info-circle' },
    { pattern: /^\/kvp\/[^/]+$/, label: 'KVP-Details', icon: 'fa-info-circle' },
  ];

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /** Get home URL based on user role */
  function getHomeUrl() {
    if (userRole === 'root') return '/root-dashboard';
    if (userRole === 'admin') return '/admin-dashboard';
    return '/employee-dashboard';
  }

  /**
   * Generate breadcrumb items from current URL
   * 1:1 like legacy: Home (link) > Current Page (active)
   * @returns {Array<{ label: string; href?: string; icon?: string; current?: boolean }>}
   */
  function generateBreadcrumbItems() {
    const currentPath = $page.url.pathname;
    /** @type {Array<{ label: string; href?: string; icon?: string; current?: boolean }>} */
    const items = [];

    // Always add Home first (always a link, never current)
    items.push({
      label: 'Home',
      href: `${base}${getHomeUrl()}`,
      icon: 'fa-home',
    });

    // Find mapping for current page
    const mapping = urlMappings[currentPath];

    if (mapping) {
      // Add current page from mapping
      items.push({
        label: mapping.label,
        icon: mapping.icon,
        current: true,
      });
    } else {
      // Check dynamic routes (e.g., /blackboard/[uuid])
      const dynamicMatch = dynamicRoutes.find((route) => route.pattern.test(currentPath));

      if (dynamicMatch) {
        items.push({
          label: dynamicMatch.label,
          icon: dynamicMatch.icon,
          current: true,
        });
      } else {
        // Fallback: generate label from path
        const pathSegments = currentPath.split('/').filter(Boolean);
        const lastSegment = pathSegments[pathSegments.length - 1] ?? '';
        const label = lastSegment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        items.push({
          label: label || 'Seite',
          current: true,
        });
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
  <nav class="breadcrumb" aria-label="Breadcrumb">
    {#each breadcrumbItems as item, index (index)}
      {#if item.current}
        <!-- Current page (not clickable) -->
        <span class="breadcrumb__item breadcrumb__item--active" aria-current="page">
          {#if item.icon}
            <i class="fas {item.icon} breadcrumb__icon" aria-hidden="true"></i>
          {/if}
          {item.label}
        </span>
      {:else}
        <!-- Clickable link -->
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href already includes $app/paths base prefix -->
        <a href={item.href} class="breadcrumb__item">
          {#if item.icon}
            <i class="fas {item.icon} breadcrumb__icon" aria-hidden="true"></i>
          {/if}
          {item.label}
        </a>
      {/if}

      <!-- Separator (not after last item) -->
      {#if index < breadcrumbItems.length - 1}
        <span class="breadcrumb__separator" aria-hidden="true">
          <i class="fas fa-chevron-right"></i>
        </span>
      {/if}
    {/each}
  </nav>
{/if}
