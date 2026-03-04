<script lang="ts">
  /**
   * AssignUserModal — Select employees to assign to a work order.
   * Shows eligible users not currently assigned.
   */
  import { MESSAGES } from '../../_lib/constants';

  import type { EligibleUser, WorkOrderListItem } from '../../_lib/types';

  interface Props {
    show: boolean;
    workOrder: WorkOrderListItem | null;
    eligibleUsers: EligibleUser[];
    submitting: boolean;
    onclose: () => void;
    onsave: (userUuids: string[]) => void;
  }

  const { show, workOrder, eligibleUsers, submitting, onclose, onsave }: Props =
    $props();

  let selectedUuids = $state<string[]>([]);
  let searchQuery = $state('');

  /** Filter out already-assigned users and apply search */
  const availableUsers = $derived.by((): EligibleUser[] => {
    const assignedNames =
      workOrder !== null ? workOrder.assigneeNames.toLowerCase() : '';
    const query = searchQuery.toLowerCase().trim();

    return eligibleUsers.filter((user: EligibleUser) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();

      // Skip already assigned (approximate match via assigneeNames)
      if (assignedNames !== '' && assignedNames.includes(fullName)) {
        return false;
      }

      // Apply search filter
      if (query === '') return true;
      return (
        fullName.includes(query) ||
        user.employeeNumber?.toLowerCase().includes(query) === true
      );
    });
  });

  const hasSelection = $derived(selectedUuids.length > 0);

  let touched = $state(false);
  const showError = $derived(touched && !hasSelection);

  /** Reset state when modal opens */
  $effect(() => {
    if (show) {
      selectedUuids = [];
      searchQuery = '';
      touched = false;
    }
  });

  function handleUserSelect(e: Event): void {
    const select = e.currentTarget as HTMLSelectElement;
    const selected: string[] = [];
    for (const opt of select.selectedOptions) {
      selected.push(opt.value);
    }
    selectedUuids = selected;
    touched = true;
  }

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    touched = true;
    if (!hasSelection) return;
    onsave(selectedUuids);
  }
</script>

{#if show && workOrder !== null}
  <div
    id="work-order-assign-user-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="assign-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
    <form
      class="ds-modal"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
      onsubmit={handleSubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="assign-modal-title"
        >
          {MESSAGES.ASSIGNEES_ADD}
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
        <p class="assign-context">
          <strong>{workOrder.title}</strong>
        </p>

        <!-- Search -->
        <div class="form-field mb-4">
          <input
            type="text"
            class="form-field__control"
            placeholder="Mitarbeiter suchen..."
            bind:value={searchQuery}
          />
        </div>

        <!-- User list -->
        {#if availableUsers.length === 0}
          <p class="assign-empty">
            {MESSAGES.ASSIGNEES_EMPTY}
          </p>
        {:else}
          <div class="form-field">
            <select
              id="assign-user-select"
              multiple
              class="multi-select"
              class:error={showError}
              aria-invalid={showError}
              onchange={handleUserSelect}
            >
              {#each availableUsers as user (user.uuid)}
                <option value={user.uuid}>
                  {user.firstName}
                  {user.lastName}
                  {#if user.employeeNumber !== null}
                    ({user.employeeNumber})
                  {/if}
                </option>
              {/each}
            </select>
            {#if showError}
              <span class="form-field__message form-field__message--error">
                Mindestens 1 Mitarbeiter auswählen
              </span>
            {:else}
              <span class="multi-select__hint">
                <i class="fas fa-info-circle"></i>
                Strg + Klick für Mehrfachauswahl
              </span>
            {/if}
          </div>
        {/if}

        {#if hasSelection}
          <p class="assign-count mt-2">
            {selectedUuids.length}
            {MESSAGES.ASSIGNEES_SELECT}
          </p>
        {/if}
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={submitting}
        >
          {#if submitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
          {/if}
          {MESSAGES.BTN_ASSIGN}
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
  .assign-context {
    margin: 0 0 1rem;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .assign-empty {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    font-style: italic;
    text-align: center;
    padding: 1rem 0;
  }

  .assign-count {
    font-size: 0.813rem;
    color: var(--color-text-secondary);
    font-weight: 600;
  }
</style>
