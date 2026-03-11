<script lang="ts">
  import {
    DEFAULT_HIERARCHY_LABELS,
    type HierarchyLabels,
  } from '$lib/types/hierarchy-labels';

  import { getUpcomingEventTimeStr, getEventLevelInfo } from './utils';

  import type { CalendarEvent } from './types';

  interface Props {
    title: string;
    icon: string;
    subtitle?: string;
    emptyStateMessage: string;
    events: CalendarEvent[];
    labels?: HierarchyLabels;
    onEventClick: (eventId: number) => void;
  }

  const {
    title,
    icon,
    subtitle,
    emptyStateMessage,
    events,
    labels = DEFAULT_HIERARCHY_LABELS,
    onEventClick,
  }: Props = $props();
</script>

<div class="card">
  <div class="card__header">
    <h3 class="card__title">
      <i class="fas {icon} mr-2"></i>
      {title}
      {#if subtitle}
        <span class="ml-2 text-sm font-normal text-(--color-text-secondary)">
          {subtitle}
        </span>
      {/if}
    </h3>
  </div>
  <div class="card__body">
    <div class="upcoming-events">
      {#if events.length === 0}
        <p class="text-center text-(--color-text-secondary)">
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
                  <span class="event-level event-level-area">{labels.area}</span
                  >
                {/if}
                {#if hasDept}
                  <span class="event-level event-level-department"
                    >{labels.department}</span
                  >
                {/if}
                {#if hasTeam}
                  <span class="event-level event-level-team">{labels.team}</span
                  >
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

<style>
  .upcoming-events {
    overflow-y: auto;
    max-height: 300px;
  }

  .event-item {
    display: flex;
    padding: 10px;
    border-bottom: 1px solid var(--border-color);
  }

  .event-item:last-child {
    border-bottom: none;
  }

  .event-item:hover {
    background-color: color-mix(in oklch, var(--color-primary) 5%, transparent);
  }

  .event-date {
    display: flex;
    flex: 0 0 90px;
    flex-direction: column;
    justify-content: center;
    margin-right: 15px;
    padding: 10px;
    border-radius: var(--radius-xl);
    text-align: center;
    background-color: var(--background-dark);
  }

  .event-day {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
    color: var(--primary-color);
  }

  .event-month {
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .event-time {
    margin-top: 5px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .event-details {
    flex: 1;
  }

  .event-title {
    margin-bottom: 5px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .event-location {
    display: flex;
    align-items: center;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .event-location i {
    margin-right: 5px;
  }

  .event-level {
    display: inline-block;
    width: fit-content;
    margin-top: 5px;
    padding: 2px 8px;
    border-radius: var(--radius-xl);
    font-size: 0.7rem;
    color: var(--color-white);
  }

  .event-level-company {
    background-color: var(--color-sky);
  }

  .event-level-department {
    background-color: var(--color-carrot);
  }

  .event-level-team {
    background-color: var(--color-emerald);
  }

  .event-level-area {
    background-color: var(--color-danger-hover);
  }

  .event-level-personal {
    background-color: var(--color-purple);
  }

  .event-badges {
    display: grid;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 5px;
  }

  .event-badges .event-level {
    margin-top: 0;
  }

  @media (width < 768px) {
    .event-date {
      flex: 0 0 70px;
    }
  }
</style>
