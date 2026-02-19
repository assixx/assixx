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

<div class="tpm-config">
  <!-- Header -->
  <div class="tpm-config__header">
    <a
      href={resolvePath('/lean-management/tpm')}
      class="tpm-config__back"
    >
      <i class="fas fa-arrow-left"></i>
      {MESSAGES.BTN_BACK_TO_OVERVIEW}
    </a>
    <h1 class="tpm-config__heading">
      <i class="fas fa-cog"></i>
      {MESSAGES.CONFIG_PAGE_HEADING}
    </h1>
    <p class="tpm-config__desc">{MESSAGES.CONFIG_PAGE_DESCRIPTION}</p>
  </div>

  <!-- Tabs -->
  <div
    class="tpm-config__tabs"
    role="tablist"
  >
    {#each TABS as tab (tab.key)}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === tab.key}
        class="tpm-config__tab"
        class:tpm-config__tab--active={activeTab === tab.key}
        onclick={() => {
          activeTab = tab.key;
        }}
      >
        <i class="fas {tab.icon}"></i>
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Tab Content -->
  <div class="tpm-config__content">
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
</div>

<style>
  .tpm-config {
    padding: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .tpm-config__header {
    margin-bottom: 1.5rem;
  }

  .tpm-config__back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-gray-500);
    text-decoration: none;
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
    transition: color 0.15s;
  }

  .tpm-config__back:hover {
    color: var(--color-blue-600);
  }

  .tpm-config__heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-gray-900);
  }

  .tpm-config__desc {
    color: var(--color-gray-500);
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }

  /* Tabs */
  .tpm-config__tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 2px solid var(--color-gray-200);
    margin-bottom: 1.5rem;
  }

  .tpm-config__tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-gray-500);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .tpm-config__tab:hover {
    color: var(--color-gray-700);
  }

  .tpm-config__tab--active {
    color: var(--color-blue-600);
    border-bottom-color: var(--color-blue-600);
    font-weight: 600;
  }

  /* Content card */
  .card {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .card__body {
    padding: 1.5rem;
  }

  /* Responsive */
  @media (width <= 640px) {
    .tpm-config {
      padding: 1rem;
    }

    .tpm-config__tabs {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .tpm-config__tab {
      white-space: nowrap;
      padding: 0.625rem 1rem;
    }
  }
</style>
