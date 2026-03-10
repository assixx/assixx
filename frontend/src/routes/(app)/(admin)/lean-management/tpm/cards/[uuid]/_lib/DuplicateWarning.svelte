<script lang="ts">
  /**
   * TPM Duplicate Warning Modal
   * @module cards/[uuid]/_lib/DuplicateWarning
   *
   * Shown when the duplicate check finds similar cards.
   * User can choose to create anyway or cancel.
   */
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

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
</script>

<ConfirmModal
  show={true}
  id="tpm-card-duplicate-warning-modal"
  title={MESSAGES.DUPLICATE_TITLE}
  variant="warning"
  confirmLabel={MESSAGES.DUPLICATE_CONTINUE}
  cancelLabel={MESSAGES.DUPLICATE_CANCEL}
  onconfirm={oncontinue}
  {oncancel}
>
  {MESSAGES.DUPLICATE_MESSAGE}
  {#snippet extra()}
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
  {/snippet}
</ConfirmModal>

<style>
  .dup-list {
    list-style: none;
    padding: 0;
    margin: 0 0 25px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .dup-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-amber-50, oklch(98.69% 0.0213 95.33));
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
</style>
