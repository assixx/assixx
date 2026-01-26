<script lang="ts">
  interface Props {
    onclose: () => void;
    onconfirm: () => void;
  }

  /* eslint-disable prefer-const */
  let { onclose, onconfirm }: Props = $props();
  /* eslint-enable prefer-const */
</script>

<div class="modal-overlay modal-overlay--active" role="presentation" onclick={onclose}>
  <div
    class="confirm-modal confirm-modal--danger"
    role="presentation"
    onclick={(e) => {
      e.stopPropagation();
    }}
  >
    <div class="confirm-modal__icon">
      <i class="fas fa-trash"></i>
    </div>
    <h3 class="confirm-modal__title">Termin Löschen</h3>
    <p class="confirm-modal__message">
      Moechten Sie diesen Termin wirklich Löschen? Diese Aktion kann nicht rückgängig gemacht
      werden.
    </p>
    <div class="confirm-modal__actions">
      <button type="button" class="confirm-modal__btn confirm-modal__btn--cancel" onclick={onclose}>
        Abbrechen
      </button>
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--danger"
        onclick={onconfirm}
      >
        <i class="fas fa-trash"></i> Löschen
      </button>
    </div>
  </div>
</div>
