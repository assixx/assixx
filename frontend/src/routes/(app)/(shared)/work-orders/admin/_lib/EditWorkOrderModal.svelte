<script lang="ts">
  /**
   * EditWorkOrderModal — Create / Edit work order form.
   * Create mode: includes assignee multi-select.
   * Edit mode: title, description, priority, due date only.
   */
  import { MESSAGES, PRIORITY_LABELS } from '../../_lib/constants';

  import type {
    CreateWorkOrderPayload,
    EligibleUser,
    UpdateWorkOrderPayload,
    WorkOrderListItem,
    WorkOrderPriority,
  } from '../../_lib/types';

  interface Props {
    show: boolean;
    workOrder: WorkOrderListItem | null;
    eligibleUsers: EligibleUser[];
    submitting: boolean;
    onclose: () => void;
    onsave: (payload: CreateWorkOrderPayload | UpdateWorkOrderPayload) => void;
  }

  const { show, workOrder, eligibleUsers, submitting, onclose, onsave }: Props =
    $props();

  const isEditMode = $derived(workOrder !== null);
  const modalTitle = $derived(
    isEditMode ? MESSAGES.MODAL_EDIT_TITLE : MESSAGES.MODAL_CREATE_TITLE,
  );

  let formTitle = $state('');
  let formDescription = $state('');
  let formPriority = $state<WorkOrderPriority>('medium');
  let formDueDate = $state('');
  let selectedUserUuids = $state<string[]>([]);

  /** Reset form when modal opens */
  $effect(() => {
    if (show) {
      if (workOrder !== null) {
        formTitle = workOrder.title;
        formDescription = '';
        formPriority = workOrder.priority;
        formDueDate =
          workOrder.dueDate !== null ? workOrder.dueDate.substring(0, 10) : '';
      } else {
        formTitle = '';
        formDescription = '';
        formPriority = 'medium';
        formDueDate = '';
        selectedUserUuids = [];
      }
    }
  });

  function toggleUser(uuid: string): void {
    if (selectedUserUuids.includes(uuid)) {
      selectedUserUuids = selectedUserUuids.filter((u: string) => u !== uuid);
    } else {
      selectedUserUuids = [...selectedUserUuids, uuid];
    }
  }

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const trimmedTitle = formTitle.trim();
    if (trimmedTitle === '') return;

    if (isEditMode) {
      const payload: UpdateWorkOrderPayload = {
        title: trimmedTitle,
        description: formDescription.trim() || undefined,
        priority: formPriority,
        dueDate: formDueDate !== '' ? formDueDate : null,
      };
      onsave(payload);
    } else {
      const payload: CreateWorkOrderPayload = {
        title: trimmedTitle,
        description: formDescription.trim() || undefined,
        priority: formPriority,
        dueDate: formDueDate !== '' ? formDueDate : null,
        assigneeUuids:
          selectedUserUuids.length > 0 ? selectedUserUuids : undefined,
      };
      onsave(payload);
    }
  }
</script>

{#if show}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="wo-modal-title"
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
          id="wo-modal-title"
        >
          {modalTitle}
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
        <!-- Title -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="wo-title"
          >
            {MESSAGES.MODAL_FIELD_TITLE}
            <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="wo-title"
            class="form-field__control"
            placeholder={MESSAGES.MODAL_FIELD_TITLE_PH}
            required
            bind:value={formTitle}
          />
        </div>

        <!-- Description -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="wo-description"
          >
            {MESSAGES.MODAL_FIELD_DESCRIPTION}
          </label>
          <textarea
            id="wo-description"
            class="form-field__control"
            placeholder={MESSAGES.MODAL_FIELD_DESCRIPTION_PH}
            rows="3"
            bind:value={formDescription}
          ></textarea>
        </div>

        <!-- Priority -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="wo-priority"
          >
            {MESSAGES.MODAL_FIELD_PRIORITY}
          </label>
          <select
            id="wo-priority"
            class="form-field__control"
            bind:value={formPriority}
          >
            {#each Object.entries(PRIORITY_LABELS) as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </select>
        </div>

        <!-- Due Date -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="wo-due-date"
          >
            {MESSAGES.MODAL_FIELD_DUE_DATE}
          </label>
          <input
            type="date"
            id="wo-due-date"
            class="form-field__control"
            bind:value={formDueDate}
          />
        </div>

        <!-- Assignees (create mode only) -->
        {#if !isEditMode && eligibleUsers.length > 0}
          <div class="form-field">
            <span class="form-field__label">
              {MESSAGES.MODAL_FIELD_ASSIGNEES}
            </span>
            <div class="user-select-list">
              {#each eligibleUsers as user (user.uuid)}
                <label class="user-select-item">
                  <input
                    type="checkbox"
                    checked={selectedUserUuids.includes(user.uuid)}
                    onchange={() => {
                      toggleUser(user.uuid);
                    }}
                  />
                  <span class="user-select-item__name">
                    {user.firstName}
                    {user.lastName}
                  </span>
                  {#if user.employeeNumber !== null}
                    <span class="user-select-item__number">
                      ({user.employeeNumber})
                    </span>
                  {/if}
                </label>
              {/each}
            </div>
          </div>
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
            {MESSAGES.MODAL_SAVING}
          {:else}
            {MESSAGES.BTN_SAVE}
          {/if}
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
  .user-select-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm, 0.25rem);
    padding: 0.5rem;
  }

  .user-select-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm, 0.25rem);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .user-select-item:hover {
    background: var(--color-bg-secondary, #f8f9fa);
  }

  .user-select-item__name {
    font-weight: 500;
  }

  .user-select-item__number {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }
</style>
