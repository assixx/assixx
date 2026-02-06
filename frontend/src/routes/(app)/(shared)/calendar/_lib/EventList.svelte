<script lang="ts">
  import { getUpcomingEventTimeStr, getEventLevelInfo } from './utils';

  import type { CalendarEvent } from './types';

  interface Props {
    title: string;
    icon: string;
    subtitle?: string;
    emptyStateMessage: string;
    events: CalendarEvent[];
    onEventClick: (eventId: number) => void;
  }

  const {
    title,
    icon,
    subtitle,
    emptyStateMessage,
    events,
    onEventClick,
  }: Props = $props();
</script>

<div class="card">
  <div class="card__header">
    <h3 class="card__title">
      <i class="fas {icon} mr-2"></i>
      {title}
      {#if subtitle}
        <span
          class="ml-2 text-sm font-normal text-[var(--color-text-secondary)]"
        >
          {subtitle}
        </span>
      {/if}
    </h3>
  </div>
  <div class="card__body">
    <div class="upcoming-events">
      {#if events.length === 0}
        <p class="text-center text-[var(--color-text-secondary)]">
          {emptyStateMessage}
        </p>
      {:else}
        {#each events as event (event.id)}
          {@const levelInfo = getEventLevelInfo(event.orgLevel)}
          {@const hasArea = event.areaId !== null && event.areaId !== undefined}
          {@const hasDept =
            event.departmentId !== null && event.departmentId !== undefined}
          {@const hasTeam = event.teamId !== null && event.teamId !== undefined}
          <button
            type="button"
            class="event-item w-full text-left"
            onclick={() => {
              onEventClick(event.id);
            }}
          >
            <div class="event-date">
              <span class="event-day"
                >{new Date(event.startTime).getDate()}</span
              >
              <span class="event-month">
                {new Date(event.startTime).toLocaleDateString('de-DE', {
                  month: 'short',
                })}
              </span>
              <span class="event-time">{getUpcomingEventTimeStr(event)}</span>
            </div>
            <div class="event-details">
              <div class="event-title">{event.title}</div>
              {#if event.location}
                <div class="event-location">
                  <i class="fas fa-map-marker-alt"></i>
                  {event.location}
                </div>
              {/if}
              <div class="event-badges">
                {#if hasArea}
                  <span class="event-level event-level-area">Bereich</span>
                {/if}
                {#if hasDept}
                  <span class="event-level event-level-department"
                    >Abteilung</span
                  >
                {/if}
                {#if hasTeam}
                  <span class="event-level event-level-team">Team</span>
                {/if}
                {#if !hasArea && !hasDept && !hasTeam}
                  <span class="event-level {levelInfo.class}"
                    >{levelInfo.text}</span
                  >
                {/if}
              </div>
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>
