/**
 * Calendar System
 * Client-side JavaScript for the company calendar feature
 */

// Global variables
let calendar;
let currentFilter = 'all';
let currentSearch = '';
let departments = [];
let teams = [];
let employees = [];
let isAdmin = false;
let currentUserId = null;
let currentUserRole = null;
let currentDepartmentId = null;
let currentTeamId = null;
let selectedAttendees = [];
let calendarView = 'dayGridMonth'; // Default view

/**
 * Get headers for API calls
 */
function getHeaders() {
  return {
    'Content-Type': 'application/json'
  };
}

/**
 * Helper function to set selected organization ID
 * @param {number} id - The organization ID
 * @param {string} name - The organization name
 */
function selectOrgId(id, name) {
  const selectedOrgIdElement = document.getElementById('selectedOrgId');
  const eventOrgIdElement = document.getElementById('eventOrgId');

  if (selectedOrgIdElement) {
    selectedOrgIdElement.textContent = name;
  }
  if (eventOrgIdElement) {
    eventOrgIdElement.value = id;
  }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
  // Alle Schließen-Buttons einrichten
  setupCloseButtons();

  // Check if user is logged in
  checkLoggedIn()
    .then(() => {
      // Load user data
      fetchUserData()
        .then((userData) => {
          currentUserId = userData.id;
          currentUserRole = userData.role;
          currentDepartmentId = userData.departmentId || userData.department_id;
          currentTeamId = userData.teamId || userData.team_id;
          isAdmin = userData.role === 'admin' || userData.role === 'root';

          // Show/hide "New Event" button based on permissions
          const newEventBtn = document.getElementById('newEventBtn');
          if (newEventBtn) {
            newEventBtn.style.display = isAdmin ? 'block' : 'none';
          }

          // Load departments and teams for form dropdowns
          loadDepartmentsAndTeams();

          // Initialize calendar
          initializeCalendar();

          // Load upcoming events
          loadUpcomingEvents();
        })
        .catch((error) => {
          console.error('Error loading user data:', error);
          window.location.href = '/login';
        });

      // Setup event listeners
      setupEventListeners();
    })
    .catch((error) => {
      console.error('Error checking login:', error);
      window.location.href = '/login';
    });
});

/**
 * Setup close buttons for all modals
 */
function setupCloseButtons() {
  // Füge Event-Listener zu allen Elementen mit data-action="close" hinzu
  document.querySelectorAll('[data-action="close"]').forEach((button) => {
    button.addEventListener('click', function () {
      // Finde das übergeordnete Modal
      const modal = this.closest('.modal-overlay');
      if (modal) {
        window.DashboardUI.closeModal(modal.id);
      } else {
        console.error('No parent modal found for close button');
      }
    });
  });

  // Schließen beim Klicken außerhalb des Modal-Inhalts
  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      // Nur schließen, wenn der Klick auf den Modal-Hintergrund erfolgt (nicht auf den Inhalt)
      if (event.target === modal) {
        window.DashboardUI.closeModal(modal.id);
      }
    });
  });
}

/**
 * Initialize FullCalendar
 */
function initializeCalendar() {
  const calendarEl = document.getElementById('calendar');

  if (!calendarEl) {
    console.error('Calendar element not found');
    return;
  }

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: calendarView,
    locale: 'de',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: '',
    },
    buttonText: {
      today: 'Heute',
      month: 'Monat',
      week: 'Woche',
      day: 'Tag',
      list: 'Liste',
    },
    allDayText: 'Ganztägig',
    firstDay: 1, // Monday as first day
    slotMinTime: '07:00:00',
    slotMaxTime: '20:00:00',
    height: 'auto',
    nowIndicator: true,
    dayMaxEvents: true,
    navLinks: true,
    selectable: isAdmin, // Only admins can select dates to create events
    select(info) {
      if (isAdmin) {
        // Bei Klick auf einzelnen Tag: allDay = false
        // Nur wenn der ganze Tag ausgewählt wurde UND es die Monatsansicht ist
        const shouldBeAllDay =
          info.allDay && calendar.view.type === 'dayGridMonth';

        openEventForm(null, info.start, info.end, false); // Immer false für normale Termine
      }
    },
    eventClick(info) {
      viewEvent(info.event.id);
    },
    eventClassNames(info) {
      // Only add org_level classes if no custom color is set
      const hasCustomColor =
        info.event.extendedProps.custom_color &&
        info.event.extendedProps.custom_color !== '';
      if (!hasCustomColor) {
        const orgLevel = info.event.extendedProps.org_level;
        if (orgLevel) {
          return [`event-${orgLevel}`];
        }
      }
      return [];
    },
    events: fetchEvents,
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      meridiem: false,
    },
    dayHeaderFormat: { weekday: 'short', day: 'numeric', month: 'numeric' },
    eventDidMount(info) {
      // Add tooltip with full title (only if tippy is available)
      if (typeof tippy !== 'undefined') {
        tippy(info.el, {
          content: info.event.title,
          placement: 'top',
          arrow: true,
        });
      } else {
        // Fallback: Add title attribute for basic tooltip
        info.el.setAttribute('title', info.event.title);
      }
    },
  });

  calendar.render();
}

/**
 * Fetch events for calendar
 */
async function fetchEvents(info, successCallback, failureCallback) {
  try {
    const start_date = info.start.toISOString().split('T')[0];
    const end_date = info.end.toISOString().split('T')[0];

    // Build query URL with filter and search parameters
    let url = `/api/calendar?start_date=${start_date}&end_date=${end_date}`;

    if (currentFilter !== 'all') {
      url += `&filter=${currentFilter}`;
    }

    if (currentSearch) {
      url += `&search=${encodeURIComponent(currentSearch)}`;
    }

    // Fetch events with authentication
    const response = await fetch(url, {
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login if unauthorized
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to load events');
    }

    const data = await response.json();

    const events = data.events.map((event) => formatEvent(event));

    // Call success callback with events
    successCallback(events);
  } catch (error) {
    console.error('Error loading events:', error);
    failureCallback(error);
    showToast('error', 'Fehler beim Laden der Termine.');
  }
}

/**
 * Format event data for FullCalendar
 */
function formatEvent(event) {
  console.log('Formatting event:', event); // Debug log
  // Use custom color if provided, otherwise fallback to org_level defaults
  let color;
  if (event.color && event.color !== '') {
    // User selected a custom color
    color = event.color;
  } else {
    // Fallback to org_level defaults
    switch (event.org_level) {
      case 'company':
        color = '#1976d2'; // Blue (matches CSS)
        break;
      case 'department':
        color = '#388e3c'; // Green (matches CSS)
        break;
      case 'team':
        color = '#f57c00'; // Orange (matches CSS)
        break;
      default:
        color = '#3498db'; // Default blue
    }
  }

  // Bei ganztägigen Events: Korrigiere das End-Datum wenn es zu weit in der Zukunft liegt
  let endTime = event.end_time;
  if (event.all_day === 1 || event.all_day === '1') {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const daysDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24));

    // Wenn der Unterschied mehr als 1 Tag ist, korrigiere es
    if (daysDiff > 1) {
      const correctedEnd = new Date(start);
      correctedEnd.setDate(correctedEnd.getDate() + 1);
      endTime = correctedEnd.toISOString();
    }
  }

  return {
    id: event.id,
    title: event.title,
    start: event.start_time,
    end: endTime,
    allDay: event.all_day === 1 || event.all_day === '1',
    backgroundColor: color,
    borderColor: color,
    textColor: '#ffffff',
    extendedProps: {
      description: event.description,
      location: event.location,
      org_level: event.org_level,
      org_id: event.org_id,
      created_by: event.created_by,
      creator_name: event.creator_name,
      reminder_time: event.reminder_time,
      user_response: event.user_response,
      custom_color: event.color, // Store original color for editing
      all_day: event.all_day, // Store all_day flag for editing
    },
  };
}

/**
 * Load upcoming events for sidebar
 */
async function loadUpcomingEvents() {
  try {
    // Fetch upcoming events
    const response = await fetch('/api/calendar/dashboard', {
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to load upcoming events');
    }

    const events = await response.json();
    displayUpcomingEvents(events);
  } catch (error) {
    console.error('Error loading upcoming events:', error);
    const upcomingEvents = document.getElementById('upcomingEvents');
    upcomingEvents.innerHTML =
      '<p class="text-center">Fehler beim Laden der Termine.</p>';
  }
}

/**
 * Display upcoming events in the sidebar
 */
function displayUpcomingEvents(events) {
  const container = document.getElementById('upcomingEvents');

  if (!container) {
    console.error('Upcoming events container not found');
    return;
  }

  container.innerHTML = '';

  if (!events || events.length === 0) {
    container.innerHTML =
      '<p class="text-center">Keine anstehenden Termine gefunden.</p>';
    return;
  }

  events.forEach((event) => {
    // Parse dates
    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);

    // Format date components
    const day = startDate.getDate();
    const month = startDate.toLocaleDateString('de-DE', { month: 'short' });

    // Format time (only if not all day)
    const timeStr = event.all_day
      ? 'Ganztägig'
      : `${startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

    // Determine level badge class
    let levelClass = 'event-level-personal';
    let levelText = 'Persönlich';

    if (event.org_level === 'company') {
      levelClass = 'event-level-company';
      levelText = 'Firma';
    } else if (event.org_level === 'department') {
      levelClass = 'event-level-department';
      levelText = 'Abteilung';
    } else if (event.org_level === 'team') {
      levelClass = 'event-level-team';
      levelText = 'Team';
    }

    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    eventItem.setAttribute('data-id', event.id);

    eventItem.innerHTML = `
      <div class="event-date">
        <span class="event-day">${day}</span>
        <span class="event-month">${month}</span>
        <span class="event-time">${timeStr}</span>
      </div>
      <div class="event-details">
        <div class="event-title">${event.title}</div>
        ${event.location ? `<div class="event-location"><i class="fas fa-map-marker-alt"></i> ${event.location}</div>` : ''}
        <span class="event-level ${levelClass}">${levelText}</span>
        ${event.user_response ? `<span class="status-${event.user_response} event-response">Ihr Status: ${getResponseText(event.user_response)}</span>` : ''}
      </div>
    `;

    // Add click event
    eventItem.addEventListener('click', () => {
      viewEvent(event.id);
    });

    container.appendChild(eventItem);
  });
}

/**
 * Convert response status to readable text
 */
function getResponseText(response) {
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
 * View a specific event
 */
async function viewEvent(eventId) {
  try {
    // Fetch event details with authentication
    const response = await fetch(`/api/calendar/${eventId}`, {
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to load event details');
    }

    const event = await response.json();

    // Format dates
    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);

    const formattedStartDate = startDate.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedEndDate = endDate.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedStartTime = startDate.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const formattedEndTime = endDate.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Prepare level text
    let levelText = 'Unbekannt';
    if (event.org_level === 'company') {
      levelText = 'Firma (alle Mitarbeiter)';
    } else if (event.org_level === 'department') {
      levelText = `Abteilung (ID: ${event.org_id})`;
    } else if (event.org_level === 'team') {
      levelText = `Team (ID: ${event.org_id})`;
    }

    // Render event description with markdown
    const renderedDescription = event.description
      ? marked.parse(event.description)
      : '';

    // Build detail view
    const detailContent = document.getElementById('eventDetailContent');
    detailContent.innerHTML = `
      <div class="event-detail-header">
        <h3>${event.title}</h3>
        <div class="event-detail-meta">
          Erstellt von: ${event.creator_name || 'Unbekannt'}
        </div>
      </div>
      
      <div class="event-metadata">
        <div class="event-metadata-item">
          <i class="fas fa-calendar"></i> 
          ${
            event.all_day
              ? `Ganztägig, ${formattedStartDate}${startDate.toDateString() !== endDate.toDateString() ? ` bis ${formattedEndDate}` : ''}`
              : `${formattedStartDate}, ${formattedStartTime} - ${startDate.toDateString() !== endDate.toDateString() ? `${formattedEndDate}, ` : ''} ${formattedEndTime}`
          }
        </div>
        
        ${
          event.location
            ? `
        <div class="event-metadata-item">
          <i class="fas fa-map-marker-alt"></i> ${event.location}
        </div>
        `
            : ''
        }
        
        <div class="event-metadata-item">
          <i class="fas fa-layer-group"></i> ${levelText}
        </div>
        
        ${
          event.reminder_time
            ? `
        <div class="event-metadata-item">
          <i class="fas fa-bell"></i> Erinnerung: ${formatReminderTime(event.reminder_time)}
        </div>
        `
            : ''
        }
        
        ${
          event.user_response
            ? `
        <div class="event-metadata-item">
          <i class="fas fa-reply"></i> Ihr Status: <span class="status-${event.user_response}">${getResponseText(event.user_response)}</span>
        </div>
        `
            : ''
        }
      </div>
      
      ${
        renderedDescription
          ? `
      <div class="event-detail-content">
        <h4>Beschreibung</h4>
        ${renderedDescription}
      </div>
      `
          : ''
      }
      
      <div class="event-attendees">
        <h4>Teilnehmer</h4>
        <div id="attendeesList" class="attendees-container">
          <div class="loading-spinner"></div>
        </div>
      </div>
    `;

    // Load attendees
    loadEventAttendees(eventId);

    // Prepare footer buttons
    const detailFooter = document.getElementById('eventDetailFooter');

    // Clear existing dynamic buttons
    const existingButtons = detailFooter.querySelectorAll(
      'button:not(.btn-secondary)'
    );
    existingButtons.forEach((button) => button.remove());

    // Add response button if invited
    if (event.user_response !== null) {
      const responseButton = document.createElement('button');
      responseButton.type = 'button';
      responseButton.className = 'btn btn-outline-primary';
      responseButton.textContent = 'Antworten';
      responseButton.addEventListener('click', () => {
        // Close detail modal and open response form
        window.DashboardUI.closeModal('eventDetailModal');
        openResponseForm(event);
      });

      detailFooter.insertBefore(responseButton, detailFooter.firstChild);
    }

    // Add edit/delete buttons for admin or creator
    if (isAdmin || event.created_by === currentUserId) {
      // Edit button
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'btn btn-primary me-2';
      editButton.textContent = 'Bearbeiten';
      editButton.addEventListener('click', () => {
        // Close detail modal and open edit form
        window.DashboardUI.closeModal('eventDetailModal');
        openEventForm(event);
      });

      // Delete button
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn btn-danger me-2';
      deleteButton.textContent = 'Löschen';
      deleteButton.addEventListener('click', () => {
        // Close detail modal and show delete confirmation
        window.DashboardUI.closeModal('eventDetailModal');
        showDeleteConfirmation(event.id);
      });

      detailFooter.insertBefore(deleteButton, detailFooter.firstChild);
      detailFooter.insertBefore(editButton, detailFooter.firstChild);
    }

    // Show modal
    window.DashboardUI.openModal('eventDetailModal');
  } catch (error) {
    console.error('Error loading event details:', error);
    showToast('error', 'Fehler beim Laden der Termindetails.');
  }
}

/**
 * Load event attendees
 */
async function loadEventAttendees(eventId) {
  try {
    const attendeesList = document.getElementById('attendeesList');

    // Fetch attendees
    const response = await fetch(`/api/calendar/${eventId}/attendees`, {
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to load attendees');
    }

    const attendees = await response.json();

    // Clear loading spinner
    attendeesList.innerHTML = '';

    if (attendees.length === 0) {
      attendeesList.innerHTML =
        '<p class="text-center">Keine Teilnehmer gefunden.</p>';
      return;
    }

    // Display attendees
    attendees.forEach((attendee) => {
      const attendeeItem = document.createElement('div');
      attendeeItem.className = 'attendee-item';

      attendeeItem.innerHTML = `
        <span class="attendee-name">${attendee.first_name} ${attendee.last_name}</span>
        <span class="attendee-status status-${attendee.response_status}">${getResponseText(attendee.response_status)}</span>
      `;

      attendeesList.appendChild(attendeeItem);
    });
  } catch (error) {
    console.error('Error loading attendees:', error);
    const attendeesList = document.getElementById('attendeesList');
    attendeesList.innerHTML =
      '<p class="text-center">Fehler beim Laden der Teilnehmer.</p>';
  }
}

/**
 * Format reminder time
 */
function formatReminderTime(minutes) {
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440);
    return `${days} Tag${days > 1 ? 'e' : ''} vorher`;
  } else if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} Stunde${hours > 1 ? 'n' : ''} vorher`;
  } else {
    return `${minutes} Minute${minutes > 1 ? 'n' : ''} vorher`;
  }
}

/**
 * Open event form for create/edit
 */
function openEventForm(
  event = null,
  startDate = null,
  endDate = null,
  allDay = false
) {
  const modalTitle = document.getElementById('eventFormModalLabel');
  const eventForm = document.getElementById('eventForm');

  // Reset form
  eventForm.reset();
  document.getElementById('eventOrgId').disabled = true;

  // Stelle sicher, dass Zeitfelder aktiv sind nach Reset
  const startTimeInput = document.getElementById('eventStartTime');
  const endTimeInput = document.getElementById('eventEndTime');
  if (startTimeInput && endTimeInput) {
    startTimeInput.disabled = false;
    endTimeInput.disabled = false;
  }

  // Clear attendees
  selectedAttendees = [];
  document.getElementById('attendeesContainer').innerHTML = '';

  // Reset color options
  document.querySelectorAll('.color-option').forEach((option) => {
    option.classList.remove('selected');
  });
  document
    .querySelector('.color-option[data-color="#3498db"]')
    .classList.add('selected');
  document.getElementById('eventColor').value = '#3498db';

  // Set form title and populate if editing
  if (event) {
    modalTitle.textContent = 'Termin bearbeiten';

    // Populate form fields
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventDescription').value =
      event.extendedProps?.description || '';
    document.getElementById('eventLocation').value =
      event.extendedProps?.location || '';
    document.getElementById('eventAllDay').checked =
      event.allDay || event.extendedProps?.all_day === 1;

    // Set reminder in custom dropdown
    const reminderTime = event.extendedProps?.reminder_time;
    if (reminderTime) {
      const reminderText = formatReminderTime(reminderTime);
      const reminderSelect = document.getElementById('eventReminder');
      if (reminderSelect) reminderSelect.value = reminderTime;
    } else {
      const reminderSelect = document.getElementById('eventReminder');
      if (reminderSelect) reminderSelect.value = '';
    }

    // Parse dates - FullCalendar provides dates as 'start' and 'end'
    const start = new Date(event.start);
    const end = new Date(event.end);

    // Für ganztägige Events: End-Datum ist einen Tag zu viel (FullCalendar speichert exklusives Ende)
    if (event.allDay) {
      end.setDate(end.getDate() - 1);
    }

    // Set date inputs (YYYY-MM-DD format)
    document.getElementById('eventStartDate').value = start
      .toISOString()
      .split('T')[0];
    document.getElementById('eventEndDate').value = end
      .toISOString()
      .split('T')[0];

    // Set time inputs (HH:MM format)
    document.getElementById('eventStartTime').value = start
      .toTimeString()
      .substring(0, 5);
    document.getElementById('eventEndTime').value = end
      .toTimeString()
      .substring(0, 5);

    // Set organization level and populate org id dropdown
    const orgLevel = event.extendedProps?.org_level;
    if (orgLevel === 'company') {
      const orgLevelSelect = document.getElementById('eventOrgLevel');
      if (orgLevelSelect) orgLevelSelect.value = 'company';
    } else if (orgLevel === 'department') {
      const orgLevelSelect = document.getElementById('eventOrgLevel');
      if (orgLevelSelect) orgLevelSelect.value = 'department';
    } else if (orgLevel === 'team') {
      const orgLevelSelect = document.getElementById('eventOrgLevel');
      if (orgLevelSelect) orgLevelSelect.value = 'team';
    }

    // Wait a bit then set the org_id
    setTimeout(() => {
      updateOrgIdDropdown(orgLevel, event.extendedProps?.org_id);
    }, 100);

    // Set color - use custom_color if available, otherwise display color
    const colorValue =
      event.extendedProps?.custom_color || event.backgroundColor || '#3498db';
    document.getElementById('eventColor').value = colorValue;
    document.querySelectorAll('.color-option').forEach((option) => {
      option.classList.remove('selected');
      if (option.getAttribute('data-color') === colorValue) {
        option.classList.add('selected');
      }
    });

    // Toggle time inputs based on allDay
    toggleTimeInputs(event.allDay);

    // Load attendees if any
    loadAttendees(event.id);
  } else {
    modalTitle.textContent = 'Neuer Termin';
    document.getElementById('eventId').value = '';

    // If start date provided (from calendar select), use it
    if (startDate) {
      const start = new Date(startDate);
      const end = endDate
        ? new Date(endDate)
        : new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour

      // Set dates and times
      document.getElementById('eventStartDate').value = start
        .toISOString()
        .split('T')[0];
      document.getElementById('eventEndDate').value = end
        .toISOString()
        .split('T')[0];

      if (!allDay) {
        document.getElementById('eventStartTime').value = start
          .toTimeString()
          .substring(0, 5);
        document.getElementById('eventEndTime').value = end
          .toTimeString()
          .substring(0, 5);
      } else {
        document.getElementById('eventStartTime').value = '00:00';
        document.getElementById('eventEndTime').value = '00:00';
      }

      document.getElementById('eventAllDay').checked = allDay;
      toggleTimeInputs(allDay);
    } else {
      // Default to current date and time
      const now = new Date();
      const later = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later

      document.getElementById('eventStartDate').value = now
        .toISOString()
        .split('T')[0];
      document.getElementById('eventEndDate').value = now
        .toISOString()
        .split('T')[0];
      document.getElementById('eventStartTime').value = now
        .toTimeString()
        .substring(0, 5);
      document.getElementById('eventEndTime').value = later
        .toTimeString()
        .substring(0, 5);

      document.getElementById('eventAllDay').checked = false;
      // Explizit die Zeitfelder aktivieren
      setTimeout(() => {
        toggleTimeInputs(false); // Zeitfelder aktivieren für normalen Termin
      }, 100);
    }
  }

  // Show modal
  window.DashboardUI.openModal('eventFormModal');
}

/**
 * Toggle time inputs based on all day checkbox
 */
function toggleTimeInputs(isAllDay) {
  console.log('toggleTimeInputs called with isAllDay:', isAllDay); // Debug log
  const startTimeInput = document.getElementById('eventStartTime');
  const endTimeInput = document.getElementById('eventEndTime');

  if (!startTimeInput || !endTimeInput) {
    console.error('Time input elements not found!');
    return;
  }

  if (
    isAllDay === true ||
    isAllDay === 'true' ||
    isAllDay === 1 ||
    isAllDay === '1'
  ) {
    startTimeInput.disabled = true;
    endTimeInput.disabled = true;
    startTimeInput.value = '00:00';
    endTimeInput.value = '00:00'; // FullCalendar interpretiert ganztägige Events korrekt
  } else {
    startTimeInput.disabled = false;
    endTimeInput.disabled = false;
    // Stelle sicher, dass die Felder wirklich aktiviert sind
    startTimeInput.removeAttribute('disabled');
    endTimeInput.removeAttribute('disabled');
  }
}

/**
 * Update organization ID dropdown based on selected level
 */
async function updateOrgIdDropdown(level, selectedId = null) {
  const orgIdDropdown = document.getElementById('orgIdDropdown');
  const orgIdDisplay = document.getElementById('orgIdDisplay');

  // Clear dropdown
  orgIdDropdown.innerHTML = '';

  if (level === 'company') {
    // For company level, set directly
    orgIdDisplay.classList.add('disabled');
    document.getElementById('selectedOrgId').textContent = 'Gesamte Firma';
    document.getElementById('eventOrgId').value = '1';
    return;
  }

  orgIdDisplay.classList.remove('disabled');

  if (level === 'department') {
    // If departments aren't loaded yet, load them
    if (departments.length === 0) {
      await loadDepartmentsAndTeams();
    }

    // Add department options
    departments.forEach((dept) => {
      const option = document.createElement('div');
      option.className = 'dropdown-option';
      option.onclick = () => selectOrgId(dept.id, dept.name);
      option.textContent = dept.name;
      orgIdDropdown.appendChild(option);
    });

    // If admin can see all departments, otherwise restrict to user's department
    if (!isAdmin && currentDepartmentId) {
      // Non-admin can only post to their own department
      const userDept = departments.find((d) => d.id === currentDepartmentId);
      if (userDept) {
        document.getElementById('selectedOrgId').textContent = userDept.name;
        document.getElementById('eventOrgId').value = currentDepartmentId;
        orgIdDisplay.classList.add('disabled');
      }
    } else {
      document.getElementById('selectedOrgId').textContent =
        '-- Bitte wählen --';
      document.getElementById('eventOrgId').value = '';
    }
  }

  if (level === 'team') {
    // If teams aren't loaded yet, load them
    if (teams.length === 0) {
      await loadDepartmentsAndTeams();
    }

    // Add team options
    teams.forEach((team) => {
      const option = document.createElement('div');
      option.className = 'dropdown-option';
      option.onclick = () => selectOrgId(team.id, team.name);
      option.textContent = team.name;
      orgIdDropdown.appendChild(option);
    });

    // If admin can see all teams, otherwise restrict to user's team
    if (!isAdmin && currentTeamId) {
      // Non-admin can only post to their own team
      const userTeam = teams.find((t) => t.id === currentTeamId);
      if (userTeam) {
        document.getElementById('selectedOrgId').textContent = userTeam.name;
        document.getElementById('eventOrgId').value = currentTeamId;
        orgIdDisplay.classList.add('disabled');
      }
    } else {
      document.getElementById('selectedOrgId').textContent =
        '-- Bitte wählen --';
      document.getElementById('eventOrgId').value = '';
    }
  }

  // Set selected value if provided
  if (selectedId) {
    // Find the matching option and set it
    const options = orgIdDropdown.querySelectorAll('.dropdown-option');
    options.forEach((option) => {
      const optionText = option.textContent;
      if (level === 'department') {
        const dept = departments.find((d) => d.id == selectedId);
        if (dept && dept.name === optionText) {
          document.getElementById('selectedOrgId').textContent = optionText;
          document.getElementById('eventOrgId').value = selectedId;
        }
      } else if (level === 'team') {
        const team = teams.find((t) => t.id == selectedId);
        if (team && team.name === optionText) {
          document.getElementById('selectedOrgId').textContent = optionText;
          document.getElementById('eventOrgId').value = selectedId;
        }
      }
    });
  }
}

/**
 * Load departments and teams for dropdown
 */
async function loadDepartmentsAndTeams() {
  try {
    // Load departments
    const deptResponse = await fetch('/api/departments', {
      headers: getHeaders(),
      credentials: 'include',
    });

    if (deptResponse.ok) {
      const deptData = await deptResponse.json();
      departments = deptData;
    } else if (deptResponse.status === 401) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    // Load teams
    const teamResponse = await fetch('/api/teams', {
      headers: getHeaders(),
      credentials: 'include',
    });

    if (teamResponse.ok) {
      const teamData = await teamResponse.json();
      teams = teamData;
    } else if (teamResponse.status === 401) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    // Load employees for attendees
    const employeeResponse = await fetch('/api/users?role=employee', {
      headers: getHeaders(),
      credentials: 'include',
    });

    if (employeeResponse.ok) {
      const employeeData = await employeeResponse.json();
      employees = employeeData;
    } else if (employeeResponse.status === 401) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
  } catch (error) {
    console.error('Error loading reference data:', error);
    showToast('error', 'Fehler beim Laden der Abteilungen und Teams.');
  }
}

/**
 * Load attendees for an event
 */
async function loadAttendees(eventId) {
  try {
    // Fetch attendees
    const response = await fetch(`/api/calendar/${eventId}/attendees`, {
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to load attendees');
    }

    const attendees = await response.json();
    selectedAttendees = attendees.map((att) => ({
      id: att.user_id,
      name: `${att.first_name} ${att.last_name}`,
      status: att.response_status,
    }));

    // Update attendees container
    updateAttendeesContainer();
  } catch (error) {
    console.error('Error loading attendees:', error);
  }
}

/**
 * Update attendees container in the form
 */
function updateAttendeesContainer() {
  const container = document.getElementById('attendeesContainer');
  container.innerHTML = '';

  if (selectedAttendees.length === 0) {
    container.innerHTML =
      '<p class="text-center text-secondary">Keine Teilnehmer hinzugefügt.</p>';
    return;
  }

  selectedAttendees.forEach((attendee) => {
    const attendeeItem = document.createElement('div');
    attendeeItem.className = 'attendee-item';
    attendeeItem.dataset.id = attendee.id;

    attendeeItem.innerHTML = `
      <span class="attendee-name">${attendee.name}</span>
      ${
        attendee.status
          ? `<span class="attendee-status status-${attendee.status}">${getResponseText(attendee.status)}</span>`
          : ''
      }
      <button type="button" class="remove-attendee">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Add remove button event
    const removeBtn = attendeeItem.querySelector('.remove-attendee');
    removeBtn.addEventListener('click', () => {
      // Remove from selected attendees
      selectedAttendees = selectedAttendees.filter(
        (att) => att.id != attendee.id
      );
      updateAttendeesContainer();
    });

    container.appendChild(attendeeItem);
  });
}

/**
 * Open attendee selection modal
 */
function openAttendeeModal() {
  // If employees aren't loaded yet, load them
  if (employees.length === 0) {
    loadDepartmentsAndTeams();
  }

  // Clear search input
  document.getElementById('attendeeSearch').value = '';

  // Populate attendees list
  const attendeesList = document.getElementById('attendeesList');
  attendeesList.innerHTML = '';

  if (employees.length === 0) {
    attendeesList.innerHTML =
      '<p class="text-center">Keine Mitarbeiter gefunden.</p>';
  } else {
    // Filter out already selected attendees
    const selectedIds = selectedAttendees.map((att) => att.id);
    const availableEmployees = employees.filter(
      (emp) => !selectedIds.includes(emp.id)
    );

    if (availableEmployees.length === 0) {
      attendeesList.innerHTML =
        '<p class="text-center">Alle Mitarbeiter wurden bereits hinzugefügt.</p>';
    } else {
      // Create checkboxes for each available employee
      availableEmployees.forEach((emp) => {
        const item = document.createElement('div');
        item.className = 'attendee-select-item';

        item.innerHTML = `
          <label class="attendee-checkbox">
            <input type="checkbox" value="${emp.id}" data-name="${emp.first_name} ${emp.last_name}">
            <span>${emp.first_name} ${emp.last_name}</span>
            ${emp.department_name ? `<span class="department-name">${emp.department_name}</span>` : ''}
          </label>
        `;

        attendeesList.appendChild(item);
      });
    }
  }

  // Show modal
  window.DashboardUI.openModal('attendeesModal');
}

/**
 * Add selected attendees to the event
 */
function addSelectedAttendees() {
  // Get all checked checkboxes
  const checkboxes = document.querySelectorAll(
    '#attendeesList input[type="checkbox"]:checked'
  );

  // Add to selected attendees
  checkboxes.forEach((checkbox) => {
    selectedAttendees.push({
      id: checkbox.value,
      name: checkbox.getAttribute('data-name'),
      status: 'pending',
    });
  });

  // Update attendees container
  updateAttendeesContainer();

  // Close modal
  window.DashboardUI.closeModal('attendeesModal');
}

/**
 * Save event (create or update)
 */
async function saveEvent() {
  try {
    // Validate form
    const eventForm = document.getElementById('eventForm');
    if (!eventForm.checkValidity()) {
      eventForm.reportValidity();
      return;
    }

    // Get form values
    const eventId = document.getElementById('eventId').value;
    const title = document.getElementById('eventTitle').value.trim();
    const description = document
      .getElementById('eventDescription')
      .value.trim();
    const location = document.getElementById('eventLocation').value.trim();
    const startDate = document.getElementById('eventStartDate').value;
    const startTime = document.getElementById('eventStartTime').value;
    const endDate = document.getElementById('eventEndDate').value;
    const endTime = document.getElementById('eventEndTime').value;
    const allDay = document.getElementById('eventAllDay').checked;
    const orgLevel = document.getElementById('eventOrgLevel').value;
    const orgId = document.getElementById('eventOrgId').value;
    const reminderTime = document.getElementById('eventReminderTime').value;
    const color = document.getElementById('eventColor').value;

    // Combine date and time
    const startDateTime = new Date(
      `${startDate}T${allDay ? '00:00' : startTime}`
    );
    const endDateTime = new Date(`${endDate}T${allDay ? '00:00' : endTime}`);

    // Für ganztägige Events: Ende ist der nächste Tag um 00:00 (FullCalendar Standard)
    if (allDay) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    // Validate dates
    if (startDateTime > endDateTime) {
      showToast(
        'error',
        'Der Startzeitpunkt muss vor dem Endzeitpunkt liegen.'
      );
      return;
    }

    // Prepare event data
    const eventData = {
      title,
      description,
      location,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      all_day: allDay,
      org_level: orgLevel,
      org_id: parseInt(orgId, 10),
      color,
      attendees: selectedAttendees.map((att) => att.id),
    };

    // Only add reminder_time if it has a value (to avoid empty string to integer conversion error)
    if (reminderTime && reminderTime !== '') {
      eventData.reminder_time = parseInt(reminderTime, 10);
    }

    let url = '/api/calendar';
    let method = 'POST';

    // If editing, use PUT method
    if (eventId) {
      url = `/api/calendar/${eventId}`;
      method = 'PUT';
    }

    // Send request with authentication
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: getHeaders(),
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      throw new Error('Failed to save event');
    }

    // Close modal and refresh calendar
    window.DashboardUI.closeModal('eventFormModal');

    // Refresh calendar
    calendar.refetchEvents();

    // Reload upcoming events
    loadUpcomingEvents();

    // Show success message
    showToast(
      'success',
      eventId
        ? 'Termin erfolgreich aktualisiert.'
        : 'Neuer Termin erfolgreich erstellt.'
    );
  } catch (error) {
    console.error('Error saving event:', error);
    showToast('error', 'Fehler beim Speichern des Termins.');
  }
}

/**
 * Delete an event
 */
async function deleteEvent(eventId) {
  try {
    const response = await fetch(`/api/calendar/${eventId}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete event');
    }

    // Refresh calendar
    calendar.refetchEvents();

    // Reload upcoming events
    loadUpcomingEvents();

    // Show success message
    showToast('success', 'Termin erfolgreich gelöscht.');
  } catch (error) {
    console.error('Error deleting event:', error);
    showToast('error', 'Fehler beim Löschen des Termins.');
  }
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmation(eventId) {
  const confirmBtn = document.getElementById('confirmActionBtn');

  // Set modal content
  document.getElementById('confirmationMessage').textContent =
    'Möchten Sie diesen Termin wirklich löschen?';
  document.getElementById('confirmationModalLabel').textContent =
    'Termin löschen';
  confirmBtn.textContent = 'Löschen';
  confirmBtn.className = 'btn btn-danger';

  // Set confirm action
  confirmBtn.onclick = function () {
    deleteEvent(eventId);
    window.DashboardUI.closeModal('confirmationModal');
  };

  // Show modal
  window.DashboardUI.openModal('confirmationModal');
}

/**
 * Open response form to respond to an event invitation
 */
function openResponseForm(event) {
  // Set event title
  document.getElementById('responseEventTitle').textContent = event.title;

  // Setup response buttons
  document.querySelectorAll('.response-btn').forEach((btn) => {
    const response = btn.getAttribute('data-response');

    // Highlight current response
    if (response === event.user_response) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    // Add click event
    btn.onclick = function () {
      respondToEvent(event.id, response);
    };
  });

  // Show modal
  window.DashboardUI.openModal('eventResponseModal');
}

/**
 * Respond to an event invitation
 */
async function respondToEvent(eventId, response) {
  try {
    // Send response
    const apiResponse = await fetch(`/api/calendar/${eventId}/respond`, {
      method: 'POST',
      credentials: 'include',
      headers: getHeaders(),
      body: JSON.stringify({ response }),
    });

    if (!apiResponse.ok) {
      throw new Error('Failed to respond to event');
    }

    // Close response modal
    window.DashboardUI.closeModal('eventResponseModal');

    // Refresh calendar
    calendar.refetchEvents();

    // Reload upcoming events
    loadUpcomingEvents();

    // Show success message
    const responseText = getResponseText(response);
    showToast('success', `Antwort "${responseText}" erfolgreich gespeichert.`);
  } catch (error) {
    console.error('Error responding to event:', error);
    showToast('error', 'Fehler beim Antworten auf die Einladung.');
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Filter by level using tab buttons
  document.querySelectorAll('.tab-btn[data-value]').forEach((button) => {
    button.addEventListener('click', function () {
      // Remove active class from all buttons
      document
        .querySelectorAll('.tab-btn')
        .forEach((btn) => btn.classList.remove('active'));
      // Add active class to clicked button
      this.classList.add('active');

      currentFilter = this.dataset.value;

      // Refresh calendar with new filter
      calendar.refetchEvents();
    });
  });

  // Search button
  const searchButton = document.getElementById('searchButton');
  const searchInput = document.getElementById('searchInput');

  if (searchButton && searchInput) {
    searchButton.addEventListener('click', () => {
      currentSearch = searchInput.value.trim();

      // Refresh calendar with search
      calendar.refetchEvents();
    });

    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        currentSearch = this.value.trim();

        // Refresh calendar with search
        calendar.refetchEvents();
      }
    });
  }

  // New event button
  const newEventBtn = document.getElementById('newEventBtn');
  if (newEventBtn) {
    newEventBtn.addEventListener('click', () => {
      openEventForm(null, null, null, false); // Explizit allDay=false übergeben
    });
  }

  // Save event button
  const saveEventBtn = document.getElementById('saveEventBtn');
  if (saveEventBtn) {
    saveEventBtn.addEventListener('click', () => {
      saveEvent();
    });
  }

  // Organization level change is now handled by the custom dropdown onclick
  // The selectOrgLevel function in calendar.html calls updateOrgIdDropdown

  // All day checkbox
  const allDayCheckbox = document.getElementById('eventAllDay');
  if (allDayCheckbox) {
    allDayCheckbox.addEventListener('change', function () {
      toggleTimeInputs(this.checked);
    });
  }

  // Color picker
  document.querySelectorAll('.color-option').forEach((option) => {
    option.addEventListener('click', function () {
      const color = this.getAttribute('data-color');
      document.getElementById('eventColor').value = color;

      // Remove selected class from all options
      document.querySelectorAll('.color-option').forEach((opt) => {
        opt.classList.remove('selected');
      });

      // Add selected class to clicked option
      this.classList.add('selected');
    });
  });

  // Add attendee button
  const addAttendeeBtn = document.getElementById('addAttendeeBtn');
  if (addAttendeeBtn) {
    addAttendeeBtn.addEventListener('click', () => {
      openAttendeeModal();
    });
  }

  // Add selected attendees button
  const addSelectedAttendeesBtn = document.getElementById(
    'addSelectedAttendeesBtn'
  );
  if (addSelectedAttendeesBtn) {
    addSelectedAttendeesBtn.addEventListener('click', () => {
      addSelectedAttendees();
    });
  }

  // Attendee search
  const attendeeSearch = document.getElementById('attendeeSearch');
  if (attendeeSearch) {
    attendeeSearch.addEventListener('input', function () {
      const searchTerm = this.value.toLowerCase();

      // Filter attendee items
      document.querySelectorAll('.attendee-select-item').forEach((item) => {
        const name = item.textContent.toLowerCase();
        if (name.includes(searchTerm)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // Calendar view buttons
  document.getElementById('monthView').addEventListener('click', function () {
    setCalendarView('dayGridMonth', this);
  });

  document.getElementById('weekView').addEventListener('click', function () {
    setCalendarView('timeGridWeek', this);
  });

  document.getElementById('dayView').addEventListener('click', function () {
    setCalendarView('timeGridDay', this);
  });

  document.getElementById('listView').addEventListener('click', function () {
    setCalendarView('listWeek', this);
  });
}

/**
 * Set calendar view
 */
function setCalendarView(view, button) {
  // Update view
  calendar.changeView(view);

  // Update button states
  document.querySelectorAll('.view-selector button').forEach((btn) => {
    btn.classList.remove('active');
    btn.classList.add('btn-outline-primary');
    btn.classList.remove('btn-primary');
  });

  button.classList.add('active');
  button.classList.add('btn-primary');
  button.classList.remove('btn-outline-primary');

  // Store current view
  calendarView = view;
}

/**
 * Fetch current user data
 */
async function fetchUserData() {
  try {
    const response = await fetch('/api/auth/user', {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to load user data');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

/**
 * Check if user is logged in
 */
async function checkLoggedIn() {
  try {
    const response = await fetch('/api/auth/check', {
      credentials: 'include',
    });

    if (!response.ok) {
      // Redirect to login page
      window.location.href = '/login';
      throw new Error('User not logged in');
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking login status:', error);
    window.location.href = '/login';
    throw error;
  }
}

/**
 * Show toast notification
 */
function showToast(type, message) {
  // Use dashboard UI toast for simplified approach
  window.DashboardUI.showToast(message, type);
}
