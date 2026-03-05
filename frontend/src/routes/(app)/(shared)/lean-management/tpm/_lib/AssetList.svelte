<script lang="ts">
  /**
   * AssetList — Employee's assigned assets as data table.
   * Shows interval × status matrix with Board + Standorte actions.
   */
  import { resolve } from '$app/paths';

  import {
    MESSAGES,
    INTERVAL_LABELS,
    CARD_STATUS_LABELS,
    CARD_STATUS_BADGE_CLASSES,
  } from './constants';

  import type {
    AssetWithTpmStatus,
    TpmCard,
    CardStatus,
    IntervalType,
  } from './types';

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  interface Props {
    assets: AssetWithTpmStatus[];
  }

  const { assets }: Props = $props();

  /** Sort: assets with open tasks first, then by name */
  const sortedAssets = $derived(
    [...assets].sort((a: AssetWithTpmStatus, b: AssetWithTpmStatus) => {
      const aOpen = a.statusCounts.red + a.statusCounts.overdue;
      const bOpen = b.statusCounts.red + b.statusCounts.overdue;
      if (aOpen !== bOpen) return bOpen - aOpen;
      const aName = a.plan.assetName ?? a.plan.name;
      const bName = b.plan.assetName ?? b.plan.name;
      return aName.localeCompare(bName, 'de');
    }),
  );

  const intervalColumns: IntervalType[] = [
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'semi_annual',
    'annual',
  ];

  const shortLabels: Record<string, string> = {
    daily: 'T',
    weekly: 'W',
    monthly: 'M',
    quarterly: 'Q',
    semi_annual: 'H',
    annual: 'J',
  };

  /** Status counts for one interval slot, computed from loaded cards */
  interface IntervalStatusEntry {
    cardCount: number;
    greenCount: number;
    redCount: number;
    yellowCount: number;
    overdueCount: number;
  }

  /** Compute status breakdown for a specific interval from card data */
  function getIntervalEntry(
    cards: TpmCard[],
    interval: IntervalType,
  ): IntervalStatusEntry | null {
    const matching = cards.filter((c: TpmCard) => c.intervalType === interval);
    if (matching.length === 0) return null;

    let green = 0;
    let red = 0;
    let yellow = 0;
    let overdue = 0;
    for (const card of matching) {
      if (card.status === 'green') green++;
      else if (card.status === 'red') red++;
      else if (card.status === 'yellow') yellow++;
      else overdue++;
    }
    return {
      cardCount: matching.length,
      greenCount: green,
      redCount: red,
      yellowCount: yellow,
      overdueCount: overdue,
    };
  }

  function getWorstStatus(entry: IntervalStatusEntry): CardStatus {
    if (entry.overdueCount > 0) return 'overdue';
    if (entry.redCount > 0) return 'red';
    if (entry.yellowCount > 0) return 'yellow';
    return 'green';
  }

  function getStatusTooltip(
    entry: IntervalStatusEntry,
    intervalLabel: string,
  ): string {
    const parts: string[] = [];
    if (entry.greenCount > 0)
      parts.push(`${String(entry.greenCount)} ${CARD_STATUS_LABELS.green}`);
    if (entry.redCount > 0)
      parts.push(`${String(entry.redCount)} ${CARD_STATUS_LABELS.red}`);
    if (entry.yellowCount > 0)
      parts.push(`${String(entry.yellowCount)} ${CARD_STATUS_LABELS.yellow}`);
    if (entry.overdueCount > 0)
      parts.push(`${String(entry.overdueCount)} ${CARD_STATUS_LABELS.overdue}`);
    return `${intervalLabel}: ${parts.join(', ')}`;
  }
</script>

{#if sortedAssets.length === 0}
  <div class="empty-state">
    <div class="empty-state__icon">
      <i class="fas fa-tools"></i>
    </div>
    <h3 class="empty-state__title">{MESSAGES.EMPTY_TITLE}</h3>
    <p class="empty-state__description">{MESSAGES.EMPTY_DESCRIPTION}</p>
  </div>
{:else}
  <div class="table-responsive">
    <table class="data-table data-table--hover data-table--striped">
      <thead>
        <tr>
          <th scope="col">{MESSAGES.MACHINE_COL_NAME}</th>
          <th scope="col">{MESSAGES.MACHINE_COL_PLAN}</th>
          {#each intervalColumns as col (col)}
            <th
              scope="col"
              class="text-center"
              style="width: 48px"
              title={INTERVAL_LABELS[col]}
            >
              {shortLabels[col] ?? col}
            </th>
          {/each}
          <th scope="col">{MESSAGES.MACHINE_COL_ACTIONS}</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedAssets as asset (asset.plan.uuid)}
          <tr>
            <td>
              <div class="flex items-center gap-2 font-medium">
                <i class="fas fa-cog text-(--color-text-muted)"></i>
                {asset.plan.assetName ?? '—'}
              </div>
            </td>
            <td>{asset.plan.name}</td>
            {#each intervalColumns as col (col)}
              {@const entry = getIntervalEntry(asset.cards, col)}
              <td class="text-center align-middle">
                {#if entry !== null}
                  {@const worstStatus = getWorstStatus(entry)}
                  <span
                    class="badge {CARD_STATUS_BADGE_CLASSES[
                      worstStatus
                    ]} badge--sm"
                    title={getStatusTooltip(entry, INTERVAL_LABELS[col])}
                  >
                    {entry.cardCount}
                  </span>
                {:else}
                  <span
                    class="text-(--color-text-muted)"
                    title="{INTERVAL_LABELS[col]}: keine Karten">—</span
                  >
                {/if}
              </td>
            {/each}
            <td>
              <div class="flex gap-2">
                <a
                  href={resolvePath(
                    `/lean-management/tpm/board/${asset.plan.uuid}`,
                  )}
                  class="action-icon action-icon--primary"
                  title={MESSAGES.BTN_VIEW_BOARD}
                  aria-label={MESSAGES.BTN_VIEW_BOARD}
                >
                  <i class="fas fa-th-large"></i>
                </a>
                <a
                  href={resolvePath(
                    `/lean-management/tpm/locations/${asset.plan.uuid}`,
                  )}
                  class="action-icon action-icon--warning"
                  title="Standorte"
                  aria-label="Standorte"
                >
                  <i class="fas fa-map-marker-alt"></i>
                </a>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Legend -->
  <div class="matrix-legend">
    <span class="matrix-legend__item">
      <span class="badge badge--success badge--sm">3</span>
      {CARD_STATUS_LABELS.green}
    </span>
    <span class="matrix-legend__item">
      <span class="badge badge--danger badge--sm">2</span>
      {CARD_STATUS_LABELS.red}
    </span>
    <span class="matrix-legend__item">
      <span class="badge badge--warning badge--sm">1</span>
      {CARD_STATUS_LABELS.yellow}
    </span>
    <span class="matrix-legend__item">
      <span class="badge badge--error badge--sm">1</span>
      {CARD_STATUS_LABELS.overdue}
    </span>
    <span class="matrix-legend__item">
      <span class="text-(--color-text-muted)">—</span>
      Keine Karten
    </span>
  </div>
{/if}

<style>
  .matrix-legend {
    display: flex;
    gap: 1.25rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-glass-border);
    margin-top: 0.75rem;
  }

  .matrix-legend__item {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>
