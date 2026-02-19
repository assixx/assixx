<script lang="ts">
  /**
   * KamishibaiSection — One interval group on the Kamishibai board.
   * Shows operator and maintenance cards in separate rows.
   * Displays open-card count badge in section header.
   */
  import { CARD_ROLE_LABELS } from '../../../_lib/constants';

  import KamishibaiCard from './KamishibaiCard.svelte';

  import type { TpmCard, TpmColorConfigEntry } from '../../../_lib/types';

  interface Props {
    label: string;
    operatorCards: TpmCard[];
    maintenanceCards: TpmCard[];
    totalOpen: number;
    colors: TpmColorConfigEntry[];
    onCardSelect?: (card: TpmCard) => void;
  }

  const {
    label,
    operatorCards,
    maintenanceCards,
    totalOpen,
    colors,
    onCardSelect,
  }: Props = $props();

  const hasOperator = $derived(operatorCards.length > 0);
  const hasMaintenance = $derived(maintenanceCards.length > 0);
</script>

<section class="kamishibai-section">
  <div class="kamishibai-section__header">
    <h3 class="kamishibai-section__label">
      <i class="fas fa-layer-group"></i>
      {label}
    </h3>
    {#if totalOpen > 0}
      <span class="kamishibai-section__badge">
        {totalOpen} offen
      </span>
    {:else}
      <span class="kamishibai-section__badge kamishibai-section__badge--ok">
        <i class="fas fa-check"></i> Alles erledigt
      </span>
    {/if}
  </div>

  {#if hasOperator}
    <div class="kamishibai-section__role-group">
      <div class="kamishibai-section__role-label">
        <i class="fas fa-user"></i>
        {CARD_ROLE_LABELS.operator}
        <span class="kamishibai-section__count">{operatorCards.length}</span>
      </div>
      <div class="kamishibai-section__cards">
        {#each operatorCards as card (card.uuid)}
          <KamishibaiCard
            {card}
            {colors}
            {onCardSelect}
          />
        {/each}
      </div>
    </div>
  {/if}

  {#if hasMaintenance}
    <div class="kamishibai-section__role-group">
      <div class="kamishibai-section__role-label">
        <i class="fas fa-wrench"></i>
        {CARD_ROLE_LABELS.maintenance}
        <span class="kamishibai-section__count">{maintenanceCards.length}</span>
      </div>
      <div class="kamishibai-section__cards">
        {#each maintenanceCards as card (card.uuid)}
          <KamishibaiCard
            {card}
            {colors}
            {onCardSelect}
          />
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .kamishibai-section {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  /* Section header */
  .kamishibai-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--color-gray-200);
    background: var(--color-gray-50, #f9fafb);
  }

  .kamishibai-section__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.938rem;
    font-weight: 600;
    color: var(--color-gray-800);
    margin: 0;
  }

  .kamishibai-section__label i {
    color: var(--color-gray-400);
    font-size: 0.875rem;
  }

  .kamishibai-section__badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-full, 9999px);
    font-size: 0.813rem;
    font-weight: 500;
    background: color-mix(
      in srgb,
      var(--color-danger, #ef4444) 12%,
      transparent
    );
    color: var(--color-danger, #ef4444);
  }

  .kamishibai-section__badge--ok {
    background: color-mix(
      in srgb,
      var(--color-success, #10b981) 12%,
      transparent
    );
    color: var(--color-success, #10b981);
  }

  /* Role group */
  .kamishibai-section__role-group {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-gray-100);
  }

  .kamishibai-section__role-group:last-child {
    border-bottom: none;
  }

  .kamishibai-section__role-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    font-weight: 500;
    color: var(--color-gray-500);
    margin-bottom: 0.75rem;
  }

  .kamishibai-section__count {
    margin-left: auto;
    background: var(--color-gray-200, #e5e7eb);
    color: var(--color-gray-600);
    border-radius: var(--radius-full, 9999px);
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  /* Cards horizontal scroll */
  .kamishibai-section__cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    min-height: 180px;
    align-items: flex-start;
  }
</style>
