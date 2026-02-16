<!--
  EditMachineAvailabilityModal.svelte (Shared)
  Modal for editing existing machine availability entries.
  Self-contained with internal state and API calls.
-->
<script lang="ts">
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';

  import { MACHINE_AVAILABILITY_STATUS_OPTIONS } from './constants';
  import { formatDateForInput, getStatusIcon, getStatusText } from './helpers';

  import type { MachineAvailabilityStatus } from './constants';

  // =============================================================================
  // TYPES
  // =============================================================================

  interface MachineAvailabilityEntry {
    id: number;
    machineId: number;
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

  interface Props {
    entry: MachineAvailabilityEntry | null;
    show: boolean;
    onClose: () => void;
    onSuccess: () => Promise<void>;
  }

  // =============================================================================
  // PROPS
  // =============================================================================

  const { entry, show, onClose, onSuccess }: Props = $props();

  // =============================================================================
  // STATE
  // =============================================================================

  let submitting = $state(false);
  let editStatus = $state<MachineAvailabilityStatus>('operational');
  let editStartDate = $state('');
  let editEndDate = $state('');
  let editReason = $state('');
  let editNotes = $state('');
  let editStatusDropdownOpen = $state(false);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  $effect(() => {
    if (entry !== null && show) {
      editStatus = entry.status as MachineAvailabilityStatus;
      editStartDate = formatDateForInput(entry.startDate);
      editEndDate = formatDateForInput(entry.endDate);
      editReason = entry.reason ?? '';
      editNotes = entry.notes ?? '';
      editStatusDropdownOpen = false;
      submitting = false;
    }
  });

  // =============================================================================
  // HANDLERS
  // =============================================================================

  function handleClose(): void {
    editStatusDropdownOpen = false;
    onClose();
  }

  async function handleSave(): Promise<void> {
    if (entry === null) return;

    submitting = true;
    try {
      const token =
        document.cookie
          .split('; ')
          .find((row) => row.startsWith('accessToken='))
          ?.split('=')[1] ?? '';

      const response = await fetch(
        `/api/v2/machines/availability/${entry.id}`,
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

      handleClose();
      await onSuccess();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error updating machine availability entry:', errorMessage);
    } finally {
      submitting = false;
    }
  }

  $effect(() => {
    return onClickOutsideDropdown(() => {
      editStatusDropdownOpen = false;
    });
  });
</script>

{#if show && entry !== null}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <div
    id="edit-machine-availability-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-machine-avail-modal-title"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) handleClose();
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
        void handleSave();
      }}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="edit-machine-avail-modal-title"
        >
          <i class="fas fa-edit mr-2"></i>
          Eintrag bearbeiten
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={handleClose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <!-- Status Dropdown -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-machine-status-dropdown">Status</label
          >
          <div
            class="dropdown"
            id="edit-machine-status-dropdown"
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
                {#each MACHINE_AVAILABILITY_STATUS_OPTIONS as opt (opt.value)}
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
            for="edit-machine-start-date">Von Datum</label
          >
          <AppDatePicker
            bind:value={editStartDate}
            required
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-machine-end-date">Bis Datum</label
          >
          <AppDatePicker
            bind:value={editEndDate}
            min={editStartDate}
            placeholder={editStartDate}
            required
          />
        </div>

        <!-- Reason -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-machine-reason">Grund (optional)</label
          >
          <input
            type="text"
            id="edit-machine-reason"
            class="form-field__control"
            maxlength="255"
            placeholder="z.B. Geplante Wartung, Ersatzteil defekt..."
            bind:value={editReason}
          />
        </div>

        <!-- Notes -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-machine-notes">Notiz (optional)</label
          >
          <textarea
            id="edit-machine-notes"
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
          onclick={handleClose}>Abbrechen</button
        >
        <button
          type="submit"
          class="btn btn-primary"
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
