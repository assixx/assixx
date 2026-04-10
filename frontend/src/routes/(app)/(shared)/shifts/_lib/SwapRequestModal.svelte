<script lang="ts">
  /**
   * Swap Request Modal
   * Uses Design System modal classes (ds-modal).
   */
  import { showErrorAlert, showSuccessAlert } from '$lib/utils/alerts';
  import { getErrorMessage } from '$lib/utils/error';

  import { createSwapRequest } from './api';
  import { DEFAULT_SHIFT_TIMES } from './constants';
  import { formatDate, getWeekStart, getWeekEnd } from './utils';

  function shiftLabel(type: string): string {
    if (type in DEFAULT_SHIFT_TIMES) {
      return DEFAULT_SHIFT_TIMES[type as keyof typeof DEFAULT_SHIFT_TIMES].label;
    }
    return type;
  }

  interface Props {
    targetShiftId: number;
    targetUserId: number;
    targetUserName: string;
    targetShiftDate: string;
    targetShiftType: string;
    requesterShiftId: number;
    requesterShiftDate: string;
    requesterShiftType: string;
    onclose: () => void;
    onsubmitted: () => void;
  }

  const {
    targetShiftId,
    targetUserId,
    targetUserName,
    targetShiftDate,
    targetShiftType,
    requesterShiftId,
    requesterShiftDate,
    requesterShiftType,
    onclose,
    onsubmitted,
  }: Props = $props();

  let swapScope = $state<'single_day' | 'week'>('single_day');
  let reason = $state('');
  let submitting = $state(false);

  const startDate = $derived(
    swapScope === 'week' ? formatDate(getWeekStart(new Date(targetShiftDate))) : targetShiftDate,
  );
  const endDate = $derived(
    swapScope === 'week' ? formatDate(getWeekEnd(new Date(targetShiftDate))) : targetShiftDate,
  );

  async function handleSubmit(): Promise<void> {
    if (submitting) return;
    submitting = true;

    try {
      await createSwapRequest({
        requesterShiftId: requesterShiftId > 0 ? requesterShiftId : undefined,
        targetShiftId: targetShiftId > 0 ? targetShiftId : undefined,
        targetId: targetUserId,
        swapScope,
        startDate,
        endDate,
        reason: reason.trim() !== '' ? reason.trim() : undefined,
      });
      showSuccessAlert('Tausch-Anfrage gesendet');
      onsubmitted();
    } catch (err: unknown) {
      showErrorAlert(getErrorMessage(err));
    } finally {
      submitting = false; // eslint-disable-line require-atomic-updates -- guarded by early return
    }
  }
</script>

<!-- Design System Modal (ds-modal) -->
<div
  class="modal-overlay modal-overlay--active"
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby="swap-modal-title"
  onkeydown={(e: KeyboardEvent) => {
    if (e.key === 'Escape') onclose();
  }}
  onclick={(e: MouseEvent) => {
    if (e.target === e.currentTarget) onclose();
  }}
>
  <div class="ds-modal ds-modal--sm">
    <div class="ds-modal__header">
      <h2
        class="ds-modal__title"
        id="swap-modal-title"
      >
        <i class="fas fa-exchange-alt mr-2"></i>Schichttausch-Anfrage
      </h2>
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
      <!-- Swap Overview -->
      <div class="swap-overview">
        <div class="swap-side">
          <span class="swap-label">Deine Schicht</span>
          <span class="swap-value">{requesterShiftDate}</span>
          <span class="swap-badge">{shiftLabel(requesterShiftType)}</span>
        </div>
        <div class="swap-arrow">
          <i class="fas fa-exchange-alt"></i>
        </div>
        <div class="swap-side">
          <span class="swap-label">{targetUserName}</span>
          <span class="swap-value">{targetShiftDate}</span>
          <span class="swap-badge">{shiftLabel(targetShiftType)}</span>
        </div>
      </div>

      <!-- Scope Selector -->
      <div class="form-field">
        <span class="form-field__label">Umfang</span>
        <div class="choice-group choice-group--compact">
          <label class="choice-card">
            <input
              class="choice-card__input"
              type="radio"
              bind:group={swapScope}
              value="single_day"
            />
            <span class="choice-card__text">Nur diesen Tag</span>
          </label>
          <label class="choice-card">
            <input
              class="choice-card__input"
              type="radio"
              bind:group={swapScope}
              value="week"
            />
            <span class="choice-card__text">Ganze Woche</span>
          </label>
        </div>
      </div>

      <!-- Reason -->
      <div class="form-field">
        <label
          class="form-field__label"
          for="swap-reason">Grund (optional)</label
        >
        <textarea
          id="swap-reason"
          class="form-field__control"
          rows="2"
          maxlength="500"
          placeholder="Warum möchtest du tauschen?"
          bind:value={reason}
        ></textarea>
      </div>
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}
        disabled={submitting}
      >
        Abbrechen
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        onclick={() => void handleSubmit()}
        disabled={submitting}
      >
        {#if submitting}
          <span class="spinner-ring spinner-ring--sm"></span>
          Senden...
        {:else}
          <i class="fas fa-paper-plane mr-1"></i>
          Anfrage senden
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .swap-overview {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    padding: var(--spacing-4);
    border-radius: var(--radius-lg);
    background: var(--glass-bg);
  }

  .swap-side {
    flex: 1;
    text-align: center;
  }

  .swap-label {
    display: block;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
  }

  .swap-value {
    display: block;
    margin-top: var(--spacing-1);
    font-weight: 600;
  }

  .swap-badge {
    display: inline-block;
    margin-top: var(--spacing-1);
    padding: 2px 8px;
    border-radius: var(--radius-full);
    background: var(--primary-color);
    color: var(--color-white);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .swap-arrow {
    color: var(--primary-color);
    font-size: 1.2rem;
  }
</style>
