<!--
  AvailabilityModal.svelte
  Modal for quick availability editing (updates users table)
  Uses ds-modal design system components
-->
<script lang="ts">
  import { AVAILABILITY_STATUS_OPTIONS, AVAILABILITY_ICONS } from './constants';
  import { getAvailabilityLabel } from './utils';

  import type { AvailabilityStatus, Employee } from './types';

  /** Get icon class for status (type-safe helper) */
  function getStatusIcon(status: AvailabilityStatus): string {
    return AVAILABILITY_ICONS[status];
  }

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    show: boolean;
    employee: Employee | null;
    submitting: boolean;

    // Bound form values (parent uses bind:)
    availabilityStatus: AvailabilityStatus;
    availabilityStart: string;
    availabilityEnd: string;
    availabilityReason: string;
    availabilityNotes: string;

    // Event handlers
    onclose: () => void;
    onsave: () => void;
    onmanage: (uuid: string) => void;
  }

  /* eslint-disable prefer-const -- Svelte reactive props must use let */
  /* eslint-disable @typescript-eslint/no-useless-default-assignment -- $bindable() required for bind: */
  let {
    show,
    employee,
    submitting,
    availabilityStatus = $bindable(),
    availabilityStart = $bindable(),
    availabilityEnd = $bindable(),
    availabilityReason = $bindable(),
    availabilityNotes = $bindable(),
    onclose,
    onsave,
    onmanage,
  }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  // =============================================================================
  // LOCAL STATE
  // =============================================================================

  let statusDropdownOpen = $state(false);

  // =============================================================================
  // DERIVED
  // =============================================================================

  const employeeName = $derived(
    employee !== null ? `${employee.firstName} ${employee.lastName}` : '',
  );

  // =============================================================================
  // HANDLERS
  // =============================================================================

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  function handleSubmit(e: Event): void {
    e.preventDefault();
    onsave();
  }

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: AvailabilityStatus): void {
    availabilityStatus = status;
    statusDropdownOpen = false;
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLER
  // =============================================================================

  function isClickOutsideDropdown(target: HTMLElement, elementId: string): boolean {
    const el = document.getElementById(elementId);
    return el !== null && !el.contains(target);
  }

  $effect(() => {
    if (statusDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        if (isClickOutsideDropdown(target, 'availability-status-dropdown')) {
          statusDropdownOpen = false;
        }
      };

      document.addEventListener('click', handleOutsideClick);
      return () => {
        document.removeEventListener('click', handleOutsideClick);
      };
    }
  });
</script>

{#if show && employee !== null}
  <!-- Availability Modal -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <div
    id="availability-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="availability-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
    <form
      id="availability-form"
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onsubmit={handleSubmit}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title" id="availability-modal-title">
          <i class="fas fa-calendar-alt mr-2"></i>
          Verfügbarkeit: {employeeName}
        </h3>
        <button type="button" class="ds-modal__close" aria-label="Schließen" onclick={onclose}>
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <!-- Status - Custom Dropdown -->
        <div class="form-field">
          <label class="form-field__label" for="availability-status">
            <i class="fas fa-user-clock mr-1"></i>
            Status
          </label>
          <div class="dropdown" id="availability-status-dropdown">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={statusDropdownOpen}
              onclick={toggleStatusDropdown}
            >
              <span>
                <i class="fas {getStatusIcon(availabilityStatus)} mr-1"></i>
                {getAvailabilityLabel(availabilityStatus)}
              </span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="dropdown__menu" class:active={statusDropdownOpen}>
              {#each AVAILABILITY_STATUS_OPTIONS as option (option.value)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(option.value);
                  }}
                >
                  <i class="fas {getStatusIcon(option.value)} mr-1"></i>
                  {option.label}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Date Range -->
        <div class="form-field">
          <label class="form-field__label" for="availability-start"> Von Datum </label>
          <div class="date-picker">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input
              type="date"
              id="availability-start"
              name="availabilityStart"
              class="date-picker__input"
              bind:value={availabilityStart}
            />
          </div>
        </div>

        <div class="form-field">
          <label class="form-field__label" for="availability-end"> Bis Datum </label>
          <div class="date-picker">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input
              type="date"
              id="availability-end"
              name="availabilityEnd"
              class="date-picker__input"
              bind:value={availabilityEnd}
            />
          </div>
        </div>

        <!-- Reason -->
        <div class="form-field">
          <label class="form-field__label" for="availability-reason"> Grund (optional) </label>
          <input
            type="text"
            id="availability-reason"
            name="availabilityReason"
            class="form-field__control"
            maxlength="255"
            placeholder="z.B. Grippe, Familienfeier, Fortbildung..."
            bind:value={availabilityReason}
          />
        </div>

        <!-- Notes -->
        <div class="form-field">
          <label class="form-field__label" for="availability-notes"> Notiz (optional) </label>
          <textarea
            id="availability-notes"
            name="availabilityNotes"
            class="form-field__control"
            rows="3"
            maxlength="500"
            placeholder="Zusätzliche Informationen..."
            bind:value={availabilityNotes}
          ></textarea>
          <span class="form-field__message text-[var(--color-text-secondary)]">
            {availabilityNotes.length}/500 Zeichen
          </span>
        </div>
      </div>

      <div class="ds-modal__footer ds-modal__footer--between">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => {
            // employee guaranteed non-null by outer {#if} block
            onmanage(employee.uuid);
          }}
        >
          <i class="fas fa-history mr-2"></i>Historie
        </button>
        <div class="flex gap-2">
          <button type="button" class="btn btn-cancel" onclick={onclose}>Abbrechen</button>
          <button type="submit" class="btn btn-modal" disabled={submitting}>
            {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
            Speichern
          </button>
        </div>
      </div>
    </form>
  </div>
{/if}
