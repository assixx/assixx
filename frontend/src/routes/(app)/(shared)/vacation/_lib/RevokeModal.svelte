<script lang="ts">
  /**
   * RevokeModal — Revoke an approved vacation request.
   * Requires a mandatory reason. Only shown for current-year approved requests.
   */
  import { showErrorAlert } from '$lib/utils';

  import type { VacationRequest } from './types';

  interface Props {
    request: VacationRequest;
    onclose: () => void;
    onsubmit: (reason: string) => Promise<void>;
  }

  const { request, onclose, onsubmit }: Props = $props();

  let reason = $state('');

  async function handleSubmit() {
    if (reason.trim() === '') {
      showErrorAlert('Bitte geben Sie einen Grund für den Widerruf an');
      return;
    }

    await onsubmit(reason.trim());
  }
</script>

<div
  id="vacation-revoke-modal"
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  onclick={onclose}
  onkeydown={(e) => {
    if (e.key === 'Escape') onclose();
  }}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form
    class="ds-modal"
    onclick={(e) => {
      e.stopPropagation();
    }}
    onkeydown={(e) => {
      e.stopPropagation();
    }}
    onsubmit={(e) => {
      e.preventDefault();
      void handleSubmit();
    }}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">
        <i class="fas fa-undo text-warning mr-2"></i>
        Genehmigung widerrufen
      </h3>
      <button
        type="button"
        class="ds-modal__close"
        onclick={onclose}
        aria-label="Schließen"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="ds-modal__body">
      <div class="respond-info">
        <p>
          <strong>{request.requesterName ?? 'Mitarbeiter'}</strong>
          — {request.computedDays}
          {request.computedDays === 1 ? 'Tag' : 'Tage'}
        </p>
        <p
          class="text-muted"
          style="font-size: 0.813rem; margin-top: 0.25rem;"
        >
          Die Urlaubstage werden dem Mitarbeiter zurückgebucht.
        </p>
      </div>

      <div class="form-field">
        <label
          class="form-field__label"
          for="revoke-reason"
        >
          Grund (Pflichtfeld)
        </label>
        <textarea
          id="revoke-reason"
          class="form-field__control form-field__control--textarea"
          bind:value={reason}
          placeholder="Bitte geben Sie den Grund für den Widerruf an..."
        ></textarea>
      </div>
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}
      >
        Abbrechen
      </button>
      <button
        type="submit"
        class="btn btn-warning"
      >
        <i class="fas fa-undo mr-1"></i>
        Widerrufen
      </button>
    </div>
  </form>
</div>

<style>
  .respond-info {
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    background: var(--glass-bg);
  }
</style>
