<script lang="ts">
  import { INTERVAL_LABELS, WEEKDAY_LABELS, MESSAGES } from './constants';

  import type { TpmPlan, TpmColorConfigEntry, CardStatus } from './types';

  interface Props {
    plans: TpmPlan[];
    colors: TpmColorConfigEntry[];
  }

  const { plans, colors }: Props = $props();

  interface UpcomingMaintenance {
    planUuid: string;
    planName: string;
    machineName: string;
    weekday: string;
    repeatEvery: number;
    time: string | null;
  }

  /** Extract up to 3 next upcoming maintenance dates from active plans */
  const upcomingList = $derived(buildUpcomingList(plans));

  function buildUpcomingList(allPlans: TpmPlan[]): UpcomingMaintenance[] {
    return allPlans
      .filter((p: TpmPlan) => p.isActive === 1)
      .slice(0, 3)
      .map((p: TpmPlan) => ({
        planUuid: p.uuid,
        planName: p.name,
        machineName: p.machineName ?? '—',
        weekday: WEEKDAY_LABELS[p.baseWeekday] ?? '—',
        repeatEvery: p.baseRepeatEvery,
        time: p.baseTime,
      }));
  }

  /** Get color hex from config, with fallback */
  function getColor(statusKey: CardStatus): string {
    const entry = colors.find(
      (c: TpmColorConfigEntry) => c.statusKey === statusKey,
    );
    return entry?.colorHex ?? '#6b7280';
  }

  function formatTime(time: string | null): string {
    if (time === null) return '—';
    return time;
  }

  function formatInterval(repeatEvery: number): string {
    if (repeatEvery === 1) return INTERVAL_LABELS.weekly;
    return `alle ${repeatEvery} Wochen`;
  }
</script>

<div class="next-maintenance">
  <h3 class="next-maintenance__title">
    <i class="fas fa-clock"></i>
    {MESSAGES.NEXT_MAINTENANCE_TITLE}
  </h3>

  {#if upcomingList.length === 0}
    <div class="next-maintenance__empty">
      <i class="fas fa-check-circle"></i>
      <p>{MESSAGES.NEXT_MAINTENANCE_EMPTY}</p>
    </div>
  {:else}
    <div class="next-maintenance__list">
      {#each upcomingList as item (item.planUuid)}
        <div
          class="next-maintenance__card"
          style="border-left: 4px solid {getColor('green')}"
        >
          <div class="next-maintenance__card-header">
            <span class="next-maintenance__machine">
              <i class="fas fa-cog"></i>
              {item.machineName}
            </span>
          </div>
          <div class="next-maintenance__card-body">
            <p class="next-maintenance__plan-name">{item.planName}</p>
            <div class="next-maintenance__details">
              <span>
                <i class="fas fa-calendar-day"></i>
                {item.weekday}
              </span>
              <span>
                <i class="fas fa-redo"></i>
                {formatInterval(item.repeatEvery)}
              </span>
              {#if item.time !== null}
                <span>
                  <i class="fas fa-clock"></i>
                  {formatTime(item.time)}
                </span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .next-maintenance {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
  }

  .next-maintenance__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-gray-800);
    margin-bottom: 1rem;
  }

  .next-maintenance__empty {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--color-gray-500);
  }

  .next-maintenance__empty i {
    font-size: 1.5rem;
    color: var(--color-green-500, #10b981);
    margin-bottom: 0.5rem;
  }

  .next-maintenance__list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .next-maintenance__card {
    background: var(--color-gray-50, #f9fafb);
    border-radius: var(--radius-md, 8px);
    padding: 0.75rem 1rem;
    transition: box-shadow 0.15s ease;
  }

  .next-maintenance__card:hover {
    box-shadow: var(--shadow-sm);
  }

  .next-maintenance__card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .next-maintenance__machine {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-gray-700);
  }

  .next-maintenance__plan-name {
    font-size: 0.8125rem;
    color: var(--color-gray-600);
    margin-bottom: 0.375rem;
  }

  .next-maintenance__details {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--color-gray-500);
  }

  .next-maintenance__details span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>
