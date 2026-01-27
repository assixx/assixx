<script lang="ts">
  import { kvpDetailState } from './state.svelte';

  interface Props {
    rejectionReason: string;
    onconfirm: () => void;
    oncancel: () => void;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { rejectionReason = $bindable(), onconfirm, oncancel }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */
</script>

{#if kvpDetailState.showRejectionModal}
  <div class="modal-overlay modal-overlay--active">
    <div class="ds-modal ds-modal--sm">
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">Vorschlag ablehnen</h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={oncancel}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p class="mb-4">Bitte geben Sie einen Grund für die Ablehnung an:</p>
        <div class="form-field">
          <label
            class="form-field__label"
            for="rejectionReasonInput">Ablehnungsgrund</label
          >
          <textarea
            class="form-field__control"
            id="rejectionReasonInput"
            rows="4"
            placeholder="Grund der Ablehnung eingeben..."
            bind:value={rejectionReason}
            required
          ></textarea>
        </div>
      </div>
      <div class="ds-modal__footer ds-modal__footer--right">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={oncancel}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={onconfirm}
        >
          Ablehnen
        </button>
      </div>
    </div>
  </div>
{/if}
