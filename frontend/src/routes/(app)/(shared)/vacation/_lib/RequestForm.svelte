<script lang="ts">
  /**
   * RequestForm — Create or edit a vacation request.
   * Includes date pickers, type selector, half-day options, note, and
   * live capacity check (300ms debounce).
   *
   * Designed to be embedded inside a ds-modal structure:
   * - Parent provides ds-modal__header and ds-modal__footer
   * - This component renders form fields for ds-modal__body
   */
  import { onDestroy } from 'svelte';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

  import CapacityIndicator from './CapacityIndicator.svelte';
  import { CAPACITY_DEBOUNCE_MS, HALF_DAY_LABELS, TYPE_LABELS } from './constants';

  import type {
    CreateVacationRequestPayload,
    VacationCapacityAnalysis,
    VacationHalfDay,
    VacationRequest,
    VacationType,
  } from './types';

  const {
    editingRequest = null,
    initialCapacity = null,
    labels = DEFAULT_HIERARCHY_LABELS,
    onsubmit,
    onCapacityCheck,
  }: {
    editingRequest?: VacationRequest | null;
    /** Pre-fetched capacity from parent (edit mode). Avoids redundant API call on mount. */
    initialCapacity?: VacationCapacityAnalysis | null;
    labels?: HierarchyLabels;
    onsubmit: (payload: CreateVacationRequestPayload) => void;
    onCapacityCheck: (
      startDate: string,
      endDate: string,
    ) => Promise<VacationCapacityAnalysis | null>;
  } = $props();

  // ─── Form state ─────────────────────────────────────────────────────

  let startDate = $state('');
  let endDate = $state('');
  let halfDayStart = $state<VacationHalfDay>('none');
  let halfDayEnd = $state<VacationHalfDay>('none');
  let vacationType = $state<VacationType>('regular');
  let requestNote = $state('');

  // Today as YYYY-MM-DD — minimum selectable date (no past-date requests)
  const todayStr = $derived.by(() => {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // Track initial dates to avoid overwriting parent pre-fetch with stale own-check
  let initialStartDate = '';
  let initialEndDate = '';

  // One-shot initialization from prop (component is recreated per modal open)
  let hasInitialized = $state(false);
  $effect(() => {
    if (!hasInitialized) {
      hasInitialized = true;
      if (editingRequest !== null) {
        startDate = editingRequest.startDate;
        endDate = editingRequest.endDate;
        halfDayStart = editingRequest.halfDayStart;
        halfDayEnd = editingRequest.halfDayEnd;
        vacationType = editingRequest.vacationType;
        requestNote = editingRequest.requestNote ?? '';
        initialStartDate = editingRequest.startDate;
        initialEndDate = editingRequest.endDate;
      }
    }
  });

  let capacityAnalysis = $state<VacationCapacityAnalysis | null>(null);
  let isCheckingCapacity = $state(false);

  // NOT $state — timer handle is internal, not reactive UI state
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Dropdown state ─────────────────────────────────────────────────

  let activeDropdown = $state<string | null>(null);

  function toggleDropdown(id: string): void {
    activeDropdown = activeDropdown === id ? null : id;
  }

  function closeAllDropdowns(): void {
    activeDropdown = null;
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(closeAllDropdowns);
  });

  // ─── Display texts ────────────────────────────────────────────────

  const vacationTypeDisplay = $derived(TYPE_LABELS[vacationType]);
  const halfDayStartDisplay = $derived(HALF_DAY_LABELS[halfDayStart]);
  const halfDayEndDisplay = $derived(HALF_DAY_LABELS[halfDayEnd]);

  // ─── Derived ────────────────────────────────────────────────────────

  const isSingleDay = $derived(startDate === endDate && startDate !== '');

  const canSubmit = $derived(
    startDate !== '' && endDate !== '' && endDate >= startDate && startDate >= todayStr,
  );

  const vacationTypes = $derived(Object.entries(TYPE_LABELS) as [VacationType, string][]);

  const halfDayOptions = $derived(Object.entries(HALF_DAY_LABELS) as [VacationHalfDay, string][]);

  // ─── Capacity check with debounce ──────────────────────────────────

  let isFirstCheck = true;

  /** Fire API call immediately (no debounce) */
  function fireCapacityRequest() {
    isCheckingCapacity = true;
    void onCapacityCheck(startDate, endDate)
      .then((result) => {
        capacityAnalysis = result;
      })
      .finally(() => {
        isCheckingCapacity = false;
      });
  }

  function triggerCapacityCheck() {
    if (startDate === '' || endDate === '' || endDate < startDate) {
      capacityAnalysis = null;
      return;
    }

    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    if (isFirstCheck) {
      isFirstCheck = false;
      // First valid date pair: fire immediately, no debounce
      // In edit mode, parent also pre-fetches — whichever arrives first wins
      fireCapacityRequest();
      return;
    }

    // Subsequent date changes: debounce to avoid rapid-fire API calls
    debounceTimer = setTimeout(fireCapacityRequest, CAPACITY_DEBOUNCE_MS);
  }

  $effect(() => {
    // Track date dependencies — trigger capacity check when dates change
    const trackedStart = startDate;
    const trackedEnd = endDate;
    void trackedStart;
    void trackedEnd;
    triggerCapacityCheck();
  });

  // Sync pre-fetched capacity from parent (edit mode)
  $effect(() => {
    if (initialCapacity !== null && startDate === initialStartDate && endDate === initialEndDate) {
      capacityAnalysis = initialCapacity;
      isCheckingCapacity = false;
    }
  });

  onDestroy(() => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
  });

  // ─── Selection handlers ───────────────────────────────────────────

  function handleVacationTypeSelect(value: VacationType): void {
    vacationType = value;
    closeAllDropdowns();
  }

  function handleHalfDayStartSelect(value: VacationHalfDay): void {
    halfDayStart = value;
    closeAllDropdowns();
  }

  function handleHalfDayEndSelect(value: VacationHalfDay): void {
    halfDayEnd = value;
    closeAllDropdowns();
  }

  // ─── Submit (called by parent via form onsubmit) ───────────────────

  /** Build and emit payload. Exported so parent form can call it. */
  export function submitForm(): void {
    if (!canSubmit) return;

    const payload: CreateVacationRequestPayload = {
      startDate,
      endDate,
      vacationType,
    };

    if (halfDayStart !== 'none') payload.halfDayStart = halfDayStart;
    if (halfDayEnd !== 'none') payload.halfDayEnd = halfDayEnd;
    if (requestNote.trim() !== '') payload.requestNote = requestNote.trim();

    onsubmit(payload);
  }

  /** Expose canSubmit for parent to disable/enable submit button */
  export function getCanSubmit(): boolean {
    return canSubmit;
  }
</script>

<!-- Dates -->
<div class="request-form__row">
  <div class="form-field">
    <label
      class="form-field__label"
      for="start-date">Von</label
    >
    <AppDatePicker
      bind:value={startDate}
      min={todayStr}
    />
  </div>
  <div class="form-field">
    <label
      class="form-field__label"
      for="end-date">Bis</label
    >
    <AppDatePicker
      bind:value={endDate}
      min={startDate}
      placeholder={startDate}
    />
  </div>
</div>

<!-- Half-day options -->
<div class="request-form__row">
  <div class="form-field">
    <span class="form-field__label">Erster Tag</span>
    <div
      class="dropdown mt-2"
      data-dropdown="halfDayStart"
    >
      <button
        type="button"
        class="dropdown__trigger"
        class:active={activeDropdown === 'halfDayStart'}
        onclick={() => {
          toggleDropdown('halfDayStart');
        }}
      >
        <span>{halfDayStartDisplay}</span>
        <i class="fas fa-chevron-down"></i>
      </button>
      <div
        class="dropdown__menu"
        class:active={activeDropdown === 'halfDayStart'}
      >
        {#each halfDayOptions as [value, label] (value)}
          <button
            type="button"
            class="dropdown__option"
            data-action="select-half-day-start"
            data-value={value}
            onclick={() => {
              handleHalfDayStartSelect(value);
            }}
          >
            {label}
          </button>
        {/each}
      </div>
    </div>
  </div>
  {#if !isSingleDay}
    <div class="form-field">
      <span class="form-field__label">Letzter Tag</span>
      <div
        class="dropdown mt-2"
        data-dropdown="halfDayEnd"
      >
        <button
          type="button"
          class="dropdown__trigger"
          class:active={activeDropdown === 'halfDayEnd'}
          onclick={() => {
            toggleDropdown('halfDayEnd');
          }}
        >
          <span>{halfDayEndDisplay}</span>
          <i class="fas fa-chevron-down"></i>
        </button>
        <div
          class="dropdown__menu"
          class:active={activeDropdown === 'halfDayEnd'}
        >
          {#each halfDayOptions as [value, label] (value)}
            <button
              type="button"
              class="dropdown__option"
              data-action="select-half-day-end"
              data-value={value}
              onclick={() => {
                handleHalfDayEndSelect(value);
              }}
            >
              {label}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Type -->
<div class="form-field">
  <span class="form-field__label">Urlaubsart</span>
  <div
    class="dropdown mt-2"
    data-dropdown="vacationType"
  >
    <button
      type="button"
      class="dropdown__trigger"
      class:active={activeDropdown === 'vacationType'}
      onclick={() => {
        toggleDropdown('vacationType');
      }}
    >
      <span>{vacationTypeDisplay}</span>
      <i class="fas fa-chevron-down"></i>
    </button>
    <div
      class="dropdown__menu"
      class:active={activeDropdown === 'vacationType'}
    >
      {#each vacationTypes as [value, label] (value)}
        <button
          type="button"
          class="dropdown__option"
          data-action="select-vacation-type"
          data-value={value}
          onclick={() => {
            handleVacationTypeSelect(value);
          }}
        >
          {label}
        </button>
      {/each}
    </div>
  </div>
</div>

<!-- Note -->
<div class="form-field">
  <label
    class="form-field__label"
    for="request-note">Bemerkung (optional)</label
  >
  <textarea
    id="request-note"
    class="form-field__control form-field__control--textarea"
    bind:value={requestNote}
    placeholder="Optionale Bemerkung zum Antrag..."
  ></textarea>
</div>

<!-- Capacity Check Result -->
<CapacityIndicator
  analysis={capacityAnalysis}
  isLoading={isCheckingCapacity}
  {labels}
/>

<style>
  .request-form__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-4, 1rem);
  }
</style>
