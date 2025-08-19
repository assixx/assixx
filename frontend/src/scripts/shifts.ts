/**
 * New Shift Planning System - TypeScript Implementation
 * Interactive weekly shift planning with drag & drop functionality
 */

import type { User } from '../types/api.types';
import { ApiClient } from '../utils/api-client';
import { mapTeams, mapUsers, type TeamAPIResponse, type UserAPIResponse } from '../utils/api-mappers';
import { $$id, createElement } from '../utils/dom-utils';

import { getAuthToken, showSuccess, showError, showInfo } from './auth';
import { showSuccessAlert, showErrorAlert } from './utils/alerts';
import { openModal } from './utils/modal-manager';

interface Employee extends User {
  department_id?: number;
  team_id?: number;
  shift_assignments?: ShiftAssignment[];
  availability_status?: 'available' | 'unavailable' | 'vacation' | 'sick';
}

interface ShiftAssignment {
  id: number;

  employee_id: number;

  date: string;
  shift_type: 'early' | 'late' | 'night';
  department_id?: number;
  machine_id?: number;
  team_leader_id?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Area {
  id: number;
  name: string;
  description?: string;
  type?: string;
}

interface Department {
  id: number;
  name: string;
  description?: string;
  area_id?: number;
}

interface Machine {
  id: number;
  name: string;
  department_id: number;
  area_id?: number;
  description?: string;
}

interface Team {
  id: number;
  name: string;
  department_id: number;
  team_lead_id?: number;
  description?: string;
  members?: TeamMember[];
}

interface TeamMember {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: 'member' | 'lead';
}

interface TeamLeader {
  id: number;
  name: string;
  username: string;
}

interface SelectedContext {
  areaId: number | null; // NEU!
  departmentId: number | null;
  machineId: number | null;
  teamId: number | null;
  teamLeaderId: number | null;
}

interface ShiftsWindow extends Window {
  selectOption: (type: string, value: string, text: string) => void;
}

// CSS Selectors Constants
const CSS_SELECTORS = {
  EMPLOYEE_ITEM: '.employee-item',
  SHIFT_CELL: '.shift-cell',
  EMPLOYEE_ASSIGNMENT: '.employee-assignment',
  SHIFT_HEADER: '.shift-header',
} as const;

// DOM Element IDs
const DOM_IDS = {
  WEEKLY_NOTES: '#weeklyNotes',
  CURRENT_WEEK_INFO: '#currentWeekInfo',
  NOTES_TOGGLE: '#notesToggle',
  NOTES_PANEL: '#notesPanel',
  USER_NAME: '#userName',
  CURRENT_DEPARTMENT: '#currentDepartment',
  CURRENT_TEAM_LEADER: '#currentTeamLeader',
  PREV_WEEK_BTN: '#prevWeekBtn',
  NEXT_WEEK_BTN: '#nextWeekBtn',
  SAVE_SCHEDULE_BTN: '#saveScheduleBtn',
  RESET_SCHEDULE_BTN: '#resetScheduleBtn',
  AREA_SELECT: '#areaSelect',
  DEPARTMENT_SELECT: '#departmentSelect',
  TEAM_SELECT: '#teamSelect',
} as const;

// CSS Classes to avoid duplicate strings
const CSS_CLASSES = {
  DROPDOWN_OPTION: 'dropdown-option',
  EMPLOYEE_NAME: 'employee-name',
} as const;

// Error Messages
const ERROR_MESSAGES = {
  SHIFT_ASSIGNMENT_FAILED: 'Fehler beim Zuweisen der Schicht',
} as const;

class ShiftPlanningSystem {
  private apiClient: ApiClient;
  private useV2API: boolean;
  private currentWeek: Date;
  private selectedEmployee: Employee | null;
  private employees: Employee[];
  private weeklyShifts: Map<string, Map<string, number[]>>;
  private shiftDetails: Map<
    string,
    {
      employee_id: number;
      first_name: string;
      last_name: string;
      username: string;
    }
  >;
  private isAdmin: boolean;
  private userRole: string;
  private currentUserId: number | null;
  private isDragging: boolean;

  // Context data for shift planning
  private areas: Area[];
  private departments: Department[];
  private machines: Machine[];
  private teams: Team[];
  private teamLeaders: TeamLeader[];
  private selectedContext: SelectedContext;

  constructor() {
    // Initialize API client and check feature flag
    this.apiClient = ApiClient.getInstance();
    const w = window as Window & { FEATURE_FLAGS?: { USE_API_V2_SHIFTS?: boolean } };
    this.useV2API = w.FEATURE_FLAGS?.USE_API_V2_SHIFTS !== false;

    this.currentWeek = new Date();
    this.selectedEmployee = null;
    this.employees = [];
    this.weeklyShifts = new Map();
    this.shiftDetails = new Map();
    this.isAdmin = false;
    this.userRole = '';
    this.currentUserId = null;
    this.isDragging = false;

    // Context data for shift planning
    this.areas = [];
    this.departments = [];
    this.machines = [];
    this.teams = [];
    this.teamLeaders = [];
    this.selectedContext = {
      areaId: null,
      departmentId: null,
      machineId: null,
      teamId: null,
      teamLeaderId: null,
    };

    // weeklyNotes removed - notes are part of shifts in v2

    void this.init();
  }

  /**
   * Safe accessor for weeklyShifts to prevent Object Injection
   */
  private getShiftEmployees(date: string, shift: string): number[] {
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return [];
    }
    // Validate shift type
    const validShifts = ['early', 'late', 'night'] as const;
    if (!validShifts.includes(shift as (typeof validShifts)[number])) {
      return [];
    }

    // Get from nested Map structure
    const dateShifts = this.weeklyShifts.get(date);
    if (!dateShifts) {
      return [];
    }

    return dateShifts.get(shift) ?? [];
  }

  /**
   * Safe setter for weeklyShifts to prevent Object Injection
   */
  private setShiftEmployees(date: string, shift: string, employees: number[]): void {
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return;
    }
    // Validate shift type
    const validShifts = ['early', 'late', 'night'] as const;
    if (!validShifts.includes(shift as (typeof validShifts)[number])) {
      return;
    }

    // Initialize date Map if not exists
    if (!this.weeklyShifts.has(date)) {
      this.weeklyShifts.set(date, new Map());
    }

    // Set the shift data
    const dateShifts = this.weeklyShifts.get(date);
    if (dateShifts) {
      dateShifts.set(shift, employees);
    }
  }

  async init(): Promise<void> {
    console.info('[SHIFTS] Initializing Shift Planning System...');

    try {
      // Check user authentication and role
      console.info('[SHIFTS DEBUG] Checking user role...');
      await this.checkUserRole();
      console.info('[SHIFTS DEBUG] User role:', this.userRole, 'Is admin:', this.isAdmin);

      // Initialize event listeners
      console.info('[SHIFTS DEBUG] Setting up event listeners...');
      this.setupEventListeners();

      // Load context data
      console.info('[SHIFTS DEBUG] Loading context data...');
      await this.loadContextData();

      // Load initial data
      console.info('[SHIFTS DEBUG] Loading employees...');
      await this.loadEmployees();
      console.info('[SHIFTS DEBUG] Loaded employees:', this.employees.length);

      console.info('[SHIFTS DEBUG] Loading current week data...');
      await this.loadCurrentWeekData();

      console.info('[SHIFTS DEBUG] Loading weekly notes...');
      try {
        this.loadWeeklyNotes();
      } catch (error) {
        console.error('[SHIFTS ERROR] Failed to load weekly notes:', error);
      }

      // Update UI based on user role
      console.info('[SHIFTS DEBUG] Updating UI for role:', this.userRole);
      this.updateUIForRole();

      // Check if department is selected and toggle visibility
      this.togglePlanningAreaVisibility();

      // For employees, load department info
      if (!this.isAdmin && this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
        await this.loadDepartments();
      }

      // Load notes again after department is properly set
      if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
        console.info('[SHIFTS DEBUG] Loading notes after department is set:', this.selectedContext.departmentId);
        this.loadWeeklyNotes();
      }

      // Highlight employee's own shifts
      this.highlightEmployeeShifts();

      console.info('[SHIFTS] Shift Planning System initialized successfully');
    } catch (error) {
      console.error('[SHIFTS ERROR] Failed to initialize:', error);
    }
  }

  async checkUserRole(): Promise<void> {
    try {
      // First check localStorage for active role (for role switching)
      const activeRole = localStorage.getItem('activeRole');

      const user = await this.getStoredUserData();
      if (user) {
        // Use activeRole if available (for role switching), otherwise use API role or stored role
        this.userRole = activeRole ?? user.role;
        this.isAdmin = ['admin', 'root', 'manager', 'team_lead'].includes(this.userRole);
        this.currentUserId = user.id;

        const userNameElement = document.querySelector('#userName');
        if (userNameElement) {
          userNameElement.textContent = user.username;
        }

        // For employees, set their department as selected
        if (!this.isAdmin && user.department_id !== undefined && user.department_id !== 0) {
          this.selectedContext.departmentId = user.department_id;
          console.info('[SHIFTS DEBUG] Employee department auto-selected:', user.department_id);
        }

        // Update info row with user's department/team info
        const currentDeptElement = document.querySelector('#currentDepartment');
        if (currentDeptElement && user.department_id !== undefined && user.department_id !== 0) {
          currentDeptElement.textContent = `Department ${String(user.department_id)}`;
        }

        const currentTeamLeaderElement = document.querySelector('#currentTeamLeader');
        if (currentTeamLeaderElement && user.position !== undefined && user.position !== '') {
          currentTeamLeaderElement.textContent = user.username;
        }
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  }

  private async getStoredUserData(): Promise<User | null> {
    const token = getAuthToken();
    if (token === null || token === '') return null;

    try {
      const response = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return (await response.json()) as User;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }

    return null;
  }

  setupEventListeners(): void {
    console.info('[SHIFTS DEBUG] Setting up event listeners');

    // Week navigation
    const prevBtn = document.querySelector('#prevWeekBtn');
    const nextBtn = document.querySelector('#nextWeekBtn');

    console.info('[SHIFTS DEBUG] Previous week button:', prevBtn);
    console.info('[SHIFTS DEBUG] Next week button:', nextBtn);

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        console.info('[SHIFTS DEBUG] Previous week button clicked');
        this.navigateWeek(-1);
      });
    } else {
      console.error('[SHIFTS ERROR] Previous week button not found!');
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        console.info('[SHIFTS DEBUG] Next week button clicked');
        this.navigateWeek(1);
      });
    } else {
      console.error('[SHIFTS ERROR] Next week button not found!');
    }

    // Employee selection (fallback for non-drag interaction)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);
      if (employeeItem && !this.isDragging) {
        this.selectEmployee(employeeItem as HTMLElement);
      }
    });

    // Shift cell assignment (fallback for non-drag interaction)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const shiftCell = target.closest(CSS_SELECTORS.SHIFT_CELL);
      if (shiftCell && this.isAdmin && !this.isDragging) {
        this.assignEmployeeToShift(shiftCell as HTMLElement);
      } else if (shiftCell && !this.isAdmin && !this.isDragging) {
        // Show shift details modal for employees
        this.showShiftDetailsModal(shiftCell as HTMLElement);
      }
    });

    // Drag & Drop Events
    this.setupDragAndDrop();

    // Context selection events
    this.setupContextEvents();

    // Weekly notes functionality
    this.setupNotesEvents();

    // Admin actions
    document.querySelector('#saveScheduleBtn')?.addEventListener('click', () => {
      void this.saveSchedule();
    });
    document.querySelector('#resetScheduleBtn')?.addEventListener('click', () => {
      this.resetSchedule();
    });

    // Remove logout functionality - handled by unified navigation
  }

  setupDragAndDrop(): void {
    console.info('[SHIFTS DEBUG] Setting up drag and drop. Is admin:', this.isAdmin);
    if (!this.isAdmin) {
      console.info('[SHIFTS DEBUG] User is not admin, drag & drop disabled');
      return;
    }

    // Drag start on employee items
    document.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);

      if (employeeItem) {
        console.info('[SHIFTS DEBUG] Drag start on employee:', (employeeItem as HTMLElement).dataset.employeeId);

        // Check if employee is available for dragging
        if (employeeItem.getAttribute('draggable') === 'false') {
          console.info('[SHIFTS DEBUG] Employee not draggable, preventing drag');
          e.preventDefault();
          return;
        }

        this.isDragging = true;
        employeeItem.classList.add('dragging');

        const employeeId = (employeeItem as HTMLElement).dataset.employeeId;
        if (employeeId !== undefined && employeeId !== '' && e.dataTransfer) {
          console.info('[SHIFTS DEBUG] Setting drag data:', employeeId);
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', employeeId);
        }
      }
    });

    // Drag end
    document.addEventListener('dragend', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);

      if (employeeItem) {
        this.isDragging = false;
        employeeItem.classList.remove('dragging');
      }
    });

    // Drag over shift cells
    document.addEventListener('dragover', (e) => {
      const target = e.target as HTMLElement;
      const shiftCell = target.closest(CSS_SELECTORS.SHIFT_CELL);

      if (shiftCell) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
        shiftCell.classList.add('drag-over');
      }
    });

    // Drag leave
    document.addEventListener('dragleave', (e) => {
      const target = e.target as HTMLElement;
      const shiftCell = target.closest(CSS_SELECTORS.SHIFT_CELL);

      if (shiftCell) {
        shiftCell.classList.remove('drag-over');
      }
    });

    // Drop on shift cells
    document.addEventListener('drop', (e) => {
      const target = e.target as HTMLElement;
      const shiftCell = target.closest(CSS_SELECTORS.SHIFT_CELL);

      console.info('[SHIFTS DEBUG] Drop event on:', target);

      if (shiftCell) {
        e.preventDefault();
        shiftCell.classList.remove('drag-over');

        const employeeId = e.dataTransfer?.getData('text/plain');
        console.info('[SHIFTS DEBUG] Dropped employee ID:', employeeId);

        if (employeeId !== undefined && employeeId !== '') {
          this.assignShift(shiftCell as HTMLElement, Number.parseInt(employeeId, 10));
        } else {
          console.error('[SHIFTS ERROR] No employee ID in drop data');
        }
      }
    });
  }

  setupContextEvents(): void {
    // Area selection (TOP of hierarchy)
    const areaSelect = document.querySelector('#areaSelect');
    if (areaSelect !== null) {
      areaSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.selectedContext.areaId = target.value !== '' ? Number.parseInt(target.value, 10) : null;
        void this.onAreaSelected();
      });
    }

    // Department selection
    const departmentSelect = document.querySelector('#departmentSelect');
    if (departmentSelect !== null) {
      departmentSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.selectedContext.departmentId = target.value !== '' ? Number.parseInt(target.value, 10) : null;
        void this.onContextChange();
        this.togglePlanningAreaVisibility();
      });
    }

    // Team selection
    const teamSelect = document.querySelector('#teamSelect');
    if (teamSelect !== null) {
      teamSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.selectedContext.teamId = target.value !== '' ? Number.parseInt(target.value, 10) : null;
        void this.onTeamSelected();
      });
    }

    // Machine selection (now filters teams!)
    const machineSelect = document.querySelector('#machineSelect');
    if (machineSelect !== null) {
      machineSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.selectedContext.machineId = target.value !== '' ? Number.parseInt(target.value, 10) : null;
        void this.onMachineSelected();
      });
    }
  }

  setupNotesEvents(): void {
    const notesToggle = document.querySelector(DOM_IDS.NOTES_TOGGLE);
    const notesPanel = document.querySelector(DOM_IDS.NOTES_PANEL);
    const notesTextarea = document.querySelector(DOM_IDS.WEEKLY_NOTES);

    if (notesToggle !== null) {
      notesToggle.addEventListener('click', () => {
        if (notesPanel !== null) {
          notesPanel.classList.toggle('show');
          if (notesPanel.classList.contains('show') && notesTextarea !== null) {
            (notesTextarea as HTMLTextAreaElement).focus();
          }
        }
      });
    }
  }

  async loadContextData(): Promise<void> {
    // Load areas first (top of hierarchy)
    await this.loadAreas();
    // Then load departments and machines
    await Promise.all([this.loadDepartments(), this.loadMachines()]);
  }

  async loadAreas(): Promise<void> {
    try {
      // Use v2 API for areas
      const response = await this.apiClient.get<{ success: boolean; data: Area[]; message: string }>('/areas');

      // Handle v2 response format
      if ('data' in response && Array.isArray(response.data)) {
        console.info('[SHIFTS] Areas loaded:', response.data);
        this.areas = response.data;
      } else if (Array.isArray(response)) {
        // Fallback for direct array response
        console.info('[SHIFTS] Areas loaded:', response);
        this.areas = response;
      } else {
        console.warn('[SHIFTS] Unexpected areas response format:', response);
        this.areas = [];
      }
    } catch (error) {
      console.error('Error loading areas:', error);
      // Continue without areas if endpoint doesn't exist
      this.areas = [];
    }
    this.populateAreaSelect();
  }

  async loadDepartments(areaId?: number): Promise<void> {
    try {
      let url = '/api/departments';
      // Filter by area if specified
      if (areaId !== undefined) {
        url += `?area_id=${String(areaId)}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAuthToken() ?? ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as Department[];
        console.info('Departments API response:', data);
        // API returns array directly
        this.departments = Array.isArray(data) ? data : [];
      } else {
        throw new Error('Failed to load departments');
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      // Fallback data only if no area filter
      if (areaId === undefined) {
        this.departments = [
          { id: 1, name: 'Produktion' },
          { id: 2, name: 'Logistik' },
          { id: 3, name: 'Qualitätssicherung' },
          { id: 4, name: 'Wartung' },
        ];
      } else {
        this.departments = [];
      }
    }
    this.populateDepartmentSelect();
  }

  async loadMachines(): Promise<void> {
    try {
      let url = '/api/machines';
      if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
        url += `?department_id=${String(this.selectedContext.departmentId)}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAuthToken() ?? ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { machines?: Machine[] };
        this.machines = data.machines ?? [];
      } else {
        throw new Error('Failed to load machines');
      }
    } catch (error) {
      console.error('Error loading machines:', error);
      // Fallback data
      this.machines = [
        { id: 1, name: 'Anlage 01', department_id: 1 },
        { id: 2, name: 'Anlage 02', department_id: 1 },
        { id: 3, name: 'Förderband A', department_id: 2 },
        { id: 4, name: 'Förderband B', department_id: 2 },
        { id: 5, name: 'Prüfstand 01', department_id: 3 },
      ];
    }
    this.populateMachineSelect();
  }

  async loadTeams(): Promise<void> {
    if (!this.useV2API) {
      // Fallback to v1 API
      try {
        let url = '/api/teams';
        if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
          url += `?department_id=${String(this.selectedContext.departmentId)}`;
        }
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${getAuthToken() ?? ''}`,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const data = (await response.json()) as Team[];
          this.teams = Array.isArray(data) ? data : [];
        }
      } catch (error) {
        console.error('Error loading teams (v1):', error);
        this.teams = [];
      }
    } else {
      // Use v2 API with ApiClient
      try {
        let url = '/teams';
        if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
          url += `?departmentId=${String(this.selectedContext.departmentId)}`;
        }

        const response = await this.apiClient.request<TeamAPIResponse[]>(url, {
          method: 'GET',
        });

        // Map snake_case to camelCase
        const mappedTeams = mapTeams(response);
        // Convert to internal Team interface
        this.teams = mappedTeams.map((t) => ({
          id: t.id,
          name: t.name,
          department_id: t.departmentId ?? 0,
          team_lead_id: t.leaderId ?? undefined,
          description: t.description,
        }));
        console.info('Teams loaded (v2):', this.teams);
      } catch (error) {
        console.error('Error loading teams (v2):', error);
        this.teams = [];
      }
    }
    this.populateTeamSelect();
  }

  loadTeamLeaders(): void {
    // Skip loading team leaders for non-admins
    // Team leaders are not used anymore
    this.teamLeaders = [];
    this.populateTeamLeaderSelect();
  }

  populateAreaSelect(): void {
    const dropdown = document.querySelector('#areaDropdown');
    if (!dropdown) {
      console.error('Area dropdown element not found');
      return;
    }

    dropdown.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('div');
    defaultOption.className = CSS_CLASSES.DROPDOWN_OPTION;
    defaultOption.dataset.value = '';
    defaultOption.textContent = 'Alle Bereiche';
    defaultOption.onclick = () => {
      this.selectOption('area', '', 'Alle Bereiche');
    };
    dropdown.append(defaultOption);

    // Add area options
    this.areas.forEach((area) => {
      const option = document.createElement('div');
      option.className = CSS_CLASSES.DROPDOWN_OPTION;
      option.dataset.value = String(area.id);
      option.textContent = area.name;
      option.onclick = () => {
        this.selectOption('area', String(area.id), area.name);
      };
      dropdown.append(option);
    });
  }

  populateDepartmentSelect(): void {
    const dropdown = document.querySelector('#departmentDropdown');
    if (!dropdown) {
      console.error('Department dropdown element not found');
      return;
    }

    dropdown.innerHTML = '';

    console.info('Populating departments:', this.departments);
    this.departments.forEach((dept) => {
      const option = document.createElement('div');
      option.className = CSS_CLASSES.DROPDOWN_OPTION;
      option.textContent = dept.name;
      option.onclick = () => {
        (window as unknown as ShiftsWindow).selectOption('department', dept.id.toString(), dept.name);
      };
      dropdown.append(option);
    });

    console.info('Department dropdown populated with', this.departments.length, 'departments');
  }

  populateMachineSelect(): void {
    const dropdown = document.querySelector('#machineDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '';

    // Filter machines by selected department if any
    let filteredMachines = this.machines;
    if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
      filteredMachines = this.machines.filter((machine) => machine.department_id === this.selectedContext.departmentId);
    }

    filteredMachines.forEach((machine) => {
      const option = document.createElement('div');
      option.className = CSS_CLASSES.DROPDOWN_OPTION;
      option.textContent = machine.name;
      option.onclick = () => {
        (window as unknown as ShiftsWindow).selectOption('machine', machine.id.toString(), machine.name);
      };
      dropdown.append(option);
    });
  }

  populateTeamSelect(): void {
    const dropdown = document.querySelector('#teamDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '';

    // Filter teams by selected department if any
    let filteredTeams = this.teams;
    if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
      filteredTeams = this.teams.filter((team) => team.department_id === this.selectedContext.departmentId);
    }

    filteredTeams.forEach((team) => {
      const option = document.createElement('div');
      option.className = CSS_CLASSES.DROPDOWN_OPTION;
      option.textContent = team.name;
      option.onclick = () => {
        (window as unknown as ShiftsWindow).selectOption('team', team.id.toString(), team.name);
      };
      dropdown.append(option);
    });
  }

  populateTeamLeaderSelect(): void {
    const dropdown = document.querySelector('#teamLeaderDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '';

    this.teamLeaders.forEach((leader) => {
      const option = document.createElement('div');
      option.className = CSS_CLASSES.DROPDOWN_OPTION;
      option.textContent = leader.name !== '' ? leader.name : leader.username;
      option.onclick = () => {
        (window as unknown as ShiftsWindow).selectOption(
          'teamLeader',
          leader.id.toString(),
          leader.name !== '' ? leader.name : leader.username,
        );
      };
      dropdown.append(option);
    });
  }

  async onAreaSelected(areaId?: number): Promise<void> {
    // Store the selected area
    this.selectedContext.areaId = areaId ?? null;

    // Reset downstream selections when area changes
    this.selectedContext.departmentId = null;
    this.selectedContext.machineId = null;
    this.selectedContext.teamId = null;

    // Reload departments filtered by area
    if (this.selectedContext.areaId !== null && this.selectedContext.areaId !== 0) {
      await this.loadDepartments(this.selectedContext.areaId);
    } else {
      await this.loadDepartments(); // Load all departments
    }

    // Clear machines and teams
    this.machines = [];
    this.teams = [];
    this.populateMachineSelect();
    this.populateTeamSelect();

    // Clear employees
    this.employees = [];
    this.renderEmployeeList();
  }

  async onContextChange(): Promise<void> {
    // Reset downstream selections when department changes
    this.selectedContext.machineId = null;
    this.selectedContext.teamId = null;

    // Reload machines and teams when department changes
    if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
      await Promise.all([this.loadMachines(), this.loadTeams()]);
    } else {
      // Clear if no department selected
      this.machines = [];
      this.teams = [];
      this.populateMachineSelect();
      this.populateTeamSelect();
    }

    // Reload employees based on context
    await this.loadEmployees();

    // Reload weekly notes for new department
    this.loadWeeklyNotes();
  }

  async onMachineSelected(machineId?: number): Promise<void> {
    // Store the selected machine
    this.selectedContext.machineId = machineId ?? null;
    // Reset team selection when machine changes
    this.selectedContext.teamId = null;

    // Clear team dropdown display
    const teamDisplay = document.querySelector('#teamDisplay span');
    if (teamDisplay) teamDisplay.textContent = 'Team wählen...';

    // Clear hidden input
    const teamSelect = $$id<HTMLInputElement>('teamSelect');
    if (teamSelect !== null) {
      teamSelect.value = '';
    }

    // Load teams for this machine (via machine_teams junction)
    if (this.selectedContext.machineId !== null && this.selectedContext.machineId !== 0) {
      await this.loadTeamsForMachine(this.selectedContext.machineId);
    } else if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
      // If no machine selected, show all department teams
      await this.loadTeams();
    } else {
      // Clear teams if no context
      this.teams = [];
      this.populateTeamSelect();
    }
  }

  async onTeamSelected(teamId?: number): Promise<void> {
    // Store the selected team
    this.selectedContext.teamId = teamId ?? null;
    // Load team members when a team is selected
    if (this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0) {
      await this.loadTeamMembers();
    }
  }

  async loadTeamsForMachine(machineId: number): Promise<void> {
    try {
      // Load teams assigned to this specific machine via machine_teams junction
      const response = await fetch(`/api/machines/${String(machineId)}/teams`, {
        headers: {
          Authorization: `Bearer ${getAuthToken() ?? ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as Team[];
        console.info('[SHIFTS] Teams for machine loaded:', data);
        this.teams = Array.isArray(data) ? data : [];
      } else {
        console.warn('[SHIFTS] Could not load teams for machine, loading all department teams');
        // Fallback to all department teams
        await this.loadTeams();
      }
    } catch (error) {
      console.error('Error loading teams for machine:', error);
      // Fallback to all department teams
      await this.loadTeams();
    }
    this.populateTeamSelect();
  }

  async loadTeamMembers(): Promise<void> {
    if (this.selectedContext.teamId === null || this.selectedContext.teamId === 0) {
      return;
    }

    if (!this.useV2API) {
      // Fallback to v1 API
      try {
        const response = await fetch(`/api/teams/${String(this.selectedContext.teamId)}/members`, {
          headers: {
            Authorization: `Bearer ${getAuthToken() ?? ''}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const members = (await response.json()) as TeamMember[];
          console.info('Team members loaded (v1):', members);
          this.displayTeamMembers(members);
        }
      } catch (error) {
        console.error('Error loading team members (v1):', error);
      }
    } else {
      // Use v2 API with ApiClient
      try {
        const response = await this.apiClient.request<UserAPIResponse[]>(
          `/teams/${String(this.selectedContext.teamId)}/members`,
          { method: 'GET' },
        );

        // Map snake_case to camelCase and convert to TeamMember interface
        const mappedUsers = mapUsers(response);
        const members: TeamMember[] = mappedUsers.map((user) => ({
          id: user.id,
          username: user.username,
          first_name: user.firstName,
          last_name: user.lastName,
          role: 'member' as const,
        }));
        console.info('Team members loaded (v2):', members);
        this.displayTeamMembers(members);
      } catch (error) {
        console.error('Error loading team members (v2):', error);
        showErrorAlert('Fehler beim Laden der Team-Mitglieder');
      }
    }
  }

  displayTeamMembers(members: TeamMember[]): void {
    // We'll create a panel to show team members that can be dragged
    const memberPanel = document.querySelector('#teamMembersPanel');
    if (!memberPanel) {
      console.warn('Team members panel not found');
      return;
    }

    // Show the panel
    memberPanel.classList.remove('u-hidden');

    // Clear panel and rebuild with DOM methods
    while (memberPanel.firstChild) {
      memberPanel.firstChild.remove();
    }

    const h3 = createElement('h3', {}, 'Team-Mitglieder');
    memberPanel.append(h3);

    const membersList = createElement('div', { className: 'members-list' });

    members.forEach((member) => {
      const card = createElement('div', {
        className: 'member-card',
        draggable: true,
      });
      card.dataset.userId = String(member.id);

      const nameDiv = createElement('div', { className: 'member-name' }, `${member.first_name} ${member.last_name}`);

      const roleDiv = createElement(
        'div',
        { className: 'member-role' },
        member.role === 'lead' ? 'Team Lead' : 'Mitglied',
      );

      card.append(nameDiv);
      card.append(roleDiv);
      membersList.append(card);
    });

    memberPanel.append(membersList);

    // Initialize drag and drop for member cards
    this.initializeMemberDragAndDrop();
  }

  initializeMemberDragAndDrop(): void {
    const memberCards = document.querySelectorAll('.member-card');

    memberCards.forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        const dragEvent = e as DragEvent;
        if (dragEvent.dataTransfer) {
          const userId = (card as HTMLElement).dataset.userId ?? '';
          dragEvent.dataTransfer.setData('userId', userId);
          dragEvent.dataTransfer.effectAllowed = 'copy';
          card.classList.add('dragging');
        }
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    });

    // Make shift cells droppable
    this.makeShiftCellsDroppable();
  }

  makeShiftCellsDroppable(): void {
    const shiftCells = document.querySelectorAll(CSS_SELECTORS.SHIFT_CELL);

    shiftCells.forEach((cell) => {
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragEvent = e as DragEvent;
        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.dropEffect = 'copy';
        }
        cell.classList.add('drag-over');
      });

      cell.addEventListener('dragleave', () => {
        cell.classList.remove('drag-over');
      });

      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('drag-over');

        const dragEvent = e as DragEvent;
        if (!dragEvent.dataTransfer) return;

        const userId = dragEvent.dataTransfer.getData('userId'); // Always returns string
        const cellElement = cell as HTMLElement;
        const date = cellElement.dataset.date; // Can be string | undefined
        const shiftType = cellElement.dataset.shiftType; // Can be string | undefined

        if (
          userId !== '' && // userId is always string from getData
          date !== undefined &&
          date !== '' &&
          shiftType !== undefined &&
          shiftType !== ''
        ) {
          // Wrap async call in void to handle promise correctly
          void this.assignUserToShift(Number(userId), date, shiftType, cellElement);
        }
      });
    });
  }

  validateHierarchy(): { valid: boolean; message?: string } {
    // Check if area is selected (if areas are available)
    if (this.areas.length > 0 && (this.selectedContext.areaId === null || this.selectedContext.areaId === 0)) {
      return { valid: false, message: 'Bitte wählen Sie einen Bereich aus' };
    }

    // Check if essential context is selected
    if (this.selectedContext.departmentId === null || this.selectedContext.departmentId === 0) {
      return { valid: false, message: 'Bitte wählen Sie eine Abteilung aus' };
    }

    // If machine is selected, verify it belongs to the department
    if (this.selectedContext.machineId !== null && this.selectedContext.machineId !== 0) {
      const machine = this.machines.find((m) => m.id === this.selectedContext.machineId);
      if (!machine) {
        return { valid: false, message: 'Ungültige Maschinen-Auswahl' };
      }
      if (machine.department_id !== this.selectedContext.departmentId) {
        return { valid: false, message: 'Maschine gehört nicht zur ausgewählten Abteilung' };
      }
    }

    // If team is selected, verify it belongs to the department
    if (this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0) {
      const team = this.teams.find((t) => t.id === this.selectedContext.teamId);
      if (!team) {
        return { valid: false, message: 'Ungültige Team-Auswahl' };
      }
      if (team.department_id !== this.selectedContext.departmentId) {
        return { valid: false, message: 'Team gehört nicht zur ausgewählten Abteilung' };
      }

      // If both machine and team are selected, verify they are linked via machine_teams
      // Note: This would require loading machine_teams data, for now we trust the UI filtering
    }

    // If area is selected, verify department belongs to it
    if (this.selectedContext.areaId !== null && this.selectedContext.areaId !== 0) {
      const department = this.departments.find((d) => d.id === this.selectedContext.departmentId);
      if (
        department?.area_id !== undefined &&
        department.area_id !== 0 &&
        department.area_id !== this.selectedContext.areaId
      ) {
        return { valid: false, message: 'Abteilung gehört nicht zum ausgewählten Bereich' };
      }
    }

    return { valid: true };
  }

  async assignUserToShift(userId: number, date: string, shiftType: string, cellElement: HTMLElement): Promise<void> {
    // Validate hierarchy before creating shift
    const validation = this.validateHierarchy();
    if (!validation.valid) {
      showError(validation.message ?? 'Ungültige Auswahl-Hierarchie');
      return;
    }

    if (!this.useV2API) {
      // Fallback to v1 API
      try {
        const response = await fetch('/api/shifts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getAuthToken() ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            date,
            type: shiftType,
            department_id: this.selectedContext.departmentId,
            team_id: this.selectedContext.teamId,
            machine_id: this.selectedContext.machineId,
            start_time: this.getShiftStartTime(shiftType),
            end_time: this.getShiftEndTime(shiftType),
          }),
        });

        if (response.ok) {
          await response.json();
          showSuccess('Schicht zugewiesen');
          this.updateShiftCell(cellElement, userId, shiftType);
        } else {
          showError(ERROR_MESSAGES.SHIFT_ASSIGNMENT_FAILED);
        }
      } catch (error) {
        console.error('Error assigning shift (v1):', error);
        showError('Fehler beim Zuweisen der Schicht');
      }
    } else {
      // Use v2 API with ApiClient
      try {
        await this.apiClient.request('/v2/shifts', {
          method: 'POST',
          body: JSON.stringify({
            userId,
            date,
            type: shiftType,
            departmentId: this.selectedContext.departmentId,
            teamId: this.selectedContext.teamId,
            machineId: this.selectedContext.machineId,
            startTime: this.getShiftStartTime(shiftType),
            endTime: this.getShiftEndTime(shiftType),
          }),
        });

        // Response is always truthy after successful await (throws on error)
        showSuccessAlert('Schicht erfolgreich zugewiesen');
        this.updateShiftCell(cellElement, userId, shiftType);
      } catch (error) {
        console.error('Error assigning shift (v2):', error);
        showErrorAlert(ERROR_MESSAGES.SHIFT_ASSIGNMENT_FAILED);
      }
    }
  }

  private updateShiftCell(cellElement: HTMLElement, userId: number, shiftType: string): void {
    const memberName = this.getMemberNameById(userId);

    // Clear existing content
    while (cellElement.firstChild) {
      cellElement.firstChild.remove();
    }

    // Build DOM structure safely
    const assignmentDiv = createElement('div', { className: 'employee-assignment' });
    const nameDiv = createElement('div', { className: CSS_CLASSES.EMPLOYEE_NAME }, memberName);
    const timeDiv = createElement('div', { className: 'shift-time' }, this.getShiftTimeDisplay(shiftType));

    assignmentDiv.append(nameDiv, timeDiv);
    cellElement.append(assignmentDiv);
    cellElement.classList.add('assigned');
  }

  private selectOption(type: string, value: string, displayText: string): void {
    // Update the dropdown display
    const displayElement = $$id(`${type}Display`);
    if (displayElement) {
      const span = displayElement.querySelector('span');
      if (span) {
        span.textContent = displayText;
      }
      // Close dropdown - use 'active' class like in HTML
      const dropdown = $$id(`${type}Dropdown`);
      if (dropdown) {
        dropdown.classList.remove('active');
      }
      // Also remove active from display element
      displayElement.classList.remove('active');
    }

    // Handle selection based on type
    if (type === 'area') {
      const areaId = value !== '' ? Number(value) : undefined;
      void this.onAreaSelected(areaId);
    } else if (type === 'department') {
      this.selectedContext.departmentId = value !== '' ? Number(value) : null;
      void this.onContextChange();
    } else if (type === 'machine') {
      const machineId = value !== '' ? Number(value) : undefined;
      if (machineId !== undefined) {
        void this.onMachineSelected(machineId);
      }
    } else if (type === 'team') {
      const teamId = value !== '' ? Number(value) : undefined;
      if (teamId !== undefined) {
        void this.onTeamSelected(teamId);
      }
    }
  }

  getMemberNameById(userId: number): string {
    const memberCard = document.querySelector(`.member-card[data-user-id="${String(userId)}"]`);
    if (memberCard) {
      const nameElement = memberCard.querySelector('.member-name');
      return nameElement?.textContent ?? 'Unbekannt';
    }
    return 'Unbekannt';
  }

  getShiftStartTime(shiftType: string): string {
    // Validate shift type to prevent object injection
    const validShiftTypes = ['early', 'late', 'night'] as const;
    if (!validShiftTypes.includes(shiftType as (typeof validShiftTypes)[number])) {
      return '08:00';
    }

    const times: Record<(typeof validShiftTypes)[number], string> = {
      early: '06:00',
      late: '14:00',
      night: '22:00',
    };
    return times[shiftType as (typeof validShiftTypes)[number]];
  }

  getShiftEndTime(shiftType: string): string {
    // Validate shift type to prevent object injection
    const validShiftTypes = ['early', 'late', 'night'] as const;
    if (!validShiftTypes.includes(shiftType as (typeof validShiftTypes)[number])) {
      return '17:00';
    }

    const times: Record<(typeof validShiftTypes)[number], string> = {
      early: '14:00',
      late: '22:00',
      night: '06:00',
    };
    return times[shiftType as (typeof validShiftTypes)[number]];
  }

  getShiftTimeDisplay(shiftType: string): string {
    // Validate shift type to prevent object injection
    const validShiftTypes = ['early', 'late', 'night'] as const;
    if (!validShiftTypes.includes(shiftType as (typeof validShiftTypes)[number])) {
      return 'Ganztags';
    }

    const displays: Record<(typeof validShiftTypes)[number], string> = {
      early: '06:00 - 14:00',
      late: '14:00 - 22:00',
      night: '22:00 - 06:00',
    };
    return displays[shiftType as (typeof validShiftTypes)[number]];
  }

  togglePlanningAreaVisibility(): void {
    const departmentNotice = document.querySelector('#departmentNotice');
    const mainPlanningArea = document.querySelector('#mainPlanningArea');
    const adminActions = document.querySelector('#adminActions');
    const weekNavigation = document.querySelector('.week-navigation');

    if ((this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) || !this.isAdmin) {
      // Department selected (or employee with auto-selected dept) - show planning area
      if (departmentNotice) (departmentNotice as HTMLElement).style.display = 'none';
      if (mainPlanningArea) (mainPlanningArea as HTMLElement).style.display = '';
      if (adminActions && this.isAdmin) (adminActions as HTMLElement).style.display = 'block';
      if (weekNavigation) (weekNavigation as HTMLElement).style.display = 'flex';

      // Load data for the selected department
      void (async () => {
        await this.loadCurrentWeekData();
        // Load notes after shift data is loaded
        if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
          console.info('[SHIFTS DEBUG] Loading notes in togglePlanningAreaVisibility');
          this.loadWeeklyNotes();
        }
      })();
    } else {
      // No department selected (only for admins) - show notice
      if (departmentNotice) (departmentNotice as HTMLElement).style.display = 'block';
      if (mainPlanningArea) (mainPlanningArea as HTMLElement).style.display = 'none';
      if (adminActions) (adminActions as HTMLElement).style.display = 'none';
      if (weekNavigation) (weekNavigation as HTMLElement).style.display = 'none';
    }
  }

  async loadEmployees(): Promise<void> {
    // For non-admins, we need to load employees from their department only
    if (!this.isAdmin && (this.selectedContext.departmentId === null || this.selectedContext.departmentId === 0)) {
      console.info('[SHIFTS DEBUG] No department selected for employee');
      this.employees = [];
      return;
    }

    try {
      // First load users
      let url = '/api/users';
      const params = new URLSearchParams();

      if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
        params.append('department_id', this.selectedContext.departmentId.toString());
      }
      if (this.selectedContext.teamLeaderId !== null && this.selectedContext.teamLeaderId !== 0) {
        params.append('team_leader_id', this.selectedContext.teamLeaderId.toString());
      }

      const paramsString = params.toString();
      if (paramsString !== '') {
        url += `?${paramsString}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAuthToken() ?? ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as User[] | { users?: User[] };
        const users = Array.isArray(data) ? data : ((data as { users?: User[] }).users ?? []);
        this.employees = users.filter((user: User) => user.role === 'employee');

        console.info('[SHIFTS DEBUG] Employees loaded:', this.employees.length, 'employees');
        console.info('[SHIFTS DEBUG] Employee data:', this.employees);

        // Availability is now part of user data, no need for separate call

        this.renderEmployeeList();
      } else {
        console.error('[SHIFTS ERROR] Failed to load employees, status:', response.status);
        throw new Error('Failed to load employees');
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      // Fallback data
      this.employees = [];
      this.renderEmployeeList();
    }
  }

  loadAvailabilityStatus(): void {
    // Availability is now part of user data in v2
    // This method is kept for backward compatibility but does nothing
    // Employee availability status is loaded with user data in loadEmployees()
    console.info('[SHIFTS] Availability status is now loaded with user data');
  }

  renderEmployeeList(): void {
    // Don't render if no employees loaded
    if (this.employees.length === 0) {
      console.info('[SHIFTS DEBUG] No employees to render');
      return;
    }

    const container = document.querySelector('#employeeList');
    console.info('[SHIFTS DEBUG] Employee list container:', container);

    if (container === null) {
      console.error('[SHIFTS ERROR] Employee list container not found!');
      return;
    }

    container.innerHTML = '';
    console.info('[SHIFTS DEBUG] Rendering employees:', this.employees.length);

    this.employees.forEach((employee) => {
      const item = document.createElement('div');
      item.className = 'employee-item';
      item.dataset.employeeId = employee.id.toString();

      // Only available employees can be dragged
      const isDraggable =
        this.isAdmin && (employee.availability_status === 'available' || employee.availability_status === undefined);
      item.setAttribute('draggable', isDraggable.toString());

      console.info(
        '[SHIFTS DEBUG] Employee:',
        employee.username,
        'Draggable:',
        isDraggable,
        'Status:',
        employee.availability_status,
      );

      // Add visual indicators for unavailable employees
      if (employee.availability_status !== undefined && employee.availability_status !== 'available') {
        item.classList.add('unavailable', `status-${employee.availability_status}`);
      }

      const name = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
      const displayName = name !== '' ? name : employee.username;

      // Build DOM structure safely
      const infoDiv = createElement('div', { className: 'employee-info' });
      const nameSpan = createElement('span', { className: CSS_CLASSES.EMPLOYEE_NAME }, displayName);
      infoDiv.append(nameSpan);

      // Add status icon if present
      const iconElement = this.createAvailabilityIcon(employee.availability_status);
      if (iconElement) {
        infoDiv.append(iconElement);
      }

      // Add status badge if present
      const badgeElement = this.createAvailabilityBadge(employee.availability_status);
      if (badgeElement) {
        infoDiv.append(badgeElement);
      }

      const statsDiv = createElement('div', { className: 'employee-stats' });
      const countSpan = createElement('span', { className: 'shift-count' }, '0');
      statsDiv.append(countSpan);

      item.append(infoDiv);
      item.append(statsDiv);

      container.append(item);
    });

    console.info('[SHIFTS DEBUG] Employee list rendered');
    // Update shift counts
    this.updateEmployeeShiftCounts();
  }

  // Create icon element instead of HTML string
  createAvailabilityIcon(status?: string): HTMLElement | null {
    let iconClass = '';
    let title = '';
    let statusClass = '';

    switch (status) {
      case 'vacation':
        iconClass = 'fa-plane';
        statusClass = 'vacation';
        title = 'Im Urlaub';
        break;
      case 'sick':
        iconClass = 'fa-notes-medical';
        statusClass = 'sick';
        title = 'Krank';
        break;
      case 'unavailable':
        iconClass = 'fa-ban';
        statusClass = 'unavailable';
        title = 'Nicht verfügbar';
        break;
      default:
        return null;
    }

    return createElement('i', {
      className: `fas ${iconClass} status-icon ${statusClass}`,
      title: title,
    });
  }

  // Create badge element instead of HTML string
  createAvailabilityBadge(status?: string): HTMLElement | null {
    let badgeClass = '';
    let text = '';

    switch (status) {
      case 'available':
        badgeClass = 'badge-success';
        text = 'Verfügbar';
        break;
      case 'vacation':
        badgeClass = 'badge-warning';
        text = 'Urlaub';
        break;
      case 'sick':
        badgeClass = 'badge-danger';
        text = 'Krank';
        break;
      case 'unavailable':
        badgeClass = 'badge-secondary';
        text = 'Nicht verfügbar';
        break;
      default:
        // Default to available if no status is set
        return this.createAvailabilityBadge('available'); // Avoid code duplication
    }

    return createElement(
      'span',
      {
        className: `badge ${badgeClass}`,
      },
      text,
    );
  }

  // Keep the old methods for backward compatibility if needed elsewhere
  getAvailabilityIcon(status?: string): string {
    switch (status) {
      case 'vacation':
        return '<i class="fas fa-plane status-icon vacation" title="Im Urlaub"></i>';
      case 'sick':
        return '<i class="fas fa-notes-medical status-icon sick" title="Krank"></i>';
      case 'unavailable':
        return '<i class="fas fa-ban status-icon unavailable" title="Nicht verfügbar"></i>';
      default:
        return '';
    }
  }

  getAvailabilityBadge(status?: string): string {
    switch (status) {
      case 'available':
        return '<span class="badge badge-success">Verfügbar</span>';
      case 'vacation':
        return '<span class="badge badge-warning">Urlaub</span>';
      case 'sick':
        return '<span class="badge badge-danger">Krank</span>';
      case 'unavailable':
        return '<span class="badge badge-secondary">Nicht verfügbar</span>';
      default:
        // Default to available if no status is set
        return '<span class="badge badge-success">Verfügbar</span>';
    }
  }

  updateEmployeeShiftCounts(): void {
    // Reset all counts
    document.querySelectorAll('.shift-count').forEach((el) => {
      el.textContent = '0';
    });

    // Count shifts for each employee - use Map for safety
    const shiftCounts = new Map<number, number>();

    this.weeklyShifts.forEach((dayShifts) => {
      dayShifts.forEach((employeeIds) => {
        employeeIds.forEach((employeeId) => {
          // Map is safe from prototype pollution
          const currentCount = shiftCounts.get(employeeId) ?? 0;
          shiftCounts.set(employeeId, currentCount + 1);
        });
      });
    });

    // Update UI
    shiftCounts.forEach((count, employeeId) => {
      const item = document.querySelector(`[data-employee-id="${String(employeeId)}"] .shift-count`);
      if (item !== null) {
        item.textContent = count.toString();
      }
    });
  }

  selectEmployee(employeeItem: HTMLElement): void {
    if (!this.isAdmin) return;

    // Remove previous selection
    document.querySelectorAll(CSS_SELECTORS.EMPLOYEE_ITEM).forEach((item) => {
      item.classList.remove('selected');
    });

    // Add selection to clicked item
    employeeItem.classList.add('selected');

    const employeeId = Number.parseInt(employeeItem.dataset.employeeId ?? '0', 10);
    this.selectedEmployee = this.employees.find((e) => e.id === employeeId) ?? null;
  }

  assignEmployeeToShift(shiftCell: HTMLElement): void {
    if (!this.isAdmin || this.selectedEmployee === null) return;

    // Let assignShift handle the date calculation
    this.assignShift(shiftCell, this.selectedEmployee.id);
  }

  assignShift(shiftCell: HTMLElement, employeeId: number): void {
    let date = shiftCell.dataset.date;
    const day = shiftCell.dataset.day;
    const shift = shiftCell.dataset.shift;

    // If no date but day exists, calculate date from current week
    if ((date === undefined || date === '') && day !== undefined && day !== '') {
      const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(day);
      if (dayIndex !== -1) {
        const weekStart = this.getWeekStart(this.currentWeek);
        const cellDate = new Date(weekStart);
        cellDate.setDate(cellDate.getDate() + dayIndex);
        date = this.formatDateKey(cellDate);
        // Also set the data-date attribute for future use
        shiftCell.dataset.date = date;
      }
    }

    console.info('[SHIFTS DEBUG] Assigning shift:', { date, day, shift, employeeId });

    if (date === undefined || date === '' || shift === undefined || shift === '') {
      console.error('[SHIFTS ERROR] Missing date or shift data on cell');
      return;
    }

    const employee = this.employees.find((e) => e.id === employeeId);
    if (employee === undefined) {
      console.error('[SHIFTS ERROR] Employee not found:', employeeId);
      return;
    }

    console.info('[SHIFTS DEBUG] Found employee:', employee);

    // Check if employee is available
    if (employee.availability_status !== undefined && employee.availability_status !== 'available') {
      console.info('[SHIFTS DEBUG] Employee not available:', employee.availability_status);

      // Get status text and badge color
      const statusText = {
        vacation: 'Urlaub',
        sick: 'Krank',
        unavailable: 'Beurlaubt',
      }[employee.availability_status];

      const name = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
      const employeeName = name !== '' ? name : employee.username;

      showError(`Mitarbeiter kann nicht zugewiesen werden: ${employeeName} ist ${statusText}`);
      return;
    }

    // Validate date format to prevent object injection
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error('Invalid date format:', date);
      return;
    }

    // Check if employee already has a shift on this day
    const shiftsOnThisDay = new Map<string, number[]>();
    const shiftTypes = ['early', 'late', 'night'] as const;
    for (const shiftType of shiftTypes) {
      const employees = this.getShiftEmployees(date, shiftType);
      if (employees.length > 0) {
        shiftsOnThisDay.set(shiftType, employees);
      }
    }
    const name2 = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
    const employeeName = name2 !== '' ? name2 : employee.username;

    // Check all shifts on this day
    for (const [shiftType, employeeIds] of shiftsOnThisDay) {
      if (shiftType !== shift && employeeIds.includes(employeeId)) {
        // Employee already has another shift on this day
        const shiftNames = new Map<string, string>([
          ['early', 'Frühschicht'],
          ['late', 'Spätschicht'],
          ['night', 'Nachtschicht'],
        ]);

        showError(
          `Doppelschicht nicht erlaubt! ${employeeName} ist bereits für die ${shiftNames.get(shiftType) ?? shiftType} eingeteilt. Ein Mitarbeiter kann nur eine Schicht pro Tag übernehmen.`,
        );
        return;
      }
    }

    // Get current employees for this shift
    const currentEmployees = this.getShiftEmployees(date, shift);

    // Check if employee is already assigned to this shift
    const index = currentEmployees.indexOf(employeeId);
    if (index !== -1) {
      // Remove assignment
      const updatedEmployees = [...currentEmployees];
      updatedEmployees.splice(index, 1);
      this.setShiftEmployees(date, shift, updatedEmployees);
    } else {
      // Add assignment
      const updatedEmployees = [...currentEmployees, employeeId];
      this.setShiftEmployees(date, shift, updatedEmployees);
    }

    // Update UI - pass the cell directly
    this.renderShiftAssignments(shiftCell, date, shift);
    this.updateEmployeeShiftCounts();
  }

  renderShiftAssignments(shiftCell: HTMLElement, date: string, shift: string): void {
    // Find the employee-assignment div within the cell
    const assignmentDiv = shiftCell.querySelector(CSS_SELECTORS.EMPLOYEE_ASSIGNMENT);
    if (assignmentDiv === null) {
      console.error('[SHIFTS ERROR] No employee-assignment div found in cell');
      return;
    }

    // Clear existing content
    assignmentDiv.innerHTML = '';

    const employeeIds = this.getShiftEmployees(date, shift);

    if (employeeIds.length === 0) {
      // Show empty slot
      assignmentDiv.innerHTML = '<div class="empty-slot">Mitarbeiter zuweisen</div>';
    } else {
      // Create employee cards for assigned employees
      employeeIds.forEach((employeeId) => {
        const employee = this.employees.find((e) => e.id === employeeId);
        if (employee) {
          const card = this.createEmployeeCard(employee);
          assignmentDiv.append(card);
        }
      });
    }
  }

  async loadCurrentWeekData(): Promise<void> {
    try {
      const weekStart = this.getWeekStart(this.currentWeek);
      const weekEnd = this.getWeekEnd(this.currentWeek);

      // Format dates for API
      const startStr = this.formatDate(weekStart);
      const endStr = this.formatDate(weekEnd);

      console.info('[SHIFTS DEBUG] Loading shifts for range:', startStr, 'to', endStr);

      const response = await fetch(`/api/shifts?start=${startStr}&end=${endStr}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken() ?? ''}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as {
          shifts?: {
            date: string;
            shift_type: string;
            employee_id: number;
            first_name: string;
            last_name: string;
            username: string;
          }[];
        };
        console.info('[SHIFTS DEBUG] API Response:', data);
        console.info('[SHIFTS DEBUG] Number of shifts:', data.shifts?.length ?? 0);
        if (data.shifts !== undefined && data.shifts.length > 0) {
          console.info('[SHIFTS DEBUG] First shift:', data.shifts[0]);
        }
        this.processShiftData(data.shifts ?? []);
        this.renderWeekView();
      } else {
        throw new Error('Failed to load shift data');
      }
    } catch (error) {
      console.error('Error loading shift data:', error);
      this.renderWeekView();
    }
  }

  processShiftData(
    shifts: {
      date: string;
      shift_type: string;
      employee_id: number;
      first_name: string;
      last_name: string;
      username: string;
    }[],
  ): void {
    this.weeklyShifts = new Map();
    this.shiftDetails = new Map(); // Store full shift details including names
    console.info('[SHIFTS DEBUG] Processing shifts:', shifts);

    shifts.forEach((shift) => {
      // Extract date part only (YYYY-MM-DD) from potentially full datetime string
      const dateString = shift.date;
      const date = dateString.split('T')[0]; // Get only YYYY-MM-DD part
      const shiftType = shift.shift_type;

      // Skip custom shifts or convert them based on time
      if (shiftType === 'custom') {
        console.info('[SHIFTS DEBUG] Skipping custom shift type');
        return; // Skip this shift for now
      }

      console.info('[SHIFTS DEBUG] Processing shift:', {
        originalDate: dateString,
        extractedDate: date,
        shiftType,
        employee_id: shift.employee_id,
        employee_name: `${shift.first_name} ${shift.last_name}`,
      });

      // Use safe setter method to avoid object injection
      const currentEmployees = this.getShiftEmployees(date, shiftType);
      this.setShiftEmployees(date, shiftType, [...currentEmployees, shift.employee_id]);

      // Store the full shift details including names
      const shiftKey = `${date}_${shiftType}_${String(shift.employee_id)}`;
      if (!this.shiftDetails.has(shiftKey)) {
        this.shiftDetails.set(shiftKey, {
          employee_id: shift.employee_id,
          first_name: shift.first_name,
          last_name: shift.last_name,
          username: shift.username,
        });
      }
    });

    console.info('[SHIFTS DEBUG] Final weeklyShifts:', this.weeklyShifts);
    console.info('[SHIFTS DEBUG] Shift details:', this.shiftDetails);
  }

  renderWeekView(): void {
    const weekStart = this.getWeekStart(this.currentWeek);

    console.info('[SHIFTS DEBUG] Rendering week view for week starting:', weekStart);

    // Update week display
    const currentWeekElement = document.querySelector(DOM_IDS.CURRENT_WEEK_INFO);
    if (currentWeekElement) {
      currentWeekElement.textContent = this.formatWeekRange(weekStart);
    } else {
      console.warn('[SHIFTS WARN] currentWeekInfo element not found');
    }

    // Update shift assignments in existing cells
    this.updateShiftCells(weekStart);
  }

  navigateWeek(direction: number): void {
    console.info('[SHIFTS DEBUG] Navigating week. Direction:', direction);
    console.info('[SHIFTS DEBUG] Current week before:', this.currentWeek);

    const newDate = new Date(this.currentWeek);

    const daysToAdd = direction * 7;
    newDate.setDate(newDate.getDate() + daysToAdd);
    this.currentWeek = newDate;

    console.info('[SHIFTS DEBUG] New week after:', this.currentWeek);

    // Load both shift data and notes for the new week
    void (async () => {
      try {
        await this.loadCurrentWeekData();
        this.loadWeeklyNotes();
        console.info('[SHIFTS DEBUG] Week data and notes loaded successfully');
      } catch (error: unknown) {
        console.error('[SHIFTS ERROR] Failed to load week data:', error);
      }
    })();
  }

  getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    return new Date(d.setDate(diff));
  }

  getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return weekEnd;
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${String(year)}-${month}-${day}`;
  }

  formatWeekRange(weekStart: Date): string {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
    };
    const startStr = weekStart.toLocaleDateString('de-DE', options);
    const endStr = weekEnd.toLocaleDateString('de-DE', options);

    return `${startStr} - ${endStr} ${String(weekEnd.getFullYear())}`;
  }

  updateShiftCells(weekStart: Date): void {
    console.info('[SHIFTS DEBUG] Updating shift cells for week starting:', weekStart);

    // Update day headers with dates
    const dayHeaders = document.querySelectorAll('.day-header');
    dayHeaders.forEach((header, index) => {
      // Skip the first header which is "Schicht"
      if (index === 0) return;

      const date = new Date(weekStart);
      date.setDate(date.getDate() + (index - 1));

      const dateSpan = header.querySelector('span');
      if (dateSpan) {
        dateSpan.textContent = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }
    });

    // Update shift cells with assignments
    const shiftTypes = ['early', 'late', 'night'];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    shiftTypes.forEach((shiftType) => {
      days.forEach((day, dayIndex) => {
        const cell = document.querySelector(`.shift-cell[data-day="${day}"][data-shift="${shiftType}"]`);
        if (!cell) {
          console.warn(`[SHIFTS WARN] Cell not found for ${day} ${shiftType}`);
          return;
        }

        const date = new Date(weekStart);
        date.setDate(date.getDate() + dayIndex);
        const dateKey = this.formatDateKey(date);

        // Clear existing assignments
        const assignmentDiv = cell.querySelector(CSS_SELECTORS.EMPLOYEE_ASSIGNMENT);
        if (assignmentDiv) {
          assignmentDiv.innerHTML = '';

          // Get assignments for this shift
          const assignments = this.getShiftEmployees(dateKey, shiftType);

          console.info('[SHIFTS DEBUG] Updating cell:', { day, shiftType, dateKey, assignments });

          if (assignments.length > 0) {
            // Add employee cards
            assignments.forEach((employeeId) => {
              // First try to find in loaded employees (for admins)
              const employee = this.employees.find((e) => e.id === employeeId);

              // If not found, try shift details (for employees who can't load all users)
              const shiftDetailKey = `${dateKey}_${shiftType}_${String(employeeId)}`;
              const shiftDetail = this.shiftDetails.get(shiftDetailKey);

              console.info(
                '[SHIFTS DEBUG] Looking for employee:',
                employeeId,
                'Found in employees:',
                !!employee,
                'Found in shiftDetails:',
                shiftDetail !== undefined,
              );

              if (employee) {
                const employeeCard = this.createEmployeeCard(employee);
                assignmentDiv.append(employeeCard);
              } else if (shiftDetail !== undefined) {
                // Create a temporary employee object from shift details
                const tempEmployee: Employee = {
                  id: shiftDetail.employee_id,
                  first_name: shiftDetail.first_name,
                  last_name: shiftDetail.last_name,
                  username: shiftDetail.username,
                  position: 'Mitarbeiter',
                  email: '',
                  role: 'employee' as const,
                  tenant_id: 0,
                  created_at: '',
                  updated_at: '',
                  is_active: true,
                  is_archived: false,
                };
                const employeeCard = this.createEmployeeCard(tempEmployee);
                assignmentDiv.append(employeeCard);
              } else {
                console.error('[SHIFTS ERROR] Employee not found:', employeeId);
                // Show at least the ID if employee data not found
                const tempCard = document.createElement('div');
                tempCard.className = 'employee-card';
                const nameDiv = document.createElement('div');
                nameDiv.className = CSS_CLASSES.EMPLOYEE_NAME;
                nameDiv.textContent = `Mitarbeiter #${String(employeeId)}`;
                tempCard.append(nameDiv);
                assignmentDiv.append(tempCard);
              }
            });
          } else {
            // Show empty slot - different text for employees vs admins
            if (this.isAdmin) {
              assignmentDiv.innerHTML = '<div class="empty-slot">Mitarbeiter zuweisen</div>';
            } else {
              assignmentDiv.innerHTML = '<div class="empty-slot">-</div>';
            }
          }
        }
      });
    });
  }

  createEmployeeCard(employee: Employee): HTMLElement {
    const card = document.createElement('div');
    card.className = 'employee-card';
    card.dataset.employeeId = employee.id.toString();

    const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
    const name = fullName !== '' ? fullName : employee.username;

    // Build card content with DOM methods
    const nameDiv = createElement('div', { className: CSS_CLASSES.EMPLOYEE_NAME }, name);
    const positionDiv = createElement('div', { className: 'employee-position' }, employee.position ?? 'Mitarbeiter');
    card.append(nameDiv, positionDiv);

    // Add remove button for admins
    if (this.isAdmin) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      const removeIcon = createElement('i', { className: 'fas fa-times' });
      removeBtn.append(removeIcon);
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        const cell = card.closest(CSS_SELECTORS.SHIFT_CELL);
        if (cell) {
          this.assignShift(cell as HTMLElement, employee.id);
        }
      };
      card.append(removeBtn);
    }

    return card;
  }

  getDayName(date: Date): string {
    return date.toLocaleDateString('de-DE', { weekday: 'short' });
  }

  formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${String(year)}-${month}-${day}`;
  }

  async saveSchedule(): Promise<void> {
    if (!this.isAdmin) return;

    // Validate department selection
    if (this.selectedContext.departmentId === null || this.selectedContext.departmentId === 0) {
      showError('Bitte wählen Sie zuerst eine Abteilung aus');
      return;
    }

    try {
      const weekStart = this.formatDate(this.getWeekStart(this.currentWeek));
      const weekEnd = this.formatDate(this.getWeekEnd(this.currentWeek));

      // Get notes from textarea
      const notesTextarea = $$id<HTMLTextAreaElement>('weeklyNotes');
      const notes = notesTextarea !== null ? notesTextarea.value : '';

      if (!this.useV2API) {
        // v1 API - Legacy bulk save
        const assignments: {
          employee_id: number;
          shift_date: string;
          shift_type: string;
          week_start: string;
          week_end: string;
          department_id?: number;
          machine_id?: number;
          team_leader_id?: number;
        }[] = [];

        this.weeklyShifts.forEach((shifts, date) => {
          shifts.forEach((employeeIds, shiftType) => {
            employeeIds.forEach((employeeId) => {
              assignments.push({
                employee_id: employeeId,
                shift_date: date,
                shift_type: shiftType,
                week_start: weekStart,
                week_end: weekEnd,
                department_id: this.selectedContext.departmentId ?? undefined,
                machine_id: this.selectedContext.machineId ?? undefined,
              });
            });
          });
        });

        const response = await fetch('/api/shifts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken() ?? ''}`,
          },
          body: JSON.stringify({
            week_start: weekStart,
            week_end: weekEnd,
            assignments,
            notes,
          }),
        });

        if (response.ok) {
          showSuccess('Schichtplan erfolgreich gespeichert!');
          await this.loadCurrentWeekData();
        } else {
          const error = (await response.json()) as { message?: string };
          showError(error.message ?? 'Fehler beim Speichern des Schichtplans');
        }
      } else {
        // v2 API - Create individual shifts with notes
        const shiftsToCreate: {
          userId: number;
          date: string;
          type: string;
          startTime: string;
          endTime: string;
          departmentId?: number;
          teamId?: number;
          machineId?: number;
          notes?: string;
        }[] = [];

        this.weeklyShifts.forEach((shifts, date) => {
          shifts.forEach((employeeIds, shiftType) => {
            employeeIds.forEach((employeeId) => {
              shiftsToCreate.push({
                userId: employeeId,
                date,
                type: shiftType,
                startTime: this.getShiftStartTime(shiftType),
                endTime: this.getShiftEndTime(shiftType),
                departmentId: this.selectedContext.departmentId ?? undefined,
                teamId: this.selectedContext.teamId ?? undefined,
                machineId: this.selectedContext.machineId ?? undefined,
                notes: notes !== '' ? notes : undefined, // Include notes with each shift
              });
            });
          });
        });

        // Create shifts one by one (v2 doesn't have bulk endpoint yet)
        let successCount = 0;
        let errorCount = 0;

        for (const shift of shiftsToCreate) {
          try {
            await this.apiClient.request('/v2/shifts', {
              method: 'POST',
              body: JSON.stringify(shift),
            });
            successCount++;
          } catch (error) {
            console.error('Error creating shift:', error);
            errorCount++;
          }
        }

        if (errorCount === 0) {
          showSuccessAlert('Schichtplan erfolgreich gespeichert!');
        } else if (successCount > 0) {
          showInfo(`${String(successCount)} Schichten gespeichert, ${String(errorCount)} fehlgeschlagen`);
        } else {
          showErrorAlert('Fehler beim Speichern des Schichtplans');
        }

        await this.loadCurrentWeekData();
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      showErrorAlert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  resetSchedule(): void {
    if (!this.isAdmin) return;

    // Use proper modal confirmation instead of confirm()
    const modalContent = `
      <div class="confirmation-modal">
        <h3>Schichtplan zurücksetzen</h3>
        <p>Möchten Sie den aktuellen Schichtplan wirklich zurücksetzen?</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="window.modalManager.closeModal()">Abbrechen</button>
          <button class="btn btn-danger" onclick="window.shiftPlanning.confirmReset()">Zurücksetzen</button>
        </div>
      </div>
    `;

    openModal(modalContent, {
      title: 'Bestätigung erforderlich',
      size: 'sm',
    });
  }

  confirmReset(): void {
    if (!this.isAdmin) return;

    this.weeklyShifts = new Map();
    this.renderWeekView();
    this.updateEmployeeShiftCounts();
    showInfo('Schichtplan wurde zurückgesetzt');

    // Close modal
    if (typeof window !== 'undefined' && 'modalManager' in window) {
      (window as unknown as { modalManager: { closeModal: () => void } }).modalManager.closeModal();
    }
  }

  loadWeeklyNotes(): void {
    // In v2, notes are part of individual shifts
    // For now, we'll keep the UI element but not load separate notes
    // Notes will be saved with each shift in saveSchedule()
    console.info('[SHIFTS] Weekly notes are now part of individual shifts in v2');

    // Clear the textarea
    const notesTextarea = document.querySelector(DOM_IDS.WEEKLY_NOTES);
    if (notesTextarea !== null) {
      (notesTextarea as HTMLTextAreaElement).value = '';
    }
    // weeklyNotes removed - notes are part of shifts in v2
  }

  saveWeeklyNotes(): void {
    // In v2, notes are saved with individual shifts
    // This method is kept for backward compatibility
    // Notes will be included when saving the schedule
    if (!this.isAdmin) return;

    const notesTextarea = document.querySelector(DOM_IDS.WEEKLY_NOTES);
    if (notesTextarea !== null) {
      // Notes are saved with each shift in v2, not separately
    }

    // Notes will be saved with shifts in saveSchedule()
    showInfo('Notizen werden beim Speichern des Schichtplans mitübernommen');
  }

  updateUIForRole(): void {
    const adminControls = document.querySelectorAll('.admin-controls');
    const employeeInfo = document.querySelectorAll('.employee-info-section');
    const adminActions = document.querySelector('#adminActions');
    const employeeSidebar = document.querySelector('.employee-sidebar');
    const mainPlanningArea = document.querySelector('.main-planning-area');
    const notesTextarea = document.querySelector(DOM_IDS.WEEKLY_NOTES);
    const infoRow = document.querySelector('.shift-info-row');

    if (this.isAdmin) {
      // Admin view - show everything (but respect department selection)
      adminControls.forEach((el) => {
        el.classList.remove('hidden');
      });
      employeeInfo.forEach((el) => {
        el.classList.add('hidden');
      });
      // adminActions visibility is controlled by togglePlanningAreaVisibility
      if (employeeSidebar) (employeeSidebar as HTMLElement).style.display = 'block';
      if (notesTextarea !== null) notesTextarea.removeAttribute('readonly');
    } else {
      // Employee view - hide admin controls and sidebar
      adminControls.forEach((el) => {
        el.classList.add('hidden');
      });
      employeeInfo.forEach((el) => {
        el.classList.remove('hidden');
      });
      if (adminActions) (adminActions as HTMLElement).style.display = 'none';
      if (employeeSidebar) (employeeSidebar as HTMLElement).style.display = 'none';

      // Hide the info row (department, machine, team leader dropdowns) for employees
      if (infoRow) {
        (infoRow as HTMLElement).style.display = 'none';
      }

      // Make the main planning area full width when sidebar is hidden
      if (mainPlanningArea) {
        mainPlanningArea.classList.add('full-width');
      }

      // Make notes textarea readonly for employees
      if (notesTextarea) {
        notesTextarea.setAttribute('readonly', 'readonly');
        notesTextarea.parentElement?.classList.add('readonly');
      }
    }

    // Update instructions
    const instructions = document.querySelector('#instructions');
    if (instructions) {
      if (this.isAdmin) {
        instructions.innerHTML = `
          <p>Ziehen Sie Mitarbeiter auf die gewünschten Schichten oder klicken Sie erst auf einen Mitarbeiter und dann auf eine Schicht.</p>
        `;
      } else {
        instructions.innerHTML = `
          <p>Hier sehen Sie Ihren aktuellen Schichtplan. Ihre Schichten sind hervorgehoben.</p>
        `;
      }
    }
  }

  highlightEmployeeShifts(): void {
    if (this.isAdmin || this.currentUserId === null) return;

    // Remove existing highlights
    document.querySelectorAll('.employee-shift').forEach((el) => {
      el.classList.remove('employee-shift');
    });

    // Highlight current employee's shifts
    this.weeklyShifts.forEach((shifts, date) => {
      shifts.forEach((employeeIds, shiftType) => {
        if (this.currentUserId !== null && employeeIds.includes(this.currentUserId)) {
          const shiftCell = document.querySelector(`[data-date="${date}"][data-shift="${shiftType}"]`);
          shiftCell?.classList.add('employee-shift');
        }
      });
    });
  }

  private escapeHtml(text: string): string {
    const map = new Map<string, string>([
      ['&', '&amp;'],
      ['<', '&lt;'],
      ['>', '&gt;'],
      ['"', '&quot;'],
      ["'", '&#039;'],
    ]);
    return text.replace(/["&'<>]/g, (m) => map.get(m) ?? m);
  }

  private showShiftDetailsModal(shiftCell: HTMLElement): void {
    const date = shiftCell.dataset.date;
    const shift = shiftCell.dataset.shift;

    if (date === undefined || date === '' || shift === undefined || shift === '') return;

    // Find shift details
    const shiftDate = new Date(date);
    const dayName = shiftDate.toLocaleDateString('de-DE', { weekday: 'long' });
    const dateStr = shiftDate.toLocaleDateString('de-DE');

    // Get shift time based on type
    const shiftTimes = new Map<string, string>([
      ['early', '06:00 - 14:00'],
      ['late', '14:00 - 22:00'],
      ['night', '22:00 - 06:00'],
    ]);

    const shiftNames = new Map<string, string>([
      ['early', 'Frühschicht'],
      ['late', 'Spätschicht'],
      ['night', 'Nachtschicht'],
    ]);

    // Get assigned employees for this shift
    const employeeIds = this.getShiftEmployees(date, shift);
    const assignedEmployees = employeeIds
      .map((id) => {
        const employee = this.employees.find((e) => e.id === id);
        if (employee) {
          const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
          const name = fullName !== '' ? fullName : employee.username;
          return this.escapeHtml(name);
        }
        return '';
      })
      .filter((name) => name !== '')
      .join(', ');

    const modalContent = `
      <div class="shift-detail-modal">
        <h3>${shiftNames.get(shift) ?? shift} - ${dayName}</h3>
        <div class="shift-detail-info">
          <div class="detail-row">
            <span class="detail-label">Datum:</span>
            <span class="detail-value">${dateStr}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Zeit:</span>
            <span class="detail-value">${shiftTimes.get(shift) ?? ''}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Zugewiesene Mitarbeiter:</span>
            <span class="detail-value">${assignedEmployees !== '' ? assignedEmployees : 'Keine Mitarbeiter zugewiesen'}</span>
          </div>
          ${
            this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0
              ? `
          <div class="detail-row">
            <span class="detail-label">Abteilung:</span>
            <span class="detail-value">${this.departments.find((d) => d.id === this.selectedContext.departmentId)?.name ?? '-'}</span>
          </div>`
              : ''
          }
          ${
            this.selectedContext.machineId !== null && this.selectedContext.machineId !== 0
              ? `
          <div class="detail-row">
            <span class="detail-label">Maschine:</span>
            <span class="detail-value">${this.machines.find((m) => m.id === this.selectedContext.machineId)?.name ?? '-'}</span>
          </div>`
              : ''
          }
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="window.modalManager.closeModal()">Schließen</button>
        </div>
      </div>
    `;

    openModal(modalContent, {
      title: 'Schichtdetails',
      size: 'md',
    });
  }
}

// Initialize the system when the page loads
let shiftPlanningSystemInstance: ShiftPlanningSystem;

// Global function for dropdown selection (called from HTML onclick)
function selectOption(type: string, value: string, text: string): void {
  console.info(`[SHIFTS] Selected ${type}: ${value} - ${text}`);

  // Update display
  const display = document.querySelector(`#${type}Display span`);
  if (display) {
    display.textContent = text;
  }

  // Update hidden input
  const hiddenInput = document.querySelector<HTMLInputElement>(`#${type}Select`);
  if (hiddenInput !== null) {
    hiddenInput.value = value;
    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    hiddenInput.dispatchEvent(changeEvent);
  }

  // Close dropdown
  const dropdown = document.querySelector(`#${type}Dropdown`);
  if (dropdown) {
    dropdown.classList.remove('active');
  }
  const displayElement = document.querySelector(`#${type}Display`);
  if (displayElement) {
    displayElement.classList.remove('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  shiftPlanningSystemInstance = new ShiftPlanningSystem();
});

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  interface WindowWithShiftPlanning extends Window {
    ShiftPlanningSystem: typeof ShiftPlanningSystem;
    shiftPlanning: ShiftPlanningSystem;
    selectOption: typeof selectOption;
  }
  (window as unknown as WindowWithShiftPlanning).ShiftPlanningSystem = ShiftPlanningSystem;
  (window as unknown as WindowWithShiftPlanning).selectOption = selectOption;

  // Add global reference for modal callbacks
  Object.defineProperty(window, 'shiftPlanning', {
    get() {
      return shiftPlanningSystemInstance;
    },
  });
}
