/**
 * Calendar UI Module
 * All UI rendering and display functions for calendar features
 * Keeps DOM manipulation separate from business logic
 */

import type { User } from '../../types/api.types';
import { $$, setHTML } from '../../utils/dom-utils';
import { state } from './state';
import type { CalendarEvent, EventLevelInfo } from './types';
import { escapeHtml, getResponseText } from './modals';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clear all child elements from a container
 */
function clearContainer(container: HTMLElement): void {
  while (container.firstChild) {
    container.firstChild.remove();
  }
}

/**
 * Get user display name
 * Tries first_name + last_name, falls back to username or email
 */
export function getUserDisplayName(user: User): string {
  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName !== '') return fullName;
  if (user.username !== '') return user.username;
  return user.email;
}

// ============================================================================
// Event Level Display
// ============================================================================

/**
 * Get event level info for UI display
 * Returns CSS class and German text for organization level
 */
export function getEventLevelInfo(orgLevel: string | undefined): EventLevelInfo {
  if (orgLevel === 'company') {
    return { class: 'event-level-company', text: 'Firma' };
  } else if (orgLevel === 'department') {
    return { class: 'event-level-department', text: 'Abteilung' };
  } else if (orgLevel === 'team') {
    return { class: 'event-level-team', text: 'Team' };
  } else if (orgLevel === 'area') {
    return { class: 'event-level-area', text: 'Bereich' };
  }
  return { class: 'event-level-personal', text: 'Persönlich' };
}

// ============================================================================
// Upcoming Events Display (Dashboard Sidebar)
// ============================================================================

/**
 * Create event date section (calendar icon with date/time)
 */
export function createEventDateSection(event: CalendarEvent): HTMLElement {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const day = startDate.getDate();
  const month = startDate.toLocaleDateString('de-DE', { month: 'short' });

  const timeStr =
    event.all_day === true || event.all_day === 1 || event.all_day === '1'
      ? 'Ganztägig'
      : `${startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

  const dateDiv = document.createElement('div');
  dateDiv.className = 'event-date';

  const daySpan = document.createElement('span');
  daySpan.className = 'event-day';
  daySpan.textContent = day.toString();
  dateDiv.append(daySpan);

  const monthSpan = document.createElement('span');
  monthSpan.className = 'event-month';
  monthSpan.textContent = month;
  dateDiv.append(monthSpan);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'event-time';
  timeSpan.textContent = timeStr;
  dateDiv.append(timeSpan);

  return dateDiv;
}

/**
 * Create event details section (title, location, level, response)
 */
export function createEventDetailsSection(event: CalendarEvent): HTMLElement {
  const levelInfo = getEventLevelInfo(event.org_level);
  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'event-details';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'event-title';
  titleDiv.textContent = event.title;
  detailsDiv.append(titleDiv);

  if (event.location !== undefined && event.location !== '') {
    const locationDiv = document.createElement('div');
    locationDiv.className = 'event-location';
    const locationIcon = document.createElement('i');
    locationIcon.className = 'fas fa-map-marker-alt';
    locationDiv.append(locationIcon);
    locationDiv.append(document.createTextNode(' ' + event.location));
    detailsDiv.append(locationDiv);
  }

  const levelSpan = document.createElement('span');
  levelSpan.className = 'event-level ' + levelInfo.class;
  levelSpan.textContent = levelInfo.text;
  detailsDiv.append(levelSpan);

  if (event.user_response !== undefined) {
    const responseSpan = document.createElement('span');
    responseSpan.className = 'status-' + event.user_response + ' event-response';
    responseSpan.textContent = 'Ihr Status: ' + getResponseText(event.user_response);
    detailsDiv.append(responseSpan);
  }

  return detailsDiv;
}

/**
 * Create event item element (complete upcoming event card)
 */
export function createEventItem(
  event: CalendarEvent,
  viewEventCallback: (id: number) => void | Promise<void>,
): HTMLElement {
  const eventItem = document.createElement('div');
  eventItem.className = 'event-item';
  eventItem.dataset['id'] = event.id.toString();

  const dateDiv = createEventDateSection(event);
  eventItem.append(dateDiv);

  const detailsDiv = createEventDetailsSection(event);
  eventItem.append(detailsDiv);

  eventItem.addEventListener('click', () => {
    void viewEventCallback(event.id);
  });

  return eventItem;
}

/**
 * Display upcoming events in the sidebar
 * Main function for rendering dashboard events
 */
export function displayUpcomingEvents(
  events: CalendarEvent[],
  viewEventCallback: (id: number) => void | Promise<void>,
): void {
  const container = $$('#upcomingEvents');

  if (!container) {
    console.error('Upcoming events container not found');
    return;
  }

  container.innerHTML = '';

  if (events.length === 0) {
    container.innerHTML = '<p class="text-center">Keine anstehenden Termine gefunden.</p>';
    return;
  }

  events.forEach((event) => {
    const eventItem = createEventItem(event, viewEventCallback);
    container.append(eventItem);
  });
}

// ============================================================================
// Department & Team Dropdowns
// ============================================================================

/**
 * Create department dropdown option (Design System BEM)
 */
function createDepartmentOption(dept: { id: number; name: string }, _action: string): HTMLDivElement {
  const option = document.createElement('div');
  option.className = 'dropdown__option'; // Design System BEM class
  option.dataset['value'] = dept.id.toString();
  option.textContent = dept.name;
  // data-action not needed - handled by initDropdown()
  return option;
}

/**
 * Populate department dropdown with options
 */
export function populateDepartmentDropdown(dropdown: HTMLElement | null, action: string): void {
  if (!dropdown) return;

  state.departments.forEach((dept) => {
    const option = createDepartmentOption(dept, action);
    dropdown.append(option);
  });
}

/**
 * Setup personal attendees UI (show add button)
 */
function setupPersonalAttendeesUI(
  attendeesGroup: HTMLElement,
  addAttendeeBtn: HTMLElement | null,
  attendeesContainer: HTMLElement | null,
): void {
  attendeesGroup.style.display = 'block';
  if (addAttendeeBtn) addAttendeeBtn.style.display = 'inline-flex';

  if (attendeesContainer && state.selectedAttendees.length === 0) {
    clearContainer(attendeesContainer);
    const noPara = document.createElement('p');
    noPara.className = 'text-muted';
    noPara.textContent = 'Keine Teilnehmer ausgewählt';
    attendeesContainer.append(noPara);
  }
}

/**
 * Setup automatic attendees UI (hide entire section for automatic levels)
 */
function setupAutomaticAttendeesUI(
  attendeesGroup: HTMLElement,
  addAttendeeBtn: HTMLElement | null,
  attendeesContainer: HTMLElement | null,
): void {
  // Hide attendees section completely for company/department/team events
  // Attendees are automatically added based on org level
  attendeesGroup.style.display = 'none';
  if (addAttendeeBtn) addAttendeeBtn.style.display = 'none';

  // Clear attendees container and state
  if (attendeesContainer) {
    clearContainer(attendeesContainer);
  }

  state.clearAttendees();
}

/**
 * Setup attendees UI based on organization level
 */
export function setupAttendeesUI(level: string): void {
  const attendeesGroup = $$('#attendeesGroup');
  const addAttendeeBtn = $$('#addAttendeeBtn');
  const attendeesContainer = $$('#attendeesContainer');

  if (!attendeesGroup) return;

  if (level === 'personal') {
    setupPersonalAttendeesUI(attendeesGroup, addAttendeeBtn, attendeesContainer);
  } else {
    setupAutomaticAttendeesUI(attendeesGroup, addAttendeeBtn, attendeesContainer);
  }
}

// ============================================================================
// Attendees Selection UI
// ============================================================================

/**
 * Create attendee option element (checkbox with user name)
 */
function createAttendeeOption(user: User): HTMLDivElement {
  const displayName = getUserDisplayName(user);
  const optionDiv = document.createElement('div');
  optionDiv.className = 'attendee-option';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `attendee-${user.id}`;
  checkbox.value = user.id.toString();
  optionDiv.append(checkbox);

  const label = document.createElement('label');
  label.htmlFor = `attendee-${user.id}`;
  label.textContent = `${displayName} (${user.email})`;
  optionDiv.append(label);

  return optionDiv;
}

/**
 * Populate attendees list with users
 */
export function populateAttendeesList(users: User[]): void {
  const attendeesList = $$('#attendeesList');
  if (!attendeesList) return;

  // Clear existing content
  clearContainer(attendeesList);

  // Add user options
  users.forEach((user) => {
    const optionDiv = createAttendeeOption(user);
    attendeesList.append(optionDiv);
  });
}

/**
 * Update selected attendees display
 * Shows chips with remove buttons for each selected attendee
 */
export function updateSelectedAttendees(): void {
  const container = $$('#attendeesContainer');
  if (!container) return;

  if (state.selectedAttendees.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Teilnehmer ausgewählt</p>';
    return;
  }

  // Get employee details for selected attendees
  const attendeeHTML = state.selectedAttendees
    .map((userId) => {
      const employee = state.employees.find((emp) => emp.id === userId);
      if (employee) {
        // Handle both snake_case (v1) and camelCase (v2) field names
        const firstName = employee.firstName ?? '';
        const lastName = employee.lastName ?? '';
        const displayName =
          `${firstName} ${lastName}`.trim() !== ''
            ? `${firstName} ${lastName}`.trim()
            : employee.username !== ''
              ? employee.username
              : employee.email;

        return `
        <div class="attendee-item">
          <span class="attendee-name">
            ${escapeHtml(displayName)}
          </span>
          <button type="button" class="remove-attendee" data-action="remove-attendee" data-user-id="${userId}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      }
      return '';
    })
    .filter((html) => html !== '')
    .join('');

  // Use setHTML from dom-utils for safe HTML setting
  setHTML(container, attendeeHTML);
}

// ============================================================================
// Organization Dropdown Management
// ============================================================================

/**
 * Hide organization dropdowns (departments and teams)
 */
export function hideOrgDropdowns(): void {
  const departmentGroup = $$('#departmentGroup');
  const departmentDropdown = $$('#departmentDropdown');
  const teamGroup = $$('#teamGroup');
  const teamDropdown = $$('#teamDropdown');

  if (departmentDropdown) departmentDropdown.innerHTML = '';
  if (teamDropdown) teamDropdown.innerHTML = '';
  if (departmentGroup) departmentGroup.style.display = 'none';
  if (teamGroup) teamGroup.style.display = 'none';
}

/**
 * Update organization ID dropdown based on selected level
 * Shows/hides department and team dropdowns as needed
 */
export function updateOrgIdDropdown(level: string): void {
  hideOrgDropdowns();
  setupAttendeesUI(level);

  const departmentGroup = $$('#departmentGroup');
  const teamGroup = $$('#teamGroup');
  const departmentDropdown = $$('#departmentDropdown');

  if (level === 'department' && departmentGroup) {
    departmentGroup.style.display = 'block';
    populateDepartmentDropdown(departmentDropdown, 'select-department');
  } else if (level === 'team' && departmentGroup && teamGroup) {
    departmentGroup.style.display = 'block';
    teamGroup.style.display = 'block';
    populateDepartmentDropdown(departmentDropdown, 'select-department-with-teams');
  }
}

// ============================================================================
// Department & Team Selection
// ============================================================================

/**
 * Select department (update UI and hidden input)
 */
export function selectDepartment(departmentId: number, departmentName: string): void {
  const selectedElement = $$('#selectedDepartment');
  const inputElement = $$('#eventDepartmentId') as HTMLInputElement | null;

  if (selectedElement) selectedElement.textContent = departmentName;
  if (inputElement) inputElement.value = departmentId.toString();
}

/**
 * Select team (update UI and hidden input)
 */
export function selectTeam(teamId: number, teamName: string): void {
  const selectedElement = $$('#selectedTeam');
  const inputElement = $$('#eventTeamId') as HTMLInputElement | null;

  if (selectedElement) selectedElement.textContent = teamName;
  if (inputElement) inputElement.value = teamId.toString();
}

/**
 * Load teams for selected department
 * Filters teams and populates team dropdown
 */
export function loadTeamsForDepartment(departmentId: number): void {
  const teamDropdown = $$('#teamDropdown');
  if (!teamDropdown) return;

  teamDropdown.innerHTML = '';

  // Filter teams by department
  // Handle both v1 (snake_case) and v2 (camelCase)
  const departmentTeams = state.teams.filter((team) => {
    const teamDeptId = team.departmentId ?? team.departmentId;
    return teamDeptId === departmentId;
  });

  // Create team options (Design System BEM)
  departmentTeams.forEach((team) => {
    const option = document.createElement('div');
    option.className = 'dropdown__option'; // Design System BEM class
    option.dataset['value'] = team.id.toString();
    option.textContent = team.name;
    // data-action not needed - handled by initDropdown()
    teamDropdown.append(option);
  });
}
