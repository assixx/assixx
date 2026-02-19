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

<div class="card">
  <div class="card__header">
    <h2 class="card__title">
      <i class="fas fa-clock mr-2"></i>
      {MESSAGES.NEXT_MAINTENANCE_TITLE}
    </h2>
  </div>
  <div class="card__body">
    {#if upcomingList.length === 0}
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <h3 class="empty-state__title">{MESSAGES.NEXT_MAINTENANCE_EMPTY}</h3>
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        {#each upcomingList as item (item.planUuid)}
          <div
            class="maint-card"
            style="border-left: 4px solid {getColor('green')}"
          >
            <span
              class="inline-flex items-center gap-1 text-sm font-semibold text-(--color-text-primary)"
            >
              <i class="fas fa-cog"></i>
              {item.machineName}
            </span>
            <p class="mt-1 text-xs text-(--color-text-secondary)">
              {item.planName}
            </p>
            <div
              class="mt-1 flex flex-wrap gap-3 text-xs text-(--color-text-muted)"
            >
              <span class="inline-flex items-center gap-1">
                <i class="fas fa-calendar-day"></i>
                {item.weekday}
              </span>
              <span class="inline-flex items-center gap-1">
                <i class="fas fa-redo"></i>
                {formatInterval(item.repeatEvery)}
              </span>
              {#if item.time !== null}
                <span class="inline-flex items-center gap-1">
                  <i class="fas fa-clock"></i>
                  {formatTime(item.time)}
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .maint-card {
    background: var(--glass-bg-hover);
    border-radius: var(--radius-md);
    padding: 0.75rem 1rem;
    transition: box-shadow 0.15s ease;
  }

  .maint-card:hover {
    box-shadow: var(--shadow-sm);
  }
</style>
