<script lang="ts">
  import { page } from '$app/stores';

  import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

  import { generateBreadcrumbItems, isFullscreenPage } from './breadcrumb-config';

  // =============================================================================
  // SVELTE 5 RUNES - Breadcrumb Navigation
  // =============================================================================

  interface Props {
    userRole?: 'root' | 'admin' | 'employee' | 'dummy';
    hierarchyLabels?: HierarchyLabels;
  }
  const { userRole = 'employee', hierarchyLabels = DEFAULT_HIERARCHY_LABELS }: Props = $props();

  const isFullscreen = $derived(isFullscreenPage($page.url.pathname));

  const breadcrumbItems = $derived(
    generateBreadcrumbItems($page.url.pathname, userRole, hierarchyLabels, $page.data),
  );
</script>

<!-- Breadcrumb Navigation (BEM from Design System) -->
<!-- Self-hides on fullscreen pages like /chat -->
{#if !isFullscreen}
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
