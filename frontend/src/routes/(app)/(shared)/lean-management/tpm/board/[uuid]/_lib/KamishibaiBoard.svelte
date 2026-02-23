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
  }

  const { cards, colors }: Props = $props();

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
  <div class="empty-state">
    <div class="empty-state__icon">
      <i class="fas fa-filter"></i>
    </div>
    <h3 class="empty-state__title">Keine Karten gefunden</h3>
    <p class="empty-state__description">
      Keine Karten entsprechen dem gewählten Filter.
    </p>
  </div>
{:else}
  <div class="flex flex-col gap-5">
    {#each sections as section (section.intervalType)}
      <KamishibaiSection
        label={section.label}
        operatorCards={section.operatorCards}
        maintenanceCards={section.maintenanceCards}
        totalOpen={section.totalOpen}
        {colors}
      />
    {/each}
  </div>
{/if}
