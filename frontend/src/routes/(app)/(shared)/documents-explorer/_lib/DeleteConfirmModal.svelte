<script lang="ts">
  import type { Document } from './types';

  interface Props {
    show: boolean;
    document: Document | null;
    submitting: boolean;
    onclose: () => void;
    onconfirm: () => void;
  }

  const { show, document, submitting, onclose, onconfirm }: Props = $props();

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }
</script>

{#if show && document}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    id="document-delete-modal"
    class="modal-overlay modal-overlay--active"
    onclick={handleOverlayClick}
  >
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="confirm-modal__title">Dokument löschen?</h3>
      <p class="confirm-modal__message">
        <strong>ACHTUNG:</strong> Diese Aktion kann nicht rückgängig gemacht
        werden!
        <br /><br />
        Das Dokument <strong>"{document.filename}"</strong> wird unwiderruflich gelöscht.
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={onclose}
          disabled={submitting}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={onconfirm}
          disabled={submitting}
        >
          {#if submitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
          {:else}
            <i class="fas fa-trash mr-2"></i>
          {/if}
          Endgültig löschen
        </button>
      </div>
    </div>
  </div>
{/if}
