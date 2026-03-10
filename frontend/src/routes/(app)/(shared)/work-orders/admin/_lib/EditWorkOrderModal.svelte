<script lang="ts">
  /**
   * EditWorkOrderModal — Create / Edit work order form.
   *
   * Create mode: all fields + assignee multi-select (required).
   * Edit mode: title, description, priority, due date only.
   *
   * Pattern: ds-modal with custom dropdown + AppDatePicker + multi-select
   * (matches TPM defect create-work-order modal).
   */
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';

  import {
    FILE_UPLOAD_CONFIG,
    MESSAGES,
    PRIORITY_LABELS,
  } from '../../_lib/constants';

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
    attachmentFiles: File[] | null;
    onclose: () => void;
    onsave: (payload: CreateWorkOrderPayload | UpdateWorkOrderPayload) => void;
    onfileschange: (files: File[] | null) => void;
  }

  const {
    show,
    workOrder,
    eligibleUsers,
    submitting,
    attachmentFiles,
    onclose,
    onsave,
    onfileschange,
  }: Props = $props();

  // ---------------------------------------------------------------------------
  // DERIVED
  // ---------------------------------------------------------------------------

  const isEditMode = $derived(workOrder !== null);
  const modalTitle = $derived(
    isEditMode ? MESSAGES.MODAL_EDIT_TITLE : MESSAGES.MODAL_CREATE_TITLE,
  );
  const modalIcon = $derived(isEditMode ? 'fa-pen' : 'fa-clipboard-check');

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
  let priorityDropdownOpen = $state(false);

  const priorityLabel = $derived(PRIORITY_LABELS[formPriority]);
  const hasAssignees = $derived(selectedUserUuids.length > 0);
  const hasDueDate = $derived(formDueDate !== '');
  const showAssigneeError = $derived(assigneeTouched && !hasAssignees);
  const showDueDateError = $derived(dueDateTouched && !hasDueDate);

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  /** Reset form when modal opens */
  $effect(() => {
    if (show) {
      if (workOrder !== null) {
        formTitle = workOrder.title;
        formDescription = '';
        formPriority = workOrder.priority;
        formDueDate = workOrder.dueDate.substring(0, 10);
      } else {
        formTitle = '';
        formDescription = '';
        formPriority = 'medium';
        formDueDate = '';
        selectedUserUuids = [];
        assigneeTouched = false;
        dueDateTouched = false;
      }
      priorityDropdownOpen = false;
    }
  });

  /** Close priority dropdown on click-outside */
  $effect(() => {
    return onClickOutsideDropdown(() => {
      priorityDropdownOpen = false;
    });
  });

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  function setPriority(value: WorkOrderPriority): void {
    formPriority = value;
    priorityDropdownOpen = false;
  }

  function handleUserSelect(e: Event): void {
    const select = e.currentTarget as HTMLSelectElement;
    const selected: string[] = [];
    for (const opt of select.selectedOptions) {
      selected.push(opt.value);
    }
    selectedUserUuids = selected;
    assigneeTouched = true;
  }

  function removeAttachment(index: number): void {
    if (attachmentFiles === null) return;
    const filtered = attachmentFiles.filter(
      (_: File, i: number) => i !== index,
    );
    onfileschange(filtered.length > 0 ? filtered : null);
  }

  function handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (files === null || files.length === 0) return;

    const existing = attachmentFiles ?? [];
    const incoming = Array.from(files);
    const merged = [...existing, ...incoming].slice(
      0,
      FILE_UPLOAD_CONFIG.MAX_FILES,
    );
    onfileschange(merged);

    // Reset input so the same file can be re-selected
    input.value = '';
  }

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const trimmedTitle = formTitle.trim();
    if (trimmedTitle === '') return;

    dueDateTouched = true;
    if (!hasDueDate) return;

    if (isEditMode) {
      const payload: UpdateWorkOrderPayload = {
        title: trimmedTitle,
        description: formDescription.trim() || undefined,
        priority: formPriority,
        dueDate: formDueDate,
      };
      onsave(payload);
    } else {
      assigneeTouched = true;
      if (!hasAssignees) return;

      const payload: CreateWorkOrderPayload = {
        title: trimmedTitle,
        description: formDescription.trim() || undefined,
        priority: formPriority,
        dueDate: formDueDate,
        assigneeUuids: selectedUserUuids,
      };
      onsave(payload);
    }
  }
</script>

{#if show}
  <div
    id="work-order-edit-modal"
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
          <i class="fas {modalIcon} mr-2"></i>
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

        <!-- Priority (custom dropdown) -->
        <div class="form-field">
          <span class="form-field__label">{MESSAGES.MODAL_FIELD_PRIORITY}</span>
          <div
            class="dropdown"
            id="wo-priority-dropdown"
            role="listbox"
          >
            <div
              class="dropdown__trigger"
              onclick={() => (priorityDropdownOpen = !priorityDropdownOpen)}
              onkeydown={(e: KeyboardEvent) => {
                if (e.key === 'Enter')
                  priorityDropdownOpen = !priorityDropdownOpen;
              }}
              role="button"
              tabindex="0"
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
                      if (e.key === 'Enter')
                        setPriority(value as WorkOrderPriority);
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

        <!-- Due Date (AppDatePicker) — Pflichtfeld -->
        <div class="form-field">
          <AppDatePicker
            label={MESSAGES.MODAL_FIELD_DUE_DATE}
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

        <!-- Attachments (optional) -->
        <div class="form-field">
          <span class="form-field__label"
            >{MESSAGES.MODAL_FIELD_ATTACHMENTS}</span
          >
          <div class="file-upload-zone file-upload-zone--compact">
            <input
              type="file"
              class="file-upload-zone__input"
              id="wo-attachments"
              multiple
              accept={FILE_UPLOAD_CONFIG.ACCEPTED_TYPES}
              onchange={handleFileSelect}
            />
            <label
              for="wo-attachments"
              class="file-upload-zone__label"
            >
              <div class="file-upload-zone__icon">
                <i class="fas fa-cloud-upload-alt"></i>
              </div>
              <div class="file-upload-zone__text">
                <p class="file-upload-zone__title">Dateien hierher ziehen</p>
                <p class="file-upload-zone__hint">
                  {MESSAGES.MODAL_ATTACHMENTS_HINT}
                </p>
              </div>
            </label>
          </div>
          {#if attachmentFiles !== null && attachmentFiles.length > 0}
            <div class="file-upload-list file-upload-list--compact">
              {#each attachmentFiles as file, i (i)}
                <div class="file-upload-list__item">
                  <i
                    class="fas {file.type === 'application/pdf' ?
                      'fa-file-pdf'
                    : 'fa-file-image'} file-upload-list__icon"
                  ></i>
                  <span class="file-upload-list__name">{file.name}</span>
                  <span class="file-upload-list__size"
                    >{(file.size / 1024 / 1024).toFixed(2)} MB</span
                  >
                  <button
                    type="button"
                    class="file-upload-list__remove"
                    onclick={() => {
                      removeAttachment(i);
                    }}
                    aria-label="Datei entfernen"
                  >
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Assignees (create mode only, multi-select) -->
        {#if !isEditMode}
          <div class="form-field">
            <label
              class="form-field__label"
              for="wo-assignees"
            >
              {MESSAGES.MODAL_FIELD_ASSIGNEES}
              <span class="text-red-500">*</span>
            </label>
            {#if eligibleUsers.length === 0}
              <div class="p-3 text-center text-sm text-(--color-text-muted)">
                <i class="fas fa-info-circle mr-1"></i>
                Keine zuweisbaren Mitarbeiter gefunden
              </div>
            {:else}
              <select
                id="wo-assignees"
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
            <i class="fas {modalIcon} mr-2"></i>
            {MESSAGES.BTN_SAVE}
          {/if}
        </button>
      </div>
    </form>
  </div>
{/if}
