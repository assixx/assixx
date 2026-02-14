<!--
  MachineAvailabilityModal.svelte (Shared)
  Modal for quick machine availability entry creation.
  Uses ds-modal design system components.
-->
<script lang="ts">
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';

  import {
    MACHINE_AVAILABILITY_STATUS_OPTIONS,
    MACHINE_AVAILABILITY_ICONS,
    MACHINE_AVAILABILITY_LABELS,
  } from './constants';

  import type { MachineAvailabilityStatus } from './constants';

  /** Minimal machine shape needed by this modal */
  interface AvailabilityMachine {
    name: string;
    uuid: string;
  }

  /** Get icon class for status */
  function getStatusIcon(status: MachineAvailabilityStatus): string {
    return MACHINE_AVAILABILITY_ICONS[status];
  }

  /** Get label for status */
  function getAvailabilityLabel(status: MachineAvailabilityStatus): string {
    return MACHINE_AVAILABILITY_LABELS[status];
  }

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    show: boolean;
    machine: AvailabilityMachine | null;
    submitting: boolean;

    // Bound form values (parent uses bind:)
    availabilityStatus: MachineAvailabilityStatus;
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
    machine,
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

  function selectStatus(status: MachineAvailabilityStatus): void {
    availabilityStatus = status;
    statusDropdownOpen = false;
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLER
  // =============================================================================

  function isClickOutsideDropdown(
    target: HTMLElement,
    elementId: string,
  ): boolean {
    const el = document.getElementById(elementId);
    return el !== null && !el.contains(target);
  }

  $effect(() => {
    if (show) {
      statusDropdownOpen = false;
    }
  });

  $effect(() => {
    if (statusDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        if (
          isClickOutsideDropdown(target, 'machine-availability-status-dropdown')
        ) {
          statusDropdownOpen = false;
        }
      };

      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });
</script>

{#if show && machine !== null}
  <!-- Machine Availability Modal -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <div
    id="machine-availability-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="machine-availability-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
    <form
      id="machine-availability-form"
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onsubmit={handleSubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="machine-availability-modal-title"
        >
          <i class="fas fa-cog mr-2"></i>
          Verfügbarkeit: {machine.name}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <!-- Status - Custom Dropdown -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-availability-status"
          >
            <i class="fas fa-cogs mr-1"></i>
            Status
          </label>
          <div
            class="dropdown"
            id="machine-availability-status-dropdown"
          >
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
            <div
              class="dropdown__menu"
              class:active={statusDropdownOpen}
            >
              {#each MACHINE_AVAILABILITY_STATUS_OPTIONS as option (option.value)}
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
          <label
            class="form-field__label"
            for="machine-availability-start"
          >
            Von Datum
          </label>
          <AppDatePicker
            bind:value={availabilityStart}
            name="availabilityStart"
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-availability-end"
          >
            Bis Datum
          </label>
          <AppDatePicker
            bind:value={availabilityEnd}
            name="availabilityEnd"
            min={availabilityStart}
            placeholder={availabilityStart}
          />
        </div>

        <!-- Reason -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-availability-reason"
          >
            Grund (optional)
          </label>
          <input
            type="text"
            id="machine-availability-reason"
            name="availabilityReason"
            class="form-field__control"
            maxlength="255"
            placeholder="z.B. Geplante Wartung, Ersatzteil defekt..."
            bind:value={availabilityReason}
          />
        </div>

        <!-- Notes -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-availability-notes"
          >
            Notiz (optional)
          </label>
          <textarea
            id="machine-availability-notes"
            name="availabilityNotes"
            class="form-field__control"
            rows="3"
            maxlength="500"
            placeholder="Zusätzliche Informationen..."
            bind:value={availabilityNotes}
          ></textarea>
          <span class="form-field__message text-(--color-text-secondary)">
            {availabilityNotes.length}/500 Zeichen
          </span>
        </div>
      </div>

      <div class="ds-modal__footer ds-modal__footer--between">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => {
            onmanage(machine.uuid);
          }}
        >
          <i class="fas fa-history mr-2"></i>Historie
        </button>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn btn-cancel"
            onclick={onclose}>Abbrechen</button
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
      </div>
    </form>
  </div>
{/if}
