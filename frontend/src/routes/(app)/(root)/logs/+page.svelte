<script lang="ts">
  /**
   * Logs Page - System Activity Logs
   * SSR: Initial data loaded in +page.server.ts
   * Level 3 Hybrid: SSR initial + client-side pagination/filtering
   *
   * @see ADR-009 Central Audit Logging (Export functionality)
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import { deleteLogs, fetchLogs } from './_lib/api';
  import {
    ACTION_OPTIONS,
    createEntityOptions,
    LOGS_PER_PAGE,
    MESSAGES,
    TIMERANGE_OPTIONS,
  } from './_lib/constants';
  import FilterDropdown from './_lib/FilterDropdown.svelte';
  import LogsDeleteModal from './_lib/LogsDeleteModal.svelte';
  import LogsExportPanel from './_lib/LogsExportPanel.svelte';
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

  const log = createLogger('LogsPage');

  // SSR Data
  const { data }: { data: PageData } = $props();

  // Hierarchy labels from layout data inheritance (A6)
  const entityOptions = $derived(createEntityOptions(data.hierarchyLabels));

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

  // UI State
  let showDeleteModal = $state(false);
  let showExportSection = $state(false);

  // =============================================================================
  // DERIVED STATE
  // =============================================================================

  const currentPage = $derived(Math.floor(currentOffset / LOGS_PER_PAGE) + 1);
  const totalPages = $derived(Math.ceil(pagination.total / LOGS_PER_PAGE));

  const actionDisplayText = $derived(
    getDropdownDisplayText(ACTION_OPTIONS, filterAction, 'Alle Aktionen'),
  );
  const entityDisplayText = $derived(
    getDropdownDisplayText(entityOptions, filterEntity, 'Alle Typen'),
  );
  const timerangeDisplayText = $derived(
    getDropdownDisplayText(TIMERANGE_OPTIONS, filterTimerange, 'Alle Zeit'),
  );

  const hasActiveFilters = $derived(
    checkHasActiveFilters(
      filterUser,
      filterAction,
      filterEntity,
      filterTimerange,
    ),
  );

  const canDelete = $derived(filtersApplied);
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
    } catch (err: unknown) {
      log.error({ err }, 'Error loading logs');
      error = MESSAGES.ERROR_LOADING;
      logs = [];
    } finally {
      loading = false;
    }
  }

  async function handleDeleteLogs(password: string): Promise<void> {
    try {
      await deleteLogs({
        password,
        filterUser,
        filterAction,
        filterEntity,
        filterTimerange,
      });

      showSuccessAlert(MESSAGES.DELETE_SUCCESS);
      showDeleteModal = false;
      filtersApplied = false;
      currentOffset = 0;
      await invalidateAll();
      await loadLogs();
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting logs');
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

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      applyFilters();
    }
  }

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
      <p class="mt-2 text-(--color-text-secondary)">
        Übersicht aller Systemaktivitäten
      </p>
    </div>

    <div class="card__body">
      <!-- Filters Section -->
      <div class="filters-section">
        <div class="filters-grid">
          <!-- User Filter -->
          <div class="form-field">
            <label
              class="form-field__label"
              for="filter-user">Suche</label
            >
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
          <FilterDropdown
            label="Aktion"
            labelId="action-label"
            options={ACTION_OPTIONS}
            selectedValue={filterAction}
            displayText={actionDisplayText}
            onselect={(value: string) => {
              filterAction = value;
            }}
          />

          <!-- Entity Type Filter -->
          <FilterDropdown
            label="Entitätstyp"
            labelId="entity-label"
            options={entityOptions}
            selectedValue={filterEntity}
            displayText={entityDisplayText}
            onselect={(value: string) => {
              filterEntity = value;
            }}
          />

          <!-- Timerange Filter -->
          <FilterDropdown
            label="Zeitraum"
            labelId="timerange-label"
            options={TIMERANGE_OPTIONS}
            selectedValue={filterTimerange}
            displayText={timerangeDisplayText}
            onselect={(value: string) => {
              filterTimerange = value;
            }}
          />
        </div>

        <!-- Filter Actions -->
        <div class="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            class="btn btn-info"
            onclick={applyFilters}
          >
            <i class="fas fa-filter mr-2"></i>
            Filter anwenden
          </button>
          <button
            type="button"
            class="btn btn-cancel"
            onclick={resetFilters}
            disabled={!filtersApplied}
          >
            <i class="fas fa-undo mr-2"></i>
            Zurücksetzen
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onclick={() => {
              showDeleteModal = true;
            }}
            disabled={!canDelete}
            title={canDelete ?
              hasActiveFilters ? 'Gefilterte Logs löschen'
              : 'Alle Logs löschen'
            : MESSAGES.DELETE_BUTTON_DISABLED_TITLE}
          >
            <i class="fas fa-trash mr-2"></i>
            Gefilterte Logs löschen
          </button>
          <!-- Export Toggle Button -->
          <button
            type="button"
            class="btn btn-success"
            onclick={() => {
              showExportSection = !showExportSection;
            }}
          >
            <i class="fas fa-download mr-2"></i>
            {showExportSection ? 'Export schließen' : 'Logs exportieren'}
          </button>
        </div>

        <!-- Export Section (collapsible) -->
        {#if showExportSection}
          <LogsExportPanel
            {filterAction}
            {filterEntity}
            {hasActiveFilters}
          />
        {/if}
      </div>

      <!-- Logs Table Container -->
      <div
        class="table-responsive"
        id="logs-table-container"
      >
        {#if loading}
          <div class="loading">
            <div class="spinner spinner--lg mx-auto">
              <div class="spinner__circle"></div>
            </div>
            <p class="mt-6">{MESSAGES.LOADING}</p>
          </div>
        {:else if error}
          <div class="empty-state empty-state--sm empty-state--error">
            <div class="empty-state__icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <p class="empty-state__title">{error}</p>
            <div class="empty-state__actions">
              <button
                type="button"
                class="btn btn-primary btn--sm"
                onclick={() => void loadLogs()}>Erneut versuchen</button
              >
            </div>
          </div>
        {:else if logs.length === 0}
          <div class="empty-state empty-state--sm">
            <div class="empty-state__icon"><i class="fas fa-search"></i></div>
            <p class="empty-state__title">{MESSAGES.EMPTY_STATE_TITLE}</p>
            <p class="empty-state__description">
              {MESSAGES.EMPTY_STATE_DESCRIPTION}
            </p>
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
                      <span
                        class="badge badge--sm {getRoleBadgeClass(
                          entry.userRole,
                        )}">{getRoleLabel(entry.userRole)}</span
                      >
                    </div>
                  </td>
                  <td class="text-muted">{entry.employeeNumber ?? '-'}</td>
                  <td>
                    <span
                      class="action-label action-{entry.action.toLowerCase()}"
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
        <nav
          class="pagination"
          id="pagination-container"
        >
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
  <LogsDeleteModal
    {hasActiveFilters}
    {filterUser}
    {filterAction}
    {filterEntity}
    {filterTimerange}
    {actionDisplayText}
    {entityDisplayText}
    {timerangeDisplayText}
    onclose={() => {
      showDeleteModal = false;
    }}
    ondelete={(password: string) => void handleDeleteLogs(password)}
  />
{/if}

<style>
  /* Filters Section — Domain-specific layout for log filtering */
  .filters-section {
    margin-bottom: var(--spacing-6);
    padding: var(--spacing-6);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
  }

  .filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-4);
  }

  /* Table Styles — Domain-specific additions */
  .entity-id {
    font-family: monospace;
    font-size: 13px;
    color: var(--color-primary);
  }

  .ip-cell {
    font-family: monospace;
    font-size: 13px;
  }

  /* Loading State */
  .loading {
    padding: var(--spacing-10);
    text-align: center;
  }

  /* User Info in Tables — Ensures badges align vertically across rows */
  .data-table .user-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .data-table .user-info .user-name {
    display: inline-block;
    width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .data-table .user-info .badge {
    flex-shrink: 0;
  }
</style>
