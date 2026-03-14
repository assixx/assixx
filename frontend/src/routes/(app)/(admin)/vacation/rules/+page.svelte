<script lang="ts">
  /**
   * Vacation Rules — Admin Page (Orchestrator)
   * Tabs: Sperrzeiten (Blackouts), Besetzungsregeln (Staffing Rules), Einstellungen (Settings)
   * SSR: Data loaded in +page.server.ts, tab content delegated to child components.
   * Supports ?tab=staffing-rules|blackouts|settings query param for deep-linking.
   */
  import { onDestroy } from 'svelte';

  import { page } from '$app/state';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';

  import BlackoutsTab from './_lib/BlackoutsTab.svelte';
  import { RULES_TABS } from './_lib/constants';
  import SettingsTab from './_lib/SettingsTab.svelte';
  import StaffingRulesTab from './_lib/StaffingRulesTab.svelte';
  import { rulesState } from './_lib/state.svelte';

  import type { PageData } from './$types';
  import type { RulesTab } from './_lib/constants';

  // ==========================================================================
  // SSR DATA
  // ==========================================================================

  const { data }: { data: PageData } = $props();
  const permissionDenied = $derived(data.permissionDenied);
  const labels = $derived(data.hierarchyLabels);

  // ==========================================================================
  // QUERY PARAM: ?tab=staffing-rules|blackouts|settings
  // ==========================================================================

  const VALID_TABS: RulesTab[] = ['blackouts', 'staffing-rules', 'settings'];

  function isValidTab(value: string | null): value is RulesTab {
    if (value === null) return false;
    return (VALID_TABS as string[]).includes(value);
  }

  // Apply query param on mount (once)
  const tabParam = page.url.searchParams.get('tab');
  if (isValidTab(tabParam)) {
    rulesState.setActiveTab(tabParam);
  }

  const ssrBlackouts = $derived(data.blackouts);
  const ssrStaffingRules = $derived(data.staffingRules);
  const ssrSettings = $derived(data.settings);
  const ssrAreas = $derived(data.areas);
  const ssrDepartments = $derived(data.departments);
  const ssrTeams = $derived(data.teams);

  // Sync SSR data into reactive state
  $effect(() => {
    rulesState.setBlackouts(ssrBlackouts);
    rulesState.setStaffingRules(ssrStaffingRules);
    rulesState.setSettings(ssrSettings);
    rulesState.setAreas(ssrAreas);
    rulesState.setDepartments(ssrDepartments);
    rulesState.setTeams(ssrTeams);
    rulesState.setLoading(false);
  });

  onDestroy(() => {
    rulesState.reset();
  });

  // ==========================================================================
  // TAB NAVIGATION
  // ==========================================================================

  function handleTabChange(tab: RulesTab) {
    rulesState.setActiveTab(tab);
  }
</script>

<svelte:head>
  <title>Urlaubsregeln - Assixx</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="die Urlaubsverwaltung" />
{:else}
  <div class="container">
    <!-- Header -->
    <div class="card mb-6">
      <div class="card__header">
        <div class="flex items-center justify-between">
          <h2 class="card__title">
            <i class="fas fa-shield-alt mr-2"></i>
            Urlaubsregeln & Einstellungen
          </h2>
        </div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="card mb-6">
      <div class="card__header">
        <div class="toggle-group">
          {#each RULES_TABS as tab (tab.value)}
            <button
              type="button"
              class="toggle-group__btn"
              class:active={rulesState.activeTab === tab.value}
              onclick={() => {
                handleTabChange(tab.value);
              }}
            >
              <i class="{tab.icon} mr-1"></i>
              {tab.label}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Tab Content -->
    {#if rulesState.activeTab === 'blackouts'}
      <BlackoutsTab {labels} />
    {:else if rulesState.activeTab === 'staffing-rules'}
      <StaffingRulesTab {labels} />
    {:else if rulesState.activeTab === 'settings'}
      <SettingsTab />
    {/if}
  </div>
{/if}

<style>
  /* Vacation Rules — all styles used in child components (BlackoutsTab, StaffingRulesTab, SettingsTab) */

  /* Rules List */
  :global(.rules-list) {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  :global(.rules-list__item) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-lg);
    background: var(--glass-bg);
    border: 1px solid var(--color-glass-border);
    transition:
      border-color var(--duration-fast) var(--ease-out),
      background-color var(--duration-fast) var(--ease-out),
      box-shadow var(--duration-fast) var(--ease-out);
  }

  :global(.rules-list__item:hover) {
    border-color: var(--color-glass-border-hover, var(--color-glass-border));
    background: var(
      --glass-bg-hover,
      color-mix(in oklch, var(--color-black) 8%, transparent)
    );
    box-shadow: 0 2px 8px
      color-mix(in oklch, var(--color-black) 8%, transparent);
  }

  :global(.rules-list__info) {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    flex: 1;
    min-width: 0;
  }

  :global(.rules-list__name) {
    font-weight: 600;
    font-size: 0.938rem;
    color: var(--text-primary);
  }

  :global(.rules-list__meta) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    font-size: 0.813rem;
    color: var(--text-muted);
  }

  :global(.rules-list__actions) {
    display: flex;
    gap: var(--spacing-2);
    flex-shrink: 0;
    margin-left: var(--spacing-3);
  }

  /* Blackout Card */
  :global(.blackout-card) {
    border-radius: var(--radius-lg);
    background: var(--glass-bg);
    border: 1px solid var(--color-glass-border);
    overflow: hidden;
    transition:
      border-color var(--duration-fast) var(--ease-out),
      background-color var(--duration-fast) var(--ease-out),
      box-shadow var(--duration-fast) var(--ease-out);
  }

  :global(.blackout-card:hover) {
    border-color: var(--color-glass-border-hover, var(--color-glass-border));
    background: var(
      --glass-bg-hover,
      color-mix(in oklch, var(--color-black) 8%, transparent)
    );
    box-shadow: 0 2px 8px
      color-mix(in oklch, var(--color-black) 8%, transparent);
  }

  :global(.blackout-card__header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-3) var(--spacing-4);
  }

  :global(.blackout-card__title-row) {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    min-width: 0;
  }

  :global(.blackout-card__icon) {
    color: var(--text-muted);
    font-size: 0.813rem;
    flex-shrink: 0;
  }

  :global(.blackout-card__name) {
    font-weight: 600;
    font-size: 0.938rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.blackout-card__actions) {
    display: flex;
    gap: var(--spacing-1);
    flex-shrink: 0;
    margin-left: var(--spacing-3);
  }

  :global(.blackout-card__body) {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    padding: 0 var(--spacing-4) var(--spacing-3);
  }

  :global(.blackout-card__date) {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: 0.813rem;
    color: var(--text-muted);
  }

  :global(.blackout-card__date i) {
    width: 1rem;
    text-align: center;
    flex-shrink: 0;
  }

  :global(.blackout-card__scopes) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-1);
  }

  :global(.blackout-card__reason) {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-2);
    font-size: 0.813rem;
    color: var(--text-muted);
    font-style: italic;
  }

  :global(.blackout-card__reason i) {
    width: 1rem;
    text-align: center;
    margin-top: 2px;
    flex-shrink: 0;
  }

  /* Settings Grid */
  :global(.settings-grid) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-4);
  }

  :global(.settings-grid .form-field) {
    margin-bottom: 0;
  }

  /* Settings Display */
  :global(.settings-display) {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    column-gap: var(--spacing-2);
  }

  :global(.settings-display__row) {
    display: contents;
  }

  :global(.settings-display__label) {
    padding: var(--spacing-2) 0;
    border-bottom: 1px solid var(--color-glass-border);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted);
  }

  :global(.settings-display__row > .tooltip) {
    padding: var(--spacing-2) 0;
    border-bottom: 1px solid var(--color-glass-border);
  }

  :global(.settings-display__value) {
    padding: var(--spacing-2) 0;
    border-bottom: 1px solid var(--color-glass-border);
    font-size: 0.938rem;
    font-weight: 600;
    color: var(--text-primary);
    text-align: right;
  }

  :global(.settings-display__row:last-child > .settings-display__label),
  :global(.settings-display__row:last-child > .tooltip),
  :global(.settings-display__row:last-child > .settings-display__value) {
    border-bottom: none;
  }

  @media (width <= 640px) {
    :global(.blackout-card__header) {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-2);
    }

    :global(.blackout-card__actions) {
      margin-left: 0;
      align-self: flex-end;
    }
  }

  @media (width <= 640px) {
    :global(.settings-grid) {
      grid-template-columns: 1fr;
    }
  }
</style>
