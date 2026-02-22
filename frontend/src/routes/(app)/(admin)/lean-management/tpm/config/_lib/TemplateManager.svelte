<script lang="ts">
  /**
   * TPM Template Manager Component
   *
   * CRUD for card templates: list, inline create/edit form, delete with confirmation.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import {
    createTemplate as apiCreateTemplate,
    updateTemplate as apiUpdateTemplate,
    deleteTemplate as apiDeleteTemplate,
    logApiError,
  } from '../../_lib/api';
  import { MESSAGES } from '../../_lib/constants';

  import type {
    TpmCardTemplate,
    CreateTemplatePayload,
    UpdateTemplatePayload,
  } from '../../_lib/types';

  // ===========================================================================
  // PROPS
  // ===========================================================================

  const { templates }: { templates: TpmCardTemplate[] } = $props();

  // ===========================================================================
  // STATE
  // ===========================================================================

  let showForm = $state(false);
  let editingTemplate = $state<TpmCardTemplate | null>(null);
  let submitting = $state(false);

  // Form fields
  let formName = $state('');
  let formDescription = $state('');
  let formIsDefault = $state(false);

  // Delete confirmation
  let showDeleteModal = $state(false);
  let deleteTarget = $state<TpmCardTemplate | null>(null);

  // ===========================================================================
  // DERIVED
  // ===========================================================================

  const isCreateMode = $derived(editingTemplate === null);
  const formHeading = $derived(
    isCreateMode ?
      MESSAGES.TEMPLATE_CREATE_TITLE
    : MESSAGES.TEMPLATE_EDIT_TITLE,
  );
  const formValid = $derived(formName.trim().length > 0);

  // ===========================================================================
  // FORM MANAGEMENT
  // ===========================================================================

  function openCreateForm(): void {
    editingTemplate = null;
    formName = '';
    formDescription = '';
    formIsDefault = false;
    showForm = true;
  }

  function openEditForm(template: TpmCardTemplate): void {
    editingTemplate = template;
    formName = template.name;
    formDescription = template.description ?? '';
    formIsDefault = template.isDefault;
    showForm = true;
  }

  function closeForm(): void {
    showForm = false;
    editingTemplate = null;
    formName = '';
    formDescription = '';
    formIsDefault = false;
  }

  // ===========================================================================
  // CRUD
  // ===========================================================================

  async function handleSubmit(): Promise<void> {
    if (!formValid) {
      showErrorAlert(MESSAGES.ERROR_TEMPLATE_NAME_REQUIRED);
      return;
    }

    submitting = true;

    if (isCreateMode) {
      await handleCreate();
    } else {
      await handleUpdate();
    }

    submitting = false;
  }

  async function handleCreate(): Promise<void> {
    const payload: CreateTemplatePayload = {
      name: formName.trim(),
      description: formDescription.trim() || null,
      isDefault: formIsDefault,
    };

    try {
      await apiCreateTemplate(payload);
      showSuccessAlert(MESSAGES.SUCCESS_TEMPLATE_CREATED);
      closeForm();
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('createTemplate', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_TEMPLATE_CREATE;
      showErrorAlert(msg);
    }
  }

  async function handleUpdate(): Promise<void> {
    if (editingTemplate === null) return;

    const payload: UpdateTemplatePayload = {
      name: formName.trim(),
      description: formDescription.trim() || null,
      isDefault: formIsDefault,
    };

    try {
      await apiUpdateTemplate(editingTemplate.uuid, payload);
      showSuccessAlert(MESSAGES.SUCCESS_TEMPLATE_UPDATED);
      closeForm();
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('updateTemplate', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_TEMPLATE_UPDATE;
      showErrorAlert(msg);
    }
  }

  // ===========================================================================
  // DELETE
  // ===========================================================================

  function requestDelete(template: TpmCardTemplate): void {
    deleteTarget = template;
    showDeleteModal = true;
  }

  async function confirmDelete(): Promise<void> {
    if (deleteTarget === null) return;
    const targetUuid = deleteTarget.uuid;
    deleteTarget = null;
    showDeleteModal = false;
    submitting = true;
    try {
      await apiDeleteTemplate(targetUuid);
      showSuccessAlert(MESSAGES.SUCCESS_TEMPLATE_DELETED);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('deleteTemplate', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_TEMPLATE_DELETE;
      showErrorAlert(msg);
    } finally {
      submitting = false;
    }
  }

  function cancelDelete(): void {
    showDeleteModal = false;
    deleteTarget = null;
  }
</script>

<div>
  <div class="mb-6 flex items-start justify-between gap-4">
    <div>
      <h3
        class="flex items-center gap-2 text-base font-semibold text-(--color-text-primary)"
      >
        <i class="fas fa-copy"></i>
        {MESSAGES.TEMPLATE_TITLE}
      </h3>
      <p class="mt-1 text-sm text-(--color-text-secondary)">
        {MESSAGES.TEMPLATE_DESCRIPTION}
      </p>
    </div>
    {#if !showForm}
      <button
        type="button"
        class="btn btn-primary"
        onclick={openCreateForm}
      >
        <i class="fas fa-plus"></i>
        {MESSAGES.BTN_NEW_TEMPLATE}
      </button>
    {/if}
  </div>

  <!-- Inline Form -->
  {#if showForm}
    <div class="tpl-form-panel">
      <h4 class="mb-4 text-sm font-semibold text-(--color-text-secondary)">
        {formHeading}
      </h4>
      <form
        class="flex flex-col gap-4"
        onsubmit={(e: SubmitEvent) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div class="form-field">
          <label
            class="form-field__label"
            for="tpl-name"
          >
            {MESSAGES.TEMPLATE_NAME} *
          </label>
          <input
            id="tpl-name"
            type="text"
            class="form-field__control"
            class:is-error={formName.length > 0 && formName.trim().length === 0}
            maxlength={255}
            placeholder={MESSAGES.PH_TEMPLATE_NAME}
            bind:value={formName}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="tpl-desc"
          >
            {MESSAGES.TEMPLATE_DESC}
          </label>
          <textarea
            id="tpl-desc"
            class="form-field__control form-field__control--textarea"
            rows={3}
            maxlength={2000}
            placeholder={MESSAGES.PH_TEMPLATE_DESC}
            bind:value={formDescription}
          ></textarea>
        </div>

        <div class="form-field">
          <label
            class="toggle-switch"
            for="tpl-default"
          >
            <input
              id="tpl-default"
              type="checkbox"
              class="toggle-switch__input"
              bind:checked={formIsDefault}
            />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label"
              >{MESSAGES.TEMPLATE_IS_DEFAULT}</span
            >
          </label>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            class="btn btn-cancel"
            onclick={closeForm}
            disabled={submitting}
          >
            {MESSAGES.BTN_CANCEL}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={submitting || !formValid}
          >
            {#if submitting}
              <i class="fas fa-spinner fa-spin"></i>
            {/if}
            {isCreateMode ?
              MESSAGES.BTN_CREATE_TEMPLATE
            : MESSAGES.BTN_UPDATE_TEMPLATE}
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Template List -->
  {#if templates.length === 0 && !showForm}
    <div class="empty-state">
      <div class="empty-state__icon">
        <i class="fas fa-copy"></i>
      </div>
      <h3 class="empty-state__title">{MESSAGES.TEMPLATE_EMPTY}</h3>
      <p class="empty-state__description">{MESSAGES.TEMPLATE_EMPTY_DESC}</p>
    </div>
  {:else if templates.length > 0}
    <div class="flex flex-col gap-2">
      {#each templates as template (template.uuid)}
        <div class="tpl-item">
          <div class="min-w-0 flex-1">
            <div
              class="flex items-center gap-2 text-sm font-semibold text-(--color-text-primary)"
            >
              {template.name}
              {#if template.isDefault}
                <span class="badge badge--info badge--sm">Standard</span>
              {/if}
            </div>
            {#if template.description}
              <p class="mt-0.5 truncate text-xs text-(--color-text-muted)">
                {template.description}
              </p>
            {/if}
          </div>
          <div class="flex shrink-0 gap-1">
            <button
              type="button"
              class="btn btn-primary btn-icon"
              title={MESSAGES.BTN_EDIT}
              onclick={() => {
                openEditForm(template);
              }}
            >
              <i class="fas fa-edit"></i>
            </button>
            <button
              type="button"
              class="btn btn-danger btn-sm btn-icon"
              title={MESSAGES.BTN_DELETE}
              onclick={() => {
                requestDelete(template);
              }}
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && deleteTarget !== null}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay modal-overlay--active"
    onclick={cancelDelete}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDelete();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="confirm-modal confirm-modal--danger"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="confirm-modal__title">{MESSAGES.TEMPLATE_DELETE_TITLE}</h3>
      <p class="confirm-modal__message">
        {MESSAGES.TEMPLATE_DELETE_MESSAGE}
      </p>
      <p
        class="mx-6 mt-2 rounded-md bg-(--glass-bg-active) px-6 py-2 text-sm font-semibold text-(--color-text-primary)"
      >
        {deleteTarget.name}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn--cancel"
          onclick={cancelDelete}
          disabled={submitting}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="confirm-modal__btn--danger"
          onclick={() => {
            void confirmDelete();
          }}
          disabled={submitting}
        >
          {#if submitting}
            <i class="fas fa-spinner fa-spin"></i>
          {/if}
          {MESSAGES.BTN_DELETE}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tpl-form-panel {
    background: var(--glass-bg-hover);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    margin-bottom: 1.25rem;
    border: 1px solid var(--color-glass-border);
  }

  .tpl-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--glass-bg-hover);
    border-radius: var(--radius-md);
    transition: background-color 0.15s;
  }

  .tpl-item:hover {
    background: var(--glass-bg-active);
  }

  /* .is-error is provided by the design system form-field component */
</style>
