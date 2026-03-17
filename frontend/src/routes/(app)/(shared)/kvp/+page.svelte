<script lang="ts">
  /**
   * KVP (Suggestions) - Page Component
   * @module kvp/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   * Note: Uses hybrid approach with client-side filtering for filter changes.
   */
  import { untrack } from 'svelte';

  import { invalidateAll, goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showErrorAlert } from '$lib/utils';
  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  import { fetchSuggestions } from './_lib/api';
  import KvpCreateModal from './_lib/KvpCreateModal.svelte';
  import KvpFilterBar from './_lib/KvpFilterBar.svelte';
  import KvpSuggestionCard from './_lib/KvpSuggestionCard.svelte';
  import { kvpState } from './_lib/state.svelte';

  import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
  import type { PageData } from './$types';
  import type {
    KvpCategory,
    Department,
    KvpSuggestion,
    KvpStats,
    CurrentUser,
    UserTeamWithAssets,
  } from './_lib/types';

  const log = createLogger('KvpPage');
  const apiClient = getApiClient();

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // Hierarchy labels from layout data inheritance
  const labels = $derived<HierarchyLabels>(data.hierarchyLabels);

  // SSR data via $derived - updates when invalidateAll() is called
  // PageData is always defined from $props(), and server guarantees array values
  const ssrCategories = $derived<KvpCategory[]>(data.categories);
  const ssrDepartments = $derived<Department[]>(data.departments);
  const ssrSuggestions = $derived<KvpSuggestion[]>(data.suggestions);
  const ssrStatistics = $derived<KvpStats | null>(data.statistics);
  const ssrCurrentUser = $derived<CurrentUser | null>(data.currentUser);
  const ssrUserOrganizations = $derived<UserTeamWithAssets[]>(
    data.userOrganizations,
  );
  const permissionDenied = $derived<boolean>(data.permissionDenied);
  const showStats = $derived<boolean>(data.showStats);

  // Sync SSR data to state store (for UI components that depend on it)
  // IMPORTANT: Use untrack to prevent infinite loop - setUser calls updateEffectiveRole
  // which reads $state, creating a circular dependency
  $effect(() => {
    // Read dependencies first (these are tracked)
    const user = ssrCurrentUser;
    const cats = ssrCategories;
    const deps = ssrDepartments;
    const suggs = ssrSuggestions;
    const stats = ssrStatistics;

    // Write without tracking to prevent circular dependency
    untrack(() => {
      if (user !== null) {
        kvpState.setUser(user);
      }
      kvpState.setCategories(cats);
      kvpState.setDepartments(deps);
      kvpState.setSuggestions(suggs);
      if (stats !== null) {
        kvpState.setStatistics(stats);
      }
      kvpState.setLoading(false);
    });
  });

  // ==========================================================================
  // DATA LOADING
  // ==========================================================================

  async function loadSuggestionsData() {
    try {
      const suggestions = await fetchSuggestions(
        kvpState.currentFilter,
        kvpState.statusFilter,
        kvpState.categoryFilter,
        kvpState.departmentFilter,
        kvpState.teamFilter,
        kvpState.assetFilter,
        kvpState.searchQuery,
      );
      kvpState.setSuggestions(suggestions);
    } catch (err: unknown) {
      log.error({ err }, 'Error loading suggestions');
    }
  }

  // ==========================================================================
  // SUGGESTION ACTIONS
  // ==========================================================================

  function viewSuggestion(uuid: string, isConfirmed: boolean) {
    if (!isConfirmed) {
      void apiClient.post(`/kvp/${uuid}/confirm`, {}).then(() => {
        notificationStore.decrementCount('kvp');
      });
    }
    void goto(resolve(`/kvp-detail?uuid=${uuid}`, {}));
  }

  // ==========================================================================
  // CREATE MODAL
  // ==========================================================================

  function handleOpenCreateModal() {
    const user = kvpState.currentUser;
    if (user === null) return;

    if (ssrUserOrganizations.length === 0) {
      showErrorAlert(
        'Sie wurden keinem Team zugeordnet. Bitte wenden Sie sich an Ihren Administrator.',
      );
      return;
    }

    kvpState.openCreateModal();
  }

  function handleCloseCreateModal(): void {
    kvpState.closeCreateModal();
  }

  async function handleModalSuccess(): Promise<void> {
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>KVP System - Assixx</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="das KVP-Modul" />
{:else}
  <div class="container">
    <!-- Statistics Overview (Admin, Root, Team Lead) -->
    {#if showStats}
      <div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div class="card-stat">
          <div class="card-stat__icon">
            <i class="fas fa-lightbulb"></i>
          </div>
          <div class="card-stat__content">
            <div class="card-stat__value">{kvpState.formattedStats.total}</div>
            <div class="card-stat__label">Gesamt Vorschläge</div>
          </div>
        </div>
        <div class="card-stat">
          <div class="card-stat__icon">
            <i class="fas fa-hourglass-half"></i>
          </div>
          <div class="card-stat__content">
            <div class="card-stat__value">
              {kvpState.formattedStats.inReview}
            </div>
            <div class="card-stat__label">In Bearbeitung</div>
          </div>
        </div>
        <div class="card-stat card-stat--success">
          <div class="card-stat__icon">
            <i class="fas fa-thumbs-up"></i>
          </div>
          <div class="card-stat__content">
            <div class="card-stat__value">
              {kvpState.formattedStats.approved}
            </div>
            <div class="card-stat__label">Genehmigt</div>
          </div>
        </div>
        <div class="card-stat">
          <div class="card-stat__icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="card-stat__content">
            <div class="card-stat__value">
              {kvpState.formattedStats.implemented}
            </div>
            <div class="card-stat__label">Umgesetzt</div>
          </div>
        </div>
        <div class="card-stat">
          <div class="card-stat__icon">
            <i class="fas fa-users"></i>
          </div>
          <div class="card-stat__content">
            <div class="card-stat__value">
              {kvpState.formattedStats.teamTotal} / {kvpState.formattedStats
                .total}
            </div>
            <div class="card-stat__label">Team / Gesamt</div>
          </div>
        </div>
        <div
          class="card-stat"
          class:card-stat--success={kvpState.formattedStats
            .implementationRate >= 50}
          class:card-stat--warning={kvpState.formattedStats
            .implementationRate >= 25 &&
            kvpState.formattedStats.implementationRate < 50}
          class:card-stat--danger={kvpState.formattedStats.implementationRate >
            0 && kvpState.formattedStats.implementationRate < 25}
        >
          <div class="card-stat__icon">
            <i class="fas fa-chart-line"></i>
          </div>
          <div class="card-stat__content">
            <div class="card-stat__value">
              {kvpState.formattedStats.teamTotal > 0 ?
                `${kvpState.formattedStats.implementationRate}%`
              : '–'}
            </div>
            <div class="card-stat__label">Umsetzungsrate Team</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Main Card -->
    <div class="card">
      <div class="card__header flex items-center justify-between">
        <div>
          <h2 class="card-title">KVP-Vorschläge</h2>
          <p class="text-secondary">
            Kontinuierlicher Verbesserungsprozess - Ihre Ideen für bessere
            Ablaeufe
          </p>
        </div>
      </div>

      <div class="card-body">
        <!-- Filter Bar -->
        <KvpFilterBar
          userOrganizations={ssrUserOrganizations}
          {labels}
          onfilterchange={() => {
            void loadSuggestionsData();
          }}
        />

        <!-- Suggestions Grid -->
        {#if kvpState.suggestions.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-inbox"></i>
            </div>
            <h3 class="empty-state__title">Keine Vorschläge gefunden</h3>
            <p class="empty-state__description">
              Ändern Sie Ihre Filter oder erstellen Sie einen neuen Vorschlag
            </p>
          </div>
        {:else}
          <div
            class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[repeat(auto-fill,minmax(350px,1fr))]"
          >
            {#each kvpState.suggestions as suggestion (suggestion.id)}
              <KvpSuggestionCard
                {suggestion}
                {labels}
                onclick={() => {
                  viewSuggestion(
                    suggestion.uuid,
                    suggestion.isConfirmed === true,
                  );
                }}
              />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Floating Add Button -->
  <button
    type="button"
    class="btn-float"
    aria-label="Neuen Vorschlag erstellen"
    onclick={handleOpenCreateModal}
  >
    <i class="fas fa-plus"></i>
  </button>

  <!-- Create KVP Modal -->
  {#if kvpState.showCreateModal}
    <KvpCreateModal
      onclose={handleCloseCreateModal}
      onsuccess={handleModalSuccess}
    />
  {/if}
{/if}
