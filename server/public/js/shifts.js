/**
 * Shift Planning JavaScript
 * Handles all client-side functionality for the shift planning system
 */

// Global variables
let currentTab = 'overview';
let shiftPlans = [];
let shiftTemplates = [];
let userDepartments = [];
let userTeams = [];

// Initialize the shift planning interface
document.addEventListener('DOMContentLoaded', function() {
    initializeShiftPlanning();
    setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            showTab(tabName);
        });
    });
    
    // Action buttons
    const createShiftPlanBtn = document.getElementById('createShiftPlanBtn');
    if (createShiftPlanBtn) {
        createShiftPlanBtn.addEventListener('click', createShiftPlan);
    }
    
    const createShiftTemplateBtn = document.getElementById('createShiftTemplateBtn');
    if (createShiftTemplateBtn) {
        createShiftTemplateBtn.addEventListener('click', createShiftTemplate);
    }
    
    const createExchangeRequestBtn = document.getElementById('createExchangeRequestBtn');
    if (createExchangeRequestBtn) {
        createExchangeRequestBtn.addEventListener('click', createExchangeRequest);
    }
    
    const setAvailabilityBtn = document.getElementById('setAvailabilityBtn');
    if (setAvailabilityBtn) {
        setAvailabilityBtn.addEventListener('click', setAvailability);
    }
    
    // Filter elements
    document.querySelectorAll('.filter-select, .filter-date').forEach(element => {
        element.addEventListener('change', function() {
            if (this.id.includes('plan')) {
                filterPlans();
            } else if (this.id.includes('assignment')) {
                filterAssignments();
            }
        });
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.dataset.modal;
            if (modalId) {
                closeModal(modalId);
            }
        });
    });
    
    // Modal background click to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });
}

/**
 * Open modal
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close modal
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

/**
 * Initialize the shift planning interface
 */
async function initializeShiftPlanning() {
    try {
        // Check authentication first

        const token = getAuthToken();
        if (!token) {

            window.location.href = '/login.html';
            return;
        }

        // Load user info and permissions
        await loadUserInfo();
        
        // Load dashboard stats
        await loadDashboardStats();
        
        // Load initial data
        await loadShiftTemplates();
        await loadDepartmentsAndTeams();
        
        // Load overview tab data
        await loadOverviewData();
        
        // Set up date filters with default values
        setupDateFilters();

    } catch (error) {
        console.error('Error initializing shift planning:', error);
        showError('Fehler beim Laden der Schichtplanung');
    }
}

/**
 * Load dashboard statistics
 */
async function loadDashboardStats() {
    try {
        const response = await fetchWithAuth('/api/shifts/dashboard');
        const data = await response.json();
        
        if (response.ok) {
            // Update dashboard stats
            document.getElementById('totalShifts').textContent = data.stats.totalUpcomingShifts || 0;
            document.getElementById('assignedEmployees').textContent = data.upcomingShifts.length || 0;
            document.getElementById('pendingExchanges').textContent = data.stats.pendingExchanges || 0;
            document.getElementById('overtimeHours').textContent = '0'; // TODO: Implement overtime calculation
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

/**
 * Load overview tab data
 */
async function loadOverviewData() {
    try {
        const response = await fetchWithAuth('/api/shifts/dashboard');
        const data = await response.json();
        
        if (response.ok) {
            displayUpcomingShifts(data.upcomingShifts || []);
            displayWeeklyAvailability(data.availability || []);
            displayExchangeRequests(data.exchangeRequests || []);
        }
    } catch (error) {
        console.error('Error loading overview data:', error);
    }
}

/**
 * Display upcoming shifts
 */
function displayUpcomingShifts(shifts) {
    const container = document.getElementById('upcomingShifts');
    
    if (shifts.length === 0) {
        container.innerHTML = '<div class="no-data">Keine geplanten Schichten gefunden.</div>';
        return;
    }
    
    const shiftsHtml = shifts.map(shift => `
        <div class="shift-item">
            <div class="shift-item-left">
                <div class="shift-time-indicator" style="background: ${shift.template_color || '#3498db'}"></div>
                <div class="shift-item-info">
                    <h4>${shift.plan_name || 'Schicht'}</h4>
                    <div class="shift-item-meta">
                        ${formatDate(shift.date)} • ${shift.start_time} - ${shift.end_time}
                    </div>
                </div>
            </div>
            <div class="shift-item-right">
                <div class="shift-status ${shift.assignment_status || 'assigned'}">${translateStatus(shift.assignment_status)}</div>
                <div class="shift-item-meta">${shift.template_name || ''}</div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = shiftsHtml;
}

/**
 * Display weekly availability
 */
function displayWeeklyAvailability(availability) {
    const container = document.getElementById('weeklyAvailability');
    const today = new Date();
    const weekDays = [];
    
    // Generate this week's dates
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - today.getDay() + i);
        weekDays.push(date);
    }
    
    const availabilityHtml = weekDays.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayAvailability = availability.find(a => a.date === dateStr);
        const isAvailable = dayAvailability ? dayAvailability.availability_type === 'available' : true;
        
        return `
            <div class="availability-day ${isAvailable ? 'available' : 'unavailable'}" data-date="${dateStr}">
                <div class="availability-day-name">${getDayName(date.getDay())}</div>
                <div class="availability-day-date">${date.getDate()}.${date.getMonth() + 1}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = availabilityHtml;
    
    // Add event listeners for availability days
    container.querySelectorAll('.availability-day').forEach(dayElement => {
        dayElement.addEventListener('click', function() {
            const date = this.dataset.date;
            toggleAvailability(date);
        });
    });
}

/**
 * Display exchange requests
 */
function displayExchangeRequests(requests) {
    const container = document.getElementById('exchangeRequests');
    
    if (requests.length === 0) {
        container.innerHTML = '<div class="no-data">Keine offenen Tauschanfragen.</div>';
        return;
    }
    
    const requestsHtml = requests.map(request => `
        <div class="exchange-item">
            <div class="exchange-header">
                <div class="exchange-type ${request.exchange_type}">${translateExchangeType(request.exchange_type)}</div>
            </div>
            <div class="exchange-details">
                <strong>${request.requester_first_name} ${request.requester_last_name}</strong><br>
                ${formatDate(request.shift_date)} • ${request.start_time} - ${request.end_time}<br>
                ${request.shift_template_name || 'Schicht'}
                ${request.message ? `<br><em>"${request.message}"</em>` : ''}
            </div>
            <div class="exchange-actions">
                <button class="btn-accept" data-request-id="${request.id}" data-response="accepted">Annehmen</button>
                <button class="btn-decline" data-request-id="${request.id}" data-response="declined">Ablehnen</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = requestsHtml;
    
    // Add event listeners for exchange action buttons
    container.querySelectorAll('.btn-accept, .btn-decline').forEach(btn => {
        btn.addEventListener('click', function() {
            const requestId = this.dataset.requestId;
            const response = this.dataset.response;
            respondToExchange(requestId, response);
        });
    });
}

/**
 * Load shift templates
 */
async function loadShiftTemplates() {
    try {
        const response = await fetchWithAuth('/api/shifts/templates');
        const data = await response.json();
        
        if (response.ok) {
            shiftTemplates = data.templates || [];
            displayShiftTemplates();
        }
    } catch (error) {
        console.error('Error loading shift templates:', error);
    }
}

/**
 * Display shift templates
 */
function displayShiftTemplates() {
    const container = document.getElementById('shiftTemplatesList');
    
    if (shiftTemplates.length === 0) {
        container.innerHTML = '<div class="no-data">Keine Schichtvorlagen gefunden. Erstellen Sie eine neue Vorlage.</div>';
        return;
    }
    
    const templatesHtml = shiftTemplates.map(template => `
        <div class="template-card">
            <div class="template-color-indicator" style="background: ${template.color}"></div>
            <h4 class="template-card-title">${template.name}</h4>
            <div class="template-time">${template.start_time} - ${template.end_time}</div>
            <div class="template-duration">${template.duration_hours}h Arbeit, ${template.break_duration_minutes || 0}min Pause</div>
            ${template.description ? `<p style="margin-top: 0.5rem; color: var(--text-light); font-size: 14px;">${template.description}</p>` : ''}
        </div>
    `).join('');
    
    container.innerHTML = templatesHtml;
}

/**
 * Load departments and teams for filters
 */
async function loadDepartmentsAndTeams() {
    try {
        const [deptResponse, teamResponse] = await Promise.all([
            fetchWithAuth('/api/departments'),
            fetchWithAuth('/api/teams')
        ]);
        
        const deptData = await deptResponse.json();
        const teamData = await teamResponse.json();
        
        if (deptResponse.ok) {
            userDepartments = deptData.departments || [];
            populateDepartmentSelects();
        }
        
        if (teamResponse.ok) {
            userTeams = teamData.teams || [];
            populateTeamSelects();
        }
    } catch (error) {
        console.error('Error loading departments and teams:', error);
    }
}

/**
 * Populate department select elements
 */
function populateDepartmentSelects() {
    const selects = document.querySelectorAll('#planDepartmentFilter, #planDepartment');
    
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Alle Abteilungen</option>';
        
        userDepartments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.name;
            select.appendChild(option);
        });
        
        if (currentValue) select.value = currentValue;
    });
}

/**
 * Populate team select elements
 */
function populateTeamSelects() {
    const selects = document.querySelectorAll('#planTeam');
    
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Alle Teams</option>';
        
        userTeams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            select.appendChild(option);
        });
        
        if (currentValue) select.value = currentValue;
    });
}

/**
 * Setup date filters with default values
 */
function setupDateFilters() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const assignmentDateFilter = document.getElementById('assignmentDateFilter');
    if (assignmentDateFilter) {
        assignmentDateFilter.value = todayStr;
    }
}

/**
 * Show tab
 */
function showTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    currentTab = tabName;
    
    // Load tab-specific data
    switch (tabName) {
        case 'plans':
            loadShiftPlans();
            break;
        case 'templates':
            loadShiftTemplates();
            break;
        case 'assignments':
            loadAssignments();
            break;
        case 'exchange':
            loadExchangeRequests();
            break;
        case 'availability':
            loadAvailabilityCalendar();
            break;
    }
}

/**
 * Load shift plans
 */
async function loadShiftPlans() {
    try {
        const container = document.getElementById('shiftPlansList');
        container.innerHTML = '<div class="loading">Schichtpläne werden geladen...</div>';
        
        const response = await fetchWithAuth('/api/shifts/plans');
        const data = await response.json();
        
        if (response.ok) {
            shiftPlans = data.plans || [];
            displayShiftPlans();
        } else {
            container.innerHTML = '<div class="error">Fehler beim Laden der Schichtpläne</div>';
        }
    } catch (error) {
        console.error('Error loading shift plans:', error);
        document.getElementById('shiftPlansList').innerHTML = '<div class="error">Fehler beim Laden der Schichtpläne</div>';
    }
}

/**
 * Display shift plans
 */
function displayShiftPlans() {
    const container = document.getElementById('shiftPlansList');
    
    if (shiftPlans.length === 0) {
        container.innerHTML = '<div class="no-data">Keine Schichtpläne gefunden. Erstellen Sie einen neuen Plan.</div>';
        return;
    }
    
    const plansHtml = shiftPlans.map(plan => `
        <div class="plan-card" data-plan-id="${plan.id}">
            <div class="plan-card-header">
                <h4 class="plan-card-title">${plan.name}</h4>
                <span class="plan-status ${plan.status || 'draft'}">${translateStatus(plan.status)}</span>
            </div>
            <div class="plan-card-meta">
                ${formatDate(plan.start_date)} - ${formatDate(plan.end_date)}<br>
                ${plan.department_name || 'Alle Abteilungen'} ${plan.team_name ? `• ${plan.team_name}` : ''}
            </div>
            ${plan.description ? `<p style="margin-top: 0.5rem; color: var(--text-light); font-size: 14px;">${plan.description}</p>` : ''}
            <div class="plan-card-actions">
                <button class="edit-plan-btn" data-plan-id="${plan.id}">Bearbeiten</button>
                <button class="view-shifts-btn" data-plan-id="${plan.id}">Schichten anzeigen</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = plansHtml;
    
    // Add event listeners for plan cards and buttons
    container.querySelectorAll('.plan-card').forEach(card => {
        card.addEventListener('click', function(e) {
            // Don't trigger if clicking on action buttons
            if (e.target.closest('.plan-card-actions')) return;
            
            const planId = this.dataset.planId;
            viewShiftPlan(planId);
        });
    });
    
    container.querySelectorAll('.edit-plan-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const planId = this.dataset.planId;
            editShiftPlan(planId);
        });
    });
    
    container.querySelectorAll('.view-shifts-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const planId = this.dataset.planId;
            viewShifts(planId);
        });
    });
}

/**
 * Create shift plan
 */
function createShiftPlan() {
    document.getElementById('shiftPlanModalTitle').textContent = 'Neuer Schichtplan';
    document.getElementById('shiftPlanForm').reset();
    openModal('shiftPlanModal');
}

/**
 * Create shift template
 */
function createShiftTemplate() {
    document.getElementById('shiftTemplateModalTitle').textContent = 'Neue Schichtvorlage';
    document.getElementById('shiftTemplateForm').reset();
    openModal('shiftTemplateModal');
}

/**
 * Handle shift plan form submission
 */
document.getElementById('shiftPlanForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(this);
        const planData = Object.fromEntries(formData.entries());
        
        // Convert empty strings to null for optional fields
        if (!planData.department_id) planData.department_id = null;
        if (!planData.team_id) planData.team_id = null;
        if (!planData.description) planData.description = null;
        
        const response = await fetchWithAuth('/api/shifts/plans', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(planData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('Schichtplan erfolgreich erstellt');
            closeModal('shiftPlanModal');
            if (currentTab === 'plans') {
                loadShiftPlans();
            }
        } else {
            showError(result.message || 'Fehler beim Erstellen des Schichtplans');
        }
    } catch (error) {
        console.error('Error creating shift plan:', error);
        showError('Fehler beim Erstellen des Schichtplans');
    }
});

/**
 * Handle shift template form submission
 */
document.getElementById('shiftTemplateForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(this);
        const templateData = Object.fromEntries(formData.entries());
        
        // Calculate duration from start and end time if not provided
        if (!templateData.duration_hours && templateData.start_time && templateData.end_time) {
            templateData.duration_hours = calculateDuration(templateData.start_time, templateData.end_time);
        }
        
        const response = await fetchWithAuth('/api/shifts/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(templateData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('Schichtvorlage erfolgreich erstellt');
            closeModal('shiftTemplateModal');
            if (currentTab === 'templates') {
                loadShiftTemplates();
            }
        } else {
            showError(result.message || 'Fehler beim Erstellen der Schichtvorlage');
        }
    } catch (error) {
        console.error('Error creating shift template:', error);
        showError('Fehler beim Erstellen der Schichtvorlage');
    }
});

/**
 * Calculate duration between start and end time
 */
function calculateDuration(startTime, endTime) {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end - start;
    return diffMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Toggle availability for a specific date
 */
async function toggleAvailability(date) {
    try {
        const response = await fetchWithAuth('/api/shifts/availability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                date: date,
                availability_type: 'available' // TODO: Toggle between available/unavailable
            })
        });
        
        if (response.ok) {
            loadOverviewData(); // Refresh availability display
        }
    } catch (error) {
        console.error('Error updating availability:', error);
        showError('Fehler beim Aktualisieren der Verfügbarkeit');
    }
}

/**
 * Utility functions
 */
function getDayName(dayIndex) {
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return days[dayIndex];
}

function translateStatus(status) {
    const translations = {
        'draft': 'Entwurf',
        'published': 'Veröffentlicht',
        'archived': 'Archiviert',
        'assigned': 'Zugewiesen',
        'pending': 'Ausstehend',
        'accepted': 'Angenommen',
        'declined': 'Abgelehnt'
    };
    return translations[status] || status;
}

function translateExchangeType(type) {
    const translations = {
        'give_away': 'Abgeben',
        'swap': 'Tauschen',
        'request_coverage': 'Vertretung'
    };
    return translations[type] || type;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Placeholder functions for features to be implemented
function loadAssignments() {
    document.getElementById('assignmentsList').innerHTML = '<div class="no-data">Zuweisungen werden in der nächsten Version implementiert.</div>';
}

function loadExchangeRequests() {
    document.getElementById('exchangeRequestsList').innerHTML = '<div class="no-data">Tauschbörse wird in der nächsten Version implementiert.</div>';
}

function loadAvailabilityCalendar() {
    document.getElementById('availabilityCalendar').innerHTML = '<div class="no-data">Verfügbarkeitskalender wird in der nächsten Version implementiert.</div>';
}

function viewShiftPlan(planId) {

    // TODO: Implement shift plan details view
}

function editShiftPlan(planId) {

    // TODO: Implement shift plan editing
}

function viewShifts(planId) {

    // TODO: Implement shifts view
}

function createExchangeRequest() {

    // TODO: Implement exchange request creation
}

function setAvailability() {

    // TODO: Implement availability setting
}

function respondToExchange(requestId, response) {

    // TODO: Implement exchange response
}

function filterPlans() {

    // TODO: Implement plan filtering
}

function filterAssignments() {

    // TODO: Implement assignment filtering
}