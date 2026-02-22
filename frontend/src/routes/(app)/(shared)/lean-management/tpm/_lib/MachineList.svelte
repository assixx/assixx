<script lang="ts">
  /**
   * MachineList — Employee's assigned machines with TPM status summary.
   * Each machine row shows plan name, card status counts, and a link to the board.
   */
  import { SvelteMap } from 'svelte/reactivity';

  import { resolve } from '$app/paths';

  import {
    MESSAGES,
    WEEKDAY_LABELS,
    INTERVAL_LABELS,
    DEFAULT_COLORS,
  } from './constants';
  import MaintenanceStatus from './MaintenanceStatus.svelte';

  import type {
    MachineWithTpmStatus,
    TpmColorConfigEntry,
    CardStatus,
  } from './types';

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  interface Props {
    machines: MachineWithTpmStatus[];
    colors: TpmColorConfigEntry[];
  }

  const { machines, colors }: Props = $props();

  /** Sort: machines with open tasks first, then by name */
  const sortedMachines = $derived(
    [...machines].sort((a: MachineWithTpmStatus, b: MachineWithTpmStatus) => {
      const aOpen = a.statusCounts.red + a.statusCounts.overdue;
      const bOpen = b.statusCounts.red + b.statusCounts.overdue;
      if (aOpen !== bOpen) return bOpen - aOpen;
      const aName = a.plan.machineName ?? a.plan.name;
      const bName = b.plan.machineName ?? b.plan.name;
      return aName.localeCompare(bName, 'de');
    }),
  );

  /** Resolve color for a status */
  function getColor(status: CardStatus): string {
    const custom = colors.find(
      (c: TpmColorConfigEntry) => c.statusKey === status,
    );
    return custom !== undefined ? custom.colorHex : DEFAULT_COLORS[status];
  }

  /** Get urgency indicator color */
  function getIndicatorColor(machine: MachineWithTpmStatus): string {
    if (machine.statusCounts.overdue > 0) return getColor('overdue');
    if (machine.statusCounts.red > 0) return getColor('red');
    if (machine.statusCounts.yellow > 0) return getColor('yellow');
    return getColor('green');
  }

  /** Get next due card info */
  function getNextDueInfo(machine: MachineWithTpmStatus): string | null {
    const dueCards = machine.cards
      .filter(
        (c) =>
          c.currentDueDate !== null &&
          (c.status === 'red' || c.status === 'overdue'),
      )
      .sort((a, b) => {
        const dateA = a.currentDueDate ?? '';
        const dateB = b.currentDueDate ?? '';
        return dateA.localeCompare(dateB);
      });

    if (dueCards.length === 0) return null;

    const nextDueDate = dueCards[0]?.currentDueDate ?? null;
    if (nextDueDate === null) return null;

    return new Date(nextDueDate).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Format weekday + time for plan schedule */
  function formatSchedule(machine: MachineWithTpmStatus): string {
    const weekday = WEEKDAY_LABELS[machine.plan.baseWeekday] ?? '—';
    const time =
      machine.plan.baseTime !== null ? `, ${machine.plan.baseTime}` : '';
    const repeat =
      machine.plan.baseRepeatEvery > 1 ?
        ` (alle ${String(machine.plan.baseRepeatEvery)} Wo.)`
      : '';
    return `${weekday}${time}${repeat}`;
  }

  /** Get most common interval from cards */
  function getDominantInterval(machine: MachineWithTpmStatus): string {
    if (machine.cards.length === 0) return '—';

    const counts = new SvelteMap<string, number>();
    for (const card of machine.cards) {
      counts.set(card.intervalType, (counts.get(card.intervalType) ?? 0) + 1);
    }

    let maxType = '';
    let maxCount = 0;
    for (const [type, count] of counts) {
      if (count > maxCount) {
        maxType = type;
        maxCount = count;
      }
    }

    const label = INTERVAL_LABELS[maxType as keyof typeof INTERVAL_LABELS];
    return counts.size > 1 ?
        `${label} + ${String(counts.size - 1)} weitere`
      : label;
  }
</script>

{#if sortedMachines.length === 0}
  <div class="empty-state">
    <div class="empty-state__icon">
      <i class="fas fa-tools"></i>
    </div>
    <h3 class="empty-state__title">{MESSAGES.EMPTY_TITLE}</h3>
    <p class="empty-state__description">{MESSAGES.EMPTY_DESCRIPTION}</p>
  </div>
{:else}
  <div class="machine-list">
    {#each sortedMachines as machine (machine.plan.uuid)}
      <div class="machine-row">
        <!-- Urgency indicator bar -->
        <div
          class="machine-row__indicator"
          style="background-color: {getIndicatorColor(machine)}"
        ></div>

        <div class="machine-row__content">
          <!-- Machine info -->
          <div class="machine-row__info">
            <div class="flex items-center gap-2">
              <i class="fas fa-cog text-sm text-(--color-text-muted)"></i>
              <span
                class="truncate text-base font-semibold text-(--color-text-primary)"
              >
                {machine.plan.machineName ?? '—'}
              </span>
            </div>
            <div class="mt-0.5 truncate text-sm text-(--color-text-muted)">
              {machine.plan.name}
            </div>
            <div
              class="mt-1 flex items-center gap-1.5 text-xs text-(--color-text-muted)"
            >
              <i class="fas fa-calendar-alt"></i>
              {formatSchedule(machine)}
            </div>
          </div>

          <!-- Status badges -->
          <div class="machine-row__status">
            <MaintenanceStatus
              statusCounts={machine.statusCounts}
              {colors}
              compact
            />
            <div class="flex gap-3 text-xs text-(--color-text-muted)">
              <span>
                {getDominantInterval(machine)}
              </span>
              {#if getNextDueInfo(machine) !== null}
                <span class="font-medium">
                  Nächste: {getNextDueInfo(machine)}
                </span>
              {/if}
            </div>
          </div>

          <!-- Action -->
          <div class="machine-row__actions">
            <a
              href={resolvePath(
                `/lean-management/tpm/board/${machine.plan.uuid}`,
              )}
              class="btn btn-primary"
            >
              <i class="fas fa-columns"></i>
              {MESSAGES.BTN_VIEW_BOARD}
            </a>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .machine-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .machine-row {
    display: flex;
    background: var(--glass-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: box-shadow 0.15s ease;
  }

  .machine-row:hover {
    box-shadow: var(--shadow-md);
  }

  .machine-row__indicator {
    width: 4px;
    flex-shrink: 0;
  }

  .machine-row__content {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1rem 1.25rem;
    flex: 1;
    min-width: 0;
  }

  .machine-row__info {
    flex: 1;
    min-width: 0;
  }

  .machine-row__status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .machine-row__actions {
    flex-shrink: 0;
  }

  @media (width <= 768px) {
    .machine-row__content {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .machine-row__status {
      align-items: flex-start;
    }

    .machine-row__actions {
      width: 100%;
    }

    .machine-row__actions :global(.btn) {
      width: 100%;
      justify-content: center;
    }
  }
</style>
