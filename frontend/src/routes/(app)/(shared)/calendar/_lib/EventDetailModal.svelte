<script lang="ts">
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
    areas?: Area[];
    departments?: Department[];
    teams?: Team[];
    onclose: () => void;
    onedit: (event: CalendarEvent) => void;
    ondelete: (eventId: number) => void;
  }

  /* eslint-disable prefer-const */
  let {
    event,
    canEdit,
    canDelete,
    areas = [],
    departments = [],
    teams = [],
    onclose,
    onedit,
    ondelete,
  }: Props = $props();
  /* eslint-enable prefer-const */

  const levelText = $derived(getEventLevelText(event));

  // Lookup names for assignments
  const areaName = $derived(areas.find((a) => a.id === event.areaId)?.name);
  const departmentName = $derived(departments.find((d) => d.id === event.departmentId)?.name);
  const teamName = $derived(teams.find((t) => t.id === event.teamId)?.name);
</script>

<div class="modal-overlay modal-overlay--active" role="presentation" onclick={onclose}>
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
      <button type="button" class="ds-modal__close" aria-label="Schliessen" onclick={onclose}>
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <div id="eventDetailContent" class="fade-in">
        <h3>
          <i class="fas" class:fa-calendar-day={event.allDay} class:fa-clock={!event.allDay}></i>
          {event.title || 'Unbenannter Termin'}
        </h3>

        {#if event.description}
          <p>{event.description}</p>
        {/if}

        <div class="event-details-grid">
          <div class="detail-item">
            <i class="fas fa-calendar"></i>
            <span><strong>Beginn:</strong> {formatDateTime(event.startTime, event.allDay)}</span>
          </div>
          <div class="detail-item">
            <i class="fas fa-calendar-check"></i>
            <span><strong>Ende:</strong> {formatDateTime(event.endTime, event.allDay)}</span>
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
              <span><strong>Bereich:</strong> {areaName}</span>
            </div>
          {/if}
          {#if departmentName}
            <div class="detail-item">
              <i class="fas fa-sitemap"></i>
              <span><strong>Abteilung:</strong> {departmentName}</span>
            </div>
          {/if}
          {#if teamName}
            <div class="detail-item">
              <i class="fas fa-users"></i>
              <span><strong>Team:</strong> {teamName}</span>
            </div>
          {/if}

          <div class="detail-item">
            <i class="fas fa-user"></i>
            <span><strong>Erstellt von:</strong> {event.creatorName ?? 'Unbekannt'}</span>
          </div>
        </div>

        {#if event.attendees && event.attendees.length > 0}
          <h4>Teilnehmer ({event.attendees.length})</h4>
          <div class="attendee-list">
            {#each event.attendees as attendee (attendee.userId)}
              {@const fullName = `${attendee.firstName ?? ''} ${attendee.lastName ?? ''}`.trim()}
              {@const name = fullName !== '' ? fullName : (attendee.username ?? 'Unbekannt')}
              <div class="attendee-item">
                <span>{name}</span>
                <span class="attendee-status" title={getResponseText(attendee.responseStatus)}>
                  <i class="fas {getResponseIconClass(attendee.responseStatus)}"></i>
                </span>
              </div>
            {/each}
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
          <button type="button" class="btn btn-cancel" onclick={onclose}>
            <i class="fas fa-times"></i> Schliessen
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Event detail modal */
  .event-details-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
    margin: 20px 0;
    padding: 24px;
    border: 1px solid rgb(255 255 255 / 8%);
    border-radius: var(--radius-xl);
    background: rgb(255 255 255 / 2%);
  }

  /* Attendee list */
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
    border: 1px solid rgb(255 255 255 / 8%);
    border-radius: var(--radius-xl);
    background: rgb(255 255 255 / 3%);
  }

  /* Modal actions */
  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid rgb(255 255 255 / 10%);
  }
</style>
