/* eslint-disable max-lines */
/**
 * Calendar Modals Module
 * All modal templates and content generation for calendar features
 * Follows KISS principle - simple, declarative HTML templates
 */

import type { CalendarEvent, EventAttendee, FormattedDates } from './types';
import { state } from './state';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Escape HTML to prevent XSS attacks
 * Used for all user-generated content in modals
 */
export function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined || text === '') return '';
  const str = text;
  return str.replace(/["&'<>]/g, (m) => {
    // Use switch to avoid object injection issues
    switch (m) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#039;';
      default:
        return m;
    }
  });
}

/**
 * Get response status text in German
 */
export function getResponseText(response: string): string {
  switch (response) {
    case 'accepted':
      return 'Zugesagt';
    case 'declined':
      return 'Abgesagt';
    case 'tentative':
      return 'Vielleicht';
    default:
      return 'Ausstehend';
  }
}

/**
 * Get attendee status icon HTML
 */
export function getAttendeeStatusIcon(status: string): string {
  switch (status) {
    case 'accepted':
      return '<i class="fas fa-check-circle"></i>';
    case 'declined':
      return '<i class="fas fa-times-circle"></i>';
    case 'tentative':
      return '<i class="fas fa-question-circle"></i>';
    default:
      return '<i class="fas fa-clock"></i>';
  }
}

/**
 * Format event dates for display
 */
export function formatEventDates(event: CalendarEvent): FormattedDates {
  // API v2 returns camelCase, fallback to snake_case for compatibility
  const startTime = event.startTime ?? event.start_time;
  const startDate = new Date(startTime);

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  return {
    dateStr: startDate.toLocaleDateString('de-DE', dateOptions),
    timeStr: startDate.toLocaleTimeString('de-DE', timeOptions),
  };
}

/**
 * Get event level text for display
 */
export function getEventLevelText(event: CalendarEvent): string {
  // API v2 returns camelCase, fallback to snake_case for compatibility
  const orgLevel = event.orgLevel ?? event.org_level;
  const departmentName = event.departmentName ?? event.department_name;
  const teamName = event.teamName ?? event.team_name;

  if (orgLevel === 'company') {
    return 'Firmentermin';
  }
  if (orgLevel === 'department') {
    return `Abteilungstermin${departmentName !== undefined && departmentName !== '' ? `: ${departmentName}` : ''}`;
  }
  if (orgLevel === 'team') {
    return `Teamtermin${teamName !== undefined && teamName !== '' ? `: ${teamName}` : ''}`;
  }
  return 'Persönlicher Termin';
}

/**
 * Check if event is all day
 */
export function isAllDayEvent(event: CalendarEvent): boolean {
  // API v2 returns camelCase, fallback to snake_case for compatibility
  const allDay = event.allDay ?? event.all_day;
  return allDay === true || allDay === 1 || allDay === '1';
}

// ============================================================================
// Event Detail Modal Content Builders
// ============================================================================

/**
 * Format date/time for event display
 */
function formatEventDateTime(date: Date, isAllDay: boolean): string {
  const dateStr = date.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (isAllDay) return dateStr;
  const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} um ${timeStr}`;
}

/**
 * Build event details section (title, description, dates, location)
 */
export function buildEventDetailsSection(event: CalendarEvent, _dates: FormattedDates, levelText: string): string {
  const isAllDay = isAllDayEvent(event);
  const icon = isAllDay ? 'calendar-day' : 'clock';
  const title = event.title !== '' ? event.title : 'Unbenannter Termin';
  const description =
    event.description !== undefined && event.description !== '' ? `<p>${escapeHtml(event.description)}</p>` : '';

  // API v2 returns camelCase, fallback to snake_case for compatibility
  const startDate = new Date(event.startTime ?? event.start_time);
  const endDate = new Date(event.endTime ?? event.end_time);
  const startTime = formatEventDateTime(startDate, isAllDay);
  const endTime = formatEventDateTime(endDate, isAllDay);

  const locationSection =
    event.location !== undefined && event.location !== ''
      ? `
      <div class="detail-item">
        <i class="fas fa-map-marker-alt"></i>
        <span><strong>Ort:</strong> ${escapeHtml(event.location)}</span>
      </div>`
      : '';

  return `
    <h3>
      <i class="fas fa-${icon}"></i>
      ${escapeHtml(title)}
    </h3>
    ${description}

    <div class="event-details-grid">
      <div class="detail-item">
        <i class="fas fa-calendar"></i>
        <span><strong>Beginn:</strong> ${startTime}</span>
      </div>
      <div class="detail-item">
        <i class="fas fa-calendar-check"></i>
        <span><strong>Ende:</strong> ${endTime}</span>
      </div>
      ${locationSection}
      <div class="detail-item">
        <i class="fas fa-layer-group"></i>
        <span><strong>Ebene:</strong> ${levelText}</span>
      </div>
      <div class="detail-item">
        <i class="fas fa-user"></i>
        <span><strong>Erstellt von:</strong> ${escapeHtml(event.creator_name ?? 'Unknown')}</span>
      </div>
    </div>
  `;
}

/**
 * Build attendee list section
 */
export function buildAttendeeListSection(attendees: EventAttendee[]): string {
  if (attendees.length === 0) {
    return '';
  }

  const attendeeItems = attendees
    .map((attendee) => {
      const firstName = attendee.firstName ?? attendee.first_name ?? '';
      const lastName = attendee.lastName ?? attendee.last_name ?? '';
      const username = attendee.username ?? '';
      const responseStatus = attendee.responseStatus ?? attendee.response ?? 'pending';

      const name =
        `${firstName} ${lastName}`.trim() !== ''
          ? `${firstName} ${lastName}`.trim()
          : username !== ''
            ? username
            : 'Unknown';

      const statusIcon = getAttendeeStatusIcon(responseStatus);

      return `
        <div class="attendee-item">
          <span>${escapeHtml(name)}</span>
          <span class="attendee-status status-${responseStatus}" title="${getResponseText(responseStatus)}">
            ${statusIcon}
          </span>
        </div>
      `;
    })
    .join('');

  return `
    <h4>Teilnehmer (${attendees.length})</h4>
    <div class="attendee-list">
      ${attendeeItems}
    </div>
  `;
}

/**
 * Build action buttons (edit, delete)
 * Respects user permissions
 */
export function buildActionButtons(event: CalendarEvent): string {
  const canEdit = state.canEditEvent(event);
  const canDelete = state.canDeleteEvent(event);

  if (canEdit) {
    return `
      <div class="modal-actions">
        <button class="btn btn-edit" data-action="edit-event" data-event-id="${event.id}">
          <i class="fas fa-edit"></i> Bearbeiten
        </button>
        <button class="btn btn-danger" data-action="delete-event" data-event-id="${event.id}">
          <i class="fas fa-trash"></i> Löschen
        </button>
        <button class="btn btn-cancel" data-action="close">
          <i class="fas fa-times"></i> Schließen
        </button>
      </div>
    `;
  }

  if (canDelete) {
    return `
      <div class="modal-actions">
        <button class="btn btn-danger" data-action="delete-event" data-event-id="${event.id}">
          <i class="fas fa-trash"></i> Löschen
        </button>
        <button class="btn btn-cancel" data-action="close">
          <i class="fas fa-times"></i> Schließen
        </button>
      </div>
    `;
  }

  return `
    <div class="modal-actions">
      <button class="btn btn-cancel" data-action="close">
        <i class="fas fa-times"></i> Schließen
      </button>
    </div>
  `;
}

/**
 * Build complete event modal content
 * Combines all sections into final HTML
 */
export function buildEventModalContent(event: CalendarEvent): string {
  // API v2 returns camelCase, fallback to snake_case for compatibility
  const startTimeStr = event.startTime ?? event.start_time;
  const startDate = new Date(startTimeStr);

  const dates: FormattedDates = {
    dateStr: startDate.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    timeStr: startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  };

  const levelText = getEventLevelText(event);
  const detailsSection = buildEventDetailsSection(event, dates, levelText);
  const attendeeSection = buildAttendeeListSection(event.attendees ?? []);
  const actionButtons = buildActionButtons(event);

  return detailsSection + attendeeSection + actionButtons;
}

// ============================================================================
// Event Form Modal Templates
// ============================================================================

/**
 * Modal header template
 */
function getModalHeaderTemplate(): string {
  return `
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">Neuer Termin</h3>
      <button type="button" class="ds-modal__close" data-action="close">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
}

/**
 * Title and description fields template
 */
function getTitleDescriptionTemplate(): string {
  return `
    <input type="hidden" id="eventId" name="event_id" />

    <div class="form-field">
      <label class="form-field__label" for="eventTitle">
        Titel
        <span class="text-red-500">*</span>
      </label>
      <input
        type="text"
        class="form-field__control"
        id="eventTitle"
        name="title"
        placeholder="Titel des Termins eingeben"
        required
      />
    </div>

    <div class="form-field">
      <label class="form-field__label" for="eventDescription">Beschreibung</label>
      <textarea
        class="form-field__control"
        id="eventDescription"
        name="description"
        rows="4"
        placeholder="Beschreibung des Termins (Markdown-Formatierung möglich)"
      ></textarea>
      <span class="form-field__message text-[var(--color-text-secondary)]">
        <i class="fas fa-info-circle"></i> Markdown-Formatierung möglich
      </span>
    </div>
  `;
}

/**
 * Date and time fields template
 */
function getDateTimeTemplate(): string {
  return `
    <div class="grid grid-cols-2 gap-4">
      <div class="form-field">
        <label class="form-field__label" for="eventStart">
          Beginn
          <span class="text-red-500">*</span>
        </label>
        <input type="datetime-local" class="form-field__control" id="eventStart" name="start_time" lang="de" required />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="eventEnd">
          Ende
          <span class="text-red-500">*</span>
        </label>
        <input type="datetime-local" class="form-field__control" id="eventEnd" name="end_time" lang="de" required />
      </div>
    </div>

    <div class="form-field">
      <label class="toggle-switch toggle-switch--sm">
        <input type="checkbox" class="toggle-switch__input" id="eventAllDay" name="all_day" />
        <span class="toggle-switch__slider"></span>
        <span class="toggle-switch__label">Ganztägiger Termin</span>
      </label>
    </div>
  `;
}

/**
 * Location field template
 */
function getLocationTemplate(): string {
  return `
    <div class="form-field">
      <label class="form-field__label" for="eventLocation">Ort</label>
      <input
        type="text"
        class="form-field__control"
        id="eventLocation"
        name="location"
        placeholder="z.B. Konferenzraum 1, Online Meeting, etc."
      />
    </div>
  `;
}

/**
 * Organization level template
 */
/**
 * Organization level template - Simplified for multi-org
 * Legacy org_level field kept for backwards compatibility
 * NOTE: Wrapped in admin-only container - hidden for employees via JS
 */
function getOrgLevelTemplate(): string {
  return `
    <!-- Admin-only: Org level visibility section - hidden for employees -->
    <div id="adminOnlyOrgLevel" class="form-field">
      <label class="form-field__label">
        <i class="fas fa-users mr-2"></i>
        Sichtbarkeit
      </label>
      <p class="text-sm text-[var(--color-text-secondary)] mb-2">
        Wählen Sie keine Organisation für firmenweite Events oder eine/mehrere spezifische Organisationen.
      </p>
    </div>
  `;
}

/**
 * Department and team selection template - Multi-Select
 * Native multi-select for areas, departments, and teams
 * Hierarchy: Area → Department → Team
 * NOTE: Wrapped in admin-only container - hidden for employees via JS
 */
function getDepartmentTeamTemplate(): string {
  return `
    <!-- Admin-only: Organization selects - hidden for employees -->
    <div id="adminOnlyOrgSelects">
      <!-- Ganze Firma Toggle -->
      <div class="form-field">
        <label class="toggle-switch toggle-switch--danger">
          <input type="checkbox" class="toggle-switch__input" id="event-company-wide" />
          <span class="toggle-switch__slider"></span>
          <span class="toggle-switch__label">
            <i class="fas fa-building mr-2"></i>
            Ganze Firma (Alle Mitarbeiter)
          </span>
        </label>
        <span class="form-field__message text-[var(--color-danger)]">
          <i class="fas fa-exclamation-triangle mr-1"></i>
          Wenn aktiviert, sehen ALLE Mitarbeiter der Firma diesen Termin
        </span>
      </div>

      <!-- Area Selection -->
      <div class="form-field">
        <label for="event-area-select" class="form-field__label">
          <i class="fas fa-map-marked-alt mr-1"></i> Bereiche
        </label>
        <select id="event-area-select" multiple class="form-field__control min-h-[100px]">
          <!-- Populated dynamically -->
        </select>
        <span class="form-field__message text-[var(--color-text-secondary)]">
          Strg/Cmd + Klick für Mehrfachauswahl
        </span>
      </div>

      <!-- Department Selection -->
      <div class="form-field">
        <label for="event-department-select" class="form-field__label">
          <i class="fas fa-sitemap mr-1"></i> Abteilungen
        </label>
        <select id="event-department-select" multiple class="form-field__control min-h-[100px]">
          <!-- Populated dynamically -->
        </select>
        <span class="form-field__message text-[var(--color-text-secondary)]">
          Strg/Cmd + Klick für Mehrfachauswahl
        </span>
      </div>

      <!-- Team Selection -->
      <div class="form-field">
        <label for="event-team-select" class="form-field__label">
          <i class="fas fa-users mr-1"></i> Teams
        </label>
        <select id="event-team-select" multiple class="form-field__control min-h-[100px]">
          <!-- Populated dynamically -->
        </select>
        <span class="form-field__message text-[var(--color-text-secondary)]">
          Strg/Cmd + Klick für Mehrfachauswahl
        </span>
      </div>
    </div>
  `;
}

/**
 * Attendees and response template
 * NOTE: Wrapped in admin-only container - hidden for employees via JS
 */
function getAttendeesResponseTemplate(): string {
  return `
    <!-- Admin-only: Attendees section - hidden for employees -->
    <div id="adminOnlyAttendees">
      <div class="form-field" id="attendeesGroup" style="display: block;">
        <label class="form-field__label">Teilnehmer</label>
        <div id="attendeesContainer">
          <p class="text-[var(--color-info)] flex items-center gap-2">
            <i class="fas fa-info-circle"></i>
            Alle Mitarbeiter der Firma werden automatisch eingeladen
          </p>
        </div>
        <button type="button" class="btn btn-secondary mt-2" id="addAttendeeBtn" style="display: none;">
          <i class="fas fa-plus"></i>
          Teilnehmer hinzufügen
        </button>
      </div>
    </div>
  `;
}

/**
 * Recurrence template
 */
function getRecurrenceTemplate(): string {
  return `
    <div class="form-field">
      <label class="form-field__label">Wiederkehrend</label>
      <div class="dropdown" id="recurrenceWrapper">
        <div class="dropdown__trigger">
          <span id="selectedRecurrence">Keine Wiederholung</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="dropdown__menu" id="recurrenceDropdown">
          <div class="dropdown__option" data-value="">Keine Wiederholung</div>
          <div class="dropdown__option" data-value="daily">Täglich</div>
          <div class="dropdown__option" data-value="weekly">Wöchentlich</div>
          <div class="dropdown__option" data-value="monthly">Monatlich</div>
          <div class="dropdown__option" data-value="yearly">Jährlich</div>
        </div>
      </div>
      <input type="hidden" id="eventRecurrence" />
    </div>

    <div class="form-field" id="recurrenceEndWrapper" style="display: none;">
      <label class="form-field__label">Wiederkehrung endet</label>
      <div class="dropdown" id="recurrenceEndTypeWrapper">
        <div class="dropdown__trigger" data-action="toggle-recurrence-end-dropdown">
          <span id="selectedRecurrenceEnd">Nie</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="dropdown__menu" id="recurrenceEndDropdown">
          <div class="dropdown__option" data-value="never" data-action="select-recurrence-end" data-end-type="never" data-end-text="Nie">Nie</div>
          <div class="dropdown__option" data-value="after" data-action="select-recurrence-end" data-end-type="after" data-end-text="Nach Anzahl">Nach Anzahl</div>
          <div class="dropdown__option" data-value="until" data-action="select-recurrence-end" data-end-type="until" data-end-text="An Datum">An Datum</div>
        </div>
      </div>
      <input type="hidden" id="eventRecurrenceEndType" value="never" />
      <div class="mt-2" id="recurrenceEndDetails" style="display: none;">
        <input type="number" class="form-field__control" id="eventRecurrenceCount" placeholder="Anzahl der Wiederholungen" min="1" style="display: none;" />
        <input type="date" class="form-field__control" id="eventRecurrenceUntil" style="display: none;" />
      </div>
    </div>
  `;
}

/**
 * Reminder template
 */
function getReminderTemplate(): string {
  return `
    <div class="form-field">
      <label class="form-field__label">Erinnerung</label>
      <div class="dropdown" id="reminderWrapper">
        <div class="dropdown__trigger">
          <span id="selectedReminder">Keine Erinnerung</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="dropdown__menu" id="reminderDropdown">
          <div class="dropdown__option" data-value="">Keine Erinnerung</div>
          <div class="dropdown__option" data-value="15">15 Minuten vorher</div>
          <div class="dropdown__option" data-value="30">30 Minuten vorher</div>
          <div class="dropdown__option" data-value="60">1 Stunde vorher</div>
          <div class="dropdown__option" data-value="1440">1 Tag vorher</div>
        </div>
      </div>
      <input type="hidden" id="eventReminderTime" />
    </div>
  `;
}

/**
 * Modal footer template
 */
function getModalFooterTemplate(): string {
  return `
    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" data-action="close">Abbrechen</button>
      <button type="button" class="btn btn-modal" id="saveEventBtn" data-action="save-event">
        <i class="fas fa-save"></i> Speichern
      </button>
    </div>
  `;
}

// ============================================================================
// Main Modal Templates
// ============================================================================

/**
 * Event Form Modal Template
 * Large modal with complete event creation/edit form
 */
export function getEventFormModalTemplate(): string {
  return `
    <div class="modal-overlay" id="eventFormModal">
      <form class="ds-modal ds-modal--lg" id="eventForm">
        ${getModalHeaderTemplate()}
        <div class="ds-modal__body">
          ${getTitleDescriptionTemplate()}
          ${getDateTimeTemplate()}
          ${getLocationTemplate()}
          ${getOrgLevelTemplate()}
          ${getDepartmentTeamTemplate()}
          ${getAttendeesResponseTemplate()}
          ${getRecurrenceTemplate()}
          ${getReminderTemplate()}
        </div>
        ${getModalFooterTemplate()}
      </form>
    </div>
  `;
}

/**
 * Event Detail Modal Template
 * Shows event details with edit/delete actions
 */
export function getEventDetailModalTemplate(): string {
  return `
    <div class="modal-overlay" id="eventDetailModal">
      <div class="ds-modal">
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">
            <i class="fas fa-calendar-alt"></i>
            Termin Details
          </h3>
          <button type="button" class="ds-modal__close" data-action="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body">
          <div id="eventDetailContent" class="fade-in">
            <!-- Wird dynamisch gefüllt -->
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attendees Modal Template
 * For selecting event attendees
 */
export function getAttendeesModalTemplate(): string {
  return `
    <div class="modal-overlay" id="attendeesModal">
      <div class="ds-modal ds-modal--md">
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">Teilnehmer hinzufügen</h3>
          <button type="button" class="ds-modal__close" data-action="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body">
          <div class="form-field">
            <input
              type="text"
              class="form-field__control"
              id="attendeeSearch"
              placeholder="Mitarbeiter suchen..."
            />
          </div>
          <div id="attendeesList" class="attendees-list">
            <!-- Wird dynamisch befüllt -->
          </div>
        </div>
        <div class="ds-modal__footer">
          <button type="button" class="btn btn-cancel" data-action="close">Abbrechen</button>
          <button type="button" class="btn btn-modal" id="addSelectedAttendeesBtn">
            <i class="fas fa-plus"></i> Ausgewählte hinzufügen
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Event Response Modal Template
 * For responding to event invitations
 */
export function getEventResponseModalTemplate(): string {
  return `
    <div class="modal-overlay" id="eventResponseModal">
      <div class="ds-modal ds-modal--sm">
        <div class="ds-modal__header">
          <h3 class="ds-modal__title" id="eventResponseModalLabel">Auf Einladung antworten</h3>
          <button type="button" class="ds-modal__close" data-action="close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body">
          <p>Wie möchten Sie auf diese Einladung antworten?</p>
          <div class="response-buttons">
            <button type="button" class="response-btn" data-response="accepted">
              <i class="fas fa-check"></i>
              <span>Zusagen</span>
            </button>
            <button type="button" class="response-btn" data-response="tentative">
              <i class="fas fa-question"></i>
              <span>Vielleicht</span>
            </button>
            <button type="button" class="response-btn" data-response="declined">
              <i class="fas fa-times"></i>
              <span>Absagen</span>
            </button>
          </div>
        </div>
        <div class="ds-modal__footer">
          <button type="button" class="btn btn-cancel" data-action="close">Schließen</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Confirmation Modal Template
 * For delete confirmations
 */
export function getConfirmationModalTemplate(): string {
  return `
    <div class="modal-overlay" id="confirmationModal">
      <div class="confirm-modal confirm-modal--danger">
        <div class="confirm-modal__icon">
          <i class="fas fa-trash"></i>
        </div>
        <h3 class="confirm-modal__title">Termin löschen</h3>
        <p class="confirm-modal__message">Möchten Sie diesen Termin wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
        <div class="confirm-modal__actions">
          <button type="button" class="confirm-modal__btn confirm-modal__btn--cancel" data-action="close">
            Abbrechen
          </button>
          <button type="button" class="confirm-modal__btn confirm-modal__btn--danger" id="confirmDeleteBtn">
            <i class="fas fa-trash"></i> Löschen
          </button>
        </div>
      </div>
    </div>
  `;
}
