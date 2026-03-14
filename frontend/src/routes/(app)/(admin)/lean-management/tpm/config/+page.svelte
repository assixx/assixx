<script lang="ts">
  /**
   * TPM Config Page
   * @module lean-management/tpm/config/+page
   *
   * Tab-based layout with 2 sections:
   * 1. ColorConfig — status color customization
   * 2. EscalationConfig — escalation thresholds
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';

  import { MESSAGES } from '../_lib/constants';

  import CategoryColorConfig from './_lib/CategoryColorConfig.svelte';
  import ColorConfig from './_lib/ColorConfig.svelte';
  import EscalationConfig from './_lib/EscalationConfig.svelte';
  import IntervalColorConfig from './_lib/IntervalColorConfig.svelte';

  import type { PageData } from './$types';

  // ===========================================================================
  // SSR DATA
  // ===========================================================================

  const { data }: { data: PageData } = $props();
  const permissionDenied = $derived(data.permissionDenied);

  // ===========================================================================
  // TAB STATE
  // ===========================================================================

  type ConfigTab = 'colors' | 'escalation';

  const TABS: { key: ConfigTab; label: string; icon: string }[] = [
    { key: 'colors', label: MESSAGES.CONFIG_TAB_COLORS, icon: 'fa-palette' },
    {
      key: 'escalation',
      label: MESSAGES.CONFIG_TAB_ESCALATION,
      icon: 'fa-exclamation-triangle',
    },
  ];

  let activeTab = $state<ConfigTab>('colors');
</script>

<svelte:head>
  <title>{MESSAGES.CONFIG_PAGE_TITLE}</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="das TPM-System" />
{:else}
  <div class="container">
    <!-- Header -->
    <div class="mb-6">
      <div class="mb-4">
        <button
          type="button"
          class="btn btn-light"
          onclick={() => {
            void goto(resolve('/lean-management/tpm'));
          }}
        >
          <i class="fas fa-arrow-left mr-2"></i>{MESSAGES.BTN_BACK_TO_OVERVIEW}
        </button>
      </div>
      <h1
        class="flex items-center gap-2 text-2xl font-bold text-(--color-text-primary)"
      >
        <i class="fas fa-cog"></i>
        {MESSAGES.CONFIG_PAGE_HEADING}
      </h1>
      <p class="mt-1 text-sm text-(--color-text-secondary)">
        {MESSAGES.CONFIG_PAGE_DESCRIPTION}
      </p>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <div
        class="tabs__nav"
        role="tablist"
      >
        {#each TABS as tab (tab.key)}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            class="tabs__tab"
            class:tabs__tab--active={activeTab === tab.key}
            onclick={() => {
              activeTab = tab.key;
            }}
          >
            <i class="fas {tab.icon}"></i>
            {tab.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Tab Content -->
    <div class="card">
      <div class="card__body">
        {#if activeTab === 'colors'}
          <ColorConfig colors={data.colors} />
          <hr class="my-8 border-(--color-glass-border)" />
          <IntervalColorConfig
            colors={data.intervalColors}
            statusColors={data.colors}
          />
          <hr class="my-8 border-(--color-glass-border)" />
          <CategoryColorConfig
            categoryColors={data.categoryColors}
            statusColors={data.colors}
          />
        {:else if activeTab === 'escalation'}
          <EscalationConfig escalation={data.escalation} />
        {/if}
      </div>
    </div>
  </div>
{/if}
