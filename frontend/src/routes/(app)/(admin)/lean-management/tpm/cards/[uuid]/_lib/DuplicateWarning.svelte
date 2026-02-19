<script lang="ts">
  /**
   * TPM Duplicate Warning Modal
   * @module cards/[uuid]/_lib/DuplicateWarning
   *
   * Shown when the duplicate check finds similar cards.
   * User can choose to create anyway or cancel.
   */
  import {
    INTERVAL_LABELS,
    CARD_ROLE_LABELS,
    MESSAGES,
  } from '../../../_lib/constants';

  import type { TpmCard } from '../../../_lib/types';

  interface Props {
    existingCards: TpmCard[];
    oncontinue: () => void;
    oncancel: () => void;
  }

  const { existingCards, oncontinue, oncancel }: Props = $props();

  function handleBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) oncancel();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') oncancel();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="modal-backdrop"
  onclick={handleBackdrop}
  onkeydown={handleKeydown}
>
  <div
    class="modal"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="dup-title"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="modal__header">
      <i class="fas fa-exclamation-triangle modal__icon"></i>
      <h3
        class="modal__title"
        id="dup-title"
      >
        {MESSAGES.DUPLICATE_TITLE}
      </h3>
    </div>

    <!-- Body -->
    <div class="modal__body">
      <p class="modal__message">{MESSAGES.DUPLICATE_MESSAGE}</p>

      <ul class="dup-list">
        {#each existingCards as card (card.uuid)}
          <li class="dup-item">
            <span class="dup-item__code">{card.cardCode}</span>
            <span class="dup-item__title">{card.title}</span>
            <span class="dup-item__meta">
              {CARD_ROLE_LABELS[card.cardRole]} — {INTERVAL_LABELS[
                card.intervalType
              ]}
            </span>
          </li>
        {/each}
      </ul>
    </div>

    <!-- Actions -->
    <div class="modal__actions">
      <button
        type="button"
        class="btn btn--ghost"
        onclick={oncancel}
      >
        {MESSAGES.DUPLICATE_CANCEL}
      </button>
      <button
        type="button"
        class="btn btn--warning"
        onclick={oncontinue}
      >
        <i class="fas fa-exclamation-circle"></i>
        {MESSAGES.DUPLICATE_CONTINUE}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 50%);
    padding: 1rem;
  }

  .modal {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 10%));
    max-width: 520px;
    width: 100%;
    overflow: hidden;
  }

  .modal__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .modal__icon {
    font-size: 1.25rem;
    color: var(--color-amber-500, #f59e0b);
  }

  .modal__title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-gray-900);
  }

  .modal__body {
    padding: 1.25rem 1.5rem;
  }

  .modal__message {
    font-size: 0.875rem;
    color: var(--color-gray-600);
    margin-bottom: 1rem;
  }

  /* Duplicate list */
  .dup-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .dup-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-amber-50, rgb(255 251 235));
    border-radius: var(--radius-md, 8px);
    border-left: 3px solid var(--color-amber-400, #fbbf24);
  }

  .dup-item__code {
    font-family: var(--font-mono, monospace);
    font-size: 0.813em;
    font-weight: 600;
    color: var(--color-gray-700);
    flex-shrink: 0;
  }

  .dup-item__title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-gray-900);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dup-item__meta {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    flex-shrink: 0;
    white-space: nowrap;
  }

  /* Actions */
  .modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-gray-200);
    background: var(--color-gray-50);
  }
</style>
