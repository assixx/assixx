<script lang="ts">
  import {
    DEFAULT_HIERARCHY_LABELS,
    type HierarchyLabels,
  } from '$lib/types/hierarchy-labels';

  import {
    getEventLevelText,
    formatDateTime,
    getResponseText,
    getResponseIconClass,
  } from './utils';

  import type { CalendarEvent, Area, Department, Team } from './types';

  interface Props {
    event: CalendarEvent;
    canEdit: boolean;
    canDelete: boolean;
    isPast: boolean;
    labels?: HierarchyLabels;
    areas?: Area[];
    departments?: Department[];
    teams?: Team[];
    onclose: () => void;
    onedit: (event: CalendarEvent) => void;
    ondelete: (eventId: number) => void;
  }

  const {
    event,
    canEdit,
    canDelete,
    isPast,
    labels = DEFAULT_HIERARCHY_LABELS,
    areas = [],
    departments = [],
    teams = [],
    onclose,
    onedit,
    ondelete,
  }: Props = $props();

  const levelText = $derived(getEventLevelText(event, labels));

  // Lookup names for assignments
  const areaName = $derived(areas.find((a) => a.id === event.areaId)?.name);
  const departmentName = $derived(
    departments.find((d) => d.id === event.departmentId)?.name,
  );
  const teamName = $derived(teams.find((t) => t.id === event.teamId)?.name);
</script>

<div
  id="calendar-event-detail-modal"
  class="modal-overlay modal-overlay--active"
  role="presentation"
  onclick={onclose}
>
  <div
    class="ds-modal"
    role="presentation"
    onclick={(e) => {
      e.stopPropagation();
    }}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">
        <i class="fas fa-calendar-alt"></i>
        Termin Details
      </h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={onclose}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <div
        id="eventDetailContent"
        class="fade-in"
      >
        <h3>
          <i
            class="fas"
            class:fa-calendar-day={event.allDay}
            class:fa-clock={!event.allDay}
          ></i>
          {event.title || 'Unbenannter Termin'}
        </h3>

        {#if event.description}
          <p>{event.description}</p>
        {/if}

        <div class="event-details-grid">
          <div class="detail-item">
            <i class="fas fa-calendar"></i>
            <span
              ><strong>Beginn:</strong>
              {formatDateTime(event.startTime, event.allDay)}</span
            >
          </div>
          <div class="detail-item">
            <i class="fas fa-calendar-check"></i>
            <span
              ><strong>Ende:</strong>
              {formatDateTime(event.endTime, event.allDay)}</span
            >
          </div>
          {#if event.location}
            <div class="detail-item">
              <i class="fas fa-map-marker-alt"></i>
              <span><strong>Ort:</strong> {event.location}</span>
            </div>
          {/if}
          <div class="detail-item">
            <i class="fas fa-layer-group"></i>
            <span><strong>Ebene:</strong> {levelText}</span>
          </div>

          <!-- Assignment details -->
          {#if areaName}
            <div class="detail-item">
              <i class="fas fa-map-marked-alt"></i>
              <span><strong>{labels.area}:</strong> {areaName}</span>
            </div>
          {/if}
          {#if departmentName}
            <div class="detail-item">
              <i class="fas fa-sitemap"></i>
              <span><strong>{labels.department}:</strong> {departmentName}</span
              >
            </div>
          {/if}
          {#if teamName}
            <div class="detail-item">
              <i class="fas fa-users"></i>
              <span><strong>{labels.team}:</strong> {teamName}</span>
            </div>
          {/if}

          <div class="detail-item">
            <i class="fas fa-user"></i>
            <span
              ><strong>Erstellt von:</strong>
              {event.creatorName ?? 'Unbekannt'}</span
            >
          </div>
        </div>

        {#if event.attendees && event.attendees.length > 0}
          <h4>Teilnehmer ({event.attendees.length})</h4>
          <div class="attendee-list">
            {#each event.attendees as attendee (attendee.userId)}
              {@const fullName =
                `${attendee.firstName ?? ''} ${attendee.lastName ?? ''}`.trim()}
              {@const name =
                fullName !== '' ? fullName : (attendee.username ?? 'Unbekannt')}
              <div class="attendee-item">
                <span>{name}</span>
                <span
                  class="attendee-status"
                  title={getResponseText(attendee.responseStatus)}
                >
                  <i class="fas {getResponseIconClass(attendee.responseStatus)}"
                  ></i>
                </span>
              </div>
            {/each}
          </div>
        {/if}

        {#if isPast}
          <div class="past-event-notice">
            <i class="fas fa-lock"></i>
            <span
              >Vergangene Termine können nicht bearbeitet oder gelöscht werden.</span
            >
          </div>
        {/if}

        <div class="modal-actions">
          {#if canEdit}
            <button
              type="button"
              class="btn btn-edit"
              onclick={() => {
                onedit(event);
              }}
            >
              <i class="fas fa-edit"></i> Bearbeiten
            </button>
          {/if}
          {#if canDelete}
            <button
              type="button"
              class="btn btn-danger"
              onclick={() => {
                ondelete(event.id);
              }}
            >
              <i class="fas fa-trash"></i> Löschen
            </button>
          {/if}
          <button
            type="button"
            class="btn btn-cancel"
            onclick={onclose}
          >
            <i class="fas fa-times"></i> Schließen
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* ─── Detail Content Typography ──────── */

  #eventDetailContent h3 {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid
      color-mix(in oklch, var(--color-white) 10%, transparent);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--primary-color);
  }

  #eventDetailContent p {
    margin-bottom: 20px;
    padding: 15px;
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-glass-border);
    font-size: 1rem;
    line-height: 1.6;
    color: var(--text-secondary);
    background: var(--glass-bg);
  }

  #eventDetailContent h4 {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 30px;
    margin-bottom: 15px;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  #eventDetailContent h4::before {
    content: '';
    width: 4px;
    height: 20px;
    border-radius: 2px;
    background: var(--primary-color);
  }

  /* ─── Details Grid ──────── */

  .event-details-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
    margin: 20px 0;
    padding: 24px;
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
  }

  .detail-item {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .detail-item:hover {
    margin: 0 -10px;
    padding-right: 10px;
    padding-left: 10px;
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
  }

  .detail-item i {
    flex-shrink: 0;
    width: 20px;
    font-size: 1rem;
    color: var(--primary-color);
    text-align: center;
  }

  .detail-item span {
    flex: 1;
    font-size: 0.95rem;
    color: var(--text-primary);
  }

  /* ─── Attendee List ──────── */

  .attendee-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }

  .attendee-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 15px;
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-white) 3%, transparent);
  }

  .attendee-item:hover {
    border-color: color-mix(in oklch, var(--color-white) 12%, transparent);
    background: color-mix(in oklch, var(--color-white) 5%, transparent);
  }

  /* ─── Past Event Notice ──────── */

  .past-event-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    margin-top: 20px;
    border-radius: var(--radius-lg);
    background: oklch(84.42% 0.1721 84.94 / 10%);
    border: 1px solid oklch(84.42% 0.1721 84.94 / 25%);
    color: var(--color-amber-400, #fbbf24);
    font-size: 0.875rem;
  }

  /* ─── Modal Actions ──────── */

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid
      color-mix(in oklch, var(--color-white) 10%, transparent);
  }

  .modal-actions :global(.btn) {
    justify-content: center;
    min-width: 120px;
  }

  .modal-actions :global(.btn-primary),
  .modal-actions :global(.btn-danger) {
    flex: 0 1 auto;
  }
</style>
