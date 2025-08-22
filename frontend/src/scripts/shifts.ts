/**
 * New Shift Planning System - TypeScript Implementation
 * Interactive weekly shift planning with drag & drop functionality
 */

import type { User } from '../types/api.types';
import { ApiClient } from '../utils/api-client';
import { mapTeams, mapUsers, type TeamAPIResponse, type UserAPIResponse } from '../utils/api-mappers';
import { $$id, createElement } from '../utils/dom-utils';
import { getAuthToken, showInfo } from './auth';
import { showSuccessAlert, showErrorAlert, showConfirm } from './utils/alerts';
import { openModal } from './utils/modal-manager';

interface Employee extends User {
  department_id?: number;
  team_id?: number;
  shift_assignments?: ShiftAssignment[];
  availability_status?: 'available' | 'unavailable' | 'vacation' | 'sick' | 'training' | 'other';
  availability_reason?: string;
  available_from?: string;
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

interface ShiftFavorite {
  id: number | string;
  name: string; // Team name for display
  areaId: number;
  areaName: string;
  departmentId: number;
  departmentName: string;
  machineId: number;
  machineName: string;
  teamId: number;
  teamName: string;
  createdAt: string;
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
  WEEKLY_NOTES: 'weeklyNotes',
  CURRENT_WEEK_INFO: 'currentWeekInfo',
  NOTES_TOGGLE: 'notesToggle',
  NOTES_PANEL: 'notesPanel',
  USER_NAME: 'userName',
  CURRENT_DEPARTMENT: 'currentDepartment',
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
  DROPDOWN_MESSAGE: 'dropdown-message',
  EMPLOYEE_NAME: 'employee-name',
} as const;

// Display values
const DISPLAY = {
  NONE: 'none',
  BLOCK: 'block',
  INLINE_BLOCK: 'inline-block',
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
  private currentPlanId: number | null; // Store current plan ID for updates
  private isEditMode: boolean; // Track if we're in edit mode

  // Context data for shift planning
  private areas: Area[];
  private departments: Department[];
  private machines: Machine[];
  private teams: Team[];
  private teamLeaders: TeamLeader[];
  private selectedContext: SelectedContext;
  private favorites: ShiftFavorite[]; // Store shift planning favorites

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
    this.currentPlanId = null;
    this.isEditMode = false;

    // Load favorites from API
    this.favorites = [];
    void (async () => {
      try {
        const favs = await this.loadFavorites();
        this.favorites = favs;
        this.renderFavorites();
        // Check button visibility after favorites are loaded
        this.updateAddFavoriteButton();
      } catch (error: unknown) {
        console.error('Failed to load favorites:', error);
      }
    })();

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

    // Check if there's a saved context from before a reload
    const savedContextStr = localStorage.getItem('shiftsReloadContext');
    if (savedContextStr !== null) {
      try {
        const savedContext = JSON.parse(savedContextStr) as {
          areaId: number | null;
          departmentId: number | null;
          machineId: number | null;
          teamId: number | null;
          currentWeek: string;
          planId: number | null;
          timestamp: number;
        };

        // Check if the saved context is recent (less than 5 minutes old)
        const ageInMs = Date.now() - savedContext.timestamp;
        if (ageInMs < 5 * 60 * 1000) {
          console.info('[SHIFTS RELOAD DEBUG] Restoring saved context after reload:', savedContext);

          // Restore the context
          this.selectedContext.areaId = savedContext.areaId;
          this.selectedContext.departmentId = savedContext.departmentId;
          this.selectedContext.machineId = savedContext.machineId;
          this.selectedContext.teamId = savedContext.teamId;
          this.currentWeek = new Date(savedContext.currentWeek);
          this.currentPlanId = savedContext.planId;

          // Mark that we're restoring from reload - will be processed after dropdowns are loaded
          // Store this for later use after loadContextData() populates the dropdowns
          // Using window object to store temporary data to avoid TypeScript issues
          (
            window as Window & {
              shiftsRestoringFromReload?: boolean;
              shiftsSavedReloadContext?: typeof savedContext;
            }
          ).shiftsRestoringFromReload = true;
          (
            window as Window & {
              shiftsRestoringFromReload?: boolean;
              shiftsSavedReloadContext?: typeof savedContext;
            }
          ).shiftsSavedReloadContext = savedContext;

          // Clear the saved context from localStorage
          localStorage.removeItem('shiftsReloadContext');
          console.info('[SHIFTS RELOAD DEBUG] Context restored and cleared from localStorage');
        } else {
          console.info('[SHIFTS RELOAD DEBUG] Saved context is too old, ignoring');
          localStorage.removeItem('shiftsReloadContext');
        }
      } catch (error) {
        console.error('[SHIFTS RELOAD DEBUG] Error parsing saved context:', error);
        localStorage.removeItem('shiftsReloadContext');
      }
    }

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

      // If we're restoring from reload, set the custom dropdowns
      const windowWithShifts = window as Window & {
        shiftsRestoringFromReload?: boolean;
        shiftsSavedReloadContext?: {
          areaId: number | null;
          departmentId: number | null;
          machineId: number | null;
          teamId: number | null;
          currentWeek: string;
          planId: number | null;
          timestamp: number;
        };
      };

      if (
        windowWithShifts.shiftsRestoringFromReload === true &&
        windowWithShifts.shiftsSavedReloadContext !== undefined
      ) {
        console.info('[SHIFTS RELOAD DEBUG] Restoring dropdown selections...');
        const context = windowWithShifts.shiftsSavedReloadContext;

        // Helper function to set custom dropdown
        const setCustomDropdown = (selectId: string, displayId: string, value: number | null, label?: string): void => {
          if (value === null) return;

          // Set the hidden input value
          const hiddenInput = $$id<HTMLInputElement>(selectId);
          if (hiddenInput !== null) {
            hiddenInput.value = String(value);
          }

          // Update the display element
          const display = $$id(displayId);
          if (display !== null && label !== undefined) {
            const span = display.querySelector('span');
            if (span !== null) {
              span.textContent = label;
            }
          }
        };

        // Load and set dropdowns in cascade order
        // 1. Set Area
        if (context.areaId !== null) {
          const area = this.areas.find((a) => a.id === context.areaId);
          if (area !== undefined) {
            setCustomDropdown('areaSelect', 'areaDisplay', context.areaId, area.name);
            // Load departments for this area
            await this.loadDepartments(context.areaId);
            this.populateDepartmentSelect();
          }
        }

        // 2. Set Department
        if (context.departmentId !== null) {
          const dept = this.departments.find((d) => d.id === context.departmentId);
          if (dept !== undefined) {
            setCustomDropdown('departmentSelect', 'departmentDisplay', context.departmentId, dept.name);
            // Load machines for this department
            this.selectedContext.departmentId = context.departmentId; // Set context before loading
            await this.loadMachines();
            this.populateMachineSelect();
          }
        }

        // 3. Set Machine
        if (context.machineId !== null) {
          const machine = this.machines.find((m) => m.id === context.machineId);
          if (machine !== undefined) {
            setCustomDropdown('machineSelect', 'machineDisplay', context.machineId, machine.name);
            // Load teams for this machine (or department if no machine-specific teams)
            await this.loadTeamsForMachine(context.machineId);
            this.populateTeamSelect();
          }
        }

        // 4. Set Team
        if (context.teamId !== null) {
          const team = this.teams.find((t) => t.id === context.teamId);
          if (team !== undefined) {
            setCustomDropdown('teamSelect', 'teamDisplay', context.teamId, team.name);
          }
        }

        // Clean up temporary properties
        delete windowWithShifts.shiftsRestoringFromReload;
        delete windowWithShifts.shiftsSavedReloadContext;

        console.info('[SHIFTS RELOAD DEBUG] Dropdown selections restored');
      }

      // Only load data if a team is already selected (e.g., from saved state)
      // For admins, check if teamId is selected
      // For employees, they will have departmentId pre-selected
      const shouldLoadData = this.isAdmin
        ? this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0
        : this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0;

      if (shouldLoadData) {
        console.info('[SHIFTS DEBUG] Team/Department selected, loading data...');
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
      } else {
        console.info('[SHIFTS DEBUG] No team/department selected, skipping initial data load');
      }

      // Update UI based on user role
      console.info('[SHIFTS DEBUG] Updating UI for role:', this.userRole);
      this.updateUIForRole();

      // Initialize the week display immediately
      this.updateWeekDisplay();

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

      // Render favorites on init
      this.renderFavorites();

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

    // Detect drag attempt on non-draggable items
    let mouseDownTime = 0;
    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);
      if (employeeItem && employeeItem.getAttribute('draggable') === 'false') {
        mouseDownTime = Date.now();

        // Set up temporary mousemove listener to detect drag attempt
        const handleMouseMove = (moveEvent: MouseEvent) => {
          // If mouse moved more than 5px, it's a drag attempt
          const distance = Math.sqrt(
            Math.pow(moveEvent.clientX - e.clientX, 2) + Math.pow(moveEvent.clientY - e.clientY, 2),
          );

          if (distance > 5) {
            // User is trying to drag a locked item
            if (this.currentPlanId !== null && !this.isEditMode) {
              showErrorAlert('Bitte erst auf "Bearbeiten" klicken, um Änderungen vorzunehmen');
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          }
        };

        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    });

    // Employee selection (fallback for non-drag interaction)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);
      if (employeeItem && !this.isDragging && Date.now() - mouseDownTime < 200) {
        // Only process click if it wasn't a drag attempt (quick click < 200ms)
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

    // Edit mode button (will be created dynamically)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'editScheduleBtn') {
        this.toggleEditMode(true);
      } else if (target.id === 'updateScheduleBtn') {
        void this.updateSchedule();
      }
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

          // Show alert if trying to drag in read-only mode
          if (this.currentPlanId !== null && !this.isEditMode) {
            showErrorAlert('Bitte erst auf "Bearbeiten" klicken, um Änderungen vorzunehmen');
          }
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
        void this.onTeamSelected(this.selectedContext.teamId ?? undefined);
      });
    }

    // Machine selection (now filters teams!)
    const machineSelect = document.querySelector('#machineSelect');
    if (machineSelect !== null) {
      machineSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.selectedContext.machineId = target.value !== '' ? Number.parseInt(target.value, 10) : null;
        void this.onMachineSelected(this.selectedContext.machineId ?? undefined);
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
    // Load ONLY areas first (top of hierarchy)
    // Departments and machines will be loaded after area selection
    await this.loadAreas();

    // Clear departments and machines initially
    this.departments = [];
    this.machines = [];
    this.teams = [];

    // Update dropdowns to show empty state
    this.populateDepartmentSelect();
    this.populateMachineSelect();
    this.populateTeamSelect();
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
      const params: string[] = [];

      // Filter by department if selected
      if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
        params.push(`department_id=${String(this.selectedContext.departmentId)}`);
      }

      // Filter by area if selected
      if (this.selectedContext.areaId !== null && this.selectedContext.areaId !== 0) {
        params.push(`area_id=${String(this.selectedContext.areaId)}`);
      }

      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAuthToken() ?? ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // API returns array directly, not wrapped in object
        const data = (await response.json()) as Machine[];
        this.machines = Array.isArray(data) ? data : [];
        console.info('[SHIFTS] Machines loaded:', this.machines);
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
    // populateTeamSelect() is called by the calling function
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

    // Show message if no area selected
    if (this.departments.length === 0) {
      const message = document.createElement('div');
      message.className = CSS_CLASSES.DROPDOWN_MESSAGE;
      message.textContent = 'Bitte erst Bereich auswählen';
      message.style.padding = '10px';
      message.style.color = '#999';
      message.style.fontStyle = 'italic';
      dropdown.append(message);
      return;
    }

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

    // Show message if no department selected
    if (this.selectedContext.departmentId === null || this.selectedContext.departmentId === 0) {
      const message = document.createElement('div');
      message.className = CSS_CLASSES.DROPDOWN_MESSAGE;
      message.textContent = 'Bitte erst Abteilung auswählen';
      message.style.padding = '10px';
      message.style.color = '#999';
      message.style.fontStyle = 'italic';
      dropdown.append(message);
      return;
    }

    // Filter machines by selected department (we already know departmentId is set)
    const filteredMachines = this.machines.filter(
      (machine) => machine.department_id === this.selectedContext.departmentId,
    );

    if (filteredMachines.length === 0) {
      const message = document.createElement('div');
      message.className = CSS_CLASSES.DROPDOWN_MESSAGE;
      message.textContent = 'Keine Maschinen verfügbar';
      message.style.padding = '10px';
      message.style.color = '#999';
      message.style.fontStyle = 'italic';
      dropdown.append(message);
      return;
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

    // Show message if no machine selected
    if (this.selectedContext.machineId === null || this.selectedContext.machineId === 0) {
      const message = document.createElement('div');
      message.className = CSS_CLASSES.DROPDOWN_MESSAGE;
      message.textContent = 'Bitte erst Maschine auswählen';
      message.style.padding = '10px';
      message.style.color = '#999';
      message.style.fontStyle = 'italic';
      dropdown.append(message);
      return;
    }

    // Teams are already filtered by machine via loadTeamsForMachine
    if (this.teams.length === 0) {
      const message = document.createElement('div');
      message.className = CSS_CLASSES.DROPDOWN_MESSAGE;
      message.textContent = 'Keine Teams verfügbar';
      message.style.padding = '10px';
      message.style.color = '#999';
      message.style.fontStyle = 'italic';
      dropdown.append(message);
      return;
    }

    this.teams.forEach((team) => {
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
      this.populateTeamSelect(); // Update dropdown after loading teams
    } else if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
      // If no machine selected, show all department teams
      await this.loadTeams();
      this.populateTeamSelect(); // Update dropdown after loading teams
    } else {
      // Clear teams if no context
      this.teams = [];
      this.populateTeamSelect();
    }
  }

  async onTeamSelected(teamId?: number): Promise<void> {
    console.info('[SHIFTS DEBUG] onTeamSelected called with teamId:', teamId);

    // Store the selected team
    this.selectedContext.teamId = teamId ?? null;

    // WICHTIG: Reset planId when team changes (different team = different plan)
    this.currentPlanId = null;
    this.isEditMode = false;
    console.info('[SHIFTS DEBUG] PlanId reset to null due to team change');

    console.info('[SHIFTS DEBUG] selectedContext after setting teamId:', this.selectedContext);

    // Load team members when a team is selected
    if (this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0) {
      console.info('[SHIFTS DEBUG] Team selected, loading data...');
      await this.loadTeamMembers();

      // Now show the planning area and load shifts
      this.togglePlanningAreaVisibility();
      await this.loadCurrentWeekData();
      await this.loadEmployees();
    } else {
      console.info('[SHIFTS DEBUG] No team selected, hiding planning area');
      // Hide planning area if no team selected
      this.togglePlanningAreaVisibility();
    }

    // Update favorites button visibility
    this.updateAddFavoriteButton();
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
    // populateTeamSelect() is called in onMachineSelected
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
      showErrorAlert(validation.message ?? 'Ungültige Auswahl-Hierarchie');
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
          showSuccessAlert('Schicht zugewiesen');
          this.updateShiftCell(cellElement, userId, shiftType);
        } else {
          showErrorAlert(ERROR_MESSAGES.SHIFT_ASSIGNMENT_FAILED);
        }
      } catch (error) {
        console.error('Error assigning shift (v1):', error);
        showErrorAlert('Fehler beim Zuweisen der Schicht');
      }
    } else {
      // Use v2 API with ApiClient
      try {
        await this.apiClient.request('/shifts', {
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

    console.info('[SHIFTS DEBUG] togglePlanningAreaVisibility called');
    console.info('[SHIFTS DEBUG] isAdmin:', this.isAdmin);
    console.info('[SHIFTS DEBUG] selectedContext:', this.selectedContext);
    console.info('[SHIFTS DEBUG] Elements found:', {
      departmentNotice: !!departmentNotice,
      mainPlanningArea: !!mainPlanningArea,
      adminActions: !!adminActions,
      weekNavigation: !!weekNavigation,
    });

    // Show planning area only when team is selected (or for employees with auto-selected team)
    const shouldShowPlanning = this.isAdmin
      ? this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0
      : this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0;

    console.info('[SHIFTS DEBUG] shouldShowPlanning:', shouldShowPlanning);

    if (shouldShowPlanning) {
      // Team selected (or employee with auto-selected dept) - show planning area
      if (departmentNotice) (departmentNotice as HTMLElement).style.display = 'none';
      if (mainPlanningArea) (mainPlanningArea as HTMLElement).style.display = '';
      if (adminActions && this.isAdmin) (adminActions as HTMLElement).style.display = 'block';
      if (weekNavigation) (weekNavigation as HTMLElement).style.display = 'flex';

      // Load data for the selected department
      void (async () => {
        console.info('[SHIFTS DEBUG] Loading employees for selected team/department');
        await this.loadEmployees();
        console.info('[SHIFTS DEBUG] About to call loadCurrentWeekData');
        await this.loadCurrentWeekData();
        console.info('[SHIFTS DEBUG] loadCurrentWeekData completed');
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
      // If a team is selected, load team members via user_teams junction
      let url = '/api/users';
      if (this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0) {
        // Load team members directly via teams endpoint
        url = `/api/teams/${String(this.selectedContext.teamId)}/members`;
        console.info('[SHIFTS DEBUG] Loading team members from user_teams junction');
      } else {
        // Otherwise load all department users
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
        // Include all users from team (not just 'employee' role, as admins can also be team members)
        this.employees = users as Employee[];

        console.info('[SHIFTS DEBUG] Employees loaded:', this.employees.length, 'employees');
        console.info('[SHIFTS DEBUG] Employee data:', this.employees);
        console.info(
          '[SHIFTS DEBUG] Employee IDs:',
          this.employees.map((e) => e.id),
        );

        // Load availability status for the current week
        await this.loadEmployeeAvailability();

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

  async loadEmployeeAvailability(): Promise<void> {
    try {
      // Get the start and end date for the current week
      const weekStart = this.getWeekStart(this.currentWeek);
      const weekEnd = this.getWeekEnd(this.currentWeek);

      // Format dates for API
      const startStr = this.formatDate(weekStart);
      const endStr = this.formatDate(weekEnd);

      console.info('[SHIFTS] Loading availability for week:', startStr, 'to', endStr);

      // Load availability status from API
      const response = await fetch(`/api/availability/current?start_date=${startStr}&end_date=${endStr}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken() ?? ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as {
          employees?: {
            employee_id: number;
            current_status: string;
            current_reason?: string;
            available_from?: string;
          }[];
        };

        const availabilityData = data.employees ?? [];

        // Map availability to employees
        this.employees.forEach((employee) => {
          const availability = availabilityData.find((a) => a.employee_id === employee.id);
          if (availability) {
            employee.availability_status = availability.current_status as
              | 'available'
              | 'unavailable'
              | 'vacation'
              | 'sick'
              | 'training'
              | 'other';
            employee.availability_reason = availability.current_reason;
            employee.available_from = availability.available_from;
          } else {
            // Default to available if no specific status
            employee.availability_status = 'available';
          }
        });

        console.info('[SHIFTS] Availability loaded for', availabilityData.length, 'employees');
      } else {
        console.warn('[SHIFTS] Could not load availability, defaulting all to available');
        // Default all to available if API fails
        this.employees.forEach((employee) => {
          employee.availability_status = 'available';
        });
      }
    } catch (error) {
      console.error('[SHIFTS] Error loading availability:', error);
      // Default all to available on error
      this.employees.forEach((employee) => {
        employee.availability_status = 'available';
      });
    }
  }

  loadAvailabilityStatus(): void {
    // Deprecated - kept for backward compatibility
    console.info('[SHIFTS] loadAvailabilityStatus is deprecated, use loadEmployeeAvailability');
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

      // Only available employees can be dragged AND only in edit mode or when no plan exists
      const isDraggable =
        this.isAdmin &&
        (employee.availability_status === 'available' || employee.availability_status === undefined) &&
        (this.currentPlanId === null || this.isEditMode);
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

    // Check if in edit mode when a plan exists
    if (this.currentPlanId !== null && !this.isEditMode) {
      showErrorAlert('Bitte erst auf "Bearbeiten" klicken, um Änderungen vorzunehmen');
      return;
    }

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

    // Check if in edit mode when a plan exists
    if (this.currentPlanId !== null && !this.isEditMode) {
      showErrorAlert('Bitte erst auf "Bearbeiten" klicken, um Änderungen vorzunehmen');
      return;
    }

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

    // Check employee availability before assignment
    if (employee.availability_status !== undefined && employee.availability_status !== 'available') {
      // Build error message with details
      const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
      const employeeName = fullName !== '' ? fullName : employee.username;
      let errorMsg = `${employeeName} ist nicht verfügbar`;

      // Add status text
      const statusTexts: Record<string, string> = {
        vacation: 'im Urlaub',
        sick: 'krankgemeldet',
        unavailable: 'nicht verfügbar',
        training: 'in Schulung',
        other: 'anderweitig abwesend',
      };

      if (employee.availability_status in statusTexts) {
        errorMsg = `${employeeName} ist ${statusTexts[employee.availability_status]}`;
      }

      // Add date range if available
      if (employee.available_from !== undefined && employee.available_from !== '') {
        errorMsg += ` (verfügbar ab ${new Date(employee.available_from).toLocaleDateString('de-DE')})`;
      }

      // Add reason if available
      if (employee.availability_reason !== undefined && employee.availability_reason !== '') {
        errorMsg += `: ${employee.availability_reason}`;
      }

      showErrorAlert(errorMsg);
      return;
    }

    console.info('[SHIFTS DEBUG] Found employee:', employee);

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

        showErrorAlert(
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
    console.info('[SHIFTS RELOAD DEBUG] loadCurrentWeekData called');
    console.info('[SHIFTS RELOAD DEBUG] Current context:', this.selectedContext);
    console.info('[SHIFTS RELOAD DEBUG] useV2API:', this.useV2API);

    try {
      const weekStart = this.getWeekStart(this.currentWeek);
      const weekEnd = this.getWeekEnd(this.currentWeek);

      // Format dates for API
      const startStr = this.formatDate(weekStart);
      const endStr = this.formatDate(weekEnd);

      console.info('[SHIFTS PLAN DEBUG] Loading shifts for range:', startStr, 'to', endStr);

      // Check if v2 API is enabled
      if (!this.useV2API) {
        // Legacy v1 API
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
      } else {
        // NEW v2 API - Plan-based loading
        try {
          // Build query parameters for v2 API
          const params = new URLSearchParams({
            startDate: startStr,
            endDate: endStr,
          });

          // Add context filters if selected
          if (this.selectedContext.departmentId !== null) {
            params.append('departmentId', String(this.selectedContext.departmentId));
          }
          if (this.selectedContext.teamId !== null) {
            params.append('teamId', String(this.selectedContext.teamId));
          }
          if (this.selectedContext.machineId !== null) {
            params.append('machineId', String(this.selectedContext.machineId));
          }
          if (this.selectedContext.areaId !== null) {
            params.append('areaId', String(this.selectedContext.areaId));
          }

          console.info('[SHIFTS PLAN DEBUG] Loading plan with params:', params.toString());
          console.info('[SHIFTS PLAN DEBUG] Making GET request to /api/v2/shifts/plan');

          // Use /api/v2/shifts/plan endpoint
          const response = await this.apiClient.request(`/shifts/plan?${params.toString()}`, {
            method: 'GET',
          });

          console.info('[SHIFTS PLAN DEBUG] Plan Response received');
          console.info('[SHIFTS PLAN DEBUG] Response type:', typeof response);
          console.info('[SHIFTS PLAN DEBUG] Response:', response);

          // Check if response has shifts array (API v2 format)
          if (response !== null && typeof response === 'object' && 'shifts' in response) {
            const planData = response as {
              plan?: {
                id: number;
                name: string;
                shiftNotes?: string; // API v2 uses camelCase
                startDate: string;
                endDate: string;
              };
              shifts: {
                id?: number;
                userId: number;
                date: string;
                type: string;
                startTime?: string;
                endTime?: string;
                user?: {
                  id: number;
                  firstName: string;
                  lastName: string;
                  username: string;
                };
              }[];
              notes?: Record<string, { note: string }> | unknown[];
            };

            // Check if we have a plan or just shifts
            const notesTextarea = $$id<HTMLTextAreaElement>('weeklyNotes');

            if (planData.plan) {
              console.info('[SHIFTS PLAN DEBUG] Plan loaded:', planData.plan);
              // Store current plan ID for update functionality
              this.currentPlanId = planData.plan.id;

              // Reset edit mode when loading a plan
              this.isEditMode = false;

              // Load notes from plan.shiftNotes (camelCase from API v2)
              const shiftNotes = (planData.plan as { shiftNotes?: string }).shiftNotes;
              if (shiftNotes !== undefined && shiftNotes !== '' && notesTextarea !== null) {
                notesTextarea.value = shiftNotes;
              } else if (notesTextarea !== null) {
                // Plan exists but no notes - clear textarea
                notesTextarea.value = '';
              }

              // Update button visibility and lock the plan
              this.updateButtonVisibility();
              this.lockShiftPlan();
            } else {
              // No plan for this week - clear everything
              console.info('[SHIFTS PLAN DEBUG] No plan found for this week - clearing notes');
              this.currentPlanId = null;
              this.isEditMode = false;

              if (notesTextarea !== null) {
                notesTextarea.value = '';
              }

              // Update button visibility and unlock for new plan creation
              this.updateButtonVisibility();
              this.unlockShiftPlan();
            }

            console.info('[SHIFTS PLAN DEBUG] Number of shifts:', planData.shifts.length);

            // Convert v2 format to legacy format for processShiftData
            const legacyShifts = planData.shifts.map((shift) => ({
              date: shift.date,
              shift_type: shift.type,
              employee_id: shift.userId,
              first_name: shift.user?.firstName ?? 'Unknown',
              last_name: shift.user?.lastName ?? 'User',
              username: shift.user?.username ?? `user_${String(shift.userId)}`,
            }));

            this.processShiftData(legacyShifts);
          } else if (response !== null && typeof response === 'object' && 'message' in response) {
            // No plan found for this week, that's okay
            console.info('[SHIFTS PLAN DEBUG] No plan found for this week');
            this.weeklyShifts = new Map();
            this.shiftDetails = new Map();
            this.currentPlanId = null;

            // Clear the notes textarea when no plan exists
            const notesTextarea = $$id<HTMLTextAreaElement>('weeklyNotes');
            if (notesTextarea !== null) {
              notesTextarea.value = '';
            }
          }

          this.renderWeekView();
        } catch (error) {
          console.error('[SHIFTS PLAN DEBUG] Error loading plan, falling back:', error);
          // If plan endpoint fails, clear the data
          this.weeklyShifts = new Map();
          this.shiftDetails = new Map();
          this.currentPlanId = null;

          // Clear the notes textarea on error
          const notesTextarea = $$id<HTMLTextAreaElement>('weeklyNotes');
          if (notesTextarea !== null) {
            notesTextarea.value = '';
          }

          this.renderWeekView();
        }
      }
    } catch (error) {
      console.error('Error loading shift data:', error);
      this.renderWeekView();
    }

    // ALWAYS update counts and re-render employee list after loading data
    console.info('[SHIFTS RELOAD DEBUG] Updating employee shift counts after load...');
    this.updateEmployeeShiftCounts();

    console.info('[SHIFTS RELOAD DEBUG] Re-rendering employee list after load...');
    this.renderEmployeeList();

    console.info('[SHIFTS RELOAD DEBUG] loadCurrentWeekData fully completed');
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
    console.info('[SHIFTS DEBUG] Current planId before navigation:', this.currentPlanId);

    const newDate = new Date(this.currentWeek);

    const daysToAdd = direction * 7;
    newDate.setDate(newDate.getDate() + daysToAdd);
    this.currentWeek = newDate;

    // WICHTIG: Reset planId when navigating to a different week!
    this.currentPlanId = null;
    this.isEditMode = false;

    console.info('[SHIFTS DEBUG] New week after:', this.currentWeek);

    // Update the week display immediately
    this.updateWeekDisplay();
    console.info('[SHIFTS DEBUG] PlanId reset to null for new week');

    // Update button visibility after resetting planId
    this.updateButtonVisibility();

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

  updateWeekDisplay(): void {
    const weekStart = this.getWeekStart(this.currentWeek);
    const currentWeekElement = document.querySelector('#currentWeekInfo');
    if (currentWeekElement) {
      currentWeekElement.textContent = this.formatWeekRange(weekStart);
      console.info('[SHIFTS DEBUG] Week display updated:', currentWeekElement.textContent);
    } else {
      console.warn('[SHIFTS WARN] currentWeekInfo element not found');
    }
  }

  formatWeekRange(weekStart: Date): string {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Get calendar week number
    const weekNumber = this.getWeekNumber(weekStart);

    // Format dates in German format DD.MM.YYYY
    const formatDate = (date: Date): string => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      return `${day}.${month}.${year}`;
    };

    const startStr = formatDate(weekStart);
    const endStr = formatDate(weekEnd);

    return `KW ${String(weekNumber)} - ${startStr} bis ${endStr}`;
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

    // Add remove button for admins (only in edit mode)
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
      // Hide button if not in edit mode
      if (!this.isEditMode && this.currentPlanId !== null) {
        removeBtn.style.display = 'none';
      }
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

  async saveSchedule(isUpdate = false): Promise<void> {
    console.info('[SHIFTS SAVE DEBUG] saveSchedule called, isUpdate:', isUpdate);
    console.info('[SHIFTS SAVE DEBUG] currentPlanId:', this.currentPlanId);
    console.info('[SHIFTS SAVE DEBUG] useV2API:', this.useV2API);

    if (!this.isAdmin) {
      console.warn('[SHIFTS SAVE DEBUG] Not admin, returning');
      return;
    }

    // Validate department selection
    if (this.selectedContext.departmentId === null || this.selectedContext.departmentId === 0) {
      console.warn('[SHIFTS SAVE DEBUG] No department selected, returning');
      showErrorAlert('Bitte wählen Sie zuerst eine Abteilung aus');
      return;
    }

    // Success message constant
    const SAVE_SUCCESS_MESSAGE = 'Schichtplan erfolgreich gespeichert!';

    console.info('[SHIFTS SAVE DEBUG] Starting save process...');
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
          showSuccessAlert(SAVE_SUCCESS_MESSAGE);
          await this.loadCurrentWeekData();
        } else {
          const error = (await response.json()) as { message?: string };
          showErrorAlert(error.message ?? 'Fehler beim Speichern des Schichtplans');
        }
      } else {
        // v2 API - Plan-basierte Speicherung (NEU!)
        // Sammle alle Shifts für den Plan
        const shiftsForPlan: {
          userId: number;
          date: string;
          type: string;
          startTime: string;
          endTime: string;
        }[] = [];

        // REMOVED: dailyNotes - we use plan.description/shift_notes instead
        // Daily notes for each day are redundant when we have one note for the whole plan

        this.weeklyShifts.forEach((shifts, date) => {
          shifts.forEach((employeeIds, shiftType) => {
            employeeIds.forEach((employeeId) => {
              shiftsForPlan.push({
                userId: employeeId,
                date,
                type: shiftType,
                startTime: this.getShiftStartTime(shiftType),
                endTime: this.getShiftEndTime(shiftType),
              });
            });
          });
        });

        // Log all shifts that will be created
        console.info('[SHIFTS PLAN DEBUG] ==========================================');
        console.info('[SHIFTS PLAN DEBUG] Total shifts in plan:', shiftsForPlan.length);
        console.info('[SHIFTS PLAN DEBUG] Week start:', weekStart);
        console.info('[SHIFTS PLAN DEBUG] Week end:', weekEnd);
        console.info('[SHIFTS PLAN DEBUG] Selected context:', this.selectedContext);
        console.info('[SHIFTS PLAN DEBUG] Notes:', notes);
        console.info('[SHIFTS PLAN DEBUG] ==========================================');

        // Check if shift plan is incomplete (less than 10 shifts for Mo-Fr with early+late)
        const expectedMinShifts = 10; // Mo-Fr je 2 Schichten (früh+spät)
        if (shiftsForPlan.length < expectedMinShifts) {
          const confirmed = await showConfirm(
            `Der Schichtplan ist unvollständig (${String(shiftsForPlan.length)} von mindestens ${String(expectedMinShifts)} Schichten ausgefüllt). Trotzdem speichern?`,
          );
          if (!confirmed) {
            console.info('[SHIFTS PLAN DEBUG] User cancelled save due to incomplete plan');
            return;
          }
        }

        // Helper to convert null to undefined for API
        const nullToUndefined = <T>(value: T | null): T | undefined => {
          return value ?? undefined;
        };

        // Erstelle Plan-Request für neuen /api/v2/shifts/plan Endpoint
        const planRequest = {
          startDate: weekStart,
          endDate: weekEnd,
          areaId: nullToUndefined(this.selectedContext.areaId),
          departmentId: nullToUndefined(this.selectedContext.departmentId),
          teamId: nullToUndefined(this.selectedContext.teamId),
          machineId: nullToUndefined(this.selectedContext.machineId),
          name: `Schichtplan KW${String(this.getWeekNumber(this.currentWeek))}/${String(new Date().getFullYear())}`,
          shiftNotes: notes !== '' ? notes : undefined, // API v2 uses camelCase
          shifts: shiftsForPlan,
          // dailyNotes removed - redundant with shiftNotes
        };

        try {
          if (isUpdate && this.currentPlanId !== null) {
            console.info('[SHIFTS PLAN DEBUG] Updating existing plan:', this.currentPlanId);
          } else {
            console.info('[SHIFTS PLAN DEBUG] Creating new plan');
          }
          console.info('[SHIFTS PLAN DEBUG] Sending plan to API:', planRequest);

          // NEUER ENDPOINT: /api/v2/shifts/plan
          const endpoint =
            isUpdate && this.currentPlanId !== null ? `/shifts/plan/${String(this.currentPlanId)}` : '/shifts/plan';

          const response = await this.apiClient.request(endpoint, {
            method: isUpdate && this.currentPlanId !== null ? 'PUT' : 'POST',
            body: JSON.stringify(planRequest),
          });

          console.info('[SHIFTS PLAN DEBUG] API Response:', response);

          // Response enthält planId und shiftIds
          if (response !== null && typeof response === 'object' && 'planId' in response) {
            const result = response as { planId: number; shiftIds: number[]; message?: string };
            console.info('[SHIFTS PLAN DEBUG] Created plan ID:', result.planId);
            console.info('[SHIFTS PLAN DEBUG] Created shift IDs:', result.shiftIds);
            this.currentPlanId = result.planId; // Store plan ID for future updates
            showSuccessAlert(result.message ?? SAVE_SUCCESS_MESSAGE);
          } else {
            showSuccessAlert(isUpdate ? 'Schichtplan wurde aktualisiert' : SAVE_SUCCESS_MESSAGE);
          }

          // If we were in edit mode, exit it after successful save
          if (isUpdate && this.isEditMode) {
            this.toggleEditMode(false);
          }

          // Save current context and week to localStorage before full page reload
          console.info('[SHIFTS RELOAD DEBUG] Saving context and doing full page reload...');

          // Save current filters and week to localStorage so they can be restored after reload
          const reloadContext = {
            areaId: this.selectedContext.areaId,
            departmentId: this.selectedContext.departmentId,
            machineId: this.selectedContext.machineId,
            teamId: this.selectedContext.teamId,
            currentWeek: this.currentWeek.toISOString(),
            planId: this.currentPlanId,
            timestamp: Date.now(),
          };

          localStorage.setItem('shiftsReloadContext', JSON.stringify(reloadContext));
          console.info('[SHIFTS RELOAD DEBUG] Saved context to localStorage:', reloadContext);

          // Perform full page reload after slight delay so user sees success message
          setTimeout(() => {
            console.info('[SHIFTS RELOAD DEBUG] Performing full page reload...');
            window.location.reload();
          }, 500);
        } catch (error) {
          console.error('[SHIFTS PLAN DEBUG] Failed to create shift plan:', error);

          // Fallback auf alten Modus falls Plan-Endpoint nicht verfügbar
          if (error instanceof Error && error.message.includes('404')) {
            console.warn('[SHIFTS PLAN DEBUG] Plan endpoint not available, falling back to individual creation');
            showErrorAlert('Plan-basierte Speicherung noch nicht verfügbar. Bitte Backend aktualisieren.');
          } else {
            showErrorAlert('Fehler beim Speichern des Schichtplans');
          }
        }
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

  /**
   * Toggle edit mode for existing shift plans
   */
  toggleEditMode(enable: boolean): void {
    this.isEditMode = enable;

    if (enable) {
      this.unlockShiftPlan();
      showInfo('Bearbeitungsmodus aktiviert');
    } else {
      this.lockShiftPlan();
      showInfo('Bearbeitungsmodus beendet');
    }

    this.updateButtonVisibility();
  }

  /**
   * Update button visibility based on plan state and edit mode
   */
  updateButtonVisibility(): void {
    const saveBtn = $$id<HTMLButtonElement>('saveScheduleBtn');
    const resetBtn = $$id<HTMLButtonElement>('resetScheduleBtn');
    const adminActions = $$id('adminActions');

    if (!adminActions || !this.isAdmin) return;

    // Remove any existing edit/update buttons
    const existingEditBtn = document.querySelector('#editScheduleBtn');
    const existingUpdateBtn = document.querySelector('#updateScheduleBtn');
    if (existingEditBtn) existingEditBtn.remove();
    if (existingUpdateBtn) existingUpdateBtn.remove();

    if (this.currentPlanId !== null) {
      // Plan exists
      if (this.isEditMode) {
        // In edit mode - show update button
        if (saveBtn) saveBtn.style.display = DISPLAY.NONE;
        if (resetBtn) resetBtn.style.display = DISPLAY.INLINE_BLOCK;

        const updateBtn = document.createElement('button');
        updateBtn.id = 'updateScheduleBtn';
        updateBtn.className = 'admin-btn';
        updateBtn.textContent = 'Schichtplan aktualisieren';
        if (resetBtn) {
          resetBtn.before(updateBtn);
        } else {
          adminActions.append(updateBtn);
        }
      } else {
        // Read-only mode - show edit button
        if (saveBtn) saveBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';

        const editBtn = document.createElement('button');
        editBtn.id = 'editScheduleBtn';
        editBtn.className = 'admin-btn';
        editBtn.textContent = 'Bearbeiten';
        adminActions.insertBefore(editBtn, adminActions.firstChild);
      }
    } else {
      // No plan exists - show normal save button
      if (saveBtn) saveBtn.style.display = DISPLAY.INLINE_BLOCK;
      if (resetBtn) resetBtn.style.display = DISPLAY.INLINE_BLOCK;
    }
  }

  /**
   * Lock shift plan (make read-only)
   */
  lockShiftPlan(): void {
    // Disable drag and drop
    const draggableEmployees = document.querySelectorAll('.employee-item[draggable="true"]');
    draggableEmployees.forEach((el) => {
      el.setAttribute('draggable', 'false');
      el.classList.add('locked');
    });

    // Disable shift cells
    const shiftCells = document.querySelectorAll(CSS_SELECTORS.SHIFT_CELL);
    shiftCells.forEach((cell) => {
      cell.classList.add('locked');
    });

    // Hide remove buttons
    const removeButtons = document.querySelectorAll(`${CSS_SELECTORS.SHIFT_CELL} .remove-btn`);
    removeButtons.forEach((btn) => {
      (btn as HTMLElement).style.display = 'none';
    });

    // Make notes readonly
    const notesTextarea = document.querySelector('#weeklyNotes');
    if (notesTextarea) {
      notesTextarea.setAttribute('readonly', 'readonly');
    }
  }

  /**
   * Unlock shift plan (make editable)
   */
  unlockShiftPlan(): void {
    // Enable drag and drop
    const draggableEmployees = document.querySelectorAll('.employee-item[draggable="false"]');
    draggableEmployees.forEach((el) => {
      el.setAttribute('draggable', 'true');
      el.classList.remove('locked');
    });

    // Enable shift cells
    const shiftCells = document.querySelectorAll(CSS_SELECTORS.SHIFT_CELL);
    shiftCells.forEach((cell) => {
      cell.classList.remove('locked');
    });

    // Show remove buttons
    const removeButtons = document.querySelectorAll(`${CSS_SELECTORS.SHIFT_CELL} .remove-btn`);
    removeButtons.forEach((btn) => {
      (btn as HTMLElement).style.display = '';
    });

    // Make notes editable
    const notesTextarea = document.querySelector('#weeklyNotes');
    if (notesTextarea) {
      notesTextarea.removeAttribute('readonly');
    }
  }

  /**
   * Update existing shift plan (PUT request)
   */
  async updateSchedule(): Promise<void> {
    if (!this.isAdmin || this.currentPlanId === null) return;

    // Reuse saveSchedule logic but with PUT request
    await this.saveSchedule(true);
  }

  loadWeeklyNotes(): void {
    // In v2, notes are part of individual shifts
    // For now, we'll keep the UI element but not load separate notes
    // Notes will be saved with each shift in saveSchedule()
    console.info('[SHIFTS] Weekly notes are now part of individual shifts in v2');

    // DO NOT clear the textarea - it contains plan.description loaded from DB
    // The notes are part of the plan, not individual shifts
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

  // Helper method to get ISO week number
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() !== 0 ? d.getUTCDay() : 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  // ============== FAVORITES FUNCTIONALITY ==============

  /**
   * Load favorites from API
   */
  private async loadFavorites(): Promise<ShiftFavorite[]> {
    try {
      const token = localStorage.getItem('token');
      if (token === null || token === '') {
        throw new Error('No authentication token');
      }

      const response = await fetch('/api/v2/shifts/favorites', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load favorites');
      }

      const result = (await response.json()) as { data: ShiftFavorite[] };
      // Ensure we have valid data array
      return Array.isArray(result.data) ? result.data : [];
    } catch (error) {
      console.error('Error loading favorites:', error);
      return [];
    }
  }

  /**
   * Refresh favorites from API
   */
  private async refreshFavorites(): Promise<void> {
    try {
      this.favorites = await this.loadFavorites();
      this.renderFavorites();
    } catch (error) {
      console.error('Error refreshing favorites:', error);
    }
  }

  /**
   * Add current context as favorite
   */
  private async addToFavorites(): Promise<void> {
    console.info('[FAVORITE ADD] Current context:', this.selectedContext);

    // First check if this combination might already be favorited
    // Check by team since that's usually unique enough
    if (this.selectedContext.teamId !== null) {
      const existingFavorite = this.favorites.find((fav) => fav.teamId === this.selectedContext.teamId);
      if (existingFavorite) {
        console.info('[FAVORITE ADD] Team already exists as favorite:', existingFavorite);
        showErrorAlert(`Diese Kombination ist bereits als Favorit "${existingFavorite.name}" gespeichert!`);
        return;
      }
    }

    // Check if all required fields are selected
    if (
      this.selectedContext.areaId === null ||
      this.selectedContext.departmentId === null ||
      this.selectedContext.machineId === null ||
      this.selectedContext.teamId === null
    ) {
      console.error('[FAVORITE ADD] Missing filters:', {
        areaId: this.selectedContext.areaId,
        departmentId: this.selectedContext.departmentId,
        machineId: this.selectedContext.machineId,
        teamId: this.selectedContext.teamId,
      });
      showErrorAlert('Bitte wählen Sie alle Filter aus (Bereich, Abteilung, Maschine und Team)');
      return;
    }

    // Double-check if this exact combination is already favorited
    if (this.isCombinationFavorited()) {
      console.info('[FAVORITE ADD] Combination already exists as favorite');
      showErrorAlert('Diese Kombination existiert bereits als Favorit!');
      return;
    }

    // Get names for display
    const area = this.areas.find((a) => a.id === this.selectedContext.areaId);
    const department = this.departments.find((d) => d.id === this.selectedContext.departmentId);
    const machine = this.machines.find((m) => m.id === this.selectedContext.machineId);
    const team = this.teams.find((t) => t.id === this.selectedContext.teamId);

    if (!area || !department || !machine || !team) {
      showErrorAlert('Fehler beim Speichern des Favoriten');
      return;
    }

    // Double-check if this combination already exists (should not happen due to button hiding)
    if (this.isCombinationFavorited()) {
      showInfo('Diese Kombination ist bereits als Favorit gespeichert');
      return;
    }

    // Create new favorite via API
    try {
      const token = localStorage.getItem('token');
      if (token === null || token === '') {
        showErrorAlert('Nicht authentifiziert');
        return;
      }

      const response = await fetch('/api/v2/shifts/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: team.name,
          areaId: this.selectedContext.areaId,
          areaName: area.name,
          departmentId: this.selectedContext.departmentId,
          departmentName: department.name,
          machineId: this.selectedContext.machineId,
          machineName: machine.name,
          teamId: this.selectedContext.teamId,
          teamName: team.name,
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          showInfo('Ein Favorit mit diesem Namen existiert bereits');
        } else {
          const error = (await response.json()) as { error?: { message?: string } };
          showErrorAlert(error.error?.message ?? 'Fehler beim Speichern des Favoriten');
        }
        return;
      }

      // Refresh favorites list
      await this.refreshFavorites();
      showSuccessAlert(`Favorit "${team.name}" wurde gespeichert`);

      // Update button visibility since we added a new favorite
      this.updateAddFavoriteButton();
    } catch (error) {
      console.error('Error saving favorite:', error);
      showErrorAlert('Fehler beim Speichern des Favoriten');
    }
  }

  /**
   * Remove favorite by ID
   */
  private async removeFavorite(favoriteId: string | number): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (token === null || token === '') {
        showErrorAlert('Nicht authentifiziert');
        return;
      }

      const response = await fetch(`/api/v2/shifts/favorites/${favoriteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        showErrorAlert(error.error?.message ?? 'Fehler beim Löschen des Favoriten');
        return;
      }

      // Refresh favorites list
      await this.refreshFavorites();
      showSuccessAlert('Favorit wurde gelöscht');

      // Update button visibility since we removed a favorite
      this.updateAddFavoriteButton();
    } catch (error) {
      console.error('Error deleting favorite:', error);
      showErrorAlert('Fehler beim Löschen des Favoriten');
    }
  }

  /**
   * Load favorite and apply its filters
   */
  private async loadFavorite(favorite: ShiftFavorite): Promise<void> {
    console.info('[LOADFAVORITE] Starting to load favorite:', favorite);
    try {
      // 1. Set and load Area
      console.info('[LOADFAVORITE] Setting area:', favorite.areaId, favorite.areaName);
      this.selectedContext.areaId = favorite.areaId;
      const areaSelect = $$id<HTMLInputElement>('areaSelect');
      if (areaSelect) {
        areaSelect.value = String(favorite.areaId);
        console.info('[LOADFAVORITE] Area select value set to:', areaSelect.value);
      } else {
        console.error('[LOADFAVORITE] Area select element not found!');
      }

      const areaDisplay = document.querySelector('#areaDisplay span');
      if (areaDisplay) {
        areaDisplay.textContent = favorite.areaName;
        console.info('[LOADFAVORITE] Area display updated to:', favorite.areaName);
      } else {
        console.error('[LOADFAVORITE] Area display element not found!');
      }

      // Use the global selectOption to trigger loading departments
      const shiftsWindow = window as unknown as ShiftsWindow;
      console.info('[LOADFAVORITE] Calling selectOption for area');
      shiftsWindow.selectOption('area', String(favorite.areaId), favorite.areaName);

      // 2. Set and load Department
      console.info('[LOADFAVORITE] Setting department:', favorite.departmentId, favorite.departmentName);
      this.selectedContext.departmentId = favorite.departmentId;
      const departmentSelect = $$id<HTMLInputElement>('departmentSelect');
      if (departmentSelect) {
        departmentSelect.value = String(favorite.departmentId);
        console.info('[LOADFAVORITE] Department select value set to:', departmentSelect.value);
      } else {
        console.error('[LOADFAVORITE] Department select element not found!');
      }

      const departmentDisplay = document.querySelector('#departmentDisplay span');
      if (departmentDisplay) {
        departmentDisplay.textContent = favorite.departmentName;
        console.info('[LOADFAVORITE] Department display updated to:', favorite.departmentName);
      } else {
        console.error('[LOADFAVORITE] Department display element not found!');
      }

      // Load machines for this department
      console.info('[LOADFAVORITE] Loading machines for department');
      await this.loadMachines();

      // 3. Set and load Machine
      this.selectedContext.machineId = favorite.machineId;
      const machineSelect = $$id<HTMLInputElement>('machineSelect');
      if (machineSelect) machineSelect.value = String(favorite.machineId);

      const machineDisplay = document.querySelector('#machineDisplay span');
      if (machineDisplay) machineDisplay.textContent = favorite.machineName;

      // Load teams for this machine
      await this.onMachineSelected(favorite.machineId);

      // 4. Set Team and load shift plan
      this.selectedContext.teamId = favorite.teamId;
      const teamSelect = $$id<HTMLInputElement>('teamSelect');
      if (teamSelect) teamSelect.value = String(favorite.teamId);

      const teamDisplay = document.querySelector('#teamDisplay span');
      if (teamDisplay) teamDisplay.textContent = favorite.teamName;

      // Trigger team selection logic (loads shift plan)
      console.info('[LOADFAVORITE] Calling onTeamSelected with teamId:', favorite.teamId);
      await this.onTeamSelected(favorite.teamId);

      // Update button visibility (should hide since we loaded a favorited combination)
      console.info('[LOADFAVORITE] Updating add favorite button visibility');
      this.updateAddFavoriteButton();

      console.info('[LOADFAVORITE] Successfully loaded favorite!');
      showSuccessAlert(`Favorit "${favorite.name}" wurde geladen`);
    } catch (error) {
      console.error('[LOADFAVORITE] Error loading favorite:', error);
      showErrorAlert('Fehler beim Laden des Favoriten');
    }
  }

  /**
   * Render favorites UI
   */
  private renderFavorites(): void {
    // Check if favorites container exists, if not create it
    let favoritesContainer = document.querySelector('#favoritesContainer');

    if (!favoritesContainer) {
      // Create favorites container above the filter row
      const filterRow = document.querySelector('.shift-info-row');
      if (!filterRow) return;

      const container = document.createElement('div');
      container.id = 'favoritesContainer';
      container.className = 'favorites-container';
      container.innerHTML = `
        <div class="favorites-header">
          <span class="favorites-label">⭐ Favoriten:</span>
          <div class="favorites-list" id="favoritesList"></div>
        </div>
      `;
      filterRow.parentElement?.insertBefore(container, filterRow);
      favoritesContainer = container;
    }

    // Render favorite buttons
    const favoritesList = document.querySelector('#favoritesList');
    if (!favoritesList) return;

    // Clear existing content safely
    while (favoritesList.firstChild) {
      favoritesList.firstChild.remove();
    }

    // Only render if we have valid favorites
    if (!Array.isArray(this.favorites) || this.favorites.length === 0) {
      return;
    }

    // Create buttons using DOM methods (safe approach)
    this.favorites.forEach((fav) => {
      // Skip invalid favorites
      if (fav.id === '' || fav.teamName === '') {
        console.warn('Skipping invalid favorite:', fav);
        return;
      }

      const button = document.createElement('button');
      button.className = 'favorite-btn';
      button.dataset.favoriteId = String(fav.id);

      // Build title with values
      const areaName = fav.areaName;
      const departmentName = fav.departmentName;
      const machineName = fav.machineName;
      const teamName = fav.teamName;

      button.title = `${areaName} → ${departmentName} → ${machineName} → ${teamName}`;

      // Add team name text
      const textNode = document.createTextNode(teamName);
      button.append(textNode);

      // Add remove button
      const removeBtn = document.createElement('span');
      removeBtn.className = 'remove-favorite';
      removeBtn.dataset.favoriteId = String(fav.id);
      removeBtn.textContent = '×';
      button.append(removeBtn);

      // Add click event listener
      button.addEventListener('click', (e) => {
        console.info('[FAVORITE DEBUG] Button clicked!', e.target);
        const target = e.target as HTMLElement;
        // Check if remove button was clicked
        if (target.classList.contains('remove-favorite')) {
          console.info('[FAVORITE DEBUG] Remove button clicked, favId:', target.dataset.favoriteId);
          e.stopPropagation();
          const favId = target.dataset.favoriteId;
          if (favId !== undefined && favId !== '') void this.removeFavorite(favId);
        } else {
          // Load the favorite
          const favId = button.dataset.favoriteId;
          console.info('[FAVORITE DEBUG] Loading favorite with ID:', favId);
          console.info('[FAVORITE DEBUG] All favorites:', this.favorites);
          const favorite = this.favorites.find((f) => String(f.id) === favId);
          console.info('[FAVORITE DEBUG] Found favorite:', favorite);
          if (favorite) {
            console.info('[FAVORITE DEBUG] Calling loadFavorite with:', favorite);
            void this.loadFavorite(favorite);
          } else {
            console.error('[FAVORITE DEBUG] Favorite not found!');
          }
        }
      });

      favoritesList.append(button);
    });

    // Show/hide add to favorites button based on team selection
    this.updateAddFavoriteButton();
  }

  /**
   * Check if current filter combination is already favorited
   */
  private isCombinationFavorited(): boolean {
    if (
      this.selectedContext.areaId === null ||
      this.selectedContext.departmentId === null ||
      this.selectedContext.machineId === null ||
      this.selectedContext.teamId === null
    ) {
      return false;
    }

    return this.favorites.some(
      (fav) =>
        fav.areaId === this.selectedContext.areaId &&
        fav.departmentId === this.selectedContext.departmentId &&
        fav.machineId === this.selectedContext.machineId &&
        fav.teamId === this.selectedContext.teamId,
    );
  }

  /**
   * Update visibility of "Add to Favorites" button
   */
  private updateAddFavoriteButton(): void {
    let addBtn = document.querySelector('#addToFavoritesBtn');

    // Check if all filters are selected AND combination is not already favorited
    const isFavorited = this.isCombinationFavorited();
    const shouldShowButton = this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0 && !isFavorited;

    console.info('[FAVORITE BUTTON] Update button visibility:', {
      teamId: this.selectedContext.teamId,
      isFavorited,
      shouldShowButton,
      buttonExists: addBtn !== null,
    });

    if (shouldShowButton) {
      // Show button only if combination is not favorited
      if (!addBtn) {
        // Create button if it doesn't exist
        const filterRow = document.querySelector('.shift-info-row');
        if (!filterRow) return;

        const btn = document.createElement('button');
        btn.id = 'addToFavoritesBtn';
        btn.className = 'btn btn-success add-favorite-btn';
        btn.innerHTML = '⭐ Zu Favoriten hinzufügen';
        btn.onclick = () => {
          void this.addToFavorites();
        };

        // Insert after the filter row
        filterRow.parentElement?.insertBefore(btn, filterRow.nextSibling);
      }
    } else {
      // Hide button if no team selected OR combination already favorited
      if (addBtn) {
        addBtn.remove();
      }
    }
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
