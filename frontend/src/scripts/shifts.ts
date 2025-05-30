/**
 * Shift Planning TypeScript
 * Handles all client-side functionality for the shift planning system
 */

import type { User } from '../types/api.types';
import { getAuthToken } from './auth';
import { showSuccess, showError, showInfo } from './auth';

interface ShiftPlan {
  id: number;
  name: string;
  department_id?: number;
  team_id?: number;
  start_date: string;
  end_date: string;
  status: 'draft' | 'published' | 'archived';
  created_by: number;
  created_at: string;
  updated_at: string;
  assignments?: ShiftAssignment[];
}

interface ShiftTemplate {
  id: number;
  name: string;
  description?: string;
  department_id?: number;
  shift_pattern: ShiftPattern[];
  created_by: number;
  created_at: string;
}

interface ShiftPattern {
  day_of_week: number;
  shift_type: 'early' | 'late' | 'night';
  start_time: string;
  end_time: string;
  required_employees: number;
}

interface ShiftAssignment {
  id: number;
  shift_plan_id: number;
  employee_id: number;
  date: string;
  shift_type: 'early' | 'late' | 'night';
  start_time: string;
  end_time: string;
  status: 'assigned' | 'confirmed' | 'completed';
  created_at: string;
  employee?: User;
}

interface ExchangeRequest {
  id: number;
  requester_id: number;
  target_id: number;
  shift_assignment_id: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface Department {
  id: number;
  name: string;
}

interface Team {
  id: number;
  name: string;
  department_id: number;
}

interface DashboardStats {
  totalShifts: number;
  upcomingShifts: number;
  openRequests: number;
  employeesOnShift: number;
}

// Global variables
let currentTab: string = 'overview';
let shiftPlans: ShiftPlan[] = [];
let shiftTemplates: ShiftTemplate[] = [];
let userDepartments: Department[] = [];
let userTeams: Team[] = [];
let currentUser: User | null = null;
let isAdmin: boolean = false;

// Initialize the shift planning interface
document.addEventListener('DOMContentLoaded', () => {
  initializeShiftPlanning();
  setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // Tab buttons
  document.querySelectorAll<HTMLButtonElement>('.tab-button').forEach((btn) => {
    btn.addEventListener('click', function () {
      const tabName = (this as HTMLElement).dataset.tab;
      if (tabName) {
        showTab(tabName);
      }
    });
  });

  // Action buttons
  const createShiftPlanBtn = document.getElementById('createShiftPlanBtn') as HTMLButtonElement;
  if (createShiftPlanBtn) {
    createShiftPlanBtn.addEventListener('click', createShiftPlan);
  }

  const createShiftTemplateBtn = document.getElementById('createShiftTemplateBtn') as HTMLButtonElement;
  if (createShiftTemplateBtn) {
    createShiftTemplateBtn.addEventListener('click', createShiftTemplate);
  }

  const createExchangeRequestBtn = document.getElementById('createExchangeRequestBtn') as HTMLButtonElement;
  if (createExchangeRequestBtn) {
    createExchangeRequestBtn.addEventListener('click', createExchangeRequest);
  }

  const setAvailabilityBtn = document.getElementById('setAvailabilityBtn') as HTMLButtonElement;
  if (setAvailabilityBtn) {
    setAvailabilityBtn.addEventListener('click', setAvailability);
  }

  // Filter elements
  document
    .querySelectorAll<HTMLSelectElement | HTMLInputElement>('.filter-select, .filter-date')
    .forEach((element) => {
      element.addEventListener('change', function () {
        const elementId = (this as HTMLElement).id;
        if (elementId.includes('plan')) {
          filterPlans();
        } else if (elementId.includes('assignment')) {
          filterAssignments();
        }
      });
    });

  // Modal close buttons
  document.querySelectorAll<HTMLButtonElement>('.modal-close, .modal-cancel').forEach((btn) => {
    btn.addEventListener('click', function () {
      const modalId = (this as HTMLElement).dataset.modal;
      if (modalId) {
        closeModal(modalId);
      }
    });
  });

  // Modal background click to close
  document.querySelectorAll<HTMLElement>('.modal').forEach((modal) => {
    modal.addEventListener('click', function (e: MouseEvent) {
      if (e.target === this) {
        closeModal(this.id);
      }
    });
  });
}

/**
 * Open modal
 */
function openModal(modalId: string): void {
  const modal = document.getElementById(modalId) as HTMLElement;
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Close modal
 */
function closeModal(modalId: string): void {
  const modal = document.getElementById(modalId) as HTMLElement;
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

/**
 * Initialize the shift planning interface
 */
async function initializeShiftPlanning(): Promise<void> {
  try {
    // Check authentication first
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/pages/login.html';
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
 * Load user info
 */
async function loadUserInfo(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/user/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      currentUser = await response.json();
      isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'root';
      
      // Update UI based on role
      updateUIForRole();
      
      // Update user display
      const userNameElement = document.getElementById('userName') as HTMLElement;
      if (userNameElement && currentUser) {
        userNameElement.textContent = currentUser.username;
      }
    } else {
      throw new Error('Failed to load user info');
    }
  } catch (error) {
    console.error('Error loading user info:', error);
    throw error;
  }
}

/**
 * Load dashboard statistics
 */
async function loadDashboardStats(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/shifts/stats', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const stats: DashboardStats = await response.json();
      updateDashboardStats(stats);
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

/**
 * Update dashboard stats display
 */
function updateDashboardStats(stats: DashboardStats): void {
  const elements = {
    totalShifts: document.getElementById('totalShifts'),
    upcomingShifts: document.getElementById('upcomingShifts'),
    openRequests: document.getElementById('openRequests'),
    employeesOnShift: document.getElementById('employeesOnShift'),
  };

  if (elements.totalShifts) elements.totalShifts.textContent = stats.totalShifts.toString();
  if (elements.upcomingShifts) elements.upcomingShifts.textContent = stats.upcomingShifts.toString();
  if (elements.openRequests) elements.openRequests.textContent = stats.openRequests.toString();
  if (elements.employeesOnShift) elements.employeesOnShift.textContent = stats.employeesOnShift.toString();
}

/**
 * Load shift templates
 */
async function loadShiftTemplates(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/shifts/templates', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      shiftTemplates = await response.json();
    }
  } catch (error) {
    console.error('Error loading shift templates:', error);
  }
}

/**
 * Load departments and teams
 */
async function loadDepartmentsAndTeams(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    // Load departments
    const deptResponse = await fetch('/api/departments', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (deptResponse.ok) {
      userDepartments = await deptResponse.json();
      populateDepartmentSelects();
    }

    // Load teams
    const teamResponse = await fetch('/api/teams', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (teamResponse.ok) {
      userTeams = await teamResponse.json();
      populateTeamSelects();
    }
  } catch (error) {
    console.error('Error loading departments and teams:', error);
  }
}

/**
 * Populate department select elements
 */
function populateDepartmentSelects(): void {
  const selects = document.querySelectorAll<HTMLSelectElement>('.department-select');
  
  selects.forEach((select) => {
    select.innerHTML = '<option value="">Alle Abteilungen</option>';
    
    userDepartments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = dept.id.toString();
      option.textContent = dept.name;
      select.appendChild(option);
    });
  });
}

/**
 * Populate team select elements
 */
function populateTeamSelects(): void {
  const selects = document.querySelectorAll<HTMLSelectElement>('.team-select');
  
  selects.forEach((select) => {
    select.innerHTML = '<option value="">Alle Teams</option>';
    
    userTeams.forEach((team) => {
      const option = document.createElement('option');
      option.value = team.id.toString();
      option.textContent = team.name;
      select.appendChild(option);
    });
  });
}

/**
 * Load overview data
 */
async function loadOverviewData(): Promise<void> {
  await Promise.all([
    loadShiftPlans(),
    loadMyAssignments(),
    loadExchangeRequests(),
  ]);
}

/**
 * Load shift plans
 */
async function loadShiftPlans(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/shifts/plans', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      shiftPlans = await response.json();
      displayShiftPlans();
    }
  } catch (error) {
    console.error('Error loading shift plans:', error);
  }
}

/**
 * Display shift plans
 */
function displayShiftPlans(): void {
  const container = document.getElementById('shiftPlansList') as HTMLElement;
  if (!container) return;

  if (shiftPlans.length === 0) {
    container.innerHTML = '<p class="no-data">Keine Schichtpläne vorhanden</p>';
    return;
  }

  container.innerHTML = shiftPlans.map((plan) => `
    <div class="shift-plan-card">
      <h3>${escapeHtml(plan.name)}</h3>
      <div class="plan-details">
        <span class="date-range">
          ${formatDate(plan.start_date)} - ${formatDate(plan.end_date)}
        </span>
        <span class="status status-${plan.status}">${getStatusText(plan.status)}</span>
      </div>
      <div class="plan-actions">
        <button class="btn btn-primary" onclick="viewShiftPlan(${plan.id})">
          <i class="fas fa-eye"></i> Ansehen
        </button>
        ${isAdmin ? `
          <button class="btn btn-secondary" onclick="editShiftPlan(${plan.id})">
            <i class="fas fa-edit"></i> Bearbeiten
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

/**
 * Load my assignments
 */
async function loadMyAssignments(): Promise<void> {
  if (!currentUser) return;

  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/shifts/my-assignments', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const assignments: ShiftAssignment[] = await response.json();
      displayMyAssignments(assignments);
    }
  } catch (error) {
    console.error('Error loading assignments:', error);
  }
}

/**
 * Display my assignments
 */
function displayMyAssignments(assignments: ShiftAssignment[]): void {
  const container = document.getElementById('myAssignmentsList') as HTMLElement;
  if (!container) return;

  if (assignments.length === 0) {
    container.innerHTML = '<p class="no-data">Keine Schichtzuweisungen vorhanden</p>';
    return;
  }

  container.innerHTML = assignments.map((assignment) => `
    <div class="assignment-card">
      <div class="assignment-date">
        <i class="fas fa-calendar"></i> ${formatDate(assignment.date)}
      </div>
      <div class="assignment-time">
        <i class="fas fa-clock"></i> ${assignment.start_time} - ${assignment.end_time}
      </div>
      <div class="assignment-type">
        <span class="shift-type shift-${assignment.shift_type}">${getShiftTypeText(assignment.shift_type)}</span>
      </div>
      ${assignment.status === 'assigned' ? `
        <button class="btn btn-sm btn-success" onclick="confirmAssignment(${assignment.id})">
          Bestätigen
        </button>
      ` : ''}
    </div>
  `).join('');
}

/**
 * Load exchange requests
 */
async function loadExchangeRequests(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/shifts/exchange-requests', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const requests: ExchangeRequest[] = await response.json();
      displayExchangeRequests(requests);
    }
  } catch (error) {
    console.error('Error loading exchange requests:', error);
  }
}

/**
 * Display exchange requests
 */
function displayExchangeRequests(requests: ExchangeRequest[]): void {
  const container = document.getElementById('exchangeRequestsList') as HTMLElement;
  if (!container) return;

  if (requests.length === 0) {
    container.innerHTML = '<p class="no-data">Keine Tauschanfragen vorhanden</p>';
    return;
  }

  container.innerHTML = requests.map((request) => `
    <div class="request-card">
      <div class="request-info">
        <p>Anfrage von Mitarbeiter ${request.requester_id}</p>
        ${request.reason ? `<p class="request-reason">${escapeHtml(request.reason)}</p>` : ''}
      </div>
      <div class="request-status">
        <span class="status status-${request.status}">${getRequestStatusText(request.status)}</span>
      </div>
      ${request.status === 'pending' && request.target_id === currentUser?.id ? `
        <div class="request-actions">
          <button class="btn btn-sm btn-success" onclick="approveRequest(${request.id})">
            Annehmen
          </button>
          <button class="btn btn-sm btn-danger" onclick="rejectRequest(${request.id})">
            Ablehnen
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

/**
 * Show tab
 */
function showTab(tabName: string): void {
  currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach((btn) => {
    const buttonElement = btn as HTMLElement;
    buttonElement.classList.toggle('active', buttonElement.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach((content) => {
    const element = content as HTMLElement;
    element.style.display = element.id === `${tabName}Tab` ? 'block' : 'none';
  });

  // Load tab-specific data
  switch (tabName) {
    case 'overview':
      loadOverviewData();
      break;
    case 'planning':
      if (isAdmin) loadPlanningData();
      break;
    case 'assignments':
      loadAssignmentsData();
      break;
    case 'requests':
      loadRequestsData();
      break;
    case 'reports':
      if (isAdmin) loadReportsData();
      break;
  }
}

/**
 * Setup date filters
 */
function setupDateFilters(): void {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Set default dates for filters
  const startDateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"][id*="Start"]');
  const endDateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"][id*="End"]');

  startDateInputs.forEach((input) => {
    input.value = formatDateForInput(today);
  });

  endDateInputs.forEach((input) => {
    input.value = formatDateForInput(nextMonth);
  });
}

/**
 * Update UI based on user role
 */
function updateUIForRole(): void {
  const adminElements = document.querySelectorAll<HTMLElement>('.admin-only');
  const employeeElements = document.querySelectorAll<HTMLElement>('.employee-only');

  if (isAdmin) {
    adminElements.forEach((el) => el.style.display = 'block');
    employeeElements.forEach((el) => el.style.display = 'none');
  } else {
    adminElements.forEach((el) => el.style.display = 'none');
    employeeElements.forEach((el) => el.style.display = 'block');
  }
}

/**
 * Create shift plan
 */
async function createShiftPlan(): Promise<void> {
  openModal('shiftPlanModal');
  // Implementation for creating shift plan
}

/**
 * Create shift template
 */
async function createShiftTemplate(): Promise<void> {
  openModal('templateModal');
  // Implementation for creating shift template
}

/**
 * Create exchange request
 */
async function createExchangeRequest(): Promise<void> {
  openModal('exchangeModal');
  // Implementation for creating exchange request
}

/**
 * Set availability
 */
async function setAvailability(): Promise<void> {
  openModal('availabilityModal');
  // Implementation for setting availability
}

/**
 * Filter plans
 */
function filterPlans(): void {
  // Implementation for filtering plans
}

/**
 * Filter assignments
 */
function filterAssignments(): void {
  // Implementation for filtering assignments
}

/**
 * Logout
 */
function logout(): void {
  localStorage.removeItem('token');
  window.location.href = '/pages/login.html';
}

// Placeholder functions for additional features
async function loadPlanningData(): Promise<void> {
  // Load planning specific data
}

async function loadAssignmentsData(): Promise<void> {
  // Load assignments specific data
}

async function loadRequestsData(): Promise<void> {
  // Load requests specific data
}

async function loadReportsData(): Promise<void> {
  // Load reports specific data
}

/**
 * View shift plan
 */
async function viewShiftPlan(planId: number): Promise<void> {
  // Implementation
  console.log('View shift plan:', planId);
}

/**
 * Edit shift plan
 */
async function editShiftPlan(planId: number): Promise<void> {
  // Implementation
  console.log('Edit shift plan:', planId);
}

/**
 * Confirm assignment
 */
async function confirmAssignment(assignmentId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`/api/shifts/assignments/${assignmentId}/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      showSuccess('Schichtzuweisung bestätigt');
      loadMyAssignments();
    } else {
      showError('Fehler beim Bestätigen der Schichtzuweisung');
    }
  } catch (error) {
    console.error('Error confirming assignment:', error);
    showError('Ein Fehler ist aufgetreten');
  }
}

/**
 * Approve exchange request
 */
async function approveRequest(requestId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`/api/shifts/exchange-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      showSuccess('Tauschanfrage angenommen');
      loadExchangeRequests();
    } else {
      showError('Fehler beim Annehmen der Tauschanfrage');
    }
  } catch (error) {
    console.error('Error approving request:', error);
    showError('Ein Fehler ist aufgetreten');
  }
}

/**
 * Reject exchange request
 */
async function rejectRequest(requestId: number): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`/api/shifts/exchange-requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      showSuccess('Tauschanfrage abgelehnt');
      loadExchangeRequests();
    } else {
      showError('Fehler beim Ablehnen der Tauschanfrage');
    }
  } catch (error) {
    console.error('Error rejecting request:', error);
    showError('Ein Fehler ist aufgetreten');
  }
}

// Utility functions
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE');
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStatusText(status: string): string {
  const statusMap: { [key: string]: string } = {
    draft: 'Entwurf',
    published: 'Veröffentlicht',
    archived: 'Archiviert',
  };
  return statusMap[status] || status;
}

function getShiftTypeText(type: string): string {
  const typeMap: { [key: string]: string } = {
    early: 'Frühschicht',
    late: 'Spätschicht',
    night: 'Nachtschicht',
  };
  return typeMap[type] || type;
}

function getRequestStatusText(status: string): string {
  const statusMap: { [key: string]: string } = {
    pending: 'Ausstehend',
    approved: 'Genehmigt',
    rejected: 'Abgelehnt',
  };
  return statusMap[status] || status;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  (window as any).viewShiftPlan = viewShiftPlan;
  (window as any).editShiftPlan = editShiftPlan;
  (window as any).confirmAssignment = confirmAssignment;
  (window as any).approveRequest = approveRequest;
  (window as any).rejectRequest = rejectRequest;
}