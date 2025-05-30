/**
 * Blackboard System
 * Client-side JavaScript for the blackboard feature
 */

// Global variables
let currentPage = 1;
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'created_at|DESC';
let departments = [];
let teams = [];
let _totalPages = 1;
let isAdmin = false;
let currentUserId = null;
let _currentUserRole = null;
let currentDepartmentId = null;
let currentTeamId = null;

// Initialize when document is ready
// Globale Variable, um zu verhindern, dass Endlosanfragen gesendet werden
let entriesLoadingEnabled = false;

document.addEventListener('DOMContentLoaded', () => {
  // Aktiviere das automatische Laden der Einträge
  entriesLoadingEnabled = true;

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

          // Show/hide "New Entry" button based on permissions
          const newEntryBtn = document.getElementById('newEntryBtn');
          if (newEntryBtn) {
            newEntryBtn.style.display = isAdmin ? 'block' : 'none';
          }

          // Load departments and teams for form dropdowns
          loadDepartmentsAndTeams();

          // Wir laden die Einträge erst wenn der Button geklickt wird
          const loadEntriesBtn = document.getElementById('loadEntriesBtn');
          if (loadEntriesBtn) {
            loadEntriesBtn.addEventListener('click', () => {
              entriesLoadingEnabled = true; // Erlaube das Laden nur nach Klick
              loadEntries();
            });
          }

          // Retry-Button Ereignisbehandlung
          const retryLoadBtn = document.getElementById('retryLoadBtn');
          if (retryLoadBtn) {
            retryLoadBtn.addEventListener('click', () => {
              entriesLoadingEnabled = true; // Erlaube das Laden nur nach Klick
              loadEntries();
            });
          }
        })
        .catch((error) => {
          console.error('Error loading user data:', error);
          window.location.href = '/pages/login.html';
        });

      // Setup event listeners
      setupEventListeners();
    })
    .catch((error) => {
      console.error('Error checking login:', error);
      window.location.href = '/pages/login.html';
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
      const _modal = this.closest('.modal-overlay');
      if (_modal) {
        window.DashboardUI.closeModal(_modal.id);
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
 * Setup all event listeners
 */
function setupEventListeners() {
  // Filter by level using pill buttons
  document.querySelectorAll('.filter-pill[data-value]').forEach((button) => {
    button.addEventListener('click', function () {
      // Remove active class from all pills
      document
        .querySelectorAll('.filter-pill')
        .forEach((pill) => pill.classList.remove('active'));
      // Add active class to clicked pill
      this.classList.add('active');

      currentFilter = this.dataset.value;
      currentPage = 1;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        loadEntries();
      }
    });
  });

  // Sort entries
  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    sortFilter.addEventListener('change', function () {
      currentSort = this.value;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        loadEntries();
      }
    });
  } else {
    console.error('Sort filter not found');
  }

  // Search button
  const searchButton = document.getElementById('searchButton');
  const searchInput = document.getElementById('searchInput');

  if (searchButton && searchInput) {
    searchButton.addEventListener('click', () => {
      currentSearch = searchInput.value.trim();
      currentPage = 1;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        loadEntries();
      }
    });

    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        currentSearch = this.value.trim();
        currentPage = 1;

        // Nur laden, wenn es aktiviert wurde
        if (entriesLoadingEnabled) {
          loadEntries();
        }
      }
    });
  } else {
    console.error('Search elements not found');
  }

  // New entry button
  const newEntryBtn = document.getElementById('newEntryBtn');
  if (newEntryBtn) {
    newEntryBtn.addEventListener('click', () => {
      openEntryForm();
    });
  } else {
    console.error('New entry button not found');
  }

  // Save entry button
  const saveEntryBtn = document.getElementById('saveEntryBtn');
  if (saveEntryBtn) {
    saveEntryBtn.addEventListener('click', () => {
      saveEntry();
    });
  } else {
    console.error('Save entry button not found');
  }

  // Organization level change
  const entryOrgLevel = document.getElementById('entryOrgLevel');
  if (entryOrgLevel) {
    entryOrgLevel.addEventListener('change', function () {
      updateOrgIdDropdown(this.value);
    });
  } else {
    console.error('Organization level dropdown not found');
  }

  // Color selection
  document.querySelectorAll('.color-option').forEach((button) => {
    button.addEventListener('click', function () {
      // Remove active class from all color options
      document
        .querySelectorAll('.color-option')
        .forEach((option) => option.classList.remove('active'));
      // Add active class to clicked option
      this.classList.add('active');
    });
  });
}

/**
 * Load blackboard entries
 */
async function loadEntries() {
  // Wenn das Laden nicht aktiviert wurde (durch Klick auf den Button), dann abbrechen
  if (!entriesLoadingEnabled) {
    return;
  }

  try {
    // Verstecke die Lade-Button-Karte
    const loadEntriesCard = document.getElementById('loadEntriesCard');
    if (loadEntriesCard) loadEntriesCard.classList.add('d-none');

    // Zeige den Ladeindikator
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.classList.remove('d-none');

    // Verstecke vorherige Ergebnisse oder Fehlermeldungen
    const blackboardEntries = document.getElementById('blackboardEntries');
    if (blackboardEntries) blackboardEntries.classList.add('d-none');

    const noEntriesMessage = document.getElementById('noEntriesMessage');
    if (noEntriesMessage) noEntriesMessage.classList.add('d-none');

    // Parse sort option
    const [sortBy, sortDir] = currentSort.split('|');

    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    // Fetch entries with authentication token
    const response = await fetch(
      `/api/blackboard?page=${currentPage}&filter=${currentFilter}&search=${encodeURIComponent(currentSearch)}&sortBy=${sortBy}&sortDir=${sortDir}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login if unauthorized
        window.location.href = '/pages/login.html';
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to load entries');
    }

    const data = await response.json();

    // Update pagination
    totalPages = data.pagination.totalPages;
    updatePagination(data.pagination);

    // Display entries
    displayEntries(data.entries);

    // Erfolgreiche Anfrage - deaktiviere weitere automatische API-Aufrufe
    entriesLoadingEnabled = false;
  } catch (error) {
    console.error('Error loading entries:', error);
    showToast('error', 'Fehler beim Laden der Einträge.');

    // Bei einem Fehler, zeige die "Keine Einträge" Nachricht mit Wiederholungs-Button
    const noEntriesMessage = document.getElementById('noEntriesMessage');
    if (noEntriesMessage) {
      noEntriesMessage.classList.remove('d-none');
    }

    // Zeige die Lade-Button-Karte wieder an
    const loadEntriesCard = document.getElementById('loadEntriesCard');
    if (loadEntriesCard) loadEntriesCard.classList.remove('d-none');

    // Setze den Ladezustand zurück, damit nicht automatisch weiter geladen wird
    entriesLoadingEnabled = false;
  } finally {
    // Verstecke immer den Ladeindikator, egal was passiert
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.classList.add('d-none');
  }
}

/**
 * Display entries in the UI
 */
function displayEntries(entries) {
  const container = document.getElementById('blackboardEntries');
  if (!container) {
    console.error('Blackboard entries container not found');
    return;
  }

  container.innerHTML = '';

  if (!entries || entries.length === 0) {
    const noEntriesMessage = document.getElementById('noEntriesMessage');
    if (noEntriesMessage) {
      noEntriesMessage.classList.remove('d-none');
    }

    // Hide pagination if no entries are found
    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
      paginationContainer.classList.add('d-none');
    }

    return;
  }

  entries.forEach((entry) => {
    const col = document.createElement('div');
    // Use class appropriate for the dashboard grid in admin-grid
    col.className = 'admin-card';

    // Sicherstellen, dass entry.content ein String ist
    let content = entry.content;
    if (typeof content !== 'string') {
      content = JSON.stringify(content) || '';
    }

    // Format content preview (strip HTML and limit length)
    let contentPreview = content.replace(/<\/?[^>]+(>|$)/g, '');
    if (contentPreview.length > 150) {
      contentPreview = `${contentPreview.substring(0, 147)}...`;
    }

    // Format date
    const createdDate = new Date(entry.created_at);
    const formattedDate = `${createdDate.toLocaleDateString(
      'de-DE'
    )} ${createdDate.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    // Prepare level badge
    let levelBadge = '';
    if (entry.org_level === 'company') {
      levelBadge = '<span class="badge level-company">Firma</span>';
    } else if (entry.org_level === 'department') {
      levelBadge = '<span class="badge level-department">Abteilung</span>';
    } else if (entry.org_level === 'team') {
      levelBadge = '<span class="badge level-team">Team</span>';
    }

    // Prepare unread badge
    const unreadBadge =
      entry.requires_confirmation && !entry.is_confirmed
        ? '<span class="badge unread-badge ms-2">Ungelesen</span>'
        : '';

    // Prepare author initial for avatar
    const authorInitial = entry.author_name
      ? entry.author_name.charAt(0).toUpperCase()
      : '?';

    // Color mapping for CSS
    const colorMap = {
      blue: '#2196F3',
      green: '#4CAF50',
      orange: '#FF9800',
      red: '#F44336',
      purple: '#9C27B0',
      gray: '#757575',
    };

    const entryColor = colorMap[entry.color] || colorMap['blue'];

    col.innerHTML = `
      <div class="card blackboard-card priority-${entry.priority} ${entry.requires_confirmation && !entry.is_confirmed ? 'unread' : ''}" style="border-left: 4px solid ${entryColor};">
        <div class="card-body">
          <h5 class="card-title" style="color: ${entryColor};">${entry.title} ${unreadBadge}</h5>
          <div class="mb-2">${levelBadge}</div>
          <p class="card-text">${contentPreview}</p>
          <button class="btn btn-sm btn-primary view-entry-btn" data-id="${entry.id}">
            Details anzeigen
          </button>
          ${
            entry.requires_confirmation && !entry.is_confirmed
              ? `<button class="btn btn-sm btn-outline-success ms-2 confirm-entry-btn" data-id="${entry.id}">
               Als gelesen bestätigen
             </button>`
              : ''
          }
        </div>
        <div class="card-footer d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center">
            <div class="avatar">${authorInitial}</div>
            <span>${entry.author_name || 'Unbekannt'}</span>
          </div>
          <small>${formattedDate}</small>
        </div>
      </div>
    `;

    container.appendChild(col);
  });

  // Add event listeners to buttons
  document.querySelectorAll('.view-entry-btn').forEach((btn) => {
    btn.addEventListener('click', function () {
      const entryId = this.getAttribute('data-id');
      viewEntry(entryId);
    });
  });

  document.querySelectorAll('.confirm-entry-btn').forEach((btn) => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const entryId = this.getAttribute('data-id');
      confirmEntry(entryId);
    });
  });

  // Show entries container and pagination
  container.classList.remove('d-none');
  const paginationContainer = document.getElementById('paginationContainer');
  if (paginationContainer) {
    paginationContainer.classList.remove('d-none');
  }
}

/**
 * Update pagination controls
 */
function updatePagination(pagination) {
  const paginationElement = document.getElementById('pagination');
  paginationElement.innerHTML = '';

  if (pagination.totalPages <= 1) {
    return;
  }

  // Previous button
  const prevLi = document.createElement('li');
  prevLi.className = `page-item ${pagination.page === 1 ? 'disabled' : ''}`;
  prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous">
                         <span aria-hidden="true">&laquo;</span>
                       </a>`;
  paginationElement.appendChild(prevLi);

  if (pagination.page > 1) {
    prevLi.addEventListener('click', (e) => {
      e.preventDefault();
      currentPage--;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        loadEntries();
      }
    });
  }

  // Page numbers
  const startPage = Math.max(1, pagination.page - 2);
  const endPage = Math.min(pagination.totalPages, pagination.page + 2);

  for (let i = startPage; i <= endPage; i++) {
    const pageLi = document.createElement('li');
    pageLi.className = `page-item ${i === pagination.page ? 'active' : ''}`;
    pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;

    if (i !== pagination.page) {
      pageLi.addEventListener('click', (e) => {
        e.preventDefault();
        currentPage = i;

        // Nur laden, wenn es aktiviert wurde
        if (entriesLoadingEnabled) {
          loadEntries();
        }
      });
    }

    paginationElement.appendChild(pageLi);
  }

  // Next button
  const nextLi = document.createElement('li');
  nextLi.className = `page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`;
  nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next">
                         <span aria-hidden="true">&raquo;</span>
                       </a>`;
  paginationElement.appendChild(nextLi);

  if (pagination.page < pagination.totalPages) {
    nextLi.addEventListener('click', (e) => {
      e.preventDefault();
      currentPage++;

      // Nur laden, wenn es aktiviert wurde
      if (entriesLoadingEnabled) {
        loadEntries();
      }
    });
  }
}

/**
 * View a specific entry
 */
async function viewEntry(entryId) {
  try {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    // Fetch entry details with authentication
    const response = await fetch(`/api/blackboard/${entryId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/pages/login.html';
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to load entry details');
    }

    const entry = await response.json();

    // Format date
    const createdDate = new Date(entry.created_at);
    const formattedDate = `${createdDate.toLocaleDateString(
      'de-DE'
    )} ${createdDate.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    // Prepare level text
    let levelText = 'Unbekannt';
    if (entry.org_level === 'company') {
      levelText = 'Firma (alle Mitarbeiter)';
    } else if (entry.org_level === 'department') {
      levelText = `Abteilung (ID: ${entry.org_id})`;
    } else if (entry.org_level === 'team') {
      levelText = `Team (ID: ${entry.org_id})`;
    }

    // Prepare priority text and class
    let priorityText = 'Normal';
    let priorityClass = 'text-primary';

    if (entry.priority === 'low') {
      priorityText = 'Niedrig';
      priorityClass = 'text-success';
    } else if (entry.priority === 'high') {
      priorityText = 'Hoch';
      priorityClass = 'text-warning';
    } else if (entry.priority === 'urgent') {
      priorityText = 'Dringend';
      priorityClass = 'text-danger';
    }

    // Render entry content with markdown
    const renderedContent = marked.parse(entry.content);

    // Build detail view
    const detailContent = document.getElementById('entryDetailContent');
    detailContent.innerHTML = `
      <div class="entry-detail-header">
        <h3>${entry.title}</h3>
        <div class="entry-detail-meta">
          <div class="avatar">${entry.author_name ? entry.author_name.charAt(0).toUpperCase() : '?'}</div>
          <span>${entry.author_name || 'Unbekannt'} • ${formattedDate}</span>
        </div>
      </div>
      
      <div class="entry-metadata">
        <div class="entry-metadata-item">
          <i class="fas fa-layer-group"></i> ${levelText}
        </div>
        <div class="entry-metadata-item">
          <i class="fas fa-flag"></i> <span class="${priorityClass}">${priorityText}</span>
        </div>
        ${
          entry.expires_at
            ? `
        <div class="entry-metadata-item">
          <i class="fas fa-calendar-times"></i> Gültig bis: ${new Date(entry.expires_at).toLocaleDateString('de-DE')}
        </div>
        `
            : ''
        }
        ${
          entry.requires_confirmation
            ? `
        <div class="entry-metadata-item">
          <i class="fas fa-check-circle"></i> Lesebestätigung: ${
            entry.is_confirmed
              ? '<span class="text-success">Bestätigt</span>'
              : '<span class="text-danger">Nicht bestätigt</span>'
          }
        </div>
        `
            : ''
        }
      </div>
      
      <div class="entry-detail-content">
        ${renderedContent}
      </div>
    `;

    // Prepare footer buttons
    const detailFooter = document.getElementById('entryDetailFooter');

    // Clear existing dynamic buttons
    const existingButtons = detailFooter.querySelectorAll(
      'button:not(.btn-secondary)'
    );
    existingButtons.forEach((button) => button.remove());

    // Add confirmation button if needed
    if (entry.requires_confirmation && !entry.is_confirmed) {
      const confirmButton = document.createElement('button');
      confirmButton.type = 'button';
      confirmButton.className = 'btn btn-success';
      confirmButton.textContent = 'Als gelesen bestätigen';
      confirmButton.addEventListener('click', () => {
        confirmEntry(entry.id);
      });

      detailFooter.insertBefore(confirmButton, detailFooter.firstChild);
    }

    // Add edit/delete buttons for admin or author
    if (isAdmin || entry.author_id === currentUserId) {
      // Edit button
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'btn btn-primary me-2';
      editButton.textContent = 'Bearbeiten';
      editButton.addEventListener('click', () => {
        // Close detail modal and open edit form
        window.DashboardUI.closeModal('entryDetailModal');
        openEntryForm(entry);
      });

      // Delete button
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn btn-danger me-2';
      deleteButton.textContent = 'Löschen';
      deleteButton.addEventListener('click', () => {
        // Close detail modal and show delete confirmation
        window.DashboardUI.closeModal('entryDetailModal');
        showDeleteConfirmation(entry.id);
      });

      detailFooter.insertBefore(deleteButton, detailFooter.firstChild);
      detailFooter.insertBefore(editButton, detailFooter.firstChild);
    }

    // Add view confirmations button for admin
    if (isAdmin && entry.requires_confirmation) {
      const viewConfirmationsButton = document.createElement('button');
      viewConfirmationsButton.type = 'button';
      viewConfirmationsButton.className = 'btn btn-info me-2';
      viewConfirmationsButton.textContent = 'Lesebestätigungen anzeigen';
      viewConfirmationsButton.addEventListener('click', () => {
        // Close detail modal and show confirmations
        window.DashboardUI.closeModal('entryDetailModal');
        viewConfirmationStatus(entry.id);
      });

      detailFooter.insertBefore(
        viewConfirmationsButton,
        detailFooter.firstChild
      );
    }

    // Show modal
    window.DashboardUI.openModal('entryDetailModal');
  } catch (error) {
    console.error('Error loading entry details:', error);
    showToast('error', 'Fehler beim Laden der Eintragsdetails.');
  }
}

/**
 * Open entry form for create/edit
 */
function openEntryForm(entry = null) {
  const _formModal = document.getElementById('entryFormModal');
  const modalTitle = document.getElementById('entryFormModalLabel');
  const entryForm = document.getElementById('entryForm');

  // Reset form
  entryForm.reset();
  document.getElementById('entryOrgId').disabled = true;

  // Reset color selection
  document
    .querySelectorAll('.color-option')
    .forEach((option) => option.classList.remove('active'));
  document
    .querySelector('.color-option[data-color="blue"]')
    .classList.add('active');

  // Set form title and populate if editing
  if (entry) {
    modalTitle.textContent = 'Eintrag bearbeiten';

    // Populate form fields
    document.getElementById('entryId').value = entry.id;
    document.getElementById('entryTitle').value = entry.title;
    document.getElementById('entryContent').value = entry.content;
    document.getElementById('entryPriority').value = entry.priority;
    document.getElementById('entryRequiresConfirmation').checked =
      entry.requires_confirmation;

    if (entry.expires_at) {
      // Convert to YYYY-MM-DD format for date input
      const expiryDate = new Date(entry.expires_at);
      const formattedDate = expiryDate.toISOString().split('T')[0];
      document.getElementById('entryExpiresAt').value = formattedDate;
    }

    // Set color selection
    if (entry.color) {
      document
        .querySelectorAll('.color-option')
        .forEach((option) => option.classList.remove('active'));
      const colorOption = document.querySelector(
        `.color-option[data-color="${entry.color}"]`
      );
      if (colorOption) {
        colorOption.classList.add('active');
      }
    }

    // Load and set tags
    loadEntryTags(entry.id);

    // Set organization level and populate org id dropdown
    document.getElementById('entryOrgLevel').value = entry.org_level;
    updateOrgIdDropdown(entry.org_level, entry.org_id);
  } else {
    modalTitle.textContent = 'Neuer Eintrag';
    document.getElementById('entryId').value = '';
    document.getElementById('entryTags').value = '';
  }

  // Show modal
  const _modal = document.getElementById('entryFormModal');
  _modal.style.opacity = '1';
  _modal.style.visibility = 'visible';
  _modal.classList.add('active');
}

/**
 * Update organization ID dropdown based on selected level
 */
async function updateOrgIdDropdown(level, selectedId = null) {
  const orgIdSelect = document.getElementById('entryOrgId');
  orgIdSelect.innerHTML = '';
  orgIdSelect.disabled = true;

  if (level === 'company') {
    // For company level, just add the current tenant
    const option = document.createElement('option');
    option.value = '1'; // Assuming tenant ID is 1
    option.textContent = 'Gesamte Firma';
    orgIdSelect.appendChild(option);
    orgIdSelect.disabled = false;
    return;
  }

  if (level === 'department') {
    // If departments aren't loaded yet, load them
    if (departments.length === 0) {
      await loadDepartmentsAndTeams();
    }

    // Add department options
    departments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.name;
      orgIdSelect.appendChild(option);
    });

    // If admin can see all departments, otherwise restrict to user's department
    if (!isAdmin && currentDepartmentId) {
      // Non-admin can only post to their own department
      orgIdSelect.value = currentDepartmentId;
      orgIdSelect.disabled = true;
    } else {
      orgIdSelect.disabled = false;
    }
  }

  if (level === 'team') {
    // If teams aren't loaded yet, load them
    if (teams.length === 0) {
      await loadDepartmentsAndTeams();
    }

    // Add team options
    teams.forEach((team) => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = team.name;
      orgIdSelect.appendChild(option);
    });

    // If admin can see all teams, otherwise restrict to user's team
    if (!isAdmin && currentTeamId) {
      // Non-admin can only post to their own team
      orgIdSelect.value = currentTeamId;
      orgIdSelect.disabled = true;
    } else {
      orgIdSelect.disabled = false;
    }
  }

  // Set selected value if provided
  if (selectedId) {
    orgIdSelect.value = selectedId;
  }
}

/**
 * Load departments and teams for dropdown
 */
async function loadDepartmentsAndTeams() {
  try {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    // Load departments
    const deptResponse = await fetch('/api/departments', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (deptResponse.ok) {
      const deptData = await deptResponse.json();
      departments = deptData;
    } else if (deptResponse.status === 401) {
      window.location.href = '/pages/login.html';
      throw new Error('Unauthorized');
    }

    // Load teams
    const teamResponse = await fetch('/api/teams', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (teamResponse.ok) {
      const teamData = await teamResponse.json();
      teams = teamData;
    } else if (teamResponse.status === 401) {
      window.location.href = '/pages/login.html';
      throw new Error('Unauthorized');
    }
  } catch (error) {
    console.error('Error loading departments and teams:', error);
    showToast('error', 'Fehler beim Laden der Abteilungen und Teams.');
  }
}

/**
 * Save entry (create or update)
 */
async function saveEntry() {
  try {
    // Validate form
    const entryForm = document.getElementById('entryForm');
    if (!entryForm.checkValidity()) {
      entryForm.reportValidity();
      return;
    }

    // Get form values
    const entryId = document.getElementById('entryId').value;
    const title = document.getElementById('entryTitle').value.trim();
    const content = document.getElementById('entryContent').value.trim();
    const orgLevel = document.getElementById('entryOrgLevel').value;
    const orgId = document.getElementById('entryOrgId').value;
    const priority = document.getElementById('entryPriority').value;
    const expiresAt = document.getElementById('entryExpiresAt').value || null;
    const requiresConfirmation = document.getElementById(
      'entryRequiresConfirmation'
    ).checked;

    // Get selected color
    const selectedColor = document.querySelector('.color-option.active');
    const color = selectedColor ? selectedColor.dataset.color : 'blue';

    // Get tags
    const tagsInput = document.getElementById('entryTags').value.trim();
    const tags = tagsInput
      ? tagsInput
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];

    // Prepare entry data
    const entryData = {
      title,
      content,
      org_level: orgLevel,
      org_id: parseInt(orgId, 10),
      priority,
      color,
      tags,
      expires_at: expiresAt,
      requires_confirmation: requiresConfirmation,
    };

    let url = '/api/blackboard';
    let method = 'POST';

    // If editing, use PUT method
    if (entryId) {
      url = `/api/blackboard/${entryId}`;
      method = 'PUT';
    }

    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    // Send request with authentication
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(entryData),
    });

    if (!response.ok) {
      throw new Error('Failed to save entry');
    }

    // Close modal and reload entries
    window.DashboardUI.closeModal('entryFormModal');
    loadEntries();

    // Show success message
    showToast(
      'success',
      entryId
        ? 'Eintrag erfolgreich aktualisiert.'
        : 'Neuer Eintrag erfolgreich erstellt.'
    );
  } catch (error) {
    console.error('Error saving entry:', error);
    showToast('error', 'Fehler beim Speichern des Eintrags.');
  }
}

/**
 * Delete an entry
 */
async function deleteEntry(entryId) {
  try {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    const response = await fetch(`/api/blackboard/${entryId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete entry');
    }

    // Reload entries
    loadEntries();

    // Show success message
    showToast('success', 'Eintrag erfolgreich gelöscht.');
  } catch (error) {
    console.error('Error deleting entry:', error);
    showToast('error', 'Fehler beim Löschen des Eintrags.');
  }
}

/**
 * Show delete confirmation modal
 */
function showDeleteConfirmation(entryId) {
  const _modal = document.getElementById('confirmationModal');
  const confirmBtn = document.getElementById('confirmActionBtn');

  // Set modal content
  document.getElementById('confirmationMessage').textContent =
    'Möchten Sie diesen Eintrag wirklich löschen?';
  document.getElementById('confirmationModalLabel').textContent =
    'Eintrag löschen';
  confirmBtn.textContent = 'Löschen';
  confirmBtn.className = 'btn btn-danger';

  // Set confirm action
  confirmBtn.onclick = function () {
    deleteEntry(entryId);
    window.DashboardUI.closeModal('confirmationModal');
  };

  // Show modal
  window.DashboardUI.openModal('confirmationModal');
}

/**
 * Confirm an entry as read
 */
async function confirmEntry(entryId) {
  try {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    const response = await fetch(`/api/blackboard/${entryId}/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to confirm entry');
    }

    // Reload entries
    loadEntries();

    // Close detail modal if open
    const detailModal = document.getElementById('entryDetailModal');
    if (detailModal.classList.contains('active')) {
      window.DashboardUI.closeModal('entryDetailModal');
    }

    // Show success message
    showToast('success', 'Eintrag erfolgreich als gelesen bestätigt.');
  } catch (error) {
    console.error('Error confirming entry:', error);
    showToast('error', 'Fehler bei der Lesebestätigung.');
  }
}

/**
 * View confirmation status for an entry
 */
async function viewConfirmationStatus(entryId) {
  try {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    const response = await fetch(`/api/blackboard/${entryId}/confirmations`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load confirmation status');
    }

    const confirmations = await response.json();

    // Calculate confirmation percentage
    const totalUsers = confirmations.length;
    const confirmedUsers = confirmations.filter(
      (user) => user.confirmed
    ).length;
    const confirmationPercentage =
      totalUsers > 0 ? Math.round((confirmedUsers / totalUsers) * 100) : 0;

    // Update progress bar
    const progressBar = document.getElementById('confirmationProgress');
    progressBar.style.width = `${confirmationPercentage}%`;
    progressBar.setAttribute('aria-valuenow', confirmationPercentage);
    progressBar.textContent = `${confirmationPercentage}%`;

    // Populate table
    const statusList = document.getElementById('confirmationStatusList');
    statusList.innerHTML = '';

    confirmations.forEach((user) => {
      const row = document.createElement('tr');

      // Format date
      const confirmedDate = user.confirmed_at
        ? `${new Date(user.confirmed_at).toLocaleDateString(
            'de-DE'
          )} ${new Date(user.confirmed_at).toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : '-';

      row.innerHTML = `
        <td>${user.first_name || ''} ${user.last_name || user.username}</td>
        <td>${user.email || '-'}</td>
        <td class="${user.confirmed ? 'confirmation-status-confirmed' : 'confirmation-status-pending'}">
          ${user.confirmed ? '<i class="fas fa-check-circle"></i> Bestätigt' : '<i class="fas fa-clock"></i> Ausstehend'}
        </td>
        <td>${confirmedDate}</td>
      `;

      statusList.appendChild(row);
    });

    // Show modal
    window.DashboardUI.openModal('confirmationStatusModal');
  } catch (error) {
    console.error('Error loading confirmation status:', error);
    showToast('error', 'Fehler beim Laden der Lesebestätigungen.');
  }
}

/**
 * Fetch current user data
 */
async function fetchUserData() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }

    const response = await fetch('/api/user/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/pages/login.html';
      throw new Error('No token found');
    }

    const response = await fetch('/api/auth/check', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Redirect to login page
      window.location.href = '/pages/login.html';
      throw new Error('User not logged in');
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking login status:', error);
    window.location.href = '/pages/login.html';
    throw error;
  }
}

/**
 * Load tags for a specific entry
 */
async function loadEntryTags(entryId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    const response = await fetch(`/api/blackboard/${entryId}/tags`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const tags = await response.json();
      const tagNames = tags.map((tag) => tag.name);
      document.getElementById('entryTags').value = tagNames.join(', ');
    }
  } catch (error) {
    console.error('Error loading entry tags:', error);
  }
}

/**
 * Show toast notification
 */
function showToast(type, message) {
  // Use dashboard UI toast for simplified approach
  window.DashboardUI.showToast(message, type);
}
