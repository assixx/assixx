<script lang="ts">
  import { MESSAGES } from './constants';

  interface Props {
    show: boolean;
    message: string;
    onclose: () => void;
    onconfirm: () => void;
  }

  /* eslint-disable prefer-const */
  let { show, message, onclose, onconfirm }: Props = $props();
  /* eslint-enable prefer-const */
</script>

{#if show}
  <div class="modal-overlay modal-overlay--active">
    <div class="confirm-modal confirm-modal--danger">
      <div class="confirm-modal__icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="confirm-modal__title">{MESSAGES.labelConfirmDelete}</h3>
      <p class="confirm-modal__message">{message}</p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={onclose}
        >
          {MESSAGES.labelCancel}
        </button>
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={onconfirm}
        >
          {MESSAGES.labelDelete}
        </button>
      </div>
    </div>
  </div>
{/if}
