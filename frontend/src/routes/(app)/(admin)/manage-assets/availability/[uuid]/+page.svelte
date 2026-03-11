<script lang="ts">
  /**
   * Asset Availability History - Page Component
   * @module manage-assets/availability/[uuid]/+page
   *
   * Displays availability history for a specific asset.
   * Mirrors the employee availability history page pattern.
   */
  import { SvelteURLSearchParams } from 'svelte/reactivity';

  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import DeleteConfirmationModal from '$lib/asset-availability/DeleteConfirmationModal.svelte';
  import EditAssetAvailabilityModal from '$lib/asset-availability/EditAssetAvailabilityModal.svelte';
  import {
    formatDate,
    formatDateTime,
    getStatusClass,
    getStatusIcon,
    getStatusText,
    truncateText,
  } from '$lib/asset-availability/helpers';

  import type { PageData } from './$types';

  // =============================================================================
  // TYPES
  // =============================================================================

  interface AssetAvailabilityEntry {
    id: number;
    assetId: number;
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

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const asset = $derived(data.asset);
  const entries = $derived(data.entries as AssetAvailabilityEntry[]);
  const error = $derived(data.error);

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
  let selectedEntry = $state<AssetAvailabilityEntry | null>(null);

  // =============================================================================
  // HELPERS
  // =============================================================================

  /** Check if entry is editable (endDate must be today or in the future) */
  function isEditable(entry: AssetAvailabilityEntry): boolean {
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
    void goto(resolve('/manage-assets'));
  }

  function navigateWithFilter(year: string, month: string): void {
    const params = new SvelteURLSearchParams();
    if (year !== '') params.set('year', year);
    if (month !== '') params.set('month', month);
    const queryString = params.toString();
    const uuid = asset?.uuid ?? '';
    void goto(
      resolve(
        `/manage-assets/availability/${uuid}${queryString !== '' ? `?${queryString}` : ''}`,
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
    const uuid = asset?.uuid ?? '';
    void goto(resolve(`/manage-assets/availability/${uuid}`));
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openEditModal(entry: AssetAvailabilityEntry): void {
    selectedEntry = entry;
    showEditModal = true;
  }

  function closeEditModal(): void {
    showEditModal = false;
    selectedEntry = null;
  }

  function openDeleteModal(entry: AssetAvailabilityEntry): void {
    selectedEntry = entry;
    showDeleteModal = true;
  }

  function closeDeleteModal(): void {
    showDeleteModal = false;
    selectedEntry = null;
  }

  async function handleModalSuccess(): Promise<void> {
    await invalidateAll();
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      yearDropdownOpen = false;
      monthDropdownOpen = false;
      if (showEditModal) closeEditModal();
      if (showDeleteModal) closeDeleteModal();
    }
  }

  $effect(() => {
    return onClickOutsideDropdown(() => {
      yearDropdownOpen = false;
      monthDropdownOpen = false;
    });
  });
</script>

<svelte:head>
  <title>Anlagenverfügbarkeit - {asset?.name ?? ''} - Assixx</title>
</svelte:head>

<svelte:window onkeydown={handleKeyDown} />

<div class="container">
  <!-- Back Button -->
  <div class="mb-4">
    <button
      type="button"
      class="btn btn-light"
      onclick={goBack}
    >
      <i class="fas fa-arrow-left mr-2"></i>Zurück zur Anlagenverwaltung
    </button>
  </div>

  <div class="card">
    <div class="card__header">
      <div>
        <h2 class="card__title">
          <i class="fas fa-cog mr-2"></i>
          Anlagenverfügbarkeit
        </h2>
        {#if asset}
          <p class="mt-1 text-(--color-text-secondary)">
            <i class="fas fa-industry mr-1"></i>
            {asset.name}
          </p>
        {/if}
      </div>
    </div>

    <!-- Filter Section -->
    <div class="card__body border-b border-(--color-border)">
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
              <div class="dropdown__menu active">
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
              <div class="dropdown__menu active">
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
            class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"
          ></i>
          <p class="text-(--color-text-secondary)">{error}</p>
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
              Es wurden noch keine Verfügbarkeitseinträge für diese Anlage
              erfasst.
            {/if}
          </p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={goBack}
          >
            <i class="fas fa-arrow-left mr-2"></i>
            Zurück zur Anlagenverwaltung
          </button>
        </div>
      {:else}
        <div class="mb-4 text-sm text-(--color-text-secondary)">
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

<!-- Modal Components -->
<EditAssetAvailabilityModal
  entry={selectedEntry}
  show={showEditModal}
  onClose={closeEditModal}
  onSuccess={handleModalSuccess}
/>

<DeleteConfirmationModal
  entry={selectedEntry}
  show={showDeleteModal}
  onClose={closeDeleteModal}
  onSuccess={handleModalSuccess}
/>

<style>
  /* Dropdown trigger sizing for filter dropdowns */
  :global([data-dropdown='year'] .dropdown__trigger),
  :global([data-dropdown='month'] .dropdown__trigger) {
    width: auto;
    min-width: 160px;
  }
</style>
