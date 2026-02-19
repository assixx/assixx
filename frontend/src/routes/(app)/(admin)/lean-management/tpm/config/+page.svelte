<script lang="ts">
  /**
   * TPM Config Page
   * @module lean-management/tpm/config/+page
   *
   * Tab-based layout with 3 sections:
   * 1. ColorConfig — status color customization
   * 2. EscalationConfig — escalation thresholds
   * 3. TemplateManager — card template CRUD
   */
  import { resolve } from '$app/paths';

  import { MESSAGES } from '../_lib/constants';

  import ColorConfig from './_lib/ColorConfig.svelte';
  import EscalationConfig from './_lib/EscalationConfig.svelte';
  import TemplateManager from './_lib/TemplateManager.svelte';

  import type { PageData } from './$types';

  // ===========================================================================
  // SSR DATA
  // ===========================================================================

  const { data }: { data: PageData } = $props();

  // ===========================================================================
  // TAB STATE
  // ===========================================================================

  type ConfigTab = 'colors' | 'escalation' | 'templates';

  const TABS: { key: ConfigTab; label: string; icon: string }[] = [
    { key: 'colors', label: MESSAGES.CONFIG_TAB_COLORS, icon: 'fa-palette' },
    {
      key: 'escalation',
      label: MESSAGES.CONFIG_TAB_ESCALATION,
      icon: 'fa-exclamation-triangle',
    },
    { key: 'templates', label: MESSAGES.CONFIG_TAB_TEMPLATES, icon: 'fa-copy' },
  ];

  let activeTab = $state<ConfigTab>('colors');

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }
</script>

<svelte:head>
  <title>{MESSAGES.CONFIG_PAGE_TITLE}</title>
</svelte:head>

<div class="container">
  <!-- Header -->
  <div class="mb-6">
    <a
      href={resolvePath('/lean-management/tpm')}
      class="mb-3 inline-flex items-center gap-2 text-sm text-(--color-text-muted) no-underline hover:text-(--color-primary)"
    >
      <i class="fas fa-arrow-left"></i>
      {MESSAGES.BTN_BACK_TO_OVERVIEW}
    </a>
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
      {:else if activeTab === 'escalation'}
        <EscalationConfig escalation={data.escalation} />
      {:else if activeTab === 'templates'}
        <TemplateManager templates={data.templates} />
      {/if}
    </div>
  </div>
</div>
