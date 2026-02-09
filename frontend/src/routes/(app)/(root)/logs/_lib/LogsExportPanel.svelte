<script lang="ts">
  /**
   * LogsExportPanel - Self-contained export panel for audit logs
   * Manages all export state, date range, format selection, and API calls.
   * Parent controls visibility via {#if}.
   *
   * @see ADR-009 Central Audit Logging
   */
  import { createLogger } from '$lib/utils/logger';

  import {
    exportLogs,
    getDefaultExportDateRange,
    getExportDateRangeFromMinutes,
    RateLimitError,
  } from './api';
  import {
    EXPORT_FORMAT_OPTIONS,
    EXPORT_QUICK_TIMERANGE_OPTIONS,
    EXPORT_SOURCE_OPTIONS,
    MESSAGES,
  } from './constants';
  import FilterDropdown from './FilterDropdown.svelte';
  import { getDropdownDisplayText } from './utils';

  import type { ExportFormat, ExportSource } from './types';

  const log = createLogger('LogsExportPanel');

  interface Props {
    /** Current action filter (passed to export API if not 'all') */
    filterAction: string;
    /** Current entity filter (passed to export API if not 'all') */
    filterEntity: string;
    /** Whether the parent has active filters */
    hasActiveFilters: boolean;
  }

  const { filterAction, filterEntity, hasActiveFilters }: Props = $props();

  // Export state
  const defaultDates = getDefaultExportDateRange();
  let exportDateFrom = $state(defaultDates.dateFrom);
  let exportDateTo = $state(defaultDates.dateTo);
  let exportFormat = $state<ExportFormat>('csv');
  let exportSource = $state<ExportSource>('all');
  let exportLoading = $state(false);
  let exportError = $state('');
  let exportSuccess = $state('');
  let rateLimitedUntil = $state<Date | null>(null);
  let selectedQuickTimerange = $state<string | null>(null);

  // =============================================================================
  // DERIVED STATE
  // =============================================================================

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
    const remaining = Math.ceil(
      (rateLimitedUntil.getTime() - Date.now()) / 1000,
    );
    return remaining > 0 ? remaining : 0;
  });
  const canExport = $derived(
    !exportLoading &&
      !isRateLimited &&
      exportDateFrom !== '' &&
      exportDateTo !== '',
  );

  // =============================================================================
  // HANDLERS
  // =============================================================================

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

      setTimeout(() => {
        exportSuccess = '';
      }, 5000);
    } catch (err) {
      if (err instanceof RateLimitError) {
        rateLimitedUntil = new Date(Date.now() + err.retryAfter * 1000);
        exportError = `${MESSAGES.EXPORT_RATE_LIMITED} (${err.retryAfter}s)`;
        log.warn({ retryAfter: err.retryAfter }, 'Export rate limited');

        setTimeout(() => {
          rateLimitedUntil = null;
          exportError = '';
        }, err.retryAfter * 1000);
      } else {
        exportError =
          err instanceof Error ? err.message : MESSAGES.EXPORT_ERROR;
        log.error({ err }, 'Export failed');
      }
    } finally {
      exportLoading = false;
    }
  }

  function selectQuickTimerange(preset: string, minutes: number): void {
    selectedQuickTimerange = preset;
    const range = getExportDateRangeFromMinutes(minutes);
    exportDateFrom = range.dateFrom;
    exportDateTo = range.dateTo;
  }

  function clearQuickTimerangeSelection(): void {
    selectedQuickTimerange = null;
  }
</script>

<div class="card mt-6">
  <div class="card__header">
    <h3 class="card__title">
      <i class="fas fa-file-export mr-2"></i>
      Audit-Logs exportieren
    </h3>
  </div>
  <div class="card__body">
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
      <span class="form-field__label mb-2 block">Schnellauswahl Zeitraum</span>
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

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <!-- Date From -->
      <div class="form-field">
        <label
          class="form-field__label"
          for="export-date-from">Von Datum</label
        >
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
        <label
          class="form-field__label"
          for="export-date-to">Bis Datum</label
        >
        <input
          type="date"
          id="export-date-to"
          class="form-field__control"
          bind:value={exportDateTo}
          oninput={clearQuickTimerangeSelection}
        />
      </div>

      <!-- Format Dropdown -->
      <FilterDropdown
        label="Format"
        labelId="format-label"
        options={EXPORT_FORMAT_OPTIONS}
        selectedValue={exportFormat}
        displayText={formatDisplayText}
        onselect={(value) => {
          exportFormat = value as ExportFormat;
        }}
      />

      <!-- Source Dropdown -->
      <FilterDropdown
        label="Quelle"
        labelId="source-label"
        options={EXPORT_SOURCE_OPTIONS}
        selectedValue={exportSource}
        displayText={sourceDisplayText}
        onselect={(value) => {
          exportSource = value as ExportSource;
        }}
      />
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
        <span class="text-sm text-(--color-text-secondary)">
          <i class="fas fa-info-circle mr-1"></i>
          Aktive Filter werden beim Export berücksichtigt
        </span>
      {/if}
    </div>

    <!-- Export Info -->
    <p class="mt-3 text-sm text-(--color-text-secondary)">
      <i class="fas fa-shield-alt mr-1"></i>
      Max. 365 Tage | 1 Export pro Minute | RLS-geschützt
    </p>
  </div>
</div>
