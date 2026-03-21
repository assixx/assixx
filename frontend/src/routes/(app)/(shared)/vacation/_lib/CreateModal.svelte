<script lang="ts">
  /**
   * CreateModal — Wraps RequestForm in a ds-modal for creating new vacation requests.
   * Owns its own formRef; parent only provides callbacks.
   */
  import RequestForm from './RequestForm.svelte';

  import type { CreateVacationRequestPayload, VacationCapacityAnalysis } from './types';

  interface RequestFormRef {
    submitForm(): void;
    getCanSubmit(): boolean;
  }

  interface Props {
    onclose: () => void;
    onsubmit: (payload: CreateVacationRequestPayload) => Promise<void>;
    onCapacityCheck: (
      startDate: string,
      endDate: string,
    ) => Promise<VacationCapacityAnalysis | null>;
  }

  const { onclose, onsubmit, onCapacityCheck }: Props = $props();

  let formRef = $state<RequestFormRef | null>(null);
</script>

<div
  id="vacation-create-modal"
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <form
    class="ds-modal"
    onsubmit={(e) => {
      e.preventDefault();
      formRef?.submitForm();
    }}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">
        <i class="fas fa-umbrella-beach mr-2"></i>
        Neuer Urlaubsantrag
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
      <RequestForm
        bind:this={formRef}
        {onsubmit}
        {onCapacityCheck}
      />
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
        class="btn btn-primary"
        disabled={!formRef}
      >
        <i class="fas fa-paper-plane mr-1"></i>
        Antrag einreichen
      </button>
    </div>
  </form>
</div>
