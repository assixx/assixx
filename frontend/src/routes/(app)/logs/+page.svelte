<script lang="ts">
  /* eslint-disable max-lines -- Complex page with filters, table, delete modal, and export section */
  /**
   * Logs Page - System Activity Logs
   * SSR: Initial data loaded in +page.server.ts
   * Level 3 Hybrid: SSR initial + client-side pagination/filtering
   *
   * @see ADR-009 Central Audit Logging (Export functionality)
   */
  import { invalidateAll } from '$app/navigation';

  import '../../../styles/logs.css';

  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('LogsPage');

  import {
    deleteLogs,
    fetchLogs,
    exportLogs,
    getDefaultExportDateRange,
    getExportDateRangeFromMinutes,
    RateLimitError,
  } from './_lib/api';
  import {
    ACTION_OPTIONS,
    ENTITY_OPTIONS,
    EXPORT_FORMAT_OPTIONS,
    EXPORT_QUICK_TIMERANGE_OPTIONS,
    EXPORT_SOURCE_OPTIONS,
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
  import type { LogEntry, PaginationInfo, ExportFormat, ExportSource } from './_lib/types';

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

  // Export State (ADR-009)
  let showExportSection = $state(false);
  const defaultDates = getDefaultExportDateRange();
  let exportDateFrom = $state(defaultDates.dateFrom);
  let exportDateTo = $state(defaultDates.dateTo);
  let exportFormat = $state<ExportFormat>('csv');
  let exportSource = $state<ExportSource>('all');
  let exportLoading = $state(false);
  let exportError = $state('');
  let exportSuccess = $state('');
  let rateLimitedUntil = $state<Date | null>(null);
  let formatDropdownOpen = $state(false);
  let sourceDropdownOpen = $state(false);
  let selectedQuickTimerange = $state<string | null>(null);

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

  // Export derived state
  const formatDisplayText = $derived(
    getDropdownDisplayText(EXPORT_FORMAT_OPTIONS, exportFormat, 'CSV'),
  );
  const sourceDisplayText = $derived(
    getDropdownDisplayText(EXPORT_SOURCE_OPTIONS, exportSource, 'Alle Quellen'),
  );
  const isRateLimited = $derived(
    rateLimitedUntil !== null && rateLimitedUntil > new Date(),
  );
  const rateLimitRemaining = $derived(() => {
    if (rateLimitedUntil === null) return 0;
    const remaining = Math.ceil((rateLimitedUntil.getTime() - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  });
  const canExport = $derived(
    !exportLoading && !isRateLimited && exportDateFrom !== '' && exportDateTo !== '',
  );

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
      log.error({ err }, 'Error loading logs');
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
      log.error({ err }, 'Error deleting logs');
      error = MESSAGES.ERROR_DELETING;
    }
  }

  /**
   * Handle export logs request.
   * Downloads file and handles rate limiting.
   */
  async function handleExportLogs(): Promise<void> {
    exportLoading = true;
    exportError = '';
    exportSuccess = '';

    try {
      await exportLogs({
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
        format: exportFormat,
        source: exportSource,
        action: filterAction !== 'all' ? filterAction : undefined,
        entityType: filterEntity !== 'all' ? filterEntity : undefined,
      });

      exportSuccess = MESSAGES.EXPORT_SUCCESS;
      log.info('Export completed successfully');

      // Clear success message after 5 seconds
      setTimeout(() => {
        exportSuccess = '';
      }, 5000);
    } catch (err) {
      if (err instanceof RateLimitError) {
        rateLimitedUntil = new Date(Date.now() + err.retryAfter * 1000);
        exportError = `${MESSAGES.EXPORT_RATE_LIMITED} (${err.retryAfter}s)`;
        log.warn({ retryAfter: err.retryAfter }, 'Export rate limited');

        // Clear rate limit after timeout
        setTimeout(() => {
          rateLimitedUntil = null;
          exportError = '';
        }, err.retryAfter * 1000);
      } else {
        exportError = err instanceof Error ? err.message : MESSAGES.EXPORT_ERROR;
        log.error({ err }, 'Export failed');
      }
    } finally {
      exportLoading = false;
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

  function selectExportFormat(value: string): void {
    exportFormat = value as ExportFormat;
    formatDropdownOpen = false;
  }

  function selectExportSource(value: string): void {
    exportSource = value as ExportSource;
    sourceDropdownOpen = false;
  }

  /**
   * Apply a quick timerange preset to the export date filters.
   */
  function selectQuickTimerange(preset: string, minutes: number): void {
    selectedQuickTimerange = preset;
    const range = getExportDateRangeFromMinutes(minutes);
    exportDateFrom = range.dateFrom;
    exportDateTo = range.dateTo;
  }

  /**
   * Clear the quick timerange selection (when manually editing dates).
   */
  function clearQuickTimerangeSelection(): void {
    selectedQuickTimerange = null;
  }

  function toggleExportSection(): void {
    showExportSection = !showExportSection;
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
        formatDropdownOpen = false;
        sourceDropdownOpen = false;
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
          <!-- Export Toggle Button -->
          <button
            type="button"
            class="btn btn-success"
            onclick={toggleExportSection}
          >
            <i class="fas fa-download mr-2"></i>
            {showExportSection ? 'Export schließen' : 'Logs exportieren'}
          </button>
        </div>

        <!-- Export Section (collapsible) -->
        {#if showExportSection}
          <div class="export-section mt-6 p-4 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)]">
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <i class="fas fa-file-export text-[var(--color-success)]"></i>
              Audit-Logs exportieren
            </h3>

            <!-- Export Status Messages -->
            {#if exportError}
              <div class="alert alert--danger mb-4">
                <i class="fas fa-exclamation-circle mr-2"></i>
                {exportError}
              </div>
            {/if}
            {#if exportSuccess}
              <div class="alert alert--success mb-4">
                <i class="fas fa-check-circle mr-2"></i>
                {exportSuccess}
              </div>
            {/if}

            <!-- Quick Timerange Buttons -->
            <div class="mb-4">
              <span class="form-field__label block mb-2">Schnellauswahl Zeitraum</span>
              <div class="toggle-group">
                {#each EXPORT_QUICK_TIMERANGE_OPTIONS as option (option.value)}
                  <button
                    type="button"
                    class="toggle-group__btn"
                    class:active={selectedQuickTimerange === option.value}
                    onclick={() => {
                      selectQuickTimerange(option.value, option.minutes);
                    }}
                  >
                    {option.text}
                  </button>
                {/each}
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Date From -->
              <div class="form-field">
                <label class="form-field__label" for="export-date-from">Von Datum</label>
                <input
                  type="date"
                  id="export-date-from"
                  class="form-field__control"
                  bind:value={exportDateFrom}
                  oninput={clearQuickTimerangeSelection}
                />
              </div>

              <!-- Date To -->
              <div class="form-field">
                <label class="form-field__label" for="export-date-to">Bis Datum</label>
                <input
                  type="date"
                  id="export-date-to"
                  class="form-field__control"
                  bind:value={exportDateTo}
                  oninput={clearQuickTimerangeSelection}
                />
              </div>

              <!-- Format Dropdown -->
              <div class="form-field">
                <span class="form-field__label" id="format-label">Format</span>
                <div class="dropdown" id="format-dropdown">
                  <button
                    type="button"
                    class="dropdown__trigger"
                    class:active={formatDropdownOpen}
                    aria-labelledby="format-label"
                    aria-expanded={formatDropdownOpen}
                    onclick={() => (formatDropdownOpen = !formatDropdownOpen)}
                  >
                    <span>{formatDisplayText}</span>
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                      <path
                        d="M1 1L6 6L11 1"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                  <div class="dropdown__menu" class:active={formatDropdownOpen}>
                    {#each EXPORT_FORMAT_OPTIONS as option (option.value)}
                      <button
                        type="button"
                        class="dropdown__option"
                        class:selected={exportFormat === option.value}
                        onclick={() => {
                          selectExportFormat(option.value);
                        }}
                      >
                        {option.text}
                      </button>
                    {/each}
                  </div>
                </div>
              </div>

              <!-- Source Dropdown -->
              <div class="form-field">
                <span class="form-field__label" id="source-label">Quelle</span>
                <div class="dropdown" id="source-dropdown">
                  <button
                    type="button"
                    class="dropdown__trigger"
                    class:active={sourceDropdownOpen}
                    aria-labelledby="source-label"
                    aria-expanded={sourceDropdownOpen}
                    onclick={() => (sourceDropdownOpen = !sourceDropdownOpen)}
                  >
                    <span>{sourceDisplayText}</span>
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                      <path
                        d="M1 1L6 6L11 1"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                  <div class="dropdown__menu" class:active={sourceDropdownOpen}>
                    {#each EXPORT_SOURCE_OPTIONS as option (option.value)}
                      <button
                        type="button"
                        class="dropdown__option"
                        class:selected={exportSource === option.value}
                        onclick={() => {
                          selectExportSource(option.value);
                        }}
                      >
                        {option.text}
                      </button>
                    {/each}
                  </div>
                </div>
              </div>
            </div>

            <!-- Export Button -->
            <div class="mt-4 flex items-center gap-4">
              <button
                type="button"
                class="btn btn-success"
                onclick={() => void handleExportLogs()}
                disabled={!canExport}
              >
                {#if exportLoading}
                  <span class="spinner spinner--sm mr-2">
                    <span class="spinner__circle"></span>
                  </span>
                  {MESSAGES.EXPORT_LOADING}
                {:else if isRateLimited}
                  <i class="fas fa-clock mr-2"></i>
                  Warten ({rateLimitRemaining()}s)
                {:else}
                  <i class="fas fa-download mr-2"></i>
                  Export starten
                {/if}
              </button>

              {#if hasActiveFilters}
                <span class="text-sm text-[var(--color-text-secondary)]">
                  <i class="fas fa-info-circle mr-1"></i>
                  Aktive Filter werden beim Export berücksichtigt
                </span>
              {/if}
            </div>

            <!-- Export Info -->
            <p class="text-sm text-[var(--color-text-secondary)] mt-3">
              <i class="fas fa-shield-alt mr-1"></i>
              Max. 365 Tage | 1 Export pro Minute | RLS-geschützt
            </p>
          </div>
        {/if}
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
        <button
          type="button"
          class="btn btn-danger"
          onclick={handleDeleteLogs}
          disabled={!canConfirmDelete}
        >
          <i class="fas fa-trash mr-2"></i>
          Endgültig löschen
        </button>
      </div>
    </div>
  </div>
{/if}
