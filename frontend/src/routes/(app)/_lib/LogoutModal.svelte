<!--
  LogoutModal.svelte
  Logout confirmation dialog using design system modal classes
  Extracted from +layout.svelte for max-lines compliance
-->
<script lang="ts">
  interface Props {
    isVisible: boolean;
    onCancel: () => void;
    onConfirm: () => void;
  }

  const { isVisible, onCancel, onConfirm }: Props = $props();
</script>

{#if isVisible}
  <div
    id="logout-modal"
    class="modal-overlay modal-overlay--active"
  >
    <div
      class="confirm-modal confirm-modal--info"
      style="bottom: 10%;"
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-sign-out-alt"></i>
      </div>
      <h3 class="confirm-modal__title">Abmeldung bestätigen</h3>
      <p class="confirm-modal__message">
        Möchten Sie sich wirklich abmelden?<br />
        <small
          ><i class="fas fa-info-circle"></i> Alle ungespeicherten Änderungen gehen
          verloren.</small
        >
      </p>
      <div class="confirm-modal__actions confirm-modal__actions--centered">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel confirm-modal__btn--wide"
          onclick={onCancel}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-danger confirm-modal__btn--wide"
          onclick={onConfirm}
        >
          Abmelden
        </button>
      </div>
    </div>
  </div>
{/if}
