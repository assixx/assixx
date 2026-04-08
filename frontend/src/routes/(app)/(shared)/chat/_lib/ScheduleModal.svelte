<script lang="ts">
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';

  import { MESSAGES, SCHEDULE_CONSTRAINTS } from './constants';

  interface Props {
    show: boolean;
    date?: string;
    time?: string;
    errorMessage?: string;
    onclose: () => void;
    onconfirm: () => void;
  }

  /* eslint-disable prefer-const -- Svelte $bindable() requires let */
  let {
    show,
    date = $bindable(''),
    time = $bindable(''),
    errorMessage = '',
    onclose,
    onconfirm,
  }: Props = $props();
  /* eslint-enable prefer-const */

  /** Today's date as YYYY-MM-DD for min attribute */
  const minDate: string = $derived(new Date().toISOString().split('T')[0] ?? '');

  /** Max selectable date (today + 60 days) as YYYY-MM-DD */
  const maxDate: string = $derived(
    new Date(Date.now() + SCHEDULE_CONSTRAINTS.maxFutureTime).toISOString().split('T')[0] ?? '',
  );
</script>

{#if show}
  <div
    id="chat-schedule-modal"
    class="modal-overlay modal-overlay--active"
  >
    <div class="ds-modal ds-modal--sm">
      <div class="ds-modal__header">
        <h2 class="ds-modal__title">
          <i class="far fa-clock"></i>
          &nbsp; {MESSAGES.labelScheduleTitle}
        </h2>
        <button
          type="button"
          class="ds-modal__close"
          aria-label={MESSAGES.labelCloseModal}
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p class="schedule-description">{MESSAGES.labelScheduleDescription}</p>
        <div class="schedule-inputs">
          <div class="form-field">
            <label
              class="form-field__label form-field__label--required"
              for="scheduleDate"
            >
              {MESSAGES.labelDate}
            </label>
            <AppDatePicker
              required
              min={minDate}
              max={maxDate}
              bind:value={date}
            />
          </div>
          <div class="form-field">
            <label
              class="form-field__label form-field__label--required"
              for="scheduleTime"
            >
              {MESSAGES.labelTime}
            </label>
            <input
              type="time"
              id="scheduleTime"
              class="form-field__control"
              required
              bind:value={time}
            />
          </div>
        </div>
        <small class="form-field__message schedule-hint">
          <i class="fas fa-info-circle"></i>
          &nbsp; {MESSAGES.labelScheduleHint}
        </small>

        {#if errorMessage}
          <div class="alert alert--warning mt-4">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            {errorMessage}
          </div>
        {/if}
      </div>
      <div class="ds-modal__footer ds-modal__footer--spaced">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}>{MESSAGES.labelCancel}</button
        >
        <button
          type="button"
          class="btn btn-secondary"
          onclick={onconfirm}
        >
          <i class="far fa-clock"></i>
          {MESSAGES.labelSchedule}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .schedule-description {
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-4);
  }

  .schedule-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-4);
  }

  .schedule-hint {
    margin-top: var(--spacing-3);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1, 0.25rem);
  }

  .form-field__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-field__label--required::after {
    content: ' *';
    color: var(--color-danger);
  }

  .form-field__control {
    padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
    border: 1px solid var(--border-color, color-mix(in oklch, var(--color-white) 20%, transparent));
    border-radius: var(--radius-md, 8px);
    background: var(
      --background-secondary,
      color-mix(in oklch, var(--color-white) 5%, transparent)
    );
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .form-field__control:focus {
    outline: none;
    border-color: var(--primary-color, var(--color-primary));
  }

  .form-field__message {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }
</style>
