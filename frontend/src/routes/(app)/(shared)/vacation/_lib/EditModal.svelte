<script lang="ts">
  /**
   * EditModal — Wraps RequestForm in a ds-modal for editing an existing vacation request.
   * Receives the request to edit + pre-fetched capacity analysis.
   */
  import RequestForm from './RequestForm.svelte';

  import type {
    CreateVacationRequestPayload,
    VacationCapacityAnalysis,
    VacationRequest,
  } from './types';

  interface RequestFormRef {
    submitForm(): void;
    getCanSubmit(): boolean;
  }

  interface Props {
    request: VacationRequest;
    initialCapacity: VacationCapacityAnalysis | null;
    onclose: () => void;
    onsubmit: (payload: CreateVacationRequestPayload) => Promise<void>;
    onCapacityCheck: (
      startDate: string,
      endDate: string,
    ) => Promise<VacationCapacityAnalysis | null>;
  }

  const { request, initialCapacity, onclose, onsubmit, onCapacityCheck }: Props = $props();

  let formRef = $state<RequestFormRef | null>(null);
</script>

<div
  id="vacation-edit-modal"
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
        <i class="fas fa-edit mr-2"></i>
        Antrag bearbeiten
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
        editingRequest={request}
        {initialCapacity}
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
        <i class="fas fa-save mr-1"></i>
        Änderungen speichern
      </button>
    </div>
  </form>
</div>
