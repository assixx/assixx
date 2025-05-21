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
let totalPages = 1;
let isAdmin = false;
let currentUserId = null;
let currentUserRole = null;
let currentDepartmentId = null;
let currentTeamId = null;

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in
  checkLoggedIn().then(() => {
    // Load user data
    fetchUserData().then(userData => {
      currentUserId = userData.id;
      currentUserRole = userData.role;
      currentDepartmentId = userData.department_id;
      currentTeamId = userData.team_id;
      isAdmin = userData.role === 'admin' || userData.role === 'root';
      
      // Show/hide "New Entry" button based on permissions
      document.getElementById('newEntryBtn').style.display = isAdmin ? 'block' : 'none';
      
      // Load departments and teams for form dropdowns
      loadDepartmentsAndTeams();
      
      // Load entries
      loadEntries();
    });
    
    // Setup event listeners
    setupEventListeners();
  });
});

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Filter by level
  document.querySelectorAll('input[name="levelFilter"]').forEach(radio => {
    radio.addEventListener('change', function() {
      currentFilter = this.value;
      currentPage = 1;
      loadEntries();
    });
  });
  
  // Sort entries
  document.getElementById('sortFilter').addEventListener('change', function() {
    currentSort = this.value;
    loadEntries();
  });
  
  // Search
  document.getElementById('searchButton').addEventListener('click', function() {
    currentSearch = document.getElementById('searchInput').value.trim();
    currentPage = 1;
    loadEntries();
  });
  
  document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      currentSearch = this.value.trim();
      currentPage = 1;
      loadEntries();
    }
  });
  
  // New entry button
  document.getElementById('newEntryBtn').addEventListener('click', function() {
    openEntryForm();
  });
  
  // Save entry button
  document.getElementById('saveEntryBtn').addEventListener('click', function() {
    saveEntry();
  });
  
  // Organization level change
  document.getElementById('entryOrgLevel').addEventListener('change', function() {
    updateOrgIdDropdown(this.value);
  });
}

/**
 * Load blackboard entries
 */
async function loadEntries() {
  try {
    // Show loading indicator
    document.getElementById('loadingIndicator').classList.remove('d-none');
    document.getElementById('blackboardEntries').classList.add('d-none');
    document.getElementById('noEntriesMessage').classList.add('d-none');
    
    // Parse sort option
    const [sortBy, sortDir] = currentSort.split('|');
    
    // Fetch entries
    const response = await fetch(`/api/blackboard?page=${currentPage}&filter=${currentFilter}&search=${encodeURIComponent(currentSearch)}&sortBy=${sortBy}&sortDir=${sortDir}`);
    
    if (!response.ok) {
      throw new Error('Failed to load entries');
    }
    
    const data = await response.json();
    
    // Update pagination
    totalPages = data.pagination.totalPages;
    updatePagination(data.pagination);
    
    // Display entries
    displayEntries(data.entries);
  } catch (error) {
    console.error('Error loading entries:', error);
    showToast('error', 'Fehler beim Laden der Einträge.');
  } finally {
    // Hide loading indicator
    document.getElementById('loadingIndicator').classList.add('d-none');
  }
}

/**
 * Display entries in the UI
 */
function displayEntries(entries) {
  const container = document.getElementById('blackboardEntries');
  container.innerHTML = '';
  
  if (entries.length === 0) {
    document.getElementById('noEntriesMessage').classList.remove('d-none');
    return;
  }
  
  entries.forEach(entry => {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4';
    
    // Format content preview (strip HTML and limit length)
    let contentPreview = entry.content.replace(/<\/?[^>]+(>|$)/g, '');
    if (contentPreview.length > 150) {
      contentPreview = contentPreview.substring(0, 147) + '...';
    }
    
    // Format date
    const createdDate = new Date(entry.created_at);
    const formattedDate = createdDate.toLocaleDateString('de-DE') + ' ' + 
                           createdDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    
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
    const unreadBadge = entry.requires_confirmation && !entry.is_confirmed ? 
      '<span class="badge unread-badge ms-2">Ungelesen</span>' : '';
    
    // Prepare author initial for avatar
    const authorInitial = entry.author_name ? entry.author_name.charAt(0).toUpperCase() : '?';
    
    col.innerHTML = `
      <div class="card blackboard-card priority-${entry.priority} ${entry.requires_confirmation && !entry.is_confirmed ? 'unread' : ''}">
        <div class="card-body">
          <h5 class="card-title">${entry.title} ${unreadBadge}</h5>
          <div class="mb-2">${levelBadge}</div>
          <p class="card-text">${contentPreview}</p>
          <button class="btn btn-sm btn-primary view-entry-btn" data-id="${entry.id}">
            Details anzeigen
          </button>
          ${entry.requires_confirmation && !entry.is_confirmed ? 
            `<button class="btn btn-sm btn-outline-success ms-2 confirm-entry-btn" data-id="${entry.id}">
               Als gelesen bestätigen
             </button>` : ''}
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
  document.querySelectorAll('.view-entry-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const entryId = this.getAttribute('data-id');
      viewEntry(entryId);
    });
  });
  
  document.querySelectorAll('.confirm-entry-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const entryId = this.getAttribute('data-id');
      confirmEntry(entryId);
    });
  });
  
  // Show entries container
  container.classList.remove('d-none');
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
    prevLi.addEventListener('click', function(e) {
      e.preventDefault();
      currentPage--;
      loadEntries();
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
      pageLi.addEventListener('click', function(e) {
        e.preventDefault();
        currentPage = i;
        loadEntries();
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
    nextLi.addEventListener('click', function(e) {
      e.preventDefault();
      currentPage++;
      loadEntries();
    });
  }
}

/**
 * View a specific entry
 */
async function viewEntry(entryId) {
  try {
    // Fetch entry details
    const response = await fetch(`/api/blackboard/${entryId}`);
    
    if (!response.ok) {
      throw new Error('Failed to load entry details');
    }
    
    const entry = await response.json();
    
    // Format date
    const createdDate = new Date(entry.created_at);
    const formattedDate = createdDate.toLocaleDateString('de-DE') + ' ' + 
                           createdDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    
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
        ${entry.expires_at ? `
        <div class="entry-metadata-item">
          <i class="fas fa-calendar-times"></i> Gültig bis: ${new Date(entry.expires_at).toLocaleDateString('de-DE')}
        </div>
        ` : ''}
        ${entry.requires_confirmation ? `
        <div class="entry-metadata-item">
          <i class="fas fa-check-circle"></i> Lesebestätigung: ${entry.is_confirmed ? 
            '<span class="text-success">Bestätigt</span>' : 
            '<span class="text-danger">Nicht bestätigt</span>'}
        </div>
        ` : ''}
      </div>
      
      <div class="entry-detail-content">
        ${renderedContent}
      </div>
    `;
    
    // Prepare footer buttons
    const detailFooter = document.getElementById('entryDetailFooter');
    
    // Clear existing dynamic buttons
    const existingButtons = detailFooter.querySelectorAll('button:not(.btn-secondary)');
    existingButtons.forEach(button => button.remove());
    
    // Add confirmation button if needed
    if (entry.requires_confirmation && !entry.is_confirmed) {
      const confirmButton = document.createElement('button');
      confirmButton.type = 'button';
      confirmButton.className = 'btn btn-success';
      confirmButton.textContent = 'Als gelesen bestätigen';
      confirmButton.addEventListener('click', function() {
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
      editButton.addEventListener('click', function() {
        // Close detail modal and open edit form
        bootstrap.Modal.getInstance(document.getElementById('entryDetailModal')).hide();
        openEntryForm(entry);
      });
      
      // Delete button
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn btn-danger me-2';
      deleteButton.textContent = 'Löschen';
      deleteButton.addEventListener('click', function() {
        // Close detail modal and show delete confirmation
        bootstrap.Modal.getInstance(document.getElementById('entryDetailModal')).hide();
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
      viewConfirmationsButton.addEventListener('click', function() {
        // Close detail modal and show confirmations
        bootstrap.Modal.getInstance(document.getElementById('entryDetailModal')).hide();
        viewConfirmationStatus(entry.id);
      });
      
      detailFooter.insertBefore(viewConfirmationsButton, detailFooter.firstChild);
    }
    
    // Show modal
    const detailModal = new bootstrap.Modal(document.getElementById('entryDetailModal'));
    detailModal.show();
  } catch (error) {
    console.error('Error loading entry details:', error);
    showToast('error', 'Fehler beim Laden der Eintragsdetails.');
  }
}

/**
 * Open entry form for create/edit
 */
function openEntryForm(entry = null) {
  const formModal = document.getElementById('entryFormModal');
  const modalTitle = document.getElementById('entryFormModalLabel');
  const entryForm = document.getElementById('entryForm');
  
  // Reset form
  entryForm.reset();
  document.getElementById('entryOrgId').disabled = true;
  
  // Set form title and populate if editing
  if (entry) {
    modalTitle.textContent = 'Eintrag bearbeiten';
    
    // Populate form fields
    document.getElementById('entryId').value = entry.id;
    document.getElementById('entryTitle').value = entry.title;
    document.getElementById('entryContent').value = entry.content;
    document.getElementById('entryPriority').value = entry.priority;
    document.getElementById('entryRequiresConfirmation').checked = entry.requires_confirmation;
    
    if (entry.expires_at) {
      // Convert to YYYY-MM-DD format for date input
      const expiryDate = new Date(entry.expires_at);
      const formattedDate = expiryDate.toISOString().split('T')[0];
      document.getElementById('entryExpiresAt').value = formattedDate;
    }
    
    // Set organization level and populate org id dropdown
    document.getElementById('entryOrgLevel').value = entry.org_level;
    updateOrgIdDropdown(entry.org_level, entry.org_id);
  } else {
    modalTitle.textContent = 'Neuer Eintrag';
    document.getElementById('entryId').value = '';
  }
  
  // Show modal
  const modal = new bootstrap.Modal(formModal);
  modal.show();
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
    departments.forEach(dept => {
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
    teams.forEach(team => {
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
    // Load departments
    const deptResponse = await fetch('/api/departments');
    if (deptResponse.ok) {
      const deptData = await deptResponse.json();
      departments = deptData;
    }
    
    // Load teams
    const teamResponse = await fetch('/api/teams');
    if (teamResponse.ok) {
      const teamData = await teamResponse.json();
      teams = teamData;
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
    const requiresConfirmation = document.getElementById('entryRequiresConfirmation').checked;
    
    // Prepare entry data
    const entryData = {
      title,
      content,
      org_level: orgLevel,
      org_id: parseInt(orgId, 10),
      priority,
      expires_at: expiresAt,
      requires_confirmation: requiresConfirmation
    };
    
    let url = '/api/blackboard';
    let method = 'POST';
    
    // If editing, use PUT method
    if (entryId) {
      url = `/api/blackboard/${entryId}`;
      method = 'PUT';
    }
    
    // Send request
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entryData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save entry');
    }
    
    // Close modal and reload entries
    bootstrap.Modal.getInstance(document.getElementById('entryFormModal')).hide();
    loadEntries();
    
    // Show success message
    showToast('success', entryId ? 'Eintrag erfolgreich aktualisiert.' : 'Neuer Eintrag erfolgreich erstellt.');
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
    const response = await fetch(`/api/blackboard/${entryId}`, {
      method: 'DELETE'
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
  const modal = document.getElementById('confirmationModal');
  const confirmBtn = document.getElementById('confirmActionBtn');
  
  // Set modal content
  document.getElementById('confirmationMessage').textContent = 'Möchten Sie diesen Eintrag wirklich löschen?';
  document.getElementById('confirmationModalLabel').textContent = 'Eintrag löschen';
  confirmBtn.textContent = 'Löschen';
  confirmBtn.className = 'btn btn-danger';
  
  // Set confirm action
  confirmBtn.onclick = function() {
    deleteEntry(entryId);
    bootstrap.Modal.getInstance(modal).hide();
  };
  
  // Show modal
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
}

/**
 * Confirm an entry as read
 */
async function confirmEntry(entryId) {
  try {
    const response = await fetch(`/api/blackboard/${entryId}/confirm`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to confirm entry');
    }
    
    // Reload entries
    loadEntries();
    
    // Close detail modal if open
    const detailModal = document.getElementById('entryDetailModal');
    if (detailModal.classList.contains('show')) {
      bootstrap.Modal.getInstance(detailModal).hide();
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
    const response = await fetch(`/api/blackboard/${entryId}/confirmations`);
    
    if (!response.ok) {
      throw new Error('Failed to load confirmation status');
    }
    
    const confirmations = await response.json();
    
    // Calculate confirmation percentage
    const totalUsers = confirmations.length;
    const confirmedUsers = confirmations.filter(user => user.confirmed).length;
    const confirmationPercentage = totalUsers > 0 ? Math.round((confirmedUsers / totalUsers) * 100) : 0;
    
    // Update progress bar
    const progressBar = document.getElementById('confirmationProgress');
    progressBar.style.width = `${confirmationPercentage}%`;
    progressBar.setAttribute('aria-valuenow', confirmationPercentage);
    progressBar.textContent = `${confirmationPercentage}%`;
    
    // Populate table
    const statusList = document.getElementById('confirmationStatusList');
    statusList.innerHTML = '';
    
    confirmations.forEach(user => {
      const row = document.createElement('tr');
      
      // Format date
      const confirmedDate = user.confirmed_at ? 
        new Date(user.confirmed_at).toLocaleDateString('de-DE') + ' ' + 
        new Date(user.confirmed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '-';
      
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
    const modal = new bootstrap.Modal(document.getElementById('confirmationStatusModal'));
    modal.show();
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
    const response = await fetch('/api/user/profile');
    
    if (!response.ok) {
      throw new Error('Failed to load user data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user data:', error);
    return { role: 'employee' };
  }
}

/**
 * Check if user is logged in
 */
async function checkLoggedIn() {
  try {
    const response = await fetch('/api/auth/check');
    
    if (!response.ok) {
      // Redirect to login page
      window.location.href = '/login.html';
      throw new Error('User not logged in');
    }
  } catch (error) {
    console.error('Error checking login status:', error);
    window.location.href = '/login.html';
  }
}

/**
 * Show toast notification
 */
function showToast(type, message) {
  // Check if we have a toast container
  let toastContainer = document.querySelector('.toast-container');
  
  if (!toastContainer) {
    // Create toast container
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast
  const toastId = 'toast-' + Date.now();
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
  toast.id = toastId;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Show toast
  const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
  bsToast.show();
  
  // Remove toast after it's hidden
  toast.addEventListener('hidden.bs.toast', function() {
    toast.remove();
  });
}