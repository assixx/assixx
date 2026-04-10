<script lang="ts">
  /**
   * TagsManagementModal — CRUD for tenant tag catalog.
   *
   * Lists all inventory tags with usage counts. Each row supports inline
   * rename + icon picker via an Edit button. Delete is hard delete and
   * confirmed via the design-system ConfirmModal (junction CASCADE removes
   * the tag from every list — irreversible).
   *
   * Refreshes tagsState on every mutation so other components (TagInput,
   * TagFilterDropdown, ListCard) see the change immediately.
   */
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { deleteTag, loadTags, updateTag } from './api';
  import { DEFAULT_TAG_ICON, LIST_ICON_OPTIONS, MESSAGES } from './constants';
  import { tagsState } from './state.svelte';

  import type { InventoryTagWithUsage } from './types';

  interface Props {
    onclose: () => void;
  }

  const { onclose }: Props = $props();

  const log = createLogger('TagsManagementModal');

  let editingId = $state<string | null>(null);
  let editName = $state('');
  let editIcon = $state<string | null>(null);
  let saving = $state(false);
  // Non-reactive re-entry guard (see TagInput for the same pattern)
  let savingPending = false;

  let showDeleteModal = $state(false);
  let deletingTag = $state<InventoryTagWithUsage | null>(null);
  let deleting = $state(false);
  let deletingPending = false;

  const tags = $derived(tagsState.tags);

  function startEdit(tag: InventoryTagWithUsage): void {
    editingId = tag.id;
    editName = tag.name;
    editIcon = tag.icon;
  }

  function cancelEdit(): void {
    editingId = null;
    editName = '';
    editIcon = null;
  }

  async function refreshCache(): Promise<void> {
    const fresh = await loadTags();
    tagsState.set(fresh);
  }

  /* eslint-disable require-atomic-updates -- Single-threaded JS runtime
     + early return on `savingPending` is a strict re-entry guard. No
     concurrent caller path can observe a stale flag. */
  async function saveEdit(): Promise<void> {
    if (editingId === null || editName.trim() === '' || savingPending) return;
    savingPending = true;
    saving = true;
    try {
      await updateTag(editingId, { name: editName.trim(), icon: editIcon });
      await refreshCache();
      showSuccessAlert(MESSAGES.TAG_SUCCESS_UPDATED);
      cancelEdit();
    } catch (err: unknown) {
      log.error({ err }, 'Error updating tag');
      const message = err instanceof Error ? err.message : MESSAGES.TAG_ERROR_SAVING;
      showErrorAlert(message);
    }
    saving = false;
    savingPending = false;
  }
  /* eslint-enable require-atomic-updates */

  function openDeleteModal(tag: InventoryTagWithUsage): void {
    deletingTag = tag;
    showDeleteModal = true;
  }

  function closeDeleteModal(): void {
    showDeleteModal = false;
    deletingTag = null;
  }

  /* eslint-disable require-atomic-updates -- Single-threaded JS runtime
     + early return on `deletingPending` is a strict re-entry guard. */
  async function confirmDelete(): Promise<void> {
    const tag = deletingTag;
    if (tag === null || deletingPending) return;
    deletingPending = true;
    deleting = true;
    try {
      await deleteTag(tag.id);
      await refreshCache();
      showSuccessAlert(MESSAGES.TAG_SUCCESS_DELETED);
      closeDeleteModal();
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting tag');
      const message = err instanceof Error ? err.message : MESSAGES.TAG_ERROR_DELETING;
      showErrorAlert(message);
    }
    deleting = false;
    deletingPending = false;
  }
  /* eslint-enable require-atomic-updates */
</script>

<div
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  aria-labelledby="tags-management-modal-title"
  tabindex="-1"
>
  <div class="ds-modal ds-modal--md">
    <div class="ds-modal__header">
      <h3
        class="ds-modal__title"
        id="tags-management-modal-title"
      >
        <i class="fas fa-tags mr-2"></i>
        {MESSAGES.TAGS_MANAGE_TITLE}
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
      {#if tags.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-tags"></i>
          </div>
          <p class="empty-state__description">{MESSAGES.TAGS_NO_TAGS}</p>
        </div>
      {:else}
        <div class="tags-mgmt">
          {#each tags as tag (tag.id)}
            {#if editingId === tag.id}
              <div class="tags-mgmt__row tags-mgmt__row--editing">
                <input
                  type="text"
                  class="form-field__control tags-mgmt__name-input"
                  bind:value={editName}
                  maxlength="50"
                  placeholder="Tag-Name"
                />
                <div class="tags-mgmt__icon-grid">
                  {#each LIST_ICON_OPTIONS as opt (opt.icon)}
                    <button
                      type="button"
                      class="icon-picker-item"
                      class:icon-picker-item--active={editIcon === opt.icon}
                      title={opt.label}
                      onclick={() => {
                        editIcon = opt.icon;
                      }}
                    >
                      <i class="fas {opt.icon}"></i>
                    </button>
                  {/each}
                </div>
                <div class="tags-mgmt__edit-actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    disabled={saving || editName.trim() === ''}
                    onclick={() => void saveEdit()}
                  >
                    {#if saving}
                      <span class="spinner-ring spinner-ring--sm mr-1"></span>
                    {/if}
                    Speichern
                  </button>
                  <button
                    type="button"
                    class="btn btn-cancel btn-sm"
                    onclick={cancelEdit}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            {:else}
              <div class="tags-mgmt__row">
                <i class="fas {tag.icon ?? DEFAULT_TAG_ICON} tags-mgmt__icon"></i>
                <span class="tags-mgmt__name">{tag.name}</span>
                <span class="tags-mgmt__usage">
                  {tag.usageCount}
                  {tag.usageCount === 1 ? 'Liste' : 'Listen'}
                </span>
                <div class="tags-mgmt__actions">
                  <button
                    type="button"
                    class="action-icon action-icon--edit"
                    title="Bearbeiten"
                    aria-label="Tag bearbeiten"
                    onclick={() => {
                      startEdit(tag);
                    }}
                  >
                    <i class="fas fa-edit"></i>
                  </button>
                  <button
                    type="button"
                    class="action-icon action-icon--delete"
                    title="Löschen"
                    aria-label="Tag löschen"
                    onclick={() => {
                      openDeleteModal(tag);
                    }}
                  >
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}>Schließen</button
      >
    </div>
  </div>
</div>

<ConfirmModal
  show={showDeleteModal}
  id="delete-inventory-tag-modal"
  title={MESSAGES.TAG_DELETE_CONFIRM_TITLE}
  variant="danger"
  icon="fa-exclamation-triangle"
  submitting={deleting}
  onconfirm={() => void confirmDelete()}
  oncancel={closeDeleteModal}
>
  <strong>{deletingTag?.name ?? ''}</strong>
  {MESSAGES.TAG_DELETE_CONFIRM_MESSAGE}
  {#if deletingTag !== null && deletingTag.usageCount > 0}
    <br /><br />
    Wird aktuell von
    <strong
      >{deletingTag.usageCount}
      {deletingTag.usageCount === 1 ? 'Liste' : 'Listen'}</strong
    > verwendet.
  {/if}
</ConfirmModal>

<style>
  .tags-mgmt {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tags-mgmt__row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-border, rgb(255 255 255 / 10%));
    border-radius: 0.5rem;
    background: var(--color-glass-bg, rgb(255 255 255 / 3%));
  }

  .tags-mgmt__row--editing {
    flex-direction: column;
    align-items: stretch;
    gap: 0.625rem;
    border-color: var(--color-primary, #2196f3);
  }

  .tags-mgmt__icon {
    color: var(--color-primary, #2196f3);
  }

  .tags-mgmt__name {
    flex: 1;
    color: var(--color-text-primary, #fff);
    font-weight: 500;
  }

  .tags-mgmt__usage {
    font-size: 0.75rem;
    color: var(--color-text-secondary, #aaa);
  }

  .tags-mgmt__actions {
    display: flex;
    gap: 0.375rem;
  }

  .tags-mgmt__name-input {
    width: 100%;
  }

  .tags-mgmt__icon-grid {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: 0.375rem;
  }

  .tags-mgmt__edit-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .icon-picker-item {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    border: 1px solid var(--color-border, rgb(255 255 255 / 10%));
    border-radius: 0.375rem;
    background: transparent;
    color: var(--color-text-secondary, #aaa);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .icon-picker-item:hover {
    background: var(--color-glass-hover, rgb(255 255 255 / 8%));
    color: var(--color-text-primary, #fff);
  }

  .icon-picker-item--active {
    border-color: var(--color-primary, #2196f3);
    background: rgb(33 150 243 / 15%);
    color: var(--color-primary, #2196f3);
  }
</style>
