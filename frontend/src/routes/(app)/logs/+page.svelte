<script lang="ts">
  /**
   * Logs Page - System Activity Logs
   * SSR: Initial data loaded in +page.server.ts
   * Level 3 Hybrid: SSR initial + client-side pagination/filtering
   */
  import { invalidateAll } from '$app/navigation';

  import '../../../styles/logs.css';

  import { deleteLogs, fetchLogs } from './_lib/api';
  import {
    ACTION_OPTIONS,
    ENTITY_OPTIONS,
    LOGS_PER_PAGE,
    MESSAGES,
    TIMERANGE_OPTIONS,
  } from './_lib/constants';
  import {
    formatDate,
    getActionLabel,
    getDisplayName,
    getDropdownDisplayText,
    getRoleBadgeClass,
    getRoleLabel,
    getVisiblePages,
    hasActiveFilters as checkHasActiveFilters,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { LogEntry, PaginationInfo } from './_lib/types';

  // SSR Data
  const { data }: { data: PageData } = $props();

  // =============================================================================
  // SSR DATA (initial values from server)
  // =============================================================================

  const ssrLogs = $derived(data.logs);
  const ssrPagination = $derived(data.pagination);

  // =============================================================================
  // HYBRID STATE - SSR initial, client updates for pagination/filtering
  // =============================================================================

  // Logs data - starts from SSR, updated by client-side fetches
  let logs = $state<LogEntry[]>([]);
  let loading = $state(false);
  let error = $state('');

  // Pagination - starts from SSR, updated by client-side navigation
  let currentOffset = $state(0);
  let pagination = $state<PaginationInfo>({
    limit: LOGS_PER_PAGE,
    offset: 0,
    total: 0,
    hasMore: false,
  });

  // Initialize from SSR on first render
  $effect(() => {
    if (logs.length === 0 && ssrLogs.length > 0) {
      logs = ssrLogs;
      pagination = ssrPagination;
    }
  });

  // Filters
  let filterUser = $state('');
  let filterAction = $state('all');
  let filterEntity = $state('all');
  let filterTimerange = $state('all');
  let filtersApplied = $state(false);

  // Dropdowns
  let actionDropdownOpen = $state(false);
  let entityDropdownOpen = $state(false);
  let timerangeDropdownOpen = $state(false);

  // Delete Modal
  let showDeleteModal = $state(false);
  let deleteConfirmText = $state('');
  let deletePassword = $state('');

  // =============================================================================
  // DERIVED STATE
  // =============================================================================

  const currentPage = $derived(Math.floor(currentOffset / LOGS_PER_PAGE) + 1);
  const totalPages = $derived(Math.ceil(pagination.total / LOGS_PER_PAGE));

  const actionDisplayText = $derived(
    getDropdownDisplayText(ACTION_OPTIONS, filterAction, 'Alle Aktionen'),
  );
  const entityDisplayText = $derived(
    getDropdownDisplayText(ENTITY_OPTIONS, filterEntity, 'Alle Typen'),
  );
  const timerangeDisplayText = $derived(
    getDropdownDisplayText(TIMERANGE_OPTIONS, filterTimerange, 'Alle Zeit'),
  );

  const hasActiveFilters = $derived(
    checkHasActiveFilters(filterUser, filterAction, filterEntity, filterTimerange),
  );

  const canDelete = $derived(filtersApplied);
  const canConfirmDelete = $derived(deleteConfirmText === 'LÖSCHEN' && deletePassword !== '');

  const visiblePages = $derived(getVisiblePages(currentPage, totalPages));

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  async function loadLogs(): Promise<void> {
    loading = true;
    error = '';

    try {
      const result = await fetchLogs({
        offset: currentOffset,
        filterUser,
        filterAction,
        filterEntity,
        filterTimerange,
      });
      logs = result.logs;
      pagination = result.pagination;
    } catch (err) {
      console.error('Error loading logs:', err);
      error = MESSAGES.ERROR_LOADING;
      logs = [];
    } finally {
      loading = false;
    }
  }

  async function handleDeleteLogs(): Promise<void> {
    try {
      await deleteLogs({
        password: deletePassword,
        filterUser,
        filterAction,
        filterEntity,
        filterTimerange,
      });

      // Reset and reload
      closeDeleteModal();
      filtersApplied = false;
      currentOffset = 0;
      await invalidateAll();
      await loadLogs();
    } catch (err) {
      console.error('Error deleting logs:', err);
      error = MESSAGES.ERROR_DELETING;
    }
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function applyFilters(): void {
    filtersApplied = true;
    currentOffset = 0;
    void loadLogs();
  }

  function resetFilters(): void {
    filterUser = '';
    filterAction = 'all';
    filterEntity = 'all';
    filterTimerange = 'all';
    filtersApplied = false;
    currentOffset = 0;
    void loadLogs();
  }

  function openDeleteModal(): void {
    showDeleteModal = true;
  }

  function closeDeleteModal(): void {
    showDeleteModal = false;
    deleteConfirmText = '';
    deletePassword = '';
  }

  function handlePreviousPage(): void {
    if (currentOffset >= LOGS_PER_PAGE) {
      currentOffset -= LOGS_PER_PAGE;
      void loadLogs();
    }
  }

  function handleNextPage(): void {
    if (pagination.hasMore) {
      currentOffset += LOGS_PER_PAGE;
      void loadLogs();
    }
  }

  function goToPage(page: number): void {
    currentOffset = (page - 1) * LOGS_PER_PAGE;
    void loadLogs();
  }

  function selectAction(value: string): void {
    filterAction = value;
    actionDropdownOpen = false;
  }

  function selectEntity(value: string): void {
    filterEntity = value;
    entityDropdownOpen = false;
  }

  function selectTimerange(value: string): void {
    filterTimerange = value;
    timerangeDropdownOpen = false;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      applyFilters();
    }
  }

  // Close dropdowns when clicking outside
  $effect(() => {
    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown')) {
        actionDropdownOpen = false;
        entityDropdownOpen = false;
        timerangeDropdownOpen = false;
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  // =============================================================================
  // LIFECYCLE - SSR: Auth checked server-side, data already loaded
  // =============================================================================

  // No onMount needed - SSR provides initial data and handles auth
</script>

<div class="container">
  <!-- Card for Logs Page -->
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-list-alt mr-2"></i>
        System-Logs
      </h2>
      <p class="text-[var(--color-text-secondary)] mt-2">Übersicht aller Systemaktivitäten</p>
    </div>

    <div class="card__body">
      <!-- Filters Section -->
      <div class="filters-section">
        <div class="filters-grid">
          <!-- User Filter -->
          <div class="form-field">
            <label class="form-field__label" for="filter-user">Suche</label>
            <input
              type="search"
              id="filter-user"
              class="form-field__control"
              placeholder="Vorname, Nachname, Personalnr..."
              autocomplete="off"
              bind:value={filterUser}
              onkeydown={handleKeydown}
            />
          </div>

          <!-- Action Filter -->
          <div class="form-field">
            <span class="form-field__label" id="action-label">Aktion</span>
            <div class="dropdown" id="action-dropdown">
              <button
                type="button"
                class="dropdown__trigger"
                class:active={actionDropdownOpen}
                aria-labelledby="action-label"
                aria-expanded={actionDropdownOpen}
                onclick={() => (actionDropdownOpen = !actionDropdownOpen)}
              >
                <span>{actionDisplayText}</span>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                  <path
                    d="M1 1L6 6L11 1"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <div
                class="dropdown__menu dropdown__menu--scrollable"
                class:active={actionDropdownOpen}
              >
                {#each ACTION_OPTIONS as option (option.value)}
                  <button
                    type="button"
                    class="dropdown__option"
                    class:selected={filterAction === option.value}
                    onclick={() => {
                      selectAction(option.value);
                    }}
                  >
                    {option.text}
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <!-- Entity Type Filter -->
          <div class="form-field">
            <span class="form-field__label" id="entity-label">Entitätstyp</span>
            <div class="dropdown" id="entity-dropdown">
              <button
                type="button"
                class="dropdown__trigger"
                class:active={entityDropdownOpen}
                aria-labelledby="entity-label"
                aria-expanded={entityDropdownOpen}
                onclick={() => (entityDropdownOpen = !entityDropdownOpen)}
              >
                <span>{entityDisplayText}</span>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                  <path
                    d="M1 1L6 6L11 1"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <div
                class="dropdown__menu dropdown__menu--scrollable"
                class:active={entityDropdownOpen}
              >
                {#each ENTITY_OPTIONS as option (option.value)}
                  <button
                    type="button"
                    class="dropdown__option"
                    class:selected={filterEntity === option.value}
                    onclick={() => {
                      selectEntity(option.value);
                    }}
                  >
                    {option.text}
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <!-- Timerange Filter -->
          <div class="form-field">
            <span class="form-field__label" id="timerange-label">Zeitraum</span>
            <div class="dropdown" id="timerange-dropdown">
              <button
                type="button"
                class="dropdown__trigger"
                class:active={timerangeDropdownOpen}
                aria-labelledby="timerange-label"
                aria-expanded={timerangeDropdownOpen}
                onclick={() => (timerangeDropdownOpen = !timerangeDropdownOpen)}
              >
                <span>{timerangeDisplayText}</span>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                  <path
                    d="M1 1L6 6L11 1"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <div
                class="dropdown__menu dropdown__menu--scrollable"
                class:active={timerangeDropdownOpen}
              >
                {#each TIMERANGE_OPTIONS as option (option.value)}
                  <button
                    type="button"
                    class="dropdown__option"
                    class:selected={filterTimerange === option.value}
                    onclick={() => {
                      selectTimerange(option.value);
                    }}
                  >
                    {option.text}
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </div>

        <!-- Filter Actions -->
        <div class="flex flex-wrap gap-3 mt-6">
          <button type="button" class="btn btn-info" onclick={applyFilters}>
            <i class="fas fa-filter mr-2"></i>
            Filter anwenden
          </button>
          <button type="button" class="btn btn-cancel" onclick={resetFilters} disabled={!filtersApplied}>
            <i class="fas fa-undo mr-2"></i>
            Zurücksetzen
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onclick={openDeleteModal}
            disabled={!canDelete}
            title={canDelete
              ? hasActiveFilters
                ? 'Gefilterte Logs löschen'
                : 'Alle Logs löschen'
              : MESSAGES.DELETE_BUTTON_DISABLED_TITLE}
          >
            <i class="fas fa-trash mr-2"></i>
            Gefilterte Logs löschen
          </button>
        </div>
      </div>

      <!-- Logs Table Container -->
      <div class="table-responsive" id="logs-table-container">
        {#if loading}
          <div class="loading">
            <div class="spinner spinner--lg mx-auto">
              <div class="spinner__circle"></div>
            </div>
            <p class="mt-6">{MESSAGES.LOADING}</p>
          </div>
        {:else if error}
          <div class="empty-state empty-state--sm empty-state--error">
            <div class="empty-state__icon"><i class="fas fa-exclamation-triangle"></i></div>
            <p class="empty-state__title">{error}</p>
            <div class="empty-state__actions">
              <button type="button" class="btn btn-primary btn--sm" onclick={() => void loadLogs()}
                >Erneut versuchen</button
              >
            </div>
          </div>
        {:else if logs.length === 0}
          <div class="empty-state empty-state--sm">
            <div class="empty-state__icon"><i class="fas fa-search"></i></div>
            <p class="empty-state__title">{MESSAGES.EMPTY_STATE_TITLE}</p>
            <p class="empty-state__description">{MESSAGES.EMPTY_STATE_DESCRIPTION}</p>
          </div>
        {:else}
          <table class="data-table data-table--hover data-table--striped">
            <thead>
              <tr>
                <th>ID</th>
                <th>Benutzer</th>
                <th>Personalnr.</th>
                <th>Aktion</th>
                <th>Objekt</th>
                <th>IP-Adresse</th>
                <th>Zeitstempel</th>
              </tr>
            </thead>
            <tbody>
              {#each logs as entry (entry.id)}
                <tr>
                  <td class="text-muted">{entry.id}</td>
                  <td>
                    <div class="user-info">
                      <span class="user-name">{getDisplayName(entry)}</span>
                      <span class="badge badge--sm {getRoleBadgeClass(entry.userRole)}"
                        >{getRoleLabel(entry.userRole)}</span
                      >
                    </div>
                  </td>
                  <td class="text-muted">{entry.employeeNumber ?? '-'}</td>
                  <td>
                    <span class="action-label action-{entry.action.toLowerCase()}"
                      >{getActionLabel(entry.action)}</span
                    >
                  </td>
                  <td>
                    {#if entry.entityType}
                      <span class="entity-type">{entry.entityType}</span>
                      {#if entry.entityId}
                        <span class="entity-id">#{entry.entityId}</span>
                      {/if}
                    {/if}
                  </td>
                  <td class="text-muted ip-cell">{entry.ipAddress ?? '-'}</td>
                  <td class="text-muted">{formatDate(entry.createdAt)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

      <!-- Pagination -->
      {#if !loading && logs.length > 0}
        <nav class="pagination" id="pagination-container">
          <button
            type="button"
            class="pagination__btn pagination__btn--prev"
            onclick={handlePreviousPage}
            disabled={currentOffset === 0}
          >
            <i class="fas fa-chevron-left"></i>
            Zurück
          </button>
          <div class="pagination__pages">
            {#each visiblePages as page, i (i)}
              {#if page.type === 'ellipsis'}
                <span class="pagination__ellipsis">...</span>
              {:else if page.type === 'page'}
                <button
                  type="button"
                  class="pagination__page"
                  class:pagination__page--active={page.active}
                  onclick={() => {
                    goToPage(page.value);
                  }}
                >
                  {page.value}
                </button>
              {/if}
            {/each}
          </div>
          <span class="pagination__info">
            Seite {currentPage} von {totalPages} ({pagination.total} Einträge)
          </span>
          <button
            type="button"
            class="pagination__btn pagination__btn--next"
            onclick={handleNextPage}
            disabled={!pagination.hasMore}
          >
            Weiter
            <i class="fas fa-chevron-right"></i>
          </button>
        </nav>
      {/if}
    </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-modal-title"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeDeleteModal();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') closeDeleteModal();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal ds-modal--md"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      role="document"
    >
      <!-- Header -->
      <div class="ds-modal__header ds-modal__header--danger">
        <h3 class="ds-modal__title flex items-center gap-3" id="delete-modal-title">
          <i class="fas fa-exclamation-triangle text-[var(--color-danger)]"></i>
          {MESSAGES.DELETE_MODAL_TITLE}
        </h3>
      </div>

      <div class="ds-modal__body">
        <!-- Warning Alert -->
        <div class="alert alert--danger mb-6">
          <p class="font-bold">
            <i class="fas fa-skull-crossbones mr-2"></i>
            {MESSAGES.DELETE_WARNING}
          </p>
        </div>

        <!-- Active Filters Display -->
        <div class="mb-6">
          <p class="text-[var(--color-text-secondary)] mb-2">Folgende Filter werden gelöscht:</p>
          <div class="bg-[rgba(0,0,0,0.3)] p-4 rounded-lg border border-[rgba(255,255,255,0.1)]">
            {#if hasActiveFilters}
              {#if filterUser !== ''}
                <span class="badge badge--info mr-2 mb-2">Benutzer: {filterUser}</span>
              {/if}
              {#if filterAction !== '' && filterAction !== 'all'}
                <span class="badge badge--info mr-2 mb-2">Aktion: {actionDisplayText}</span>
              {/if}
              {#if filterEntity !== '' && filterEntity !== 'all'}
                <span class="badge badge--info mr-2 mb-2">Entitätstyp: {entityDisplayText}</span>
              {/if}
              {#if filterTimerange !== '' && filterTimerange !== 'all'}
                <span class="badge badge--info mr-2 mb-2">Zeitraum: {timerangeDisplayText}</span>
              {/if}
            {:else}
              <span class="text-[var(--color-text-secondary)]">{MESSAGES.NO_FILTERS_WARNING}</span>
            {/if}
          </div>
        </div>

        <!-- Confirmation Input -->
        <div class="form-field mb-4">
          <label class="form-field__label" for="deleteLogsConfirmation">
            {MESSAGES.DELETE_CONFIRM_LABEL.split('LÖSCHEN')[0]}
            <strong class="text-[var(--color-danger)]">LÖSCHEN</strong>
            {MESSAGES.DELETE_CONFIRM_LABEL.split('LÖSCHEN')[1]}
          </label>
          <input
            type="text"
            id="deleteLogsConfirmation"
            class="form-field__control"
            placeholder="LÖSCHEN"
            autocomplete="off"
            bind:value={deleteConfirmText}
          />
        </div>

        <!-- Password Section -->
        <div class="form-field">
          <label class="form-field__label flex items-center gap-2" for="deleteLogsPassword">
            <i class="fas fa-lock text-[var(--color-danger)]"></i>
            {MESSAGES.DELETE_PASSWORD_LABEL}
          </label>
          <input
            type="password"
            id="deleteLogsPassword"
            class="form-field__control"
            placeholder="Ihr Root-Passwort"
            bind:value={deletePassword}
          />
          <span class="form-field__message">{MESSAGES.DELETE_PASSWORD_HINT}</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="ds-modal__footer">
        <button type="button" class="btn btn-cancel" onclick={closeDeleteModal}>Abbrechen</button>
        <button type="button" class="btn btn-danger" onclick={handleDeleteLogs} disabled={!canConfirmDelete}>
          <i class="fas fa-trash mr-2"></i>
          Endgültig löschen
        </button>
      </div>
    </div>
  </div>
{/if}
