<script lang="ts">
  /**
   * CreateWorkOrderFromKvp — Modal für Arbeitsauftrag aus KVP-Vorschlag.
   *
   * Pre-fills title + description from suggestion, sets sourceType='kvp_proposal'.
   * Fetches all eligible users on open (no asset-based filtering for KVP).
   */
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import { createWorkOrder, logApiError } from '../../work-orders/_lib/api';
  import { PRIORITY_LABELS, MESSAGES as WO_MESSAGES } from '../../work-orders/_lib/constants';

  import type { KvpSuggestion } from './types';
  import type {
    CreateWorkOrderPayload,
    EligibleUser,
    WorkOrderPriority,
  } from '../../work-orders/_lib/types';

  interface Props {
    show: boolean;
    suggestion: KvpSuggestion | null;
    preloadedUsers?: EligibleUser[] | null;
    onclose: () => void;
    onsaved: () => void;
  }

  const { show, suggestion, preloadedUsers = null, onclose, onsaved }: Props = $props();

  // ---------------------------------------------------------------------------
  // FORM STATE
  // ---------------------------------------------------------------------------

  let formTitle = $state('');
  let formDescription = $state('');
  let formPriority = $state<WorkOrderPriority>('medium');
  let formDueDate = $state('');
  let selectedUserUuids = $state<string[]>([]);
  let assigneeTouched = $state(false);
  let dueDateTouched = $state(false);
  const hasAssignees = $derived(selectedUserUuids.length > 0);
  const hasDueDate = $derived(formDueDate !== '');
  const showAssigneeError = $derived(assigneeTouched && !hasAssignees);
  const showDueDateError = $derived(dueDateTouched && !hasDueDate);

  // ---------------------------------------------------------------------------
  // ASYNC STATE
  // ---------------------------------------------------------------------------

  let eligibleUsers = $state<EligibleUser[]>([]);
  const loadingUsers = $state(false);
  let submitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let priorityDropdownOpen = $state(false);
  const priorityLabel = $derived(PRIORITY_LABELS[formPriority]);

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  /** Reset + pre-fill form when modal opens */
  $effect(() => {
    if (show && suggestion !== null) {
      formTitle = `KVP: ${suggestion.title}`;
      formDescription = suggestion.description;
      formPriority = 'medium';
      formDueDate = '';
      selectedUserUuids = [];
      assigneeTouched = false;
      dueDateTouched = false;
      errorMessage = null;
      eligibleUsers = preloadedUsers ?? [];
    }
  });

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  function handleUserSelect(e: Event): void {
    const select = e.currentTarget as HTMLSelectElement;
    const selected: string[] = [];
    for (const opt of select.selectedOptions) {
      selected.push(opt.value);
    }
    selectedUserUuids = selected;
    assigneeTouched = true;
  }

  function setPriority(value: WorkOrderPriority): void {
    formPriority = value;
    priorityDropdownOpen = false;
  }

  $effect(() => {
    return onClickOutsideDropdown(() => {
      priorityDropdownOpen = false;
    });
  });

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    assigneeTouched = true;
    dueDateTouched = true;
    const trimmedTitle = formTitle.trim();
    if (trimmedTitle === '' || suggestion === null || !hasAssignees || !hasDueDate) return;

    submitting = true;
    errorMessage = null;

    try {
      const payload: CreateWorkOrderPayload = {
        title: trimmedTitle,
        description: formDescription.trim() || undefined,
        priority: formPriority,
        sourceType: 'kvp_proposal',
        sourceUuid: suggestion.uuid,
        dueDate: formDueDate,
        assigneeUuids: selectedUserUuids,
      };
      await createWorkOrder(payload);
      showSuccessAlert(WO_MESSAGES.SUCCESS_CREATED);
      onsaved();
    } catch (err: unknown) {
      logApiError('createWorkOrder', err);
      showErrorAlert(WO_MESSAGES.ERROR_CREATE);
      errorMessage = WO_MESSAGES.ERROR_CREATE;
    } finally {
      submitting = false;
    }
  }
</script>

{#if show && suggestion !== null}
  <div
    id="kvp-create-work-order-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="wo-kvp-modal-title"
    tabindex="-1"
  >
    <form
      class="ds-modal"
      onsubmit={handleSubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="wo-kvp-modal-title"
        >
          <i class="fas fa-clipboard-check mr-2"></i>
          Arbeitsauftrag erstellen
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
        {#if errorMessage !== null}
          <div class="alert alert--danger mb-4">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            {errorMessage}
          </div>
        {/if}

        <!-- Source info -->
        <div class="source-info mb-4">
          <span class="badge badge--success">KVP-Vorschlag</span>
          <span class="ml-2 text-sm text-(--color-text-muted)">
            {suggestion.categoryName} — {suggestion.submittedByName}
            {suggestion.submittedByLastname}
          </span>
        </div>

        <!-- Title -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="wo-kvp-title"
          >
            Titel
            <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="wo-kvp-title"
            class="form-field__control"
            placeholder="Kurze Beschreibung des Auftrags..."
            required
            bind:value={formTitle}
          />
        </div>

        <!-- Description -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="wo-kvp-desc"
          >
            Beschreibung
          </label>
          <textarea
            id="wo-kvp-desc"
            class="form-field__control"
            placeholder="Detaillierte Arbeitsanweisung..."
            rows="3"
            bind:value={formDescription}
          ></textarea>
        </div>

        <!-- Priority -->
        <div class="form-field">
          <span class="form-field__label">Priorität</span>
          <div
            class="dropdown"
            id="wo-kvp-priority-dropdown"
            role="listbox"
          >
            <div
              class="dropdown__trigger"
              onclick={() => (priorityDropdownOpen = !priorityDropdownOpen)}
              role="button"
              tabindex="0"
              onkeydown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') priorityDropdownOpen = !priorityDropdownOpen;
              }}
            >
              <span>{priorityLabel}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            {#if priorityDropdownOpen}
              <div class="dropdown__menu active">
                {#each Object.entries(PRIORITY_LABELS) as [value, label] (value)}
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      setPriority(value as WorkOrderPriority);
                    }}
                    onkeydown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter') setPriority(value as WorkOrderPriority);
                    }}
                    role="option"
                    tabindex="0"
                    aria-selected={formPriority === value}
                  >
                    {label}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Due Date — Pflichtfeld -->
        <div class="form-field">
          <AppDatePicker
            label="Fälligkeitsdatum"
            value={formDueDate}
            required={true}
            variant={showDueDateError ? 'error' : undefined}
            onchange={(v: string) => {
              formDueDate = v;
              dueDateTouched = true;
            }}
          />
          {#if showDueDateError}
            <span class="form-field__message form-field__message--error">
              Fälligkeitsdatum ist erforderlich
            </span>
          {/if}
        </div>

        <!-- Assignees -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="wo-kvp-assignees"
          >
            Mitarbeiter zuweisen
            <span class="text-red-500">*</span>
          </label>
          {#if loadingUsers}
            <div class="p-3 text-center text-sm text-(--color-text-muted)">
              <i class="fas fa-spinner fa-spin mr-1"></i>
              Mitarbeiter werden geladen...
            </div>
          {:else if eligibleUsers.length === 0}
            <div class="p-3 text-center text-sm text-(--color-text-muted)">
              <i class="fas fa-info-circle mr-1"></i>
              Keine zuweisbaren Mitarbeiter gefunden
            </div>
          {:else}
            <select
              id="wo-kvp-assignees"
              multiple
              class="multi-select multi-select--compact"
              class:error={showAssigneeError}
              aria-invalid={showAssigneeError}
              onchange={handleUserSelect}
            >
              {#each eligibleUsers as user (user.uuid)}
                <option value={user.uuid}>
                  {user.firstName}
                  {user.lastName}
                  {#if user.employeeNumber !== null}({user.employeeNumber}){/if}
                </option>
              {/each}
            </select>
            {#if showAssigneeError}
              <span class="form-field__message form-field__message--error">
                Mindestens 1 Mitarbeiter auswählen
              </span>
            {:else}
              <span class="multi-select__hint">
                <i class="fas fa-info-circle"></i>
                Strg + Klick für Mehrfachauswahl
              </span>
            {/if}
          {/if}
        </div>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class="btn btn-secondary"
          disabled={submitting || loadingUsers}
        >
          {#if submitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
            Wird erstellt...
          {:else}
            <i class="fas fa-clipboard-check mr-2"></i>
            Auftrag erstellen
          {/if}
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
  .source-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
