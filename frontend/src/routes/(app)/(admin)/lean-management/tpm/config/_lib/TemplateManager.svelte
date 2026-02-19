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
    isCreateMode
      ? MESSAGES.TEMPLATE_CREATE_TITLE
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

<div class="tpl-mgr">
  <div class="tpl-mgr__header">
    <div>
      <h3 class="tpl-mgr__title">
        <i class="fas fa-copy"></i>
        {MESSAGES.TEMPLATE_TITLE}
      </h3>
      <p class="tpl-mgr__desc">{MESSAGES.TEMPLATE_DESCRIPTION}</p>
    </div>
    {#if !showForm}
      <button
        type="button"
        class="btn btn--primary btn--sm"
        onclick={openCreateForm}
      >
        <i class="fas fa-plus"></i>
        {MESSAGES.BTN_NEW_TEMPLATE}
      </button>
    {/if}
  </div>

  <!-- Inline Form -->
  {#if showForm}
    <div class="tpl-mgr__form-panel">
      <h4 class="tpl-mgr__form-title">{formHeading}</h4>
      <form
        class="tpl-form"
        onsubmit={(e: SubmitEvent) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div class="form-group">
          <label class="form-label" for="tpl-name">
            {MESSAGES.TEMPLATE_NAME} *
          </label>
          <input
            id="tpl-name"
            type="text"
            class="input"
            class:input--error={formName.length > 0 &&
              formName.trim().length === 0}
            maxlength={255}
            placeholder={MESSAGES.PH_TEMPLATE_NAME}
            bind:value={formName}
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="tpl-desc">
            {MESSAGES.TEMPLATE_DESC}
          </label>
          <textarea
            id="tpl-desc"
            class="input textarea"
            rows={3}
            maxlength={2000}
            placeholder={MESSAGES.PH_TEMPLATE_DESC}
            bind:value={formDescription}
          ></textarea>
        </div>

        <div class="form-group form-group--toggle">
          <label class="toggle-label" for="tpl-default">
            <input
              id="tpl-default"
              type="checkbox"
              class="toggle-input"
              bind:checked={formIsDefault}
            />
            <span class="toggle-text">{MESSAGES.TEMPLATE_IS_DEFAULT}</span>
          </label>
        </div>

        <div class="tpl-form__actions">
          <button
            type="button"
            class="btn btn--ghost"
            onclick={closeForm}
            disabled={submitting}
          >
            {MESSAGES.BTN_CANCEL}
          </button>
          <button
            type="submit"
            class="btn btn--primary"
            disabled={submitting || !formValid}
          >
            {#if submitting}
              <i class="fas fa-spinner fa-spin"></i>
            {/if}
            {isCreateMode
              ? MESSAGES.BTN_CREATE_TEMPLATE
              : MESSAGES.BTN_UPDATE_TEMPLATE}
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Template List -->
  {#if templates.length === 0 && !showForm}
    <div class="tpl-mgr__empty">
      <i class="fas fa-copy tpl-mgr__empty-icon"></i>
      <p class="tpl-mgr__empty-title">{MESSAGES.TEMPLATE_EMPTY}</p>
      <p class="tpl-mgr__empty-desc">{MESSAGES.TEMPLATE_EMPTY_DESC}</p>
    </div>
  {:else if templates.length > 0}
    <div class="tpl-list">
      {#each templates as template (template.uuid)}
        <div class="tpl-item">
          <div class="tpl-item__info">
            <div class="tpl-item__name">
              {template.name}
              {#if template.isDefault}
                <span class="tpl-item__badge">Standard</span>
              {/if}
            </div>
            {#if template.description}
              <p class="tpl-item__desc">{template.description}</p>
            {/if}
          </div>
          <div class="tpl-item__actions">
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              title={MESSAGES.BTN_EDIT}
              onclick={() => {
                openEditForm(template);
              }}
            >
              <i class="fas fa-edit"></i>
            </button>
            <button
              type="button"
              class="btn btn--ghost btn--sm btn--danger-text"
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
    class="modal-backdrop"
    onclick={cancelDelete}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDelete();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
    >
      <div class="modal__header">
        <i class="fas fa-exclamation-triangle modal__icon modal__icon--danger"
        ></i>
        <h3 class="modal__title">{MESSAGES.TEMPLATE_DELETE_TITLE}</h3>
      </div>
      <div class="modal__body">
        <p>{MESSAGES.TEMPLATE_DELETE_MESSAGE}</p>
        <p class="modal__detail">
          <strong>{deleteTarget.name}</strong>
        </p>
      </div>
      <div class="modal__actions">
        <button
          type="button"
          class="btn btn--ghost"
          onclick={cancelDelete}
          disabled={submitting}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="btn btn--danger"
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
  .tpl-mgr__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .tpl-mgr__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-gray-800);
  }

  .tpl-mgr__desc {
    color: var(--color-gray-500);
    font-size: 0.8125rem;
    margin-top: 0.25rem;
  }

  /* Form panel */
  .tpl-mgr__form-panel {
    background: var(--color-gray-50);
    border-radius: var(--radius-md, 8px);
    padding: 1.25rem;
    margin-bottom: 1.25rem;
    border: 1px solid var(--color-gray-200);
  }

  .tpl-mgr__form-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-gray-700);
    margin-bottom: 1rem;
  }

  .tpl-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .tpl-form__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-gray-700);
  }

  .form-group--toggle {
    flex-direction: row;
    align-items: center;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
  }

  .toggle-input {
    width: 1.125rem;
    height: 1.125rem;
    accent-color: var(--color-blue-600, #2563eb);
    cursor: pointer;
  }

  .toggle-text {
    font-size: 0.875rem;
    color: var(--color-gray-700);
  }

  .textarea {
    resize: vertical;
    min-height: 4rem;
  }

  /* Template list */
  .tpl-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tpl-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--color-gray-50);
    border-radius: var(--radius-md, 8px);
    transition: background-color 0.15s;
  }

  .tpl-item:hover {
    background: var(--color-gray-100);
  }

  .tpl-item__info {
    flex: 1;
    min-width: 0;
  }

  .tpl-item__name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-gray-800);
  }

  .tpl-item__badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-full, 9999px);
    background: var(--color-blue-100, #dbeafe);
    color: var(--color-blue-700, #1d4ed8);
  }

  .tpl-item__desc {
    font-size: 0.8125rem;
    color: var(--color-gray-500);
    margin-top: 0.125rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tpl-item__actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  /* Empty state */
  .tpl-mgr__empty {
    text-align: center;
    padding: 2rem;
    color: var(--color-gray-400);
  }

  .tpl-mgr__empty-icon {
    font-size: 2rem;
    margin-bottom: 0.75rem;
  }

  .tpl-mgr__empty-title {
    font-weight: 600;
    color: var(--color-gray-500);
  }

  .tpl-mgr__empty-desc {
    font-size: 0.8125rem;
    margin-top: 0.25rem;
  }

  /* Danger text variant */
  :global(.btn--danger-text) {
    color: var(--color-red-500, #ef4444);
  }

  :global(.btn--danger-text:hover) {
    color: var(--color-red-700, #b91c1c);
    background: var(--color-red-50, #fef2f2);
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 50%);
    padding: 1rem;
  }

  .modal {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 10%));
    max-width: 420px;
    width: 100%;
    overflow: hidden;
  }

  .modal__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .modal__icon {
    font-size: 1.25rem;
  }

  .modal__icon--danger {
    color: var(--color-red-500, #ef4444);
  }

  .modal__title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-gray-900);
  }

  .modal__body {
    padding: 1.25rem 1.5rem;
    font-size: 0.875rem;
    color: var(--color-gray-600);
  }

  .modal__detail {
    margin-top: 0.75rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-gray-50);
    border-radius: var(--radius-md, 8px);
    color: var(--color-gray-800);
  }

  .modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-gray-200);
    background: var(--color-gray-50);
  }
</style>
