<script lang="ts">
  /**
   * KamishibaiBoard — Groups cards by interval type and renders sections.
   * Sections are ordered by intervalOrder (daily→custom).
   * Shows empty state if no cards match the current filter.
   */
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';

  import { INTERVAL_LABELS, MESSAGES, ZOOM_CONFIG } from '../../../_lib/constants';

  import KamishibaiSection from './KamishibaiSection.svelte';

  import type {
    TpmCard,
    TpmColorConfigEntry,
    IntervalColorConfigEntry,
    CategoryColorConfigEntry,
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
    allCards: TpmCard[];
    filteredCards: TpmCard[];
    colors: TpmColorConfigEntry[];
    intervalColors: IntervalColorConfigEntry[];
    categoryColors?: CategoryColorConfigEntry[];
  }

  const { allCards, filteredCards, colors, intervalColors, categoryColors = [] }: Props = $props();

  function countOpen(sectionCards: TpmCard[]): number {
    return sectionCards.filter((c: TpmCard) => c.status === 'red' || c.status === 'overdue').length;
  }

  function buildSections(all: TpmCard[], filtered: TpmCard[]): SectionData[] {
    const grouped = new SvelteMap<IntervalType, TpmCard[]>();
    for (const card of all) {
      const existing = grouped.get(card.intervalType) ?? [];
      existing.push(card);
      grouped.set(card.intervalType, existing);
    }

    const filteredUuids = new Set(filtered.map((c: TpmCard) => c.uuid));

    return INTERVAL_ORDER.filter((it: IntervalType) => grouped.has(it)).map((it: IntervalType) => {
      const sectionAll = grouped.get(it) ?? [];
      const sectionFiltered = sectionAll.filter((c: TpmCard) => filteredUuids.has(c.uuid));
      return {
        intervalType: it,
        label: INTERVAL_LABELS[it],
        operatorCards: sectionFiltered.filter((c: TpmCard) => c.cardRole === 'operator'),
        maintenanceCards: sectionFiltered.filter((c: TpmCard) => c.cardRole === 'maintenance'),
        totalOpen: countOpen(sectionAll),
      };
    });
  }

  const sections = $derived(buildSections(allCards, filteredCards));

  /** Global stacking toggle — collapsed (stacked) by default */
  let globalCollapsed = $state(true);

  /** In stacked mode, hide sections with 0 filtered cards */
  function sectionHasCards(s: SectionData): boolean {
    return s.operatorCards.length > 0 || s.maintenanceCards.length > 0;
  }

  const visibleSections = $derived(
    globalCollapsed ? sections.filter((s: SectionData) => sectionHasCards(s)) : sections,
  );

  /** Tracks which cards are currently flipped — drives section expansion */
  const flippedCards = new SvelteSet<string>();

  /** Cards flipped from stacked mode — get locate animation + scroll */
  const locateCards = new SvelteSet<string>();

  /** Tracks sections manually expanded via header click */
  const expandedSections = new SvelteSet<IntervalType>();

  /** Index of section with a hovered stacked card — dims siblings */
  let hoveredSectionIdx = $state<number | null>(null);

  function handleToggle(): void {
    globalCollapsed = !globalCollapsed;
    flippedCards.clear();
    locateCards.clear();
    expandedSections.clear();
  }

  function handleSectionHeaderClick(intervalType: IntervalType): void {
    const section = visibleSections.find((s: SectionData) => s.intervalType === intervalType);
    const isExpanded =
      expandedSections.has(intervalType) ||
      (section !== undefined && sectionHasFlippedCards(section));

    if (isExpanded) {
      expandedSections.delete(intervalType);
      if (section !== undefined) {
        for (const c of [...section.operatorCards, ...section.maintenanceCards]) {
          flippedCards.delete(c.uuid);
          locateCards.delete(c.uuid);
        }
      }
    } else {
      expandedSections.add(intervalType);
    }
  }

  function handleCardFlip(uuid: string, isFlipped: boolean): void {
    if (isFlipped) {
      const section = sections.find((s: SectionData) =>
        [...s.operatorCards, ...s.maintenanceCards].some((c: TpmCard) => c.uuid === uuid),
      );

      /** Flipped from stacked mode → locate animation + scroll */
      const wasStacked =
        globalCollapsed &&
        section !== undefined &&
        !expandedSections.has(section.intervalType) &&
        !sectionHasFlippedCards(section);

      flippedCards.add(uuid);
      if (wasStacked) locateCards.add(uuid);

      /** Pin the section open so it stays expanded after un-flip */
      if (section !== undefined) {
        expandedSections.add(section.intervalType);
      }
    } else {
      flippedCards.delete(uuid);
      locateCards.delete(uuid);
    }
  }

  /** Section is expanded if any of its cards are currently flipped */
  function sectionHasFlippedCards(section: SectionData): boolean {
    return [...section.operatorCards, ...section.maintenanceCards].some((c: TpmCard) =>
      flippedCards.has(c.uuid),
    );
  }

  /** Dynamic overlap factor based on previous section's card count */
  function getOverlapFactor(cardCount: number): number {
    if (cardCount <= 20) return -0.91;
    if (cardCount <= 40) return -0.51;
    if (cardCount <= 60) return -0.21;
    return 0;
  }

  const toggleLabel = $derived(
    globalCollapsed ? MESSAGES.BTN_BOARD_STACKED : MESSAGES.BTN_BOARD_EXPANDED,
  );
  const toggleIcon = $derived(globalCollapsed ? 'fa-layer-group' : 'fa-th-large');

  /** Zoom — same pattern as Gesamtansicht (OverallViewTable) */
  let zoomLevel: number = $state(ZOOM_CONFIG.DEFAULT);

  function zoomIn(): void {
    if (zoomLevel < ZOOM_CONFIG.MAX) zoomLevel += ZOOM_CONFIG.STEP;
  }

  function zoomOut(): void {
    if (zoomLevel > ZOOM_CONFIG.MIN) zoomLevel -= ZOOM_CONFIG.STEP;
  }

  function zoomReset(): void {
    zoomLevel = ZOOM_CONFIG.DEFAULT;
  }

  /** Fullscreen — same pattern as Gesamtansicht (OverallViewTable) */
  const FULLSCREEN_CLASS = 'tpm-board-fullscreen';

  async function toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement !== null) {
        await document.exitFullscreen();
      } else {
        document.body.classList.add(FULLSCREEN_CLASS);
        await document.documentElement.requestFullscreen();
      }
    } catch {
      document.body.classList.remove(FULLSCREEN_CLASS);
    }
  }

  function handleFullscreenChange(): void {
    if (document.fullscreenElement === null) {
      document.body.classList.remove(FULLSCREEN_CLASS);
    }
  }
</script>

<svelte:document onfullscreenchange={handleFullscreenChange} />

<div class="kamishibai-board">
  <div class="kamishibai-board__toolbar">
    <div class="zoom-controls">
      <button
        type="button"
        class="toggle-group__btn"
        class:active={globalCollapsed}
        aria-pressed={globalCollapsed}
        aria-label={globalCollapsed ? 'Sections aufklappen' : 'Sections stapeln'}
        onclick={handleToggle}
      >
        <i class="fas {toggleIcon}"></i>
        <span>{toggleLabel}</span>
      </button>
      <button
        type="button"
        class="btn btn-icon btn-secondary ml-2"
        title={MESSAGES.ZOOM_IN}
        disabled={zoomLevel >= ZOOM_CONFIG.MAX}
        onclick={zoomIn}><i class="fas fa-plus"></i></button
      >
      <span class="zoom-level">{zoomLevel}%</span>
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title={MESSAGES.ZOOM_OUT}
        disabled={zoomLevel <= ZOOM_CONFIG.MIN}
        onclick={zoomOut}><i class="fas fa-minus"></i></button
      >
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title={MESSAGES.ZOOM_RESET}
        onclick={zoomReset}><i class="fas fa-compress-arrows-alt"></i></button
      >
      <button
        type="button"
        class="btn btn-icon btn-secondary ml-2"
        title={MESSAGES.ZOOM_FULLSCREEN}
        onclick={() => {
          void toggleFullscreen();
        }}><i class="fas fa-expand"></i></button
      >
    </div>
  </div>

  <div
    class="kamishibai-board__sections"
    class:kamishibai-board__sections--collapsed={globalCollapsed}
    style="zoom: {zoomLevel / 100};"
  >
    {#each visibleSections as section, idx (section.intervalType)}
      <KamishibaiSection
        label={section.label}
        operatorCards={section.operatorCards}
        maintenanceCards={section.maintenanceCards}
        totalOpen={section.totalOpen}
        {colors}
        {intervalColors}
        {categoryColors}
        sectionIndex={idx}
        isLast={idx === visibleSections.length - 1}
        isCollapsed={globalCollapsed}
        isSectionExpanded={sectionHasFlippedCards(section) ||
          expandedSections.has(section.intervalType)}
        overlapFactor={idx > 0 ?
          getOverlapFactor(
            visibleSections[idx - 1].operatorCards.length +
              visibleSections[idx - 1].maintenanceCards.length,
          )
        : -0.7}
        isPreviousExpanded={idx > 0 &&
          (sectionHasFlippedCards(visibleSections[idx - 1]) ||
            expandedSections.has(visibleSections[idx - 1].intervalType))}
        dimmed={hoveredSectionIdx !== null && hoveredSectionIdx !== idx}
        highlightedUuids={locateCards}
        onCardFlip={handleCardFlip}
        onStackedCardHover={(hovering: boolean) => {
          hoveredSectionIdx = hovering ? idx : null;
        }}
        onHeaderClick={() => {
          handleSectionHeaderClick(section.intervalType);
        }}
      />
    {/each}
  </div>
</div>

<style>
  .kamishibai-board__toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.75rem;
  }

  .kamishibai-board__sections {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .kamishibai-board__sections--collapsed {
    gap: 0;
  }

  /* ---- Zoom Controls ---- */
  .toggle-group__btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
  }

  .zoom-level {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    min-width: 3rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  /* ---- Fullscreen ---- */
  :global(body.tpm-board-fullscreen .kamishibai-board) {
    position: fixed !important;
    z-index: 9999 !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 1.5rem !important;
    width: 100% !important;
    min-height: 100vh !important;
    overflow: auto;
    background: var(--main-bg) !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  :global(body.tpm-board-fullscreen .sidebar),
  :global(body.tpm-board-fullscreen .header),
  :global(body.tpm-board-fullscreen #breadcrumb-container),
  :global(body.tpm-board-fullscreen .card__header) {
    display: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .kamishibai-board__sections {
      transition: none;
    }
  }
</style>
