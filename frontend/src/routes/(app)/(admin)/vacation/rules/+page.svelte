<script lang="ts">
  /**
   * Vacation Rules — Admin Page (Orchestrator)
   * Tabs: Sperrzeiten (Blackouts), Besetzungsregeln (Staffing Rules), Einstellungen (Settings)
   * SSR: Data loaded in +page.server.ts, tab content delegated to child components.
   */
  import { onDestroy } from 'svelte';

  import '$styles/vacation-rules.css';

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
    <BlackoutsTab />
  {:else if rulesState.activeTab === 'staffing-rules'}
    <StaffingRulesTab />
  {:else if rulesState.activeTab === 'settings'}
    <SettingsTab />
  {/if}
</div>
