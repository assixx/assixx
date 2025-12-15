/**
 * Employee Dashboard Script
 * Handles employee-specific functionality and document management
 */

import type { User, Document } from '../../types/api.types';
import { apiClient } from '../../utils/api-client';
import { getAuthToken, showError, loadUserInfo } from '../auth/index';
import { $$id, setHTML, escapeHtml, createElement } from '../../utils/dom-utils';

interface EmployeeInfo extends User {
  department?: string;
  team?: string;
  supervisor?: string;
  documents_count?: number;
  recent_documents?: Document[];
  // API v2 fields from /users/me
  teamAreaName?: string;
  teamDepartmentName?: string;
  teamName?: string;
}

// Calendar Event type matching actual API v2 response (uses startTime/endTime)
interface CalendarEventApi {
  id: number;
  tenantId: number;
  createdBy: number;
  title: string;
  description?: string;
  startTime: string; // API returns startTime, not startDate
  endTime: string; // API returns endTime, not endDate
  allDay: boolean | number; // Can be boolean or 0/1
  location?: string;
  category: string;
  color?: string;
  orgLevel?: string; // API returns orgLevel for visibility
  recurring?: boolean;
  recurrencePattern?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Download a document
 */
function downloadDocument(docId?: string | number): void {
  if (docId === undefined) {
    console.error('No document ID provided');
    return;
  }

  const token = getAuthToken();
  if (token === null || token === '') return;

  // Create a download link - try v2 API endpoint first
  // The backend will handle the fallback if v2 is not available
  const link = document.createElement('a');
  link.href = `/api/v2/documents/${docId}/download`;
  link.download = '';
  link.style.display = 'none';

  // Add authorization header via query parameter for download
  // Note: This is a workaround since we can't set headers on anchor tag downloads
  link.href += `?token=${encodeURIComponent(token)}`;

  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * Search documents
 */
async function searchDocuments(query: string): Promise<void> {
  try {
    const response = await apiClient.get<{ documents: Document[] }>(
      `/documents/search?query=${encodeURIComponent(query)}`,
    );
    displayDocuments(response.documents);
  } catch (error) {
    console.error('Fehler bei der Dokumentensuche:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Load employee information
 */
async function loadEmployeeInfo(): Promise<void> {
  try {
    // Use cached user data from auth.js to prevent duplicate API calls
    const employeeInfo = (await loadUserInfo()) as EmployeeInfo;
    displayEmployeeInfo(employeeInfo);
  } catch (error) {
    console.error('Fehler beim Laden der Mitarbeiterinformationen:', error);
    showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  }
}

/**
 * Get full name for display
 */
function getDisplayName(info: EmployeeInfo): string {
  const fullName = `${info.firstName ?? ''} ${info.lastName ?? ''}`.trim();
  return fullName !== '' ? fullName : info.username;
}

/**
 * Update employee name elements
 */
function updateNameElements(info: EmployeeInfo): void {
  const employeeName = document.querySelector('#employee-name');
  if (employeeName) {
    employeeName.textContent = getDisplayName(info);
  }

  // #user-name is handled by unified-navigation - removed to prevent race condition
}

/**
 * Generate employee details HTML
 */
function generateEmployeeDetailsHTML(info: EmployeeInfo): string {
  const parts = [
    `<p><strong>Name:</strong> ${escapeHtml(info.firstName ?? '')} ${escapeHtml(info.lastName ?? '')}</p>`,
    `<p><strong>E-Mail:</strong> ${escapeHtml(info.email)}</p>`,
  ];

  if (info.department !== undefined && info.department !== '') {
    parts.push(`<p><strong>Abteilung:</strong> ${escapeHtml(info.department)}</p>`);
  }

  if (info.team !== undefined && info.team !== '') {
    parts.push(`<p><strong>Team:</strong> ${escapeHtml(info.team)}</p>`);
  }

  if (info.position !== undefined && info.position !== '') {
    parts.push(`<p><strong>Position:</strong> ${escapeHtml(info.position)}</p>`);
  }

  return parts.join('\n');
}

/**
 * Update employee details section
 */
function updateEmployeeDetails(info: EmployeeInfo): void {
  const employeeDetails = $$id('employee-details');
  if (employeeDetails) {
    setHTML(employeeDetails, generateEmployeeDetailsHTML(info));
  }
}

/**
 * Update stat cards with employee info (Area, Department, Team, Position)
 */
function updateStatCards(info: EmployeeInfo): void {
  // Area card - from teamAreaName
  const areaEl = $$id('employee-area');
  if (areaEl !== null) {
    areaEl.textContent = info.teamAreaName ?? 'Nicht zugewiesen';
  }

  // Department card - from teamDepartmentName (via team assignment)
  const deptEl = $$id('employee-department');
  if (deptEl !== null) {
    deptEl.textContent = info.teamDepartmentName ?? info.department ?? 'Nicht zugewiesen';
  }

  // Team card - from teamName
  const teamEl = $$id('employee-team');
  if (teamEl !== null) {
    teamEl.textContent = info.teamName ?? info.team ?? 'Nicht zugewiesen';
  }

  // Position card
  const posEl = $$id('employee-position');
  if (posEl !== null) {
    posEl.textContent = info.position ?? 'Mitarbeiter';
  }
}

/**
 * Display employee information
 */
function displayEmployeeInfo(info: EmployeeInfo): void {
  try {
    updateNameElements(info);
    updateEmployeeDetails(info);
    updateStatCards(info);
  } catch (error) {
    console.error('Fehler beim Anzeigen der Mitarbeiterinformationen:', error);
  }
}

/**
 * Load employee documents
 */
async function loadDocuments(): Promise<void> {
  try {
    const response = await apiClient.get<{ documents: Document[] }>('/documents');
    displayDocuments(response.documents);
  } catch (error) {
    console.error('Fehler beim Laden der Dokumente:', error);
  }
}

/**
 * Display recent documents in compact-item format (like Admin Dashboard)
 */
function displayDocuments(documents: Document[]): void {
  const container = $$id('recent-documents');
  if (container === null) return;

  if (documents.length === 0) {
    setHTML(container, '<p class="p-2 text-muted">Keine Dokumente vorhanden</p>');
    return;
  }

  // Show only last 5 documents in compact format
  const items = documents.slice(0, 5).map((doc) => {
    const item = createElement('div', { className: 'compact-item' });
    const fileName = doc.filename;
    const nameSpan = createElement('span', { className: 'compact-item-name', title: fileName }, fileName);
    item.append(nameSpan);
    return item;
  });

  container.innerHTML = '';
  items.forEach((item) => {
    container.append(item);
  });
}

/**
 * Load upcoming calendar events
 */
async function loadUpcomingEvents(): Promise<void> {
  try {
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get date 3 months in future for range
    const futureDate = new Date(today);
    futureDate.setMonth(futureDate.getMonth() + 3);

    const startISO = today.toISOString();
    const endISO = futureDate.toISOString();

    // Use calendar API v2
    const response = await apiClient.get<{
      events: CalendarEventApi[];
      pagination: unknown;
    }>(
      `/calendar/events?startDate=${encodeURIComponent(startISO)}&endDate=${encodeURIComponent(endISO)}&filter=all&limit=10`,
    );

    const events = response.events;

    if (events.length === 0) {
      updateUpcomingEvents([]);
      return;
    }

    // Filter events that are in the future, sort by startTime, and take next 3
    const filteredEvents = events
      .filter((event: CalendarEventApi) => {
        // Check if startTime exists and is not empty
        if (event.startTime === '') {
          return false;
        }

        try {
          const eventDate = new Date(event.startTime);
          const isValid = !Number.isNaN(eventDate.getTime());
          const isFuture = eventDate >= today;
          return isValid && isFuture;
        } catch {
          return false;
        }
      })
      .sort((a: CalendarEventApi, b: CalendarEventApi) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      })
      .slice(0, 3);

    updateUpcomingEvents(filteredEvents);
  } catch (error) {
    console.error('Error loading upcoming events:', error);
    updateUpcomingEvents([]);
  }
}

/**
 * Update upcoming calendar events
 */
function updateUpcomingEvents(events: CalendarEventApi[]): void {
  const container = $$id('calendar-events-list');
  if (container === null) return;

  if (events.length === 0) {
    setHTML(
      container,
      `<div class="p-2 rounded text-xs">
        <strong class="block font-semibold">Nächste Termine</strong>
        <p class="text-[var(--color-text-secondary)] mt-1">Keine anstehenden Termine</p>
      </div>`,
    );
    return;
  }

  // Clear container and add events
  container.innerHTML = '';

  events.forEach((event) => {
    const eventItem = createEventItem(event);
    container.append(eventItem);
  });
}

/**
 * Create event item HTML element
 */
function createEventItem(event: CalendarEventApi): HTMLElement {
  // API v2 returns camelCase fields through dbToApiEvent
  const startDate = new Date(event.startTime);
  const day = startDate.getDate().toString();
  const month = startDate.toLocaleDateString('de-DE', { month: 'short' });

  // API returns allDay as boolean or number (1/0)
  const isAllDay = event.allDay === true || event.allDay === 1;
  const time = isAllDay ? 'Ganztägig' : startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // Get org level class and text - API returns orgLevel
  const orgLevel = event.orgLevel ?? 'personal';
  const levelClass = `event-level-${orgLevel}`;
  const levelText = getOrgLevelText(orgLevel);

  const eventItem = createElement('div', { className: 'event-item' });
  eventItem.dataset['id'] = event.id.toString();

  // Event date section
  const eventDate = createElement('div', { className: 'event-date' });
  eventDate.append(
    createElement('span', { className: 'event-day' }, day),
    createElement('span', { className: 'event-month' }, month),
    createElement('span', { className: 'event-time' }, time),
  );

  // Event details section
  const eventDetails = createElement('div', { className: 'event-details' });
  const title = createElement(
    'div',
    { className: 'event-title' },
    event.title !== '' ? event.title : 'Unbenannter Termin',
  );
  eventDetails.append(title);

  // Location (optional)
  if (event.location !== undefined && event.location !== '') {
    const locationDiv = createElement('div', { className: 'event-location' });
    locationDiv.append(createElement('i', { className: 'fas fa-map-marker-alt' }), ` ${event.location}`);
    eventDetails.append(locationDiv);
  }

  // Org level badge
  const levelBadge = createElement('span', { className: `event-level ${levelClass}` }, levelText);
  eventDetails.append(levelBadge);

  eventItem.append(eventDate, eventDetails);

  // Click handler to open calendar
  eventItem.addEventListener('click', () => {
    window.location.href = '/calendar';
  });

  return eventItem;
}

/**
 * Get German text for org level
 */
function getOrgLevelText(orgLevel: string): string {
  switch (orgLevel) {
    case 'company':
      return 'Firma';
    case 'department':
      return 'Abteilung';
    case 'team':
      return 'Team';
    case 'area':
      return 'Bereich';
    default:
      return 'Persönlich';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Debug logging
  console.info('[Employee Dashboard] Starting initialization...');

  // Check if admin is viewing as employee
  const userRole = localStorage.getItem('userRole');
  const activeRole = localStorage.getItem('activeRole');
  const token = localStorage.getItem('token');

  console.info('[Employee Dashboard] Role Check:', {
    userRole,
    activeRole,
    token: token !== null && token !== '' ? 'exists' : 'missing',
    pathname: window.location.pathname,
  });

  const isAdminAsEmployee = userRole === 'admin' && activeRole === 'employee';

  console.info('[Employee Dashboard] Is Admin as Employee:', isAdminAsEmployee);

  // Show role indicator for admins
  if (isAdminAsEmployee) {
    const roleIndicator = $$id('role-indicator');
    const switchBtn = $$id('role-switch-btn');

    if (roleIndicator) {
      roleIndicator.style.display = 'inline-flex';
    }
    if (switchBtn !== null) {
      switchBtn.style.display = 'flex';
    }
  }

  // DOM elements
  const searchForm = $$id('search-form') as HTMLFormElement | null;
  const searchInput = $$id('search-input') as HTMLInputElement | null;

  // Search functionality - only add if search form exists
  if (searchForm !== null && searchInput !== null) {
    searchForm.addEventListener('submit', (e) => {
      void (async () => {
        e.preventDefault();
        const query = searchInput.value.trim();

        if (query !== '') {
          await searchDocuments(query);
        }
      })();
    });
  }

  // Load initial data
  void loadEmployeeInfo();
  void loadDocuments();
  void loadUpcomingEvents();

  // Event delegation for document download buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action="download-document"]');

    if (button instanceof HTMLButtonElement) {
      const docId = button.dataset['docId'];
      if (docId !== undefined) {
        downloadDocument(docId);
      }
    }
  });
});

// Extend window for employee dashboard functions
declare global {
  interface Window {
    downloadDocument: (docId?: string | number) => void;
  }
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.downloadDocument = downloadDocument;
}
