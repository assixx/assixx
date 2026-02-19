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

  /** Get urgency indicator class */
  function getUrgencyClass(machine: MachineWithTpmStatus): string {
    if (machine.statusCounts.overdue > 0) return 'machine-row--overdue';
    if (machine.statusCounts.red > 0) return 'machine-row--open';
    if (machine.statusCounts.yellow > 0) return 'machine-row--pending';
    return 'machine-row--ok';
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
  <div class="machine-list__empty">
    <i class="fas fa-tools machine-list__empty-icon"></i>
    <h3>{MESSAGES.EMPTY_TITLE}</h3>
    <p>{MESSAGES.EMPTY_DESCRIPTION}</p>
  </div>
{:else}
  <div class="machine-list">
    {#each sortedMachines as machine (machine.plan.uuid)}
      <div class="machine-row {getUrgencyClass(machine)}">
        <!-- Urgency indicator bar -->
        <div
          class="machine-row__indicator"
          style="background-color: {machine.statusCounts.overdue > 0 ?
            getColor('overdue')
          : machine.statusCounts.red > 0 ? getColor('red')
          : machine.statusCounts.yellow > 0 ? getColor('yellow')
          : getColor('green')}"
        ></div>

        <div class="machine-row__content">
          <!-- Machine info -->
          <div class="machine-row__info">
            <div class="machine-row__name">
              <i class="fas fa-cog machine-row__icon"></i>
              <span class="machine-row__machine-name">
                {machine.plan.machineName ?? '—'}
              </span>
            </div>
            <div class="machine-row__plan-name">{machine.plan.name}</div>
            <div class="machine-row__schedule">
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
            <div class="machine-row__meta">
              <span class="machine-row__interval">
                {getDominantInterval(machine)}
              </span>
              {#if getNextDueInfo(machine) !== null}
                <span class="machine-row__due">
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
              class="btn btn--primary btn--sm"
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

  .machine-list__empty {
    text-align: center;
    padding: 3rem 1.5rem;
  }

  .machine-list__empty-icon {
    font-size: 2.5rem;
    color: var(--color-gray-300);
    margin-bottom: 1rem;
  }

  .machine-list__empty h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-gray-700);
    margin-bottom: 0.5rem;
  }

  .machine-list__empty p {
    color: var(--color-gray-500);
    font-size: 0.875rem;
  }

  /* Machine row */
  .machine-row {
    display: flex;
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
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

  /* Machine info */
  .machine-row__info {
    flex: 1;
    min-width: 0;
  }

  .machine-row__name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .machine-row__icon {
    color: var(--color-gray-400);
    font-size: 0.875rem;
  }

  .machine-row__machine-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-gray-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .machine-row__plan-name {
    font-size: 0.813rem;
    color: var(--color-gray-500);
    margin-top: 0.125rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .machine-row__schedule {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-gray-400);
    margin-top: 0.375rem;
  }

  /* Status */
  .machine-row__status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .machine-row__meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--color-gray-500);
  }

  .machine-row__due {
    font-weight: 500;
  }

  /* Actions */
  .machine-row__actions {
    flex-shrink: 0;
  }

  /* Responsive */
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

    .machine-row__actions .btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
