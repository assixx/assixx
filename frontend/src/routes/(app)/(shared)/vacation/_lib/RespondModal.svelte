<script lang="ts">
  /**
   * RespondModal — Approve or deny a vacation request.
   * Owns its own UI state (note, specialLeave, capacity).
   * Fetches capacity analysis on mount for approve actions.
   */
  import { onMount } from 'svelte';

  import { showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './api';
  import CapacityIndicator from './CapacityIndicator.svelte';
  import SpecialLeaveCheckbox from './SpecialLeaveCheckbox.svelte';

  import type {
    RespondPayload,
    VacationCapacityAnalysis,
    VacationRequest,
  } from './types';

  const log = createLogger('RespondModal');

  interface Props {
    request: VacationRequest;
    action: 'approve' | 'deny';
    onclose: () => void;
    onsubmit: (payload: RespondPayload) => Promise<void>;
  }

  const { request, action, onclose, onsubmit }: Props = $props();

  let responseNote = $state('');
  let isSpecialLeave = $state(false);
  let respondCapacity = $state<VacationCapacityAnalysis | null>(null);
  let isLoadingCapacity = $state(false);

  onMount(() => {
    if (action === 'approve') {
      void fetchCapacity();
    }
  });

  async function fetchCapacity() {
    isLoadingCapacity = true;
    try {
      respondCapacity = await api.analyzeCapacity(
        request.startDate,
        request.endDate,
        request.requesterId,
      );
    } catch (err) {
      log.error({ err }, 'Capacity fetch failed');
    } finally {
      isLoadingCapacity = false;
    }
  }

  async function handleSubmit() {
    if (action === 'deny' && responseNote.trim() === '') {
      showErrorAlert('Bitte geben Sie einen Grund für die Ablehnung an');
      return;
    }

    await onsubmit({
      action,
      responseNote:
        responseNote.trim() !== '' ? responseNote.trim() : undefined,
      isSpecialLeave: action === 'approve' ? isSpecialLeave : undefined,
    });
  }
</script>

<div
  id="vacation-respond-modal"
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
        {#if action === 'approve'}
          <i class="fas fa-check-circle text-success mr-2"></i>
          Antrag genehmigen
        {:else}
          <i class="fas fa-times-circle text-danger mr-2"></i>
          Antrag ablehnen
        {/if}
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
      </div>

      {#if action === 'approve'}
        <CapacityIndicator
          analysis={respondCapacity}
          isLoading={isLoadingCapacity}
        />

        <SpecialLeaveCheckbox
          checked={isSpecialLeave}
          onchange={(val: boolean) => {
            isSpecialLeave = val;
          }}
        />
      {/if}

      <div class="form-field">
        <label
          class="form-field__label"
          for="response-note"
        >
          {action === 'deny' ? 'Grund (Pflichtfeld)' : 'Bemerkung (optional)'}
        </label>
        <textarea
          id="response-note"
          class="form-field__control form-field__control--textarea"
          bind:value={responseNote}
          placeholder={action === 'deny' ?
            'Bitte geben Sie den Grund für die Ablehnung an...'
          : 'Optionale Bemerkung...'}
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
        class={action === 'approve' ? 'btn btn-primary' : 'btn btn-danger'}
      >
        {action === 'approve' ? 'Genehmigen' : 'Ablehnen'}
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
