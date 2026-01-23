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

  // KVP-specific styles (migrated from legacy)
  import '../../../styles/kvp.css';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showErrorAlert } from '$lib/utils';
  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('KvpPage');
  const apiClient = getApiClient();

  import { fetchSuggestions, findUserTeamAsLead } from './_lib/api';
  import { FILTER_OPTIONS, STATUS_FILTER_OPTIONS } from './_lib/constants';
  import KvpCreateModal from './_lib/KvpCreateModal.svelte';
  import { kvpState } from './_lib/state.svelte';
  import {
    getStatusBadgeClass,
    getStatusText,
    getPriorityBadgeClass,
    getPriorityText,
    getVisibilityBadgeClass,
    getVisibilityInfo,
    formatDate,
    getSharedByInfo,
    getAttachmentText,
    debounce,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { KvpCategory, Department, KvpSuggestion, KvpStats, CurrentUser } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  // PageData is always defined from $props(), and server guarantees array values
  const ssrCategories = $derived<KvpCategory[]>(data.categories);
  const ssrDepartments = $derived<Department[]>(data.departments);
  const ssrSuggestions = $derived<KvpSuggestion[]>(data.suggestions);
  const ssrStatistics = $derived<KvpStats | null>(data.statistics);
  const ssrCurrentUser = $derived<CurrentUser | null>(data.currentUser);

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

  // =============================================================================
  // UI STATE - Client-side only
  // =============================================================================

  // Modal state
  let currentTeamId = $state<number | null>(null);

  // Dropdown state (filters)
  let activeDropdown = $state<string | null>(null);
  let statusDisplayText = $state('Alle Status');
  let categoryDisplayText = $state('Alle Kategorien');
  let departmentDisplayText = $state('Alle Abteilungen');

  // Debounced search
  const debouncedSearch = debounce(() => {
    void loadSuggestionsData();
  }, 300);

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
        kvpState.searchQuery,
      );
      kvpState.setSuggestions(suggestions);
    } catch (err) {
      log.error({ err }, 'Error loading suggestions');
    }
  }

  // ==========================================================================
  // FILTER HANDLERS
  // ==========================================================================

  function handleFilterChange(filter: string) {
    kvpState.setFilter(filter as typeof kvpState.currentFilter);
    void loadSuggestionsData();
  }

  function toggleDropdown(dropdownId: string) {
    activeDropdown = activeDropdown === dropdownId ? null : dropdownId;
  }

  function closeAllDropdowns() {
    activeDropdown = null;
  }

  function handleStatusSelect(value: string, label: string) {
    kvpState.setStatusFilter(value);
    statusDisplayText = label;
    closeAllDropdowns();
    void loadSuggestionsData();
  }

  function handleCategorySelect(value: string, label: string) {
    kvpState.setCategoryFilter(value);
    categoryDisplayText = label;
    closeAllDropdowns();
    void loadSuggestionsData();
  }

  function handleDepartmentSelect(value: string, label: string) {
    kvpState.setDepartmentFilter(value);
    departmentDisplayText = label;
    closeAllDropdowns();
    void loadSuggestionsData();
  }

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    kvpState.setSearchQuery(target.value);
    debouncedSearch();
  }

  // Close dropdowns when clicking outside
  function handleDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      closeAllDropdowns();
    }
  }

  // ==========================================================================
  // SUGGESTION ACTIONS
  // ==========================================================================

  /**
   * View suggestion detail and auto-confirm if not yet read
   */
  function viewSuggestion(uuid: string, isConfirmed: boolean) {
    // Auto-confirm if not yet read (non-blocking)
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

  async function handleOpenCreateModal() {
    // Validate employee has a team
    if (kvpState.effectiveRole === 'employee') {
      const user = kvpState.currentUser;
      if (user === null) return;

      // Check if user has team
      let teamId = user.teamId;

      if (teamId === undefined || teamId === 0) {
        // Check if user is team lead
        const userTeam = await findUserTeamAsLead(user.id);
        if (userTeam !== null) {
          teamId = userTeam.id;
        }
      }

      if (teamId === undefined || teamId === 0) {
        showErrorAlert(
          'Sie wurden keinem Team zugeordnet. Bitte wenden Sie sich an Ihren Administrator.',
        );
        return;
      }

      currentTeamId = teamId;
    }

    kvpState.openCreateModal();
  }

  function handleCloseCreateModal(): void {
    kvpState.closeCreateModal();
    currentTeamId = null;
  }

  async function handleModalSuccess(): Promise<void> {
    // Level 3: Trigger SSR refetch after creating new suggestion
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>KVP System - Assixx</title>
</svelte:head>

<svelte:document onclick={handleDocumentClick} />

<div class="container">
  <!-- Admin Info Box -->
  {#if kvpState.isAdmin}
    <div class="alert alert--info mb-6">
      <div class="alert__icon">
        <i class="fas fa-lightbulb"></i>
      </div>
      <div class="alert__content">
        <strong class="alert__title">Tipp für Admins:</strong>
        <p class="alert__message">
          Wechseln Sie zur Employee-Ansicht um selbst Vorschläge einzureichen. Als Admin koennen Sie
          Vorschläge verwalten und firmenweit teilen.
        </p>
      </div>
    </div>
  {/if}

  <!-- Statistics Overview (Admin only) -->
  {#if kvpState.isAdmin}
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
          <div class="card-stat__value">{kvpState.formattedStats.open}</div>
          <div class="card-stat__label">In Bearbeitung</div>
        </div>
      </div>
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="card-stat__content">
          <div class="card-stat__value">{kvpState.formattedStats.implemented}</div>
          <div class="card-stat__label">Umgesetzt</div>
        </div>
      </div>
      <div class="card-stat card-stat--success">
        <div class="card-stat__icon">
          <i class="fas fa-euro-sign"></i>
        </div>
        <div class="card-stat__content">
          <div class="card-stat__value">{kvpState.formattedStats.savings}</div>
          <div class="card-stat__label">Einsparungen</div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main Card -->
  <div class="card">
    <div class="card__header flex justify-between items-center">
      <div>
        <h2 class="card-title">KVP-Vorschläge</h2>
        <p class="text-secondary">
          Kontinuierlicher Verbesserungsprozess - Ihre Ideen für bessere Ablaeufe
        </p>
      </div>
    </div>

    <div class="card-body">
      <!-- Filter Card (wie Calendar) -->
      <div class="card mb-6">
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-filter mr-2"></i>
            Filter & Anzeige
          </h3>
          <!-- Alle Filter in einer Zeile -->
          <div class="kvp-filter-row mt-6">
            <!-- Ansichts-Filter -->
            <div class="form-field">
              <span class="form-field__label">Ansicht</span>
              <div class="toggle-group mt-2" id="kvpFilter">
                {#each FILTER_OPTIONS as option (option.value)}
                  <button
                    type="button"
                    class="toggle-group__btn"
                    class:active={kvpState.currentFilter === option.value}
                    data-value={option.value}
                    onclick={() => {
                      handleFilterChange(option.value);
                    }}
                    title={option.title}
                  >
                    <i class="fas {option.icon}"></i>
                    {option.label}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Status Filter -->
            <div class="form-field">
              <span class="form-field__label">Status</span>
              <div class="dropdown mt-2" data-dropdown="status">
                <button
                  type="button"
                  class="dropdown__trigger"
                  class:active={activeDropdown === 'status'}
                  onclick={() => {
                    toggleDropdown('status');
                  }}
                >
                  <span>{statusDisplayText}</span>
                  <i class="fas fa-chevron-down"></i>
                </button>
                <div class="dropdown__menu" class:active={activeDropdown === 'status'}>
                  {#each STATUS_FILTER_OPTIONS as option (option.value)}
                    <button
                      type="button"
                      class="dropdown__option"
                      data-action="select-status"
                      data-value={option.value}
                      onclick={() => {
                        handleStatusSelect(option.value, option.label);
                      }}
                    >
                      {option.label}
                    </button>
                  {/each}
                </div>
              </div>
            </div>

            <!-- Category Filter -->
            <div class="form-field">
              <span class="form-field__label">Kategorie</span>
              <div class="dropdown mt-2" data-dropdown="category">
                <button
                  type="button"
                  class="dropdown__trigger"
                  class:active={activeDropdown === 'category'}
                  onclick={() => {
                    toggleDropdown('category');
                  }}
                >
                  <span>{categoryDisplayText}</span>
                  <i class="fas fa-chevron-down"></i>
                </button>
                <div class="dropdown__menu" class:active={activeDropdown === 'category'}>
                  <button
                    type="button"
                    class="dropdown__option"
                    data-action="select-category"
                    data-value=""
                    onclick={() => {
                      handleCategorySelect('', 'Alle Kategorien');
                    }}
                  >
                    Alle Kategorien
                  </button>
                  {#each kvpState.categories as category (category.id)}
                    <button
                      type="button"
                      class="dropdown__option"
                      data-action="select-category"
                      data-value={category.id.toString()}
                      onclick={() => {
                        handleCategorySelect(category.id.toString(), category.name);
                      }}
                    >
                      {category.name}
                    </button>
                  {/each}
                </div>
              </div>
            </div>

            <!-- Department Filter -->
            <div class="form-field">
              <span class="form-field__label">Abteilung</span>
              <div class="dropdown mt-2" data-dropdown="department">
                <button
                  type="button"
                  class="dropdown__trigger"
                  class:active={activeDropdown === 'department'}
                  onclick={() => {
                    toggleDropdown('department');
                  }}
                >
                  <span>{departmentDisplayText}</span>
                  <i class="fas fa-chevron-down"></i>
                </button>
                <div class="dropdown__menu" class:active={activeDropdown === 'department'}>
                  <button
                    type="button"
                    class="dropdown__option"
                    data-action="select-department"
                    data-value=""
                    onclick={() => {
                      handleDepartmentSelect('', 'Alle Abteilungen');
                    }}
                  >
                    Alle Abteilungen
                  </button>
                  {#each kvpState.departments as dept (dept.id)}
                    <button
                      type="button"
                      class="dropdown__option"
                      data-action="select-department"
                      data-value={dept.id.toString()}
                      onclick={() => {
                        handleDepartmentSelect(dept.id.toString(), dept.name);
                      }}
                    >
                      {dept.name}
                    </button>
                  {/each}
                </div>
              </div>
            </div>

            <!-- Suche -->
            <div class="form-field kvp-search-field">
              <span class="form-field__label">Suche</span>
              <div class="search-input mt-2">
                <i class="search-input__icon fas fa-search"></i>
                <input
                  type="search"
                  class="search-input__field"
                  placeholder="Vorschläge durchsuchen..."
                  value={kvpState.searchQuery}
                  oninput={handleSearchInput}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Suggestions Grid -->
      {#if kvpState.suggestions.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-inbox"></i>
          </div>
          <h3 class="empty-state__title">Keine Vorschläge gefunden</h3>
          <p class="empty-state__description">
            Aendern Sie Ihre Filter oder erstellen Sie einen neuen Vorschlag
          </p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 mt-6">
          {#each kvpState.suggestions as suggestion (suggestion.id)}
            {@const visibilityInfo = getVisibilityInfo(suggestion)}
            {@const isRead = suggestion.isConfirmed === true}
            {@const isNew = suggestion.firstSeenAt === null || suggestion.firstSeenAt === undefined}
            <div
              class="glass-card kvp-card text-left w-full cursor-pointer"
              role="button"
              tabindex="0"
              onclick={() => {
                viewSuggestion(suggestion.uuid, isRead);
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') viewSuggestion(suggestion.uuid, isRead);
              }}
            >
              <!-- Status container: Eye icon (left) + Badges (right) -->
              <div class="kvp-status-container">
                <!-- Read confirmation status (Pattern 2: Individual tracking) -->
                <span
                  class="kvp-read-status"
                  class:kvp-read-status--read={isRead}
                  class:kvp-read-status--unread={!isRead}
                  title={isRead ? 'Gelesen' : 'Ungelesen'}
                >
                  <i class="fas {isRead ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </span>

                <div class="flex items-center gap-2">
                  {#if isNew}
                    <span class="badge badge--sm badge--success">Neu</span>
                  {/if}
                  <span class="badge {getStatusBadgeClass(suggestion.status)}">
                    {getStatusText(suggestion.status)}
                  </span>
                </div>
              </div>

              <div class="mb-4">
                <h3 class="suggestion-title">{suggestion.title}</h3>
                <div class="suggestion-meta">
                  <span>
                    <i class="fas fa-user"></i>
                    {suggestion.submittedByName}
                    {suggestion.submittedByLastname}
                  </span>
                  <span>
                    <i class="fas fa-calendar"></i>
                    {formatDate(suggestion.createdAt)}
                  </span>
                  {#if suggestion.attachmentCount !== undefined && suggestion.attachmentCount > 0}
                    <span>
                      <i class="fas fa-camera"></i>
                      {getAttachmentText(suggestion.attachmentCount)}
                    </span>
                  {/if}
                </div>
                <div class="share-info">
                  <i class="fas fa-share-alt"></i>
                  <span class="badge {getVisibilityBadgeClass(suggestion.orgLevel)}">
                    <i class="fas {visibilityInfo.icon}"></i>
                    <span>{visibilityInfo.text}{getSharedByInfo(suggestion)}</span>
                  </span>
                </div>
              </div>

              <div class="suggestion-description">{suggestion.description}</div>

              <div class="suggestion-footer">
                <div class="flex gap-2 flex-wrap">
                  <span class="badge {getPriorityBadgeClass(suggestion.priority)}">
                    {getPriorityText(suggestion.priority)}
                  </span>
                  <div
                    class="category-tag"
                    style:background="{suggestion.categoryColor}20"
                    style:color={suggestion.categoryColor}
                    style:border="1px solid {suggestion.categoryColor}"
                  >
                    {suggestion.categoryIcon}
                    {suggestion.categoryName}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Floating Add Button (employees only) -->
{#if kvpState.isEmployee}
  <button
    type="button"
    class="btn-float"
    aria-label="Neuen Vorschlag erstellen"
    onclick={handleOpenCreateModal}
  >
    <i class="fas fa-plus"></i>
  </button>
{/if}

<!-- Create KVP Modal -->
{#if kvpState.showCreateModal}
  <KvpCreateModal {currentTeamId} onclose={handleCloseCreateModal} onsuccess={handleModalSuccess} />
{/if}
