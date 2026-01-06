<script lang="ts">
  import { MESSAGES } from './constants';

  interface Props {
    show: boolean;
    date: string;
    time: string;
    onclose: () => void;
    onconfirm: () => void;
  }

  /* eslint-disable prefer-const */
  let { show, date = $bindable(), time = $bindable(), onclose, onconfirm }: Props = $props();
  /* eslint-enable prefer-const */
</script>

{#if show}
  <div class="modal-overlay modal-overlay--active">
    <div class="ds-modal ds-modal--sm">
      <div class="ds-modal__header">
        <h2 class="ds-modal__title">
          <i class="far fa-clock"></i>
          &nbsp; {MESSAGES.labelScheduleTitle}
        </h2>
        <button class="ds-modal__close" aria-label={MESSAGES.labelCloseModal} onclick={onclose}>
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p class="schedule-description">{MESSAGES.labelScheduleDescription}</p>
        <div class="schedule-inputs">
          <div class="form-field">
            <label class="form-field__label form-field__label--required" for="scheduleDate">
              {MESSAGES.labelDate}
            </label>
            <input
              type="date"
              id="scheduleDate"
              class="form-field__control"
              required
              bind:value={date}
            />
          </div>
          <div class="form-field">
            <label class="form-field__label form-field__label--required" for="scheduleTime">
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
      </div>
      <div class="ds-modal__footer ds-modal__footer--spaced">
        <button class="btn btn-cancel" onclick={onclose}>{MESSAGES.labelCancel}</button>
        <button class="btn btn-modal" onclick={onconfirm}>
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
    color: var(--color-danger, #f44336);
  }

  .form-field__control {
    padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
    border: 1px solid var(--border-color, rgb(255 255 255 / 20%));
    border-radius: var(--radius-md, 8px);
    background: var(--background-secondary, rgb(255 255 255 / 5%));
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .form-field__control:focus {
    outline: none;
    border-color: var(--primary-color, #2196f3);
  }

  .form-field__message {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }
</style>
