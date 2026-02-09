<script lang="ts">
  import { MESSAGES } from './constants';

  interface Props {
    showDeleteModal: boolean;
    showDeleteConfirmModal: boolean;
    showForceDeleteModal: boolean;
    forceDeleteMessage: string;
    onCloseDelete: () => void;
    onCloseDeleteConfirm: () => void;
    onCloseForceDelete: () => void;
    onProceedToConfirm: () => void;
    onConfirmDelete: () => void;
    onForceDelete: () => void;
  }

  const {
    showDeleteModal,
    showDeleteConfirmModal,
    showForceDeleteModal,
    forceDeleteMessage,
    onCloseDelete,
    onCloseDeleteConfirm,
    onCloseForceDelete,
    onProceedToConfirm,
    onConfirmDelete,
    onForceDelete,
  }: Props = $props();

  function handleDeleteOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onCloseDelete();
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onCloseDeleteConfirm();
  }

  function handleForceDeleteOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onCloseForceDelete();
  }
</script>

<!-- Delete Modal Step 1 -->
{#if showDeleteModal}
  <div
    id="delete-department-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-modal-title"
    tabindex="-1"
    onclick={handleDeleteOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onCloseDelete();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="ds-modal ds-modal--sm"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="delete-modal-title"
        >
          <i class="fas fa-trash-alt mr-2 text-red-500"></i>
          {MESSAGES.DELETE_TITLE}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={onCloseDelete}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p class="text-(--color-text-secondary)">
          {MESSAGES.DELETE_QUESTION}
        </p>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onCloseDelete}>{MESSAGES.BTN_CANCEL}</button
        >
        <button
          type="button"
          class="btn btn-danger"
          onclick={onProceedToConfirm}>{MESSAGES.BTN_DELETE}</button
        >
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal Step 2: Final Confirmation -->
{#if showDeleteConfirmModal}
  <div
    id="delete-department-confirm-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="delete-confirm-title"
    tabindex="-1"
    onclick={handleDeleteConfirmOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onCloseDeleteConfirm();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3
        class="confirm-modal__title"
        id="delete-confirm-title"
      >
        {MESSAGES.DELETE_CONFIRM_TITLE}
      </h3>
      <p class="confirm-modal__message">
        <strong>ACHTUNG:</strong>
        {MESSAGES.DELETE_CONFIRM_WARNING}
        <br /><br />
        {MESSAGES.DELETE_CONFIRM_MESSAGE}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={onCloseDeleteConfirm}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={onConfirmDelete}
        >
          {MESSAGES.BTN_DELETE_FINAL}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Force Delete Warning Modal -->
{#if showForceDeleteModal}
  <div
    id="force-delete-warning-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="force-delete-title"
    tabindex="-1"
    onclick={handleForceDeleteOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onCloseForceDelete();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="confirm-modal confirm-modal--warning"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3
        class="confirm-modal__title"
        id="force-delete-title"
      >
        {MESSAGES.FORCE_DELETE_TITLE}
      </h3>
      <p class="confirm-modal__message">{forceDeleteMessage}</p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={onCloseForceDelete}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--confirm"
          onclick={onForceDelete}
        >
          {MESSAGES.DELETE_TITLE}
        </button>
      </div>
    </div>
  </div>
{/if}
