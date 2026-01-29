<script lang="ts">
  /**
   * Availability History - Page Component
   * @module manage-employees/availability/[uuid]/+page
   *
   * Displays availability history for a specific employee.
   * Design pattern: Similar to blackboard (custom dropdowns)
   */
  import { SvelteURLSearchParams } from 'svelte/reactivity';

  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import {
    AVAILABILITY_BADGE_CLASSES,
    AVAILABILITY_ICONS,
    AVAILABILITY_LABELS,
  } from '../../_lib/constants';

  import type { PageData } from './$types';
  import type { AvailabilityStatus } from '../../_lib/types';

  // =============================================================================
  // TYPES
  // =============================================================================

  interface AvailabilityEntry {
    id: number;
    employeeId: number;
    status: string;
    startDate: string;
    endDate: string;
    reason: string | null;
    notes: string | null;
    createdBy: number | null;
    createdByName: string | null;
    createdAt: string;
    updatedAt: string;
  }

  // AvailabilityStatus imported from ../../_lib/types

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const employee = $derived(data.employee);
  const entries = $derived(data.entries as AvailabilityEntry[]);
  const error = $derived(data.error);

  // =============================================================================
  // CONSTANTS
  // =============================================================================

  const STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
    { value: 'available', label: 'Verfügbar' },
    { value: 'unavailable', label: 'Nicht verfügbar' },
    { value: 'vacation', label: 'Urlaub' },
    { value: 'sick', label: 'Krank' },
    { value: 'training', label: 'Schulung' },
    { value: 'other', label: 'Sonstiges' },
  ];

  // =============================================================================
  // FILTER OPTIONS
  // =============================================================================

  const currentYearNum = new Date().getFullYear();
  const yearOptions = [
    { value: '', label: 'Alle Jahre' },
    ...Array.from({ length: 11 }, (_, i) => {
      const year = currentYearNum - 5 + i;
      return { value: String(year), label: String(year) };
    }),
  ];

  const monthOptions = [
    { value: '', label: 'Alle Monate' },
    { value: '01', label: 'Januar' },
    { value: '02', label: 'Februar' },
    { value: '03', label: 'März' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Dezember' },
  ];

  // =============================================================================
  // FILTER STATE (derived from URL params)
  // =============================================================================

  const selectedYear = $derived(data.currentYear ?? '');
  const selectedMonth = $derived(data.currentMonth ?? '');
  const hasActiveFilter = $derived(selectedYear !== '' || selectedMonth !== '');

  const yearLabel = $derived(
    yearOptions.find((opt) => opt.value === selectedYear)?.label ??
      'Alle Jahre',
  );
  const monthLabel = $derived(
    monthOptions.find((opt) => opt.value === selectedMonth)?.label ??
      'Alle Monate',
  );

  // =============================================================================
  // DROPDOWN STATE
  // =============================================================================

  let yearDropdownOpen = $state(false);
  let monthDropdownOpen = $state(false);

  // =============================================================================
  // MODAL STATE
  // =============================================================================

  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedEntry = $state<AvailabilityEntry | null>(null);
  let submitting = $state(false);

  // Edit form state
  let editStatus = $state<AvailabilityStatus>('available');
  let editStartDate = $state('');
  let editEndDate = $state('');
  let editReason = $state('');
  let editNotes = $state('');
  let editStatusDropdownOpen = $state(false);

  // =============================================================================
  // HELPERS
  // =============================================================================

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  function formatDate(dateStr: string | null): string {
    if (dateStr === null || dateStr === '') return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function formatDateTime(dateStr: string | null): string {
    if (dateStr === null || dateStr === '') return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateForInput(dateStr: string | null): string {
    if (dateStr === null || dateStr === '') return '';
    return dateStr.split('T')[0];
  }

  function getStatusText(status: string): string {
    if (status in AVAILABILITY_LABELS) {
      return AVAILABILITY_LABELS[status as AvailabilityStatus];
    }
    return status;
  }

  function getStatusClass(status: string): string {
    if (status in AVAILABILITY_BADGE_CLASSES) {
      return AVAILABILITY_BADGE_CLASSES[status as AvailabilityStatus];
    }
    return 'badge--secondary';
  }

  function getStatusIcon(status: string): string {
    if (status in AVAILABILITY_ICONS) {
      return AVAILABILITY_ICONS[status as AvailabilityStatus];
    }
    return 'fa-question-circle';
  }

  function truncateText(text: string | null, maxLength: number = 50): string {
    if (text === null || text === '') return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /** Check if entry is editable (endDate must be today or in the future) */
  function isEditable(entry: AvailabilityEntry): boolean {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Pure comparison function, not reactive state
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Pure comparison function, not reactive state
    const endDate = new Date(entry.endDate);
    endDate.setHours(0, 0, 0, 0);
    return endDate >= today;
  }

  // =============================================================================
  // NAVIGATION & FILTER
  // =============================================================================

  function goBack(): void {
    void goto(resolvePath('/manage-employees'));
  }

  function navigateWithFilter(year: string, month: string): void {
    const params = new SvelteURLSearchParams();
    if (year !== '') params.set('year', year);
    if (month !== '') params.set('month', month);
    const queryString = params.toString();
    const uuid = employee?.uuid ?? '';
    void goto(
      resolvePath(
        `/manage-employees/availability/${uuid}${queryString !== '' ? `?${queryString}` : ''}`,
      ),
    );
  }

  function selectYear(value: string): void {
    yearDropdownOpen = false;
    navigateWithFilter(value, selectedMonth);
  }

  function selectMonth(value: string): void {
    monthDropdownOpen = false;
    navigateWithFilter(selectedYear, value);
  }

  function clearFilter(): void {
    const uuid = employee?.uuid ?? '';
    void goto(resolvePath(`/manage-employees/availability/${uuid}`));
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openEditModal(entry: AvailabilityEntry): void {
    selectedEntry = entry;
    editStatus = entry.status as AvailabilityStatus;
    editStartDate = formatDateForInput(entry.startDate);
    editEndDate = formatDateForInput(entry.endDate);
    editReason = entry.reason ?? '';
    editNotes = entry.notes ?? '';
    showEditModal = true;
  }

  function closeEditModal(): void {
    showEditModal = false;
    selectedEntry = null;
    editStatusDropdownOpen = false;
  }

  function openDeleteModal(entry: AvailabilityEntry): void {
    selectedEntry = entry;
    showDeleteModal = true;
  }

  function closeDeleteModal(): void {
    showDeleteModal = false;
    selectedEntry = null;
  }

  async function saveEntry(): Promise<void> {
    if (selectedEntry === null) return;

    submitting = true;
    try {
      const token =
        document.cookie
          .split('; ')
          .find((row) => row.startsWith('accessToken='))
          ?.split('=')[1] ?? '';

      const response = await fetch(
        `/api/v2/users/availability/${selectedEntry.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: editStatus,
            startDate: editStartDate,
            endDate: editEndDate,
            reason: editReason !== '' ? editReason : null,
            notes: editNotes !== '' ? editNotes : null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update entry');
      }

      closeEditModal();
      await invalidateAll();
    } catch (err) {
      console.error('Error updating entry:', err);
    } finally {
      submitting = false;
    }
  }

  async function deleteEntry(): Promise<void> {
    if (selectedEntry === null) return;

    submitting = true;
    try {
      const token =
        document.cookie
          .split('; ')
          .find((row) => row.startsWith('accessToken='))
          ?.split('=')[1] ?? '';

      const response = await fetch(
        `/api/v2/users/availability/${selectedEntry.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      closeDeleteModal();
      await invalidateAll();
    } catch (err) {
      console.error('Error deleting entry:', err);
    } finally {
      submitting = false;
    }
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleClickOutside(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('#year-dropdown')) yearDropdownOpen = false;
    if (!target.closest('#month-dropdown')) monthDropdownOpen = false;
    if (!target.closest('#edit-status-dropdown'))
      editStatusDropdownOpen = false;
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      yearDropdownOpen = false;
      monthDropdownOpen = false;
      editStatusDropdownOpen = false;
      if (showEditModal) closeEditModal();
      if (showDeleteModal) closeDeleteModal();
    }
  }
</script>

<svelte:head>
  <title
    >Verfügbarkeitshistorie - {employee?.firstName ?? ''}
    {employee?.lastName ?? ''} - Assixx</title
  >
</svelte:head>

<svelte:window
  onclick={handleClickOutside}
  onkeydown={handleKeyDown}
/>

<div class="container">
  <!-- Back Button -->
  <div class="mb-4">
    <button
      type="button"
      class="btn btn-light"
      onclick={goBack}
    >
      <i class="fas fa-arrow-left mr-2"></i>Zurück zur Mitarbeiterverwaltung
    </button>
  </div>

  <div class="card">
    <div class="card__header">
      <div>
        <h2 class="card__title">
          <i class="fas fa-calendar-alt mr-2"></i>
          Verfügbarkeitshistorie
        </h2>
        {#if employee}
          <p class="mt-1 text-[var(--color-text-secondary)]">
            <i class="fas fa-user mr-1"></i>
            {employee.firstName}
            {employee.lastName} ({employee.email})
          </p>
        {/if}
      </div>
    </div>

    <!-- Filter Section -->
    <div class="card__body border-b border-[var(--color-border)]">
      <div class="flex flex-wrap items-end gap-4">
        <!-- Year Dropdown -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="year-dropdown">Jahr</label
          >
          <div
            class="dropdown"
            id="year-dropdown"
            data-dropdown="year"
            role="listbox"
          >
            <div
              class="dropdown__trigger"
              onclick={() => (yearDropdownOpen = !yearDropdownOpen)}
              onkeydown={(e) => {
                if (e.key === 'Enter') yearDropdownOpen = !yearDropdownOpen;
              }}
              role="button"
              tabindex="0"
            >
              <span>{yearLabel}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            {#if yearDropdownOpen}
              <div class="dropdown__menu dropdown__menu--scrollable active">
                {#each yearOptions as opt (opt.value)}
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      selectYear(opt.value);
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') selectYear(opt.value);
                    }}
                    role="option"
                    tabindex="0"
                    aria-selected={selectedYear === opt.value}
                  >
                    {opt.label}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Month Dropdown -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="month-dropdown">Monat</label
          >
          <div
            class="dropdown"
            id="month-dropdown"
            data-dropdown="month"
            role="listbox"
          >
            <div
              class="dropdown__trigger"
              onclick={() => (monthDropdownOpen = !monthDropdownOpen)}
              onkeydown={(e) => {
                if (e.key === 'Enter') monthDropdownOpen = !monthDropdownOpen;
              }}
              role="button"
              tabindex="0"
            >
              <span>{monthLabel}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            {#if monthDropdownOpen}
              <div class="dropdown__menu dropdown__menu--scrollable active">
                {#each monthOptions as opt (opt.value)}
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      selectMonth(opt.value);
                    }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') selectMonth(opt.value);
                    }}
                    role="option"
                    tabindex="0"
                    aria-selected={selectedMonth === opt.value}
                  >
                    {opt.label}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        {#if hasActiveFilter}
          <div class="form-field">
            <span class="form-field__label invisible">Aktion</span>
            <button
              type="button"
              class="btn btn-secondary"
              onclick={clearFilter}
            >
              <i class="fas fa-times mr-2"></i>Filter zurücksetzen
            </button>
          </div>
        {/if}
      </div>
    </div>

    <div class="card__body">
      {#if error}
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-[var(--color-danger)]"
          ></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
        </div>
      {:else if entries.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-calendar-times"></i>
          </div>
          <h3 class="empty-state__title">Keine Einträge gefunden</h3>
          <p class="empty-state__description">
            {#if hasActiveFilter}
              Für den ausgewählten Zeitraum gibt es keine
              Verfügbarkeitseinträge.
            {:else}
              Es wurden noch keine Verfügbarkeitseinträge erfasst.
            {/if}
          </p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={goBack}
          >
            <i class="fas fa-arrow-left mr-2"></i>
            Zurück zur Mitarbeiterverwaltung
          </button>
        </div>
      {:else}
        <div class="mb-4 text-sm text-[var(--color-text-secondary)]">
          {entries.length} Einträge gefunden
          {#if hasActiveFilter}
            (gefiltert)
          {/if}
        </div>
        <div class="table-responsive">
          <table class="data-table data-table--hover data-table--striped">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Von</th>
                <th scope="col">Bis</th>
                <th scope="col">Grund</th>
                <th scope="col">Notizen</th>
                <th scope="col">Erstellt von</th>
                <th scope="col">Erstellt am</th>
                <th
                  scope="col"
                  class="text-right">Aktionen</th
                >
              </tr>
            </thead>
            <tbody>
              {#each entries as entry (entry.id)}
                {@const editable = isEditable(entry)}
                <tr>
                  <td>
                    <span class="badge {getStatusClass(entry.status)}">
                      <i class="fas {getStatusIcon(entry.status)} mr-1"></i>
                      {getStatusText(entry.status)}
                    </span>
                  </td>
                  <td>{formatDate(entry.startDate)}</td>
                  <td>{formatDate(entry.endDate)}</td>
                  <td>{entry.reason ?? '-'}</td>
                  <td title={entry.notes ?? ''}>{truncateText(entry.notes)}</td>
                  <td>{entry.createdByName ?? '-'}</td>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>
                    <div class="flex justify-end gap-2">
                      {#if editable}
                        <button
                          type="button"
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Eintrag bearbeiten"
                          onclick={() => {
                            openEditModal(entry);
                          }}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                      {:else}
                        <button
                          type="button"
                          class="action-icon action-icon--edit cursor-not-allowed opacity-30"
                          title="Vergangene Einträge können nicht bearbeitet werden"
                          aria-label="Bearbeiten nicht möglich"
                          disabled
                        >
                          <i class="fas fa-lock"></i>
                        </button>
                      {/if}
                      <button
                        type="button"
                        class="action-icon action-icon--delete"
                        title="Löschen"
                        aria-label="Eintrag löschen"
                        onclick={() => {
                          openDeleteModal(entry);
                        }}
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Edit Modal -->
{#if showEditModal && selectedEntry !== null}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-modal-title"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeEditModal();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
    <form
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onsubmit={(e) => {
        e.preventDefault();
        void saveEntry();
      }}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="edit-modal-title"
        >
          <i class="fas fa-edit mr-2"></i>
          Eintrag bearbeiten
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={closeEditModal}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <!-- Status Dropdown -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-status-dropdown">Status</label
          >
          <div
            class="dropdown"
            id="edit-status-dropdown"
          >
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={editStatusDropdownOpen}
              onclick={(e) => {
                e.stopPropagation();
                editStatusDropdownOpen = !editStatusDropdownOpen;
              }}
            >
              <span>
                <i class="fas {getStatusIcon(editStatus)} mr-1"></i>
                {getStatusText(editStatus)}
              </span>
              <i class="fas fa-chevron-down"></i>
            </div>
            {#if editStatusDropdownOpen}
              <div class="dropdown__menu dropdown__menu--scrollable active">
                {#each STATUS_OPTIONS as opt (opt.value)}
                  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      editStatus = opt.value;
                      editStatusDropdownOpen = false;
                    }}
                  >
                    <i class="fas {getStatusIcon(opt.value)} mr-1"></i>
                    {opt.label}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Date Range -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-start-date">Von Datum</label
          >
          <div class="date-picker">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input
              type="date"
              id="edit-start-date"
              class="date-picker__input"
              bind:value={editStartDate}
              required
            />
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-end-date">Bis Datum</label
          >
          <div class="date-picker">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input
              type="date"
              id="edit-end-date"
              class="date-picker__input"
              bind:value={editEndDate}
              required
            />
          </div>
        </div>

        <!-- Reason -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-reason">Grund (optional)</label
          >
          <input
            type="text"
            id="edit-reason"
            class="form-field__control"
            maxlength="255"
            placeholder="z.B. Grippe, Familienfeier..."
            bind:value={editReason}
          />
        </div>

        <!-- Notes -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-notes">Notiz (optional)</label
          >
          <textarea
            id="edit-notes"
            class="form-field__control"
            rows="3"
            maxlength="500"
            placeholder="Zusätzliche Informationen..."
            bind:value={editNotes}
          ></textarea>
        </div>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={closeEditModal}>Abbrechen</button
        >
        <button
          type="submit"
          class="btn btn-modal"
          disabled={submitting}
        >
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"
            ></span>{/if}
          Speichern
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && selectedEntry !== null}
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
    <div
      class="ds-modal"
      role="presentation"
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="delete-modal-title"
        >
          <i class="fas fa-trash mr-2 text-[var(--color-danger)]"></i>
          Eintrag löschen
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={closeDeleteModal}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <p class="text-[var(--color-text-secondary)]">
          Möchten Sie diesen Verfügbarkeitseintrag wirklich löschen?
        </p>
        <div class="mt-4 rounded-lg bg-[var(--color-bg-secondary)] p-4">
          <div class="mb-2 flex items-center gap-2">
            <span class="badge {getStatusClass(selectedEntry.status)}">
              <i class="fas {getStatusIcon(selectedEntry.status)} mr-1"></i>
              {getStatusText(selectedEntry.status)}
            </span>
          </div>
          <p class="text-sm">
            <strong>Zeitraum:</strong>
            {formatDate(selectedEntry.startDate)} - {formatDate(
              selectedEntry.endDate,
            )}
          </p>
          {#if selectedEntry.reason}
            <p class="mt-1 text-sm">
              <strong>Grund:</strong>
              {selectedEntry.reason}
            </p>
          {/if}
        </div>
        <p class="mt-4 text-sm text-[var(--color-warning)]">
          <i class="fas fa-exclamation-triangle mr-1"></i>
          Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={closeDeleteModal}>Abbrechen</button
        >
        <button
          type="button"
          class="btn btn-danger"
          disabled={submitting}
          onclick={() => {
            void deleteEntry();
          }}
        >
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"
            ></span>{/if}
          Löschen
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Dropdown trigger sizing for filter dropdowns */
  :global([data-dropdown='year'] .dropdown__trigger),
  :global([data-dropdown='month'] .dropdown__trigger) {
    width: auto;
    min-width: 160px;
  }
</style>
