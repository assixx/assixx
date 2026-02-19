<script lang="ts">
  /**
   * KamishibaiBoard — Groups cards by interval type and renders sections.
   * Sections are ordered by intervalOrder (daily→custom).
   * Shows empty state if no cards match the current filter.
   */
  import { SvelteMap } from 'svelte/reactivity';

  import { INTERVAL_LABELS } from '../../../_lib/constants';

  import KamishibaiSection from './KamishibaiSection.svelte';

  import type {
    TpmCard,
    TpmColorConfigEntry,
    IntervalType,
  } from '../../../_lib/types';

  /** Canonical interval order — daily first, custom last */
  const INTERVAL_ORDER: IntervalType[] = [
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'semi_annual',
    'annual',
    'long_runner',
    'custom',
  ];

  interface SectionData {
    intervalType: IntervalType;
    label: string;
    operatorCards: TpmCard[];
    maintenanceCards: TpmCard[];
    totalOpen: number;
  }

  interface Props {
    cards: TpmCard[];
    colors: TpmColorConfigEntry[];
    onCardSelect?: (card: TpmCard) => void;
  }

  const { cards, colors, onCardSelect }: Props = $props();

  function countOpen(sectionCards: TpmCard[]): number {
    return sectionCards.filter(
      (c: TpmCard) => c.status === 'red' || c.status === 'overdue',
    ).length;
  }

  function buildSections(allCards: TpmCard[]): SectionData[] {
    const grouped = new SvelteMap<IntervalType, TpmCard[]>();
    for (const card of allCards) {
      const existing = grouped.get(card.intervalType) ?? [];
      existing.push(card);
      grouped.set(card.intervalType, existing);
    }

    return INTERVAL_ORDER.filter((it: IntervalType) => grouped.has(it)).map(
      (it: IntervalType) => {
        const sectionCards = grouped.get(it) ?? [];
        const operatorCards = sectionCards.filter(
          (c: TpmCard) => c.cardRole === 'operator',
        );
        const maintenanceCards = sectionCards.filter(
          (c: TpmCard) => c.cardRole === 'maintenance',
        );
        return {
          intervalType: it,
          label: INTERVAL_LABELS[it],
          operatorCards,
          maintenanceCards,
          totalOpen: countOpen(sectionCards),
        };
      },
    );
  }

  const sections = $derived(buildSections(cards));
</script>

{#if sections.length === 0}
  <div class="board-empty">
    <i class="fas fa-filter board-empty__icon"></i>
    <h3 class="board-empty__title">Keine Karten gefunden</h3>
    <p class="board-empty__desc">
      Keine Karten entsprechen dem gewählten Filter.
    </p>
  </div>
{:else}
  <div class="kamishibai-board">
    {#each sections as section (section.intervalType)}
      <KamishibaiSection
        label={section.label}
        operatorCards={section.operatorCards}
        maintenanceCards={section.maintenanceCards}
        totalOpen={section.totalOpen}
        {colors}
        {onCardSelect}
      />
    {/each}
  </div>
{/if}

<style>
  .kamishibai-board {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .board-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-sm);
  }

  .board-empty__icon {
    font-size: 2.5rem;
    color: var(--color-gray-300);
    margin-bottom: 1rem;
  }

  .board-empty__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-gray-700);
    margin: 0 0 0.5rem;
  }

  .board-empty__desc {
    font-size: 0.875rem;
    color: var(--color-gray-500);
    margin: 0;
  }
</style>
