/**
 * New Shift Planning System - TypeScript Implementation
 * Interactive weekly shift planning with drag & drop functionality
 */

import type { User } from '../types/api.types';
import { ApiClient } from '../utils/api-client';
import {
  mapTeams,
  mapUsers,
  mapRotationPatterns,
  type TeamAPIResponse,
  type UserAPIResponse,
  type RotationPatternAPIResponse,
} from '../utils/api-mappers';
import { $$, $$id, createElement } from '../utils/dom-utils';
import { getAuthToken, showInfo } from './auth';
// escapeHtml removed - using DOM manipulation instead
import { showSuccessAlert, showErrorAlert, showConfirm } from './utils/alerts';
import { openModal } from './utils/modal-manager';

interface Employee extends User {
  department_id?: number;
  team_id?: number;
  shift_assignments?: ShiftAssignment[];
  availability_status?: string; // Allow any string for combined statuses like "available vacation"
  availabilityStatus?: string; // camelCase version from API
  availability_start?: string;
  availability_end?: string;
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

// Autofill and Rotation Interfaces
interface ShiftAutofillConfig {
  enabled: boolean;
  fillWeekdays: boolean;
  skipWeekends: boolean;
  respectAvailability: boolean;
}

interface ShiftRotationConfig {
  enabled: boolean;
  pattern: 'F_S_alternate' | 'custom';
  nightFixed: boolean;
  autoGenerateWeeks: number; // Number of weeks to generate ahead
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
  private isPlanLocked: boolean; // Track if plan is locked (rotation mode or read-only)

  // Context data for shift planning
  private areas: Area[];
  private departments: Department[];
  private machines: Machine[];
  private teams: Team[];
  private teamLeaders: TeamLeader[];
  private selectedContext: SelectedContext;
  private favorites: ShiftFavorite[]; // Store shift planning favorites

  // Autofill and Rotation Configuration
  private autofillConfig: ShiftAutofillConfig;
  private rotationConfig: ShiftRotationConfig;
  private fallbackConfig: { enabled: boolean };
  private userPreferencesCache: Record<string, string | boolean | object>;

  // Edit mode variables for rotation
  private editMode = false;
  private currentPatternId: number | null = null;

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
    this.isPlanLocked = false;

    // Load favorites from API
    this.favorites = [];

    // Initialize Autofill and Rotation configs
    this.autofillConfig = {
      enabled: false,
      fillWeekdays: true,
      skipWeekends: true,
      respectAvailability: true,
    };

    this.rotationConfig = {
      enabled: false,
      pattern: 'F_S_alternate',
      nightFixed: true,
      autoGenerateWeeks: 4,
    };

    // Fallback config - show normal shifts when rotation has no data
    this.fallbackConfig = {
      enabled: false, // Show normal shifts as fallback when rotation is empty
    };

    this.userPreferencesCache = {};

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
    console.info('[SHIFTS] Initial context:', {
      areaId: this.selectedContext.areaId,
      departmentId: this.selectedContext.departmentId,
      machineId: this.selectedContext.machineId,
      teamId: this.selectedContext.teamId,
    });

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

        // Reload user preferences with the restored team_id
        if (context.teamId !== null) {
          console.info('[SHIFTS RELOAD DEBUG] Loading preferences for restored team:', context.teamId);
          await this.loadUserPreferencesFromDatabase();
        }
      }

      // Only load data if a team is already selected (e.g., from saved state)
      // For admins, check if teamId is selected
      // For employees, they will have departmentId pre-selected
      const shouldLoadData = this.isAdmin
        ? this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0
        : this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0;

      if (shouldLoadData) {
        console.info('[SHIFTS DEBUG] Team/Department selected, loading data...');

        // Load user preferences for the selected team (important for rotation checkbox!)
        if (this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0) {
          console.info('[SHIFTS DEBUG] Loading preferences for selected team on init:', this.selectedContext.teamId);
          await this.loadUserPreferencesFromDatabase();
        }

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
      void this.resetSchedule();
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

    // Setup shift control checkboxes (preferences will be loaded after team selection)
    this.setupShiftControls();

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

    // Drag over for shift cells and to enable drops everywhere
    document.addEventListener('dragover', (e) => {
      const target = e.target as HTMLElement;

      // Check if we're in rotation modal FIRST
      const rotationModal = target.closest('#rotation-setup-modal');
      if (rotationModal) {
        // For rotation modal, ONLY preventDefault and let local handlers manage the rest
        e.preventDefault();
        return;
      }

      // Always preventDefault to enable drop events
      e.preventDefault();

      // For rotation drop zones, let their specific handlers add visual effects
      if (target.classList.contains('drop-zone') || target.closest('.drop-zone')) {
        console.info('[GLOBAL DRAGOVER] Over drop zone, preventDefault called');
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move'; // Ensure dropEffect is set
        }
        return; // Specific handlers will manage visual feedback
      }

      // For shift cells, add visual feedback
      const shiftCell = target.closest(CSS_SELECTORS.SHIFT_CELL);
      if (shiftCell) {
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

    // Drop on shift cells - Listen in BOTH capture and bubble phase for debugging
    document.addEventListener(
      'drop',
      (e) => {
        const target = e.target as HTMLElement;

        console.info('[GLOBAL DROP CAPTURE] !!!!! Drop event in CAPTURE phase on:', target.className, target.id);
        console.info('[GLOBAL DROP] Event details:', e.dataTransfer?.types, e.dataTransfer?.effectAllowed);

        // Check if this is a rotation modal drop zone - if so, let it handle the event
        if (target.classList.contains('drop-zone') || target.closest('.drop-zone')) {
          console.info('[SHIFTS DEBUG] Drop on rotation zone, letting specific handler manage it');
          // Don't prevent default or stop propagation - let the event continue
          return; // Let the specific drop zone handler handle this
        }

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
      },
      false,
    ); // Explicitly use bubbling phase

    // Add another listener in capture phase for debugging
    document.addEventListener(
      'drop',
      (e) => {
        const target = e.target as HTMLElement;
        console.info('[GLOBAL DROP DEBUG] Drop detected anywhere! Target:', target.className);

        // If this is within the rotation modal, prevent default to avoid page reload
        const rotationModal = target.closest('#rotation-setup-modal');
        if (rotationModal) {
          console.info('[GLOBAL DROP DEBUG] Drop within rotation modal - preventing default');
          e.preventDefault(); // Prevent default action (important for modal drops)
        }
      },
      true, // Use capture phase
    );
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

    // Load user preferences for the selected team (includes rotation checkbox state)
    console.info('[SHIFTS DEBUG] Loading user preferences for team:', teamId);
    await this.loadUserPreferencesFromDatabase();

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
          // Find the employee to check availability
          const employeeId = Number(userId);
          const employee = this.employees.find((emp) => emp.id === employeeId);

          if (employee !== undefined) {
            // Check if employee is available on this specific date
            if (this.isEmployeeAvailableOnDate(employee, date)) {
              // Wrap async call in void to handle promise correctly
              void this.assignUserToShift(employeeId, date, shiftType, cellElement);
            } else {
              // Employee is not available on this date
              const firstName = employee.first_name ?? '';
              const lastName = employee.last_name ?? '';
              const name = `${firstName} ${lastName}`.trim();
              const displayName = name !== '' ? name : employee.username;

              // Format date for display
              const dateObj = new Date(date);
              const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}.${dateObj.getFullYear()}`;

              showErrorAlert(`${displayName} ist am ${formattedDate} nicht verfügbar`);
            }
          }
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

  /**
   * Convert frontend shift type to database format
   * Frontend uses: early, late, night
   * Database expects: F, S, N
   */
  private convertShiftTypeForAPI(frontendType: string): string {
    const typeMap: Record<string, string> = {
      early: 'F', // Frühschicht
      late: 'S', // Spätschicht
      night: 'N', // Nachtschicht
    };
    return typeMap[frontendType] ?? frontendType;
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
            type: this.convertShiftTypeForAPI(shiftType),
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

          // Trigger autofill if enabled
          const day = cellElement.dataset.day;
          if (this.autofillConfig.enabled && day !== undefined && day !== '') {
            this.performAutofill(userId, day, shiftType);
          }
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
            type: this.convertShiftTypeForAPI(shiftType),
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

        // Trigger autofill if enabled
        const day = cellElement.dataset.day;
        if (this.autofillConfig.enabled && day !== undefined && day !== '') {
          this.performAutofill(userId, day, shiftType);
        }
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

      // Show shift controls when planning area is shown
      const shiftControls = $$('.shift-controls');
      if (shiftControls) shiftControls.style.display = 'block';

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

      // Hide shift controls when planning area is hidden
      const shiftControls = $$('.shift-controls');
      if (shiftControls) shiftControls.style.display = 'none';
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
      // Use v2 API for employees with availability data
      const apiClientInstance = ApiClient.getInstance();

      // ALWAYS load all users via v2 API to get availability data
      console.info('[SHIFTS DEBUG] Loading all users via v2 API for availability data');
      let allUsers = await apiClientInstance.get<UserAPIResponse[]>('/users');

      let users: UserAPIResponse[] = [];

      if (this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0) {
        // Filter by team ID
        console.info('[SHIFTS DEBUG] Filtering users by team ID:', this.selectedContext.teamId);
        // For now, load team members separately to get the correct list
        const teamMembers = await apiClientInstance.get<UserAPIResponse[]>(
          `/teams/${String(this.selectedContext.teamId)}/members`,
        );
        const teamMemberIds = teamMembers.map((m) => m.id);
        // Use the full user data with availability from /users endpoint
        users = allUsers.filter((u) => teamMemberIds.includes(u.id));
      } else {
        users = allUsers;
        // Filter by department if selected
        if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
          users = users.filter((u) => {
            const deptId = u.department_id ?? u.departmentId;
            return deptId === this.selectedContext.departmentId;
          });
        }
      }

      // Map the users to ensure we have availability data
      const mappedUsers = mapUsers(users);

      // Convert mapped users to Employee type with all required fields
      this.employees = mappedUsers.map(
        (u) =>
          ({
            id: u.id,
            username: u.username,
            email: u.email,
            first_name: u.firstName,
            last_name: u.lastName,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role,
            tenant_id: u.tenantId,
            department_id: u.departmentId ?? undefined,
            team_id: u.teamId ?? undefined,
            position: u.position,
            employee_number: u.employeeNumber,
            is_active: u.isActive,
            is_archived: false,
            created_at: u.createdAt ?? new Date().toISOString(),
            updated_at: u.updatedAt ?? new Date().toISOString(),
            availability_status: u.availabilityStatus ?? undefined,
            availabilityStatus: u.availabilityStatus ?? undefined,
            availability_start: u.availabilityStart ?? undefined,
            availability_end: u.availabilityEnd ?? undefined,
            availability_notes: u.availabilityNotes ?? undefined,
          }) as Employee,
      );

      console.info('[SHIFTS DEBUG] Employees loaded:', this.employees.length, 'employees');
      console.info('[SHIFTS DEBUG] Employee data:', this.employees);
      console.info(
        '[SHIFTS DEBUG] Employee IDs:',
        this.employees.map((e) => e.id),
      );

      // Log availability status for debugging
      this.employees.forEach((emp) => {
        console.info('[SHIFTS DEBUG] Employee availability:', {
          email: emp.email,
          availability_status: emp.availability_status,
          availabilityStatus: emp.availabilityStatus,
        });
      });

      // No need to load availability separately - v2 API provides it
      console.info('[SHIFTS] Using availability data from v2 API');

      this.renderEmployeeList();
    } catch (error) {
      console.error('Error loading employees:', error);
      // Fallback data
      this.employees = [];
      this.renderEmployeeList();
    }
  }

  loadEmployeeAvailability(): void {
    try {
      // Get the start and end date for the current week
      const weekStart = this.getWeekStart(this.currentWeek);
      const weekEnd = this.getWeekEnd(this.currentWeek);

      // Format dates for API
      const startStr = this.formatDate(weekStart);
      const endStr = this.formatDate(weekEnd);

      console.info('[SHIFTS] Loading availability for week:', startStr, 'to', endStr);

      // V2 API already provides availability data in the employee objects
      // The availability_status and availabilityStatus fields are included directly
      console.info('[SHIFTS] Using availability data from v2 API for employees');

      // Log current availability status from employees
      const availableCount = this.employees.filter((e) => {
        const status = e.availability_status ?? e.availabilityStatus ?? 'available';
        // Parse combined statuses like "available vacation"
        const parts = status.trim().split(/\s+/);
        const actualStatus = parts.length > 1 ? parts[1] : parts[0];
        return actualStatus === 'available';
      }).length;

      console.info('[SHIFTS] Availability loaded:', availableCount, 'of', this.employees.length, 'employees available');
    } catch (error) {
      console.error('[SHIFTS] Error processing availability data:', error);
      // Keep existing availability data from v2 API
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
    console.info('[SHIFTS DEBUG] Full employee data:', this.employees);

    this.employees.forEach((employee) => {
      // Log ALL availability-related fields
      console.info('[SHIFTS AVAILABILITY DEBUG]', {
        id: employee.id,
        name: `${employee.first_name ?? ''} ${employee.last_name ?? ''}`,
        availability_status: employee.availability_status,
        availabilityStatus: employee.availabilityStatus,
        availability_start: employee.availability_start,
        availability_end: employee.availability_end,
        fullEmployee: employee,
      });

      const item = document.createElement('div');
      item.className = 'employee-item';
      item.dataset.employeeId = employee.id.toString();

      // Get the week-specific availability status
      const availabilityStatus = this.getWeekAvailabilityStatus(employee);

      // Admin can drag any employee (availability check happens on drop)
      const isDraggable = this.isAdmin && (this.currentPlanId === null || this.isEditMode);
      item.setAttribute('draggable', isDraggable.toString());

      console.info(
        '[SHIFTS DEBUG] Employee:',
        employee.username,
        'Draggable:',
        isDraggable,
        'Week-specific status:',
        availabilityStatus,
        'Raw status:',
        employee.availability_status ?? employee.availabilityStatus,
        'Date range:',
        employee.availability_start,
        'to',
        employee.availability_end,
      );

      // Add visual indicators for unavailable employees
      if (availabilityStatus !== 'available') {
        item.classList.add('unavailable', `status-${availabilityStatus}`);
      }

      const name = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
      const displayName = name !== '' ? name : employee.username;

      // Build DOM structure safely
      const infoDiv = createElement('div', { className: 'employee-info' });
      const nameSpan = createElement('span', { className: CSS_CLASSES.EMPLOYEE_NAME }, displayName);
      infoDiv.append(nameSpan);

      // Add status icon if present (use resolved status)
      const iconElement = this.createAvailabilityIcon(availabilityStatus);
      if (iconElement) {
        infoDiv.append(iconElement);
      }

      // Add status badge if present (use resolved status)
      const badgeElement = this.createAvailabilityBadge(availabilityStatus);
      if (badgeElement) {
        infoDiv.append(badgeElement);
      }

      // Add date range if not available
      if (availabilityStatus !== 'available') {
        const dateRangeElement = this.createAvailabilityDateRange(employee);
        if (dateRangeElement) {
          infoDiv.append(dateRangeElement);
        }
      }

      // Add "Verfügbar ab" date ONLY if it's relevant for the current week
      if (employee.availability_end !== undefined && employee.availability_end !== '') {
        const endDate = new Date(employee.availability_end);
        endDate.setDate(endDate.getDate() + 1); // Add one day (this is when employee returns)

        // Get current week boundaries
        const weekStart = this.getWeekStart(this.currentWeek);
        const weekEnd = this.getWeekEnd(this.currentWeek);

        // Only show "Verfügbar ab" if the return date is within the current week
        if (endDate >= weekStart && endDate <= weekEnd) {
          const day = endDate.getDate().toString().padStart(2, '0');
          const month = (endDate.getMonth() + 1).toString().padStart(2, '0');
          const year = endDate.getFullYear();
          const availableFromDate = `${day}.${month}.${year}`;

          const availableFromSpan = createElement(
            'div',
            {
              className: 'availability-return-date',
            },
            `Verfügbar ab ${availableFromDate}`,
          );
          availableFromSpan.style.fontSize = '11px';
          availableFromSpan.style.color = '#4caf50';
          availableFromSpan.style.marginTop = '2px';
          infoDiv.append(availableFromSpan);
        }
      }

      /* Shift counts temporarily disabled
      const statsDiv = createElement('div', { className: 'employee-stats' });
      const countSpan = createElement('span', { className: 'shift-count' }, '0');
      statsDiv.append(countSpan);
      item.append(statsDiv);
      */

      item.append(infoDiv);

      container.append(item);
    });

    console.info('[SHIFTS DEBUG] Employee list rendered');
    // Update shift counts - temporarily disabled
    // this.updateEmployeeShiftCounts();
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
      case 'training':
        iconClass = 'fa-graduation-cap';
        statusClass = 'training';
        title = 'Schulung';
        break;
      case 'other':
        iconClass = 'fa-clock';
        statusClass = 'other';
        title = 'Sonstiges';
        break;
      default:
        return null;
    }

    return createElement('i', {
      className: `fas ${iconClass} status-icon ${statusClass}`,
      title: title,
    });
  }

  // Create date range element for availability period
  createAvailabilityDateRange(employee: Employee): HTMLElement | null {
    const startDate = employee.availability_start;
    const endDate = employee.availability_end;

    // Only show if we have at least one date
    if (startDate === undefined && endDate === undefined) {
      return null;
    }

    // Format dates in German format (DD.MM.YYYY)
    const formatDate = (dateStr?: string): string => {
      if (dateStr === undefined) return '?';
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const startFormatted = formatDate(startDate);
    const endFormatted = formatDate(endDate);

    // Create the date range element
    const dateRangeSpan = createElement(
      'span',
      {
        className: 'availability-date-range',
      },
      `(${startFormatted} - ${endFormatted})`,
    );

    // Apply styles directly
    dateRangeSpan.style.color = '#da3d3dff';

    return dateRangeSpan;
  }

  // Create badge element instead of HTML string
  createAvailabilityBadge(status?: string): HTMLElement | null {
    let badgeClass = '';
    let text = '';

    switch (status) {
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
      case 'training':
        badgeClass = 'badge-info';
        text = 'Schulung';
        break;
      case 'other':
        badgeClass = 'badge-dark';
        text = 'Sonstiges';
        break;
      case 'available':
      default:
        // Default to available if no status is set
        badgeClass = 'badge-success';
        text = 'Verfügbar';
        break;
    }

    return createElement(
      'span',
      {
        className: `badge ${badgeClass}`,
      },
      text,
    );
  }

  /**
   * Calculate availability status for a specific week based on date ranges
   */
  getWeekAvailabilityStatus(employee: Employee): string {
    // If no special status, return available
    const baseStatus = employee.availability_status ?? employee.availabilityStatus ?? 'available';

    // Parse the base status (might be "available vacation" format)
    let actualStatus = 'available';
    if (baseStatus !== '') {
      const parts = baseStatus.trim().split(/\s+/);
      if (parts.length > 1) {
        actualStatus = parts[1]; // e.g., "available vacation" -> "vacation"
      } else {
        actualStatus = parts[0] !== '' ? parts[0] : 'available';
      }
    }

    // If status is already "available", no need to check dates
    if (actualStatus === 'available') {
      return 'available';
    }

    // Check if the status applies to the current week
    const weekStart = this.getWeekStart(this.currentWeek);
    const weekEnd = this.getWeekEnd(this.currentWeek);

    // Add debug logging
    const firstName = employee.first_name ?? 'Unknown';
    const lastName = employee.last_name ?? 'Unknown';
    console.info(`[SHIFTS DEBUG] Checking week availability for ${firstName} ${lastName}:`, {
      actualStatus,
      weekRange: `${this.formatDate(weekStart)} to ${this.formatDate(weekEnd)}`,
      availStart: employee.availability_start,
      availEnd: employee.availability_end,
    });

    // If we have date ranges, check if they overlap with current week
    if (employee.availability_start !== undefined || employee.availability_end !== undefined) {
      const availStart = employee.availability_start !== undefined ? new Date(employee.availability_start) : null;
      const availEnd = employee.availability_end !== undefined ? new Date(employee.availability_end) : null;

      // Check if the availability period overlaps with the current week
      const overlaps = this.checkDateRangeOverlap(availStart, availEnd, weekStart, weekEnd);

      console.info(`[SHIFTS DEBUG] Overlap check for ${firstName} ${lastName}:`, {
        overlaps,
        availRange: `${availStart ? this.formatDate(availStart) : 'null'} to ${availEnd ? this.formatDate(availEnd) : 'null'}`,
      });

      // If the special status doesn't apply to this week, return available
      if (!overlaps) {
        console.info(
          `[SHIFTS] Employee ${firstName} ${lastName} status "${actualStatus}" doesn't apply to week ${this.formatWeekRange(weekStart)}`,
        );
        return 'available';
      }
    }

    // The special status applies to this week
    console.info(`[SHIFTS DEBUG] ${firstName} ${lastName} status for this week: ${actualStatus}`);
    return actualStatus;
  }

  /**
   * Check if two date ranges overlap
   */
  checkDateRangeOverlap(start1: Date | null, end1: Date | null, start2: Date, end2: Date): boolean {
    // If no start date, assume it started in the past
    const effectiveStart = start1 ?? new Date('1900-01-01');
    // If no end date, assume it continues into the future
    const effectiveEnd = end1 ?? new Date('2100-01-01');

    // Check if ranges overlap
    return effectiveStart <= end2 && effectiveEnd >= start2;
  }

  /**
   * Check if employee is available on a specific date
   */
  isEmployeeAvailableOnDate(employee: Employee, dateString: string): boolean {
    // Get the employee's availability status
    const rawStatus = employee.availability_status ?? employee.availabilityStatus ?? 'available';

    // Parse the status
    let status = 'available';
    if (typeof rawStatus === 'string') {
      const parts = rawStatus.trim().split(/\s+/);
      if (parts.length > 1) {
        status = parts[1]; // e.g., "available vacation" -> "vacation"
      } else {
        status = parts[0] !== '' ? parts[0] : 'available';
      }
    }

    // If status is available, no need to check dates
    if (status === 'available') {
      return true;
    }

    // Check if the unavailability applies to this specific date
    const checkDate = new Date(dateString);
    const startDate = employee.availability_start !== undefined ? new Date(employee.availability_start) : null;
    const endDate = employee.availability_end !== undefined ? new Date(employee.availability_end) : null;

    // Set time to noon to avoid timezone issues
    checkDate.setHours(12, 0, 0, 0);
    if (startDate !== null) {
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDate !== null) {
      endDate.setHours(23, 59, 59, 999);
    }

    // Check if the date falls within the unavailability period
    const isWithinPeriod = this.checkDateRangeOverlap(startDate, endDate, checkDate, checkDate);

    // If within unavailability period, employee is NOT available
    return !isWithinPeriod;
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
    // Parse the status (already resolved by getWeekAvailabilityStatus if called from there)
    let resolvedStatus = 'available';
    if (status !== undefined && status !== '') {
      // If it's already a simple status (from getWeekAvailabilityStatus), use it directly
      // Otherwise parse combined format
      const parts = status.trim().split(/\s+/);
      if (parts.length > 1) {
        resolvedStatus = parts[1];
      } else {
        resolvedStatus = parts[0] !== '' ? parts[0] : 'available';
      }
    }

    switch (resolvedStatus) {
      case 'available':
        return '<span class="badge badge-success">Verfügbar</span>';
      case 'vacation':
        return '<span class="badge badge-warning">Urlaub</span>';
      case 'sick':
        return '<span class="badge badge-danger">Krank</span>';
      case 'unavailable':
        return '<span class="badge badge-secondary">Nicht verfügbar</span>';
      case 'training':
        return '<span class="badge badge-info">Schulung</span>';
      case 'other':
        return '<span class="badge badge-dark">Sonstiges</span>';
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

    // Check if plan is locked (rotation mode or existing plan without edit mode)
    if (this.isPlanLocked) {
      console.info('[SHIFTS] Selection blocked - plan is locked');
      return;
    }

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

    // Check employee availability for this specific date
    if (!this.isEmployeeAvailableOnDate(employee, date)) {
      // Build error message with details
      const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
      const employeeName = fullName !== '' ? fullName : employee.username;

      // Format the specific date
      const dateObj = new Date(date);
      const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}.${dateObj.getFullYear()}`;

      // Get the status type
      const rawStatus = employee.availability_status ?? employee.availabilityStatus ?? 'available';
      let status = 'available';
      if (typeof rawStatus === 'string') {
        const parts = rawStatus.trim().split(/\s+/);
        if (parts.length > 1) {
          status = parts[1];
        } else {
          status = parts[0] !== '' ? parts[0] : 'available';
        }
      }

      // Build status text
      const statusTexts = new Map<string, string>([
        ['vacation', 'im Urlaub'],
        ['sick', 'krankgemeldet'],
        ['unavailable', 'nicht verfügbar'],
        ['training', 'in Schulung'],
        ['other', 'anderweitig abwesend'],
      ]);

      const statusText = statusTexts.get(status) ?? 'nicht verfügbar';
      let errorMsg = `${employeeName} ist am ${formattedDate} ${statusText}`;

      // Add reason if available
      const reason = employee.availability_reason;
      if (reason !== undefined && reason !== '') {
        errorMsg += `: ${reason}`;
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
    // this.updateEmployeeShiftCounts(); // temporarily disabled

    // Trigger autofill if enabled (for drag & drop operations)
    // But not if we're already autofilling (to prevent recursion)
    // And not if we're removing an employee
    if (this.autofillConfig.enabled && day !== undefined && day !== '' && !this.isAutofilling && !this.isRemoving) {
      console.info('[SHIFTS DEBUG] Triggering autofill for employee:', employeeId, 'day:', day, 'shift:', shift);
      this.performAutofill(employeeId, day, shift);
    }
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
      assignmentDiv.innerHTML = '<div class="empty-slot">+</div>';
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
    console.info('[SHIFTS RELOAD DEBUG] Rotation enabled:', this.rotationConfig.enabled);

    try {
      const weekStart = this.getWeekStart(this.currentWeek);
      const weekEnd = this.getWeekEnd(this.currentWeek);

      // Format dates for API
      const startStr = this.formatDate(weekStart);
      const endStr = this.formatDate(weekEnd);

      console.info('[SHIFTS PLAN DEBUG] Loading shifts for range:', startStr, 'to', endStr);

      // Check if rotation is enabled - if yes, load from shift_rotation_history
      if (this.rotationConfig.enabled) {
        console.info('[SHIFTS ROTATION] Loading from shift_rotation_history');

        const response = await fetch(`/api/v2/shifts/rotation/history?start_date=${startStr}&end_date=${endStr}`, {
          headers: {
            Authorization: `Bearer ${getAuthToken() ?? ''}`,
          },
        });

        if (response.ok) {
          const data = (await response.json()) as {
            data?: {
              history?: {
                shiftDate: string; // camelCase from backend dbToApi
                shiftType: string;
                userId: number;
                status: string;
              }[];
            };
          };

          console.info('[SHIFTS ROTATION] History data:', data);

          if (data.data?.history && data.data.history.length > 0) {
            // Convert rotation history to shift format
            // Note: Backend uses camelCase due to dbToApi conversion
            const shifts = data.data.history.map((h) => {
              const employee = this.employees.find((e) => e.id === h.userId);
              // Convert shift type from DB format (F/S/N) to frontend format (early/late/night)
              let shiftType = h.shiftType;
              if (shiftType === 'F') {
                shiftType = 'early';
              } else if (shiftType === 'S') {
                shiftType = 'late';
              } else if (shiftType === 'N') {
                shiftType = 'night';
              }
              return {
                date: h.shiftDate,
                shift_type: shiftType,
                employee_id: h.userId,
                first_name: employee?.first_name ?? '',
                last_name: employee?.last_name ?? '',
                username: employee?.username ?? '',
              };
            });

            this.processShiftData(shifts);
            this.renderWeekView();

            // Show edit rotation button since we have rotation data
            this.showEditRotationButton(true);

            // Lock shift plan when rotation is active - prevent drag & drop
            this.lockShiftPlan();
            console.info('[SHIFTS ROTATION] Plan locked - rotation mode active');

            // Show info that rotation mode is active
            const infoBar = document.querySelector('.shift-info-bar');
            if (infoBar) {
              infoBar.innerHTML = '<span style="color: #4CAF50;">🔄 Automatische Rotation aktiv</span>';
            }

            return; // Exit when we have rotation data
          } else {
            console.info('[SHIFTS ROTATION] No rotation history found for this period');

            // Check if fallback is enabled - if yes, load normal shifts
            if (this.fallbackConfig.enabled) {
              console.info('[SHIFTS FALLBACK] Loading normal shifts as fallback');
              // Clear info bar to show normal mode
              const infoBar = document.querySelector('.shift-info-bar');
              if (infoBar) {
                infoBar.innerHTML = '<span style="color: #FFC107;">📋 Normale Schichten (Fallback-Modus)</span>';
              }
              // Continue to load normal shifts below (don't return)
            } else {
              // No fallback - show empty
              this.weeklyShifts = new Map();
              // Hide edit rotation button since no rotation data exists
              this.showEditRotationButton(false);
              // Unlock plan when no rotation data exists
              this.unlockShiftPlan();
              this.shiftDetails = new Map();
              this.currentPlanId = null; // Clear plan ID

              // Clear notes textarea when no fallback and no rotation data
              const notesTextarea = $$id<HTMLTextAreaElement>('weeklyNotes');
              if (notesTextarea) {
                notesTextarea.value = '';
                // Clear any info bar message
                const infoBar = document.querySelector('.shift-info-bar');
                if (infoBar) {
                  infoBar.innerHTML = '';
                }
              }

              this.renderWeekView();
              return; // Exit early when no rotation and no fallback
            }
          }
        } else {
          console.error('[SHIFTS ROTATION] Failed to load rotation history');
          // Check if fallback is enabled before throwing error
          if (!this.fallbackConfig.enabled) {
            throw new Error('Failed to load rotation history');
          }
          // Continue with normal shifts if fallback is enabled
          console.info('[SHIFTS FALLBACK] Rotation API failed, falling back to normal shifts');
        }
        // Otherwise continue to load normal shifts as fallback
      }

      // Normal shift loading when rotation is disabled
      // Hide edit rotation button when rotation is disabled
      this.showEditRotationButton(false);
      // Ensure plan is unlocked when rotation is disabled
      // (will be locked later if an existing plan is found)
      this.unlockShiftPlan();

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
    // this.updateEmployeeShiftCounts(); // temporarily disabled

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
      let shiftType = shift.shift_type;

      // Map database shift types to UI shift types
      // F = Frühschicht = early, S = Spätschicht = late, N = Nachtschicht = night
      if (shiftType === 'F') {
        shiftType = 'early';
      } else if (shiftType === 'S') {
        shiftType = 'late';
      } else if (shiftType === 'N') {
        shiftType = 'night';
      }

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

  // Shift Control Methods (Autofill & Rotation)
  private setupShiftControls(): void {
    console.info('[SHIFTS DEBUG] Setting up shift controls');
    console.info('[SHIFTS DEBUG] Current team context:', this.selectedContext.teamId);

    // Load preferences if team is already selected
    if (this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0) {
      console.info('[SHIFTS DEBUG] Team is selected during setupShiftControls, loading preferences...');
      void this.loadUserPreferencesFromDatabase();
    }

    const autofillCheckbox = $$<HTMLInputElement>('#shift-autofill');
    const rotationCheckbox = $$<HTMLInputElement>('#shift-rotation');

    if (autofillCheckbox) {
      autofillCheckbox.addEventListener('change', (e) => {
        this.autofillConfig.enabled = (e.target as HTMLInputElement).checked;
        void this.saveUserPreferenceToDatabase('shift_autofill_enabled', this.autofillConfig.enabled);

        if (this.autofillConfig.enabled) {
          showInfo('Autofill aktiviert: Woche wird automatisch ausgefüllt beim Zuweisen');
        } else {
          showInfo('Autofill deaktiviert');
        }
      });
    }

    if (rotationCheckbox) {
      rotationCheckbox.addEventListener('change', (e) => {
        void (async () => {
          const newValue = (e.target as HTMLInputElement).checked;

          if (newValue) {
            // Aktivieren
            const confirmed = await showConfirm(
              'Möchten Sie die automatische Rotation aktivieren? Dies erstellt automatisch wechselnde Schichten für die nächsten Wochen.',
            );

            if (confirmed) {
              this.rotationConfig.enabled = true;
              this.editMode = false;
              this.currentPatternId = null;
              this.openRotationModal();
            } else {
              this.rotationConfig.enabled = false;
              rotationCheckbox.checked = false;
            }
          } else {
            // Deaktivieren - Warnung zeigen
            const confirmed = await showConfirm(
              '⚠️ Rotation deaktivieren?\n\nAlle automatisch generierten Schichten werden gelöscht!\nDie normale manuelle Schichtplanung wird wieder aktiviert.\n\nWirklich fortfahren?',
            );

            if (confirmed) {
              this.rotationConfig.enabled = false;

              // Delete all rotation history
              try {
                const token = getAuthToken();
                if (token !== null && token !== '') {
                  // CRITICAL: Include team_id for multi-tenant isolation
                  const teamId = this.selectedContext.teamId;
                  if (teamId === null || teamId === 0) {
                    showErrorAlert('Kein Team ausgewählt. Bitte wählen Sie zuerst ein Team.');
                    return;
                  }

                  const response = await fetch(`/api/v2/shifts/rotation/history?team_id=${teamId}`, {
                    method: 'DELETE',
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  });

                  if (response.ok) {
                    const result = (await response.json()) as { success: boolean; data?: unknown };
                    console.info('[SHIFTS ROTATION] Deleted rotation data:', result);
                    showInfo('Rotation deaktiviert. Alle generierten Schichten wurden gelöscht.');
                  } else {
                    showErrorAlert('Fehler beim Löschen der Rotation-Historie');
                  }
                }
              } catch (error) {
                console.error('[SHIFTS ROTATION] Error deleting history:', error);
                showErrorAlert('Fehler beim Löschen der Rotation-Historie');
              }

              // Reload to show normal shifts
              void this.loadCurrentWeekData();
            } else {
              // User cancelled - keep rotation enabled
              this.rotationConfig.enabled = true;
              rotationCheckbox.checked = true;
            }
          }

          // Save preference to database
          void this.saveUserPreferenceToDatabase('shift_rotation_enabled', this.rotationConfig.enabled);
        })();
      });
    }

    // Setup fallback checkbox
    const fallbackCheckbox = $$<HTMLInputElement>('#shift-fallback');
    if (fallbackCheckbox) {
      fallbackCheckbox.addEventListener('change', (e) => {
        this.fallbackConfig.enabled = (e.target as HTMLInputElement).checked;
        void this.saveUserPreferenceToDatabase('shift_fallback_enabled', this.fallbackConfig.enabled);

        if (this.fallbackConfig.enabled) {
          showInfo('Fallback aktiviert: Normale Schichten werden angezeigt wenn keine Rotation vorhanden');
        } else {
          showInfo('Fallback deaktiviert: Nur Rotations-Daten werden angezeigt');
        }

        // Reload current week data with new fallback setting
        void this.loadCurrentWeekData();
      });
    }

    // Setup edit rotation button listener
    const editRotationBtn = $$id<HTMLButtonElement>('edit-rotation-btn');
    if (editRotationBtn) {
      editRotationBtn.addEventListener('click', () => {
        console.info('[SHIFTS DEBUG] Edit rotation button clicked');
        void this.loadRotationForEdit();
      });
    }
  }

  private isAutofilling = false; // Flag to prevent recursive autofill
  private isRemoving = false; // Flag to prevent autofill when removing employees

  private performAutofill(userId: number, day: string, shiftType: string): void {
    if (!this.autofillConfig.enabled || !this.isAdmin || this.isAutofilling) return;

    // Set flag to prevent recursive calls
    this.isAutofilling = true;

    const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const currentWeekStart = this.getWeekStart(this.currentWeek);

    // Don't autofill the same day that was just assigned
    const daysToFill = weekDays.filter((weekDay) => weekDay !== day);

    console.info('[SHIFTS AUTOFILL] Filling week for employee:', userId, 'Shift type:', shiftType);

    for (const weekDay of daysToFill) {
      // Calculate the date for this weekday
      const dayIndex = weekDays.indexOf(weekDay);
      const shiftDate = new Date(currentWeekStart);
      shiftDate.setDate(shiftDate.getDate() + dayIndex);

      // Find the shift cell for this day and shift type
      const shiftCell = $$(`.shift-cell[data-day="${weekDay}"][data-shift="${shiftType}"]`);

      if (shiftCell) {
        // Check if already has an employee assigned (not just empty-slot)
        const existingEmployee = shiftCell.querySelector('.employee-card');
        if (!existingEmployee) {
          console.info('[SHIFTS AUTOFILL] Assigning', weekDay, 'for employee:', userId);
          // Use regular assignShift to persist to database
          this.assignShift(shiftCell, userId);
        } else {
          console.info('[SHIFTS AUTOFILL] Skipping', weekDay, '- already has employee');
        }
      }
    }

    // Reset flag
    this.isAutofilling = false;

    showSuccessAlert(
      `Woche automatisch für Mitarbeiter ausgefüllt (${shiftType === 'early' ? 'Frühschicht' : shiftType === 'late' ? 'Spätschicht' : 'Nachtschicht'})`,
    );
  }

  private async saveUserPreferenceToDatabase(key: string, value: boolean | string | object): Promise<void> {
    try {
      const token = getAuthToken();
      if (token === null || token === '') return;

      // Get current team_id from selected context
      const teamId = this.selectedContext.teamId;

      // Use the correct v2 settings API endpoint
      const response = await fetch('/api/v2/settings/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          setting_key: key,
          setting_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          value_type: typeof value === 'boolean' ? 'boolean' : typeof value === 'object' ? 'json' : 'string',
          category: 'shifts',
          team_id: teamId, // Include team_id for team-specific settings
        }),
      });

      if (!response.ok) {
        console.error('Failed to save preference:', await response.text());
      }

      // Update cache with team context
      const cacheKey = teamId !== null ? `${key}_team_${teamId}` : key;
      Reflect.set(this.userPreferencesCache, cacheKey, value);
    } catch (error) {
      console.error('Error saving preference:', error);
    }
  }

  private async checkRotationPatternExists(teamId: number | null): Promise<boolean> {
    if (teamId === null) return false;

    try {
      const token = getAuthToken();
      if (token === null || token === '') return false;

      const response = await fetch('/api/v2/shifts/rotation/patterns?active=true', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return false;

      const result = (await response.json()) as { data: { patterns: RotationPatternAPIResponse[] } };
      const rawPatterns = result.data.patterns;

      // Map the patterns to ensure consistent camelCase
      const patterns = mapRotationPatterns(rawPatterns);

      console.info('[SHIFTS DEBUG] Checking patterns for teamId:', teamId);
      console.info('[SHIFTS DEBUG] Found patterns:', patterns);

      // Check if any pattern exists for this team
      return patterns.some((p) => p.teamId === teamId);
    } catch (error) {
      console.error('[SHIFTS] Error checking rotation patterns:', error);
      return false;
    }
  }

  private rotationDropHandlers = new Map<
    string,
    { dragenter?: EventListener; dragover: EventListener; dragleave: EventListener; drop: EventListener }
  >();

  private setupRotationDragDrop(): void {
    console.info('[ROTATION SETUP] Setting up drag & drop zones');
    // Setup drop zones for each shift type
    const dropZones = ['drop-zone-f', 'drop-zone-s', 'drop-zone-n'];

    dropZones.forEach((zoneId) => {
      const dropZone = $$id<HTMLDivElement>(zoneId);
      if (!dropZone) {
        console.error('[ROTATION SETUP] Drop zone not found:', zoneId);
        return;
      }
      console.info('[ROTATION SETUP] Setting up drop zone:', zoneId);

      // Set inline handlers to ensure drop is allowed (belt and suspenders approach)
      dropZone.ondragover = (e) => {
        e.preventDefault();
        return false;
      };
      dropZone.ondrop = (e) => {
        e.preventDefault();
        return false;
      };

      // Remove old handlers if they exist
      const existingHandlers = this.rotationDropHandlers.get(zoneId);
      if (existingHandlers) {
        if ('dragenter' in existingHandlers && typeof existingHandlers.dragenter === 'function') {
          dropZone.removeEventListener('dragenter', existingHandlers.dragenter);
        }
        dropZone.removeEventListener('dragover', existingHandlers.dragover);
        dropZone.removeEventListener('dragleave', existingHandlers.dragleave);
        dropZone.removeEventListener('drop', existingHandlers.drop);
      }

      // Create new handlers
      const dragenterHandler = (e: Event) => {
        const dragEvent = e as DragEvent;
        dragEvent.preventDefault(); // Critical for allowing drop
        dragEvent.stopPropagation();
        dragEvent.stopImmediatePropagation();

        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.dropEffect = 'move';
        }

        console.info('[ROTATION DRAGENTER] Entering zone:', zoneId);
        dropZone.classList.add('drag-over'); // Also add visual feedback here
      };

      const dragoverHandler = (e: Event) => {
        const dragEvent = e as DragEvent;
        // MUST prevent default to allow drop!
        dragEvent.preventDefault();
        dragEvent.stopPropagation(); // Stop bubbling
        dragEvent.stopImmediatePropagation(); // Stop all other handlers

        // Always set dropEffect to signal drop is allowed
        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.dropEffect = 'move';
          dragEvent.dataTransfer.effectAllowed = 'move';
        }

        if (!dropZone.classList.contains('drag-over')) {
          console.info('[ROTATION DRAGOVER] Drag over zone:', zoneId);
          dropZone.classList.add('drag-over');
        }
      };

      const dragleaveHandler = (e: Event) => {
        const dragEvent = e as DragEvent;
        // Check if we're really leaving the drop zone or just hovering over a child
        const relatedTarget = (dragEvent as DragEvent & { relatedTarget?: EventTarget }).relatedTarget as
          | HTMLElement
          | null
          | undefined;

        // Only remove drag-over if we're truly leaving the zone
        if (!relatedTarget || !dropZone.contains(relatedTarget)) {
          console.info('[ROTATION DRAGLEAVE] Actually leaving zone:', zoneId);
          dropZone.classList.remove('drag-over');
        } else {
          console.info('[ROTATION DRAGLEAVE] False leave (still in zone):', zoneId);
        }
      };

      // Handle drop
      const dropHandler = (e: Event) => {
        console.info('[ROTATION DROP] DROP EVENT FIRED! Zone:', zoneId);
        const dragEvent = e as DragEvent;
        dragEvent.preventDefault();
        dragEvent.stopPropagation(); // Prevent bubbling to document handler
        dragEvent.stopImmediatePropagation(); // Stop ALL other handlers
        dropZone.classList.remove('drag-over');

        console.info('[ROTATION DROP] Drop event triggered on zone:', zoneId, 'Event:', dragEvent);

        if (!dragEvent.dataTransfer) {
          console.error('[ROTATION DROP] No dataTransfer object!');
          return;
        }

        // Try to get data from different keys for compatibility
        let employeeId = dragEvent.dataTransfer.getData('employeeId');
        if (employeeId === '') {
          employeeId = dragEvent.dataTransfer.getData('text/plain');
        }
        const employeeName = dragEvent.dataTransfer.getData('employeeName');

        console.info('[ROTATION DROP] Received data - ID:', employeeId, 'Name:', employeeName);

        if (employeeId === '') {
          console.error('[ROTATION DROP] No employee ID received!');
          return;
        }

        // Check if employee already exists in any drop zone and remove it
        const existingElement = document.querySelector(`.drop-zone [data-employee-id="${employeeId}"]`);
        if (existingElement !== null) {
          existingElement.remove();
        }

        // Create employee element in drop zone
        const employeeDiv = document.createElement('div');
        employeeDiv.className = 'employee-item';
        employeeDiv.dataset.employeeId = employeeId;
        employeeDiv.dataset.shiftType = dropZone.dataset.shift ?? '';
        employeeDiv.textContent = employeeName;

        // Make it draggable again
        employeeDiv.draggable = true;

        // Add drag handlers for re-ordering
        employeeDiv.addEventListener('dragstart', (dragEvent) => {
          if (dragEvent.dataTransfer) {
            dragEvent.dataTransfer.effectAllowed = 'move';
            dragEvent.dataTransfer.setData('employeeId', employeeId);
            dragEvent.dataTransfer.setData('employeeName', employeeName);
            employeeDiv.classList.add('dragging');
          }
        });

        employeeDiv.addEventListener('dragend', () => {
          employeeDiv.classList.remove('dragging');
        });

        // Add click handler to remove (the × button)
        employeeDiv.addEventListener('click', (clickEvent) => {
          const target = clickEvent.target as HTMLElement;
          const rect = target.getBoundingClientRect();
          const clickX = clickEvent.clientX - rect.left;

          // Check if click is on the right side (× button area)
          if (clickX > rect.width - 30) {
            employeeDiv.remove();
          }
        });

        dropZone.append(employeeDiv);
        console.info('[ROTATION DROP] Employee added to zone:', zoneId, 'ID:', employeeId);
      };

      // Register ALL handlers in CAPTURE phase to intercept before document handlers!
      console.info('[ROTATION SETUP] Registering event handlers for zone:', zoneId);
      dropZone.addEventListener('dragenter', dragenterHandler, true);
      dropZone.addEventListener('dragover', dragoverHandler, true);
      dropZone.addEventListener('dragleave', dragleaveHandler, true);
      // CRITICAL: Use capture phase (true) for drop to intercept before any bubbling handlers!
      dropZone.addEventListener('drop', dropHandler, true);

      console.info('[ROTATION SETUP] Drop handler registered for zone:', zoneId, dropZone);

      // Store handlers for cleanup later
      this.rotationDropHandlers.set(zoneId, {
        dragenter: dragenterHandler,
        dragover: dragoverHandler,
        dragleave: dragleaveHandler,
        drop: dropHandler,
      });

      console.info('[ROTATION SETUP] Handlers stored for zone:', zoneId);
    });
  }

  private async loadUserPreferencesFromDatabase(): Promise<void> {
    try {
      const token = getAuthToken();
      if (token === null || token === '') return;

      // Get current team_id from selected context
      const teamId = this.selectedContext.teamId;
      console.info('[SHIFTS DEBUG] Loading preferences for team_id:', teamId);

      const queryParams = new URLSearchParams({ category: 'shifts' });
      if (teamId !== null) {
        queryParams.append('team_id', String(teamId));
      }

      // Use the correct v2 settings API endpoint with team_id
      const response = await fetch(`/api/v2/settings/user?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn('Could not load user preferences');
        return;
      }

      const result = (await response.json()) as {
        data?: {
          settings?: {
            settingKey: string;
            settingValue: boolean | string | number;
            valueType: string;
          }[];
        };
      };
      const settings = result.data?.settings ?? [];

      // Process settings
      for (const setting of settings) {
        switch (setting.settingKey) {
          case 'shift_autofill_enabled': {
            // settingValue is already a boolean from API v2
            this.autofillConfig.enabled = setting.settingValue === true;
            const autofillCheckbox = $$<HTMLInputElement>('#shift-autofill');
            if (autofillCheckbox) {
              autofillCheckbox.checked = this.autofillConfig.enabled;
            }
            console.info('[SHIFTS DEBUG] Loaded autofill setting from DB:', this.autofillConfig.enabled);
            break;
          }

          case 'shift_rotation_enabled': {
            // settingValue is already a boolean from API v2
            const dbEnabled = setting.settingValue === true;

            // Check if rotation pattern exists for this team
            const patternExists = await this.checkRotationPatternExists(this.selectedContext.teamId);

            // Only enable rotation if both DB setting is true AND pattern exists
            this.rotationConfig.enabled = dbEnabled && patternExists;

            const rotationCheckbox = $$<HTMLInputElement>('#shift-rotation');
            if (rotationCheckbox) {
              rotationCheckbox.checked = this.rotationConfig.enabled;
            }

            console.info('[SHIFTS DEBUG] Loaded rotation setting from DB:', dbEnabled);
            console.info('[SHIFTS DEBUG] Pattern exists for team:', patternExists);
            console.info('[SHIFTS DEBUG] Final rotation enabled state:', this.rotationConfig.enabled);
            break;
          }

          case 'shift_fallback_enabled': {
            // settingValue is already a boolean from API v2
            this.fallbackConfig.enabled = setting.settingValue === true;
            const fallbackCheckbox = $$<HTMLInputElement>('#shift-fallback');
            if (fallbackCheckbox) {
              fallbackCheckbox.checked = this.fallbackConfig.enabled;
            }
            console.info('[SHIFTS DEBUG] Loaded fallback setting from DB:', this.fallbackConfig.enabled);
            break;
          }

          case 'shift_autofill_config':
            try {
              // If it's already an object, use it directly; otherwise parse
              if (typeof setting.settingValue === 'object') {
                Object.assign(this.autofillConfig, setting.settingValue);
              } else if (typeof setting.settingValue === 'string') {
                Object.assign(this.autofillConfig, JSON.parse(setting.settingValue));
              }
            } catch {
              // Invalid JSON, ignore
            }
            break;
        }

        // Update cache - convert value to string for consistency
        this.userPreferencesCache[setting.settingKey] = String(setting.settingValue);
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  }

  private openRotationModal(existingPattern?: {
    id?: number;
    name: string;
    description?: string;
    patternType: string;
    patternConfig: Record<string, unknown>;
    startsAt: string;
    endsAt?: string | null;
  }): void {
    // Populate available employees for drag & drop
    this.setupRotationDragDrop();

    // Filter employees by selected team (Multi-tenant isolation)
    const teamEmployees = this.employees.filter((e) => {
      // Only show active employees from the selected team
      if (!e.is_active) return false;

      // Check if employee belongs to selected team
      if (this.selectedContext.teamId !== null) {
        // TODO: Add team_id check when employee data includes it
        // For now, show all active employees from tenant
        return true;
      }

      return true;
    });

    // Populate available employees list
    const availableContainer = $$id<HTMLDivElement>('rotation-available-employees');
    if (availableContainer) {
      console.info('[ROTATION SETUP] Found available employees container, adding', teamEmployees.length, 'employees');
      // Clear existing content
      while (availableContainer.firstChild) {
        availableContainer.firstChild.remove();
      }

      // Create draggable employee items
      teamEmployees.forEach((employee) => {
        const employeeDiv = document.createElement('div');
        employeeDiv.className = 'employee-item';
        employeeDiv.draggable = true;
        employeeDiv.dataset.employeeId = String(employee.id);
        employeeDiv.dataset.employeeName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
        employeeDiv.textContent = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`;

        // Add drag event listeners
        employeeDiv.addEventListener('dragstart', (e) => {
          console.info(
            '[ROTATION DRAG] Starting drag for employee:',
            employee.id,
            employee.first_name,
            employee.last_name,
          );
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(employee.id)); // Also set text/plain for compatibility
            e.dataTransfer.setData('employeeId', String(employee.id));
            e.dataTransfer.setData('employeeName', employeeDiv.dataset.employeeName ?? '');
            employeeDiv.classList.add('dragging');
            console.info('[ROTATION DRAG] Data set in dataTransfer');
          }
        });

        employeeDiv.addEventListener('dragend', (dragEndEvent) => {
          console.info(
            '[ROTATION DRAG] Drag ended for employee:',
            employee.id,
            employee.first_name,
            employee.last_name,
          );
          console.info('[ROTATION DRAG] DragEnd event details:', dragEndEvent.dataTransfer?.dropEffect);
          employeeDiv.classList.remove('dragging');
        });

        availableContainer.append(employeeDiv);
      });

      console.info(
        '[ROTATION SETUP] Added all employees. Container now has',
        availableContainer.children.length,
        'children',
      );
    } else {
      console.error('[ROTATION SETUP] Available employees container not found!');
    }

    // Set default start date and end date constraints
    const startDateInput = $$id<HTMLInputElement>('rotation-start-date');
    const endDateInput = $$id<HTMLInputElement>('rotation-end-date');
    const today = new Date();
    const currentYear = today.getFullYear();
    const maxDate = `${currentYear}-12-31`;

    // Helper function to get next Monday
    const getNextMonday = (date: Date): Date => {
      const result = new Date(date);
      const dayOfWeek = result.getDay();
      // If today is Monday (1), get next Monday (+7 days)
      // Otherwise calculate days until next Monday
      const daysUntilMonday = dayOfWeek === 1 ? 7 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      result.setDate(result.getDate() + daysUntilMonday);
      return result;
    };

    // Helper function to get second Friday after a given date
    const getSecondFridayAfter = (date: Date): Date => {
      const result = new Date(date);
      // First, get to the next Friday
      const dayOfWeek = result.getDay();
      const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 12 - dayOfWeek;
      result.setDate(result.getDate() + daysUntilFriday);
      // Then add one more week to get the second Friday
      result.setDate(result.getDate() + 7);
      return result;
    };

    // Only set default dates in CREATE mode
    if (!this.editMode) {
      const nextMonday = getNextMonday(today);
      const secondFriday = getSecondFridayAfter(nextMonday);

      if (startDateInput) {
        startDateInput.value = nextMonday.toISOString().split('T')[0];
        startDateInput.min = today.toISOString().split('T')[0];
      }

      if (endDateInput) {
        // Set default end date to second Friday after start date
        endDateInput.value = secondFriday.toISOString().split('T')[0];
        endDateInput.min = today.toISOString().split('T')[0];
        endDateInput.max = maxDate;
      }
    } else {
      // In EDIT mode, just set the constraints
      if (startDateInput) {
        startDateInput.min = today.toISOString().split('T')[0];
      }

      if (endDateInput) {
        endDateInput.min = today.toISOString().split('T')[0];
        endDateInput.max = maxDate;
      }
    }

    // Auto-adjust end date when start date changes (only in CREATE mode)
    if (!this.editMode && startDateInput && endDateInput) {
      startDateInput.addEventListener('change', () => {
        const newStartDate = new Date(startDateInput.value);
        const newEndDate = getSecondFridayAfter(newStartDate);
        endDateInput.value = newEndDate.toISOString().split('T')[0];
      });
    }

    // Show/hide custom pattern config and night shift ignore option
    const patternSelect = $$id<HTMLSelectElement>('rotation-pattern');
    const customConfig = $$id<HTMLDivElement>('custom-pattern-config');
    const ignoreNightGroup = $$id<HTMLDivElement>('ignore-night-shift-group');

    if (patternSelect) {
      patternSelect.addEventListener('change', () => {
        // Show/hide custom config
        if (customConfig) {
          customConfig.style.display = patternSelect.value === 'custom' ? 'block' : 'none';
        }

        // Show/hide ignore night shift option for all patterns except custom
        if (ignoreNightGroup) {
          ignoreNightGroup.style.display =
            patternSelect.value !== 'custom' && patternSelect.value !== '' ? 'block' : 'none';
        }
      });
    }

    // Update modal title based on mode
    const modal = $$id<HTMLDivElement>('rotation-setup-modal');
    if (modal) {
      const modalHeader = modal.querySelector('.modal-header h2');
      if (modalHeader) {
        modalHeader.textContent = this.editMode ? 'Schichtrotation bearbeiten' : 'Schichtrotation einrichten';
      }

      modal.style.display = 'flex';
      console.info('[SHIFTS DEBUG] Showing rotation setup modal in', this.editMode ? 'EDIT' : 'CREATE', 'mode');
    }

    // If editing, populate form with existing data
    if (this.editMode && existingPattern !== undefined) {
      const rotationStartInput = $$id<HTMLInputElement>('rotation-start-date');
      const rotationEndInput = $$id<HTMLInputElement>('rotation-end-date');
      const rotationPatternSelect = $$id<HTMLSelectElement>('rotation-pattern');
      const skipWeekendsInput = $$id<HTMLInputElement>('rotation-skip-weekends');
      const ignoreNightInput = $$id<HTMLInputElement>('rotation-ignore-night');

      if (rotationPatternSelect) {
        // Map patternType to select value based on pattern_type and pattern_config
        // Check if it's a weekly rotation based on patternConfig
        let selectValue = 'weekly'; // default

        if (existingPattern.patternType === 'alternate_fs') {
          selectValue = 'weekly';
        } else if (existingPattern.patternType === 'fixed_n') {
          selectValue = 'biweekly';
        } else if (existingPattern.patternType === 'custom') {
          // Check if it's actually a weekly rotation disguised as custom
          // If cycleWeeks is 1 and has skipWeekends/ignoreNightShift, it's weekly
          if ('cycleWeeks' in existingPattern.patternConfig && existingPattern.patternConfig.cycleWeeks === 1) {
            selectValue = 'weekly';
          } else {
            selectValue = 'custom';
          }
        }

        rotationPatternSelect.value = selectValue;

        // Trigger change event to show/hide related options
        const changeEvent = new Event('change');
        rotationPatternSelect.dispatchEvent(changeEvent);
      }

      if (rotationStartInput) {
        rotationStartInput.value = existingPattern.startsAt.split('T')[0];
      }

      if (rotationEndInput && existingPattern.endsAt !== null && existingPattern.endsAt !== undefined) {
        rotationEndInput.value = existingPattern.endsAt.split('T')[0];
      }

      // Load checkbox values from patternConfig
      // Check if skipWeekends exists in patternConfig
      if (skipWeekendsInput && 'skipWeekends' in existingPattern.patternConfig) {
        skipWeekendsInput.checked = existingPattern.patternConfig.skipWeekends as boolean;
      }

      // Check if ignoreNightShift exists in patternConfig
      if (ignoreNightInput && 'ignoreNightShift' in existingPattern.patternConfig) {
        ignoreNightInput.checked = existingPattern.patternConfig.ignoreNightShift as boolean;
      }

      // Load employee shift assignments if they exist
      if ('shiftGroups' in existingPattern.patternConfig) {
        const shiftAssignments = existingPattern.patternConfig.shiftGroups as Record<string, string>;

        // Clear all drop zones first
        ['drop-zone-f', 'drop-zone-s', 'drop-zone-n'].forEach((zoneId) => {
          const zone = $$id<HTMLDivElement>(zoneId);
          if (zone) {
            while (zone.firstChild) {
              zone.firstChild.remove();
            }
          }
        });

        // Place employees in their assigned shift columns
        Object.entries(shiftAssignments).forEach(([employeeId, shiftType]) => {
          // Find the employee in available list
          const availableEmployee = availableContainer?.querySelector(
            `[data-employee-id="${employeeId}"]`,
          ) as HTMLDivElement | null;
          if (availableEmployee !== null) {
            // Determine target drop zone
            let targetZoneId = 'drop-zone-f'; // default
            if (shiftType === 'S') targetZoneId = 'drop-zone-s';
            else if (shiftType === 'N') targetZoneId = 'drop-zone-n';

            const targetZone = $$id<HTMLDivElement>(targetZoneId);
            if (targetZone !== null) {
              // Create employee element in drop zone
              const employeeDiv = document.createElement('div');
              employeeDiv.className = 'employee-item';
              employeeDiv.dataset.employeeId = employeeId;
              employeeDiv.dataset.shiftType = shiftType;
              const employeeName = availableEmployee.dataset.employeeName ?? '';
              employeeDiv.textContent = employeeName;
              employeeDiv.draggable = true;

              // Add drag handlers
              employeeDiv.addEventListener('dragstart', (e) => {
                if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('employeeId', employeeId);
                  e.dataTransfer.setData('employeeName', employeeName);
                  employeeDiv.classList.add('dragging');
                }
              });

              employeeDiv.addEventListener('dragend', () => {
                employeeDiv.classList.remove('dragging');
              });

              // Add click handler for removal
              employeeDiv.addEventListener('click', (clickEvent) => {
                const target = clickEvent.target as HTMLElement;
                const rect = target.getBoundingClientRect();
                const clickX = clickEvent.clientX - rect.left;

                if (clickX > rect.width - 30) {
                  employeeDiv.remove();
                }
              });

              targetZone.append(employeeDiv);
            }
          }
        });
      }
    }

    // Setup event handlers
    const saveBtn = $$id<HTMLButtonElement>('save-rotation-btn');
    if (saveBtn) {
      // Update button text based on mode
      saveBtn.textContent = this.editMode ? 'Änderungen speichern' : 'Rotation erstellen';

      // Remove old listener and add new one
      const newSaveBtn = saveBtn.cloneNode(true) as HTMLButtonElement;
      saveBtn.parentNode?.replaceChild(newSaveBtn, saveBtn);
      newSaveBtn.addEventListener('click', () => {
        if (this.editMode) {
          void this.updateRotation();
        } else {
          void this.createRotation();
        }
      });
    }

    // Setup close buttons
    const closeButtons = document.querySelectorAll('[data-modal-close="rotation-setup-modal"]');
    closeButtons.forEach((btn) => {
      const newBtn = btn.cloneNode(true) as HTMLElement;
      btn.parentNode?.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        this.closeRotationModal();
      });
    });

    // Modal styles are now in shifts.css - no need for inline styles

    // Show the modal (using the modal variable already declared above)
    if (modal) {
      modal.classList.add('show');
      console.info('[SHIFTS DEBUG] Opened rotation setup modal');
    } else {
      console.error('[SHIFTS DEBUG] Modal element not found: rotation-setup-modal');
    }
  }

  private closeRotationModal(): void {
    const modal = $$id<HTMLDivElement>('rotation-setup-modal');
    if (modal) {
      modal.classList.remove('show');
      console.info('[SHIFTS DEBUG] Closed rotation setup modal');
    }

    // Reset checkbox if modal was closed without saving
    const rotationCheckbox = $$<HTMLInputElement>('#shift-rotation');
    if (rotationCheckbox && !this.rotationConfig.enabled) {
      rotationCheckbox.checked = false;
    }
  }

  private async loadRotationForEdit(): Promise<void> {
    try {
      // Plan remains locked during rotation editing - preventing drag & drop
      console.info('[SHIFTS ROTATION] Plan stays locked during rotation editing');

      const token = getAuthToken();
      if (token === null || token === '') {
        showErrorAlert('Nicht angemeldet');
        return;
      }

      if (this.selectedContext.teamId === null) {
        showErrorAlert('Kein Team ausgewählt');
        return;
      }

      // Get patterns for this team
      const response = await fetch('/api/v2/shifts/rotation/patterns?active=true', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load patterns: ${response.statusText}`);
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: {
          patterns?: {
            id: number;
            teamId: number | null;
            name: string;
            description?: string;
            patternType: string;
            patternConfig: Record<string, unknown>;
            startsAt: string;
            endsAt?: string | null;
          }[];
        };
      };

      if (!result.success || result.data?.patterns === undefined) {
        showErrorAlert('Keine Rotationsmuster gefunden');
        return;
      }

      // Find pattern for current team
      const pattern = result.data.patterns.find((p) => p.teamId === this.selectedContext.teamId);
      if (pattern === undefined) {
        showErrorAlert('Kein Rotationsmuster für dieses Team gefunden');
        return;
      }

      // Set edit mode
      this.editMode = true;
      this.currentPatternId = pattern.id;

      // Open modal with loaded data
      this.openRotationModal(pattern);
    } catch (error) {
      console.error('[SHIFTS ERROR] Failed to load rotation for edit:', error);
      showErrorAlert('Fehler beim Laden der Rotation');
    }
  }

  private async createRotation(): Promise<void> {
    try {
      const token = getAuthToken();
      if (token === null || token === '') {
        showErrorAlert('Nicht angemeldet');
        return;
      }

      // Get form values from new modal structure
      const patternSelect = $$id<HTMLSelectElement>('rotation-pattern');
      const startInput = $$id<HTMLInputElement>('rotation-start-date');
      const endInput = $$id<HTMLInputElement>('rotation-end-date');
      const skipWeekendsInput = $$id<HTMLInputElement>('rotation-skip-weekends');
      const ignoreNightInput = $$id<HTMLInputElement>('rotation-ignore-night');

      const pattern = patternSelect?.value;
      const startDate = startInput?.value;
      const endDateValue = endInput?.value;
      const skipWeekends = skipWeekendsInput?.checked ?? false;
      const ignoreNightShift = ignoreNightInput?.checked ?? false;

      // Validate required fields
      if (pattern === undefined || pattern === '') {
        showErrorAlert('Bitte wählen Sie ein Rotationsmuster');
        return;
      }

      if (startDate === undefined || startDate === '') {
        showErrorAlert('Bitte wählen Sie ein Startdatum');
        return;
      }

      if (endDateValue === undefined || endDateValue === '') {
        showErrorAlert('Bitte wählen Sie ein Enddatum');
        return;
      }

      // Validate end date is after start date
      const endDate = new Date(endDateValue);
      if (endDate <= new Date(startDate)) {
        showErrorAlert('Das Enddatum muss nach dem Startdatum liegen');
        return;
      }

      // Schutz: Maximal bis Ende des aktuellen Jahres
      const currentYear = new Date().getFullYear();
      const maxEndDate = new Date(currentYear, 11, 31); // 31. Dezember des aktuellen Jahres
      if (endDate > maxEndDate) {
        showErrorAlert(`Das Enddatum darf maximal bis zum 31.12.${currentYear} gehen (Datenbankschutz)`);
        return;
      }

      // Get selected employees from drop zones
      const shiftGroups: Record<number, string> = {};
      const selectedEmployees: number[] = [];

      // Get employees from F column
      const fZone = $$id<HTMLDivElement>('drop-zone-f');
      if (fZone) {
        const fEmployees = fZone.querySelectorAll<HTMLDivElement>('.employee-item');
        fEmployees.forEach((emp) => {
          const empId = Number(emp.dataset.employeeId);
          if (empId !== 0 && !Number.isNaN(empId)) {
            selectedEmployees.push(empId);
            Reflect.set(shiftGroups, empId, 'F');
          }
        });
      }

      // Get employees from S column
      const sZone = $$id<HTMLDivElement>('drop-zone-s');
      if (sZone) {
        const sEmployees = sZone.querySelectorAll<HTMLDivElement>('.employee-item');
        sEmployees.forEach((emp) => {
          const empId = Number(emp.dataset.employeeId);
          if (empId !== 0 && !Number.isNaN(empId)) {
            selectedEmployees.push(empId);
            Reflect.set(shiftGroups, empId, 'S');
          }
        });
      }

      // Get employees from N column
      const nZone = $$id<HTMLDivElement>('drop-zone-n');
      if (nZone) {
        const nEmployees = nZone.querySelectorAll<HTMLDivElement>('.employee-item');
        nEmployees.forEach((emp) => {
          const empId = Number(emp.dataset.employeeId);
          if (empId !== 0 && !Number.isNaN(empId)) {
            selectedEmployees.push(empId);
            Reflect.set(shiftGroups, empId, 'N');
          }
        });
      }

      if (selectedEmployees.length === 0) {
        showErrorAlert('Bitte ziehen Sie mindestens einen Mitarbeiter in eine Schicht-Spalte');
        return;
      }

      // Map pattern type to API format - always use 'custom' for flexibility
      const patternType = 'custom';

      // Get selected team from context
      const teamId = this.selectedContext.teamId;
      // Step 1: Create rotation pattern
      const requestPayload = {
        name: `${pattern} Rotation`,
        description: `Automatische ${pattern} Rotation`,
        team_id: teamId ?? null,
        pattern_type: patternType,
        pattern_config: {
          skipWeekends: skipWeekends,
          cycleWeeks: pattern === 'weekly' ? 1 : pattern === 'biweekly' ? 2 : 4,
          ignoreNightShift: ignoreNightShift,
          shiftGroups: shiftGroups, // Include the shift assignments from drag & drop
        },
        cycle_length_weeks: pattern === 'weekly' ? 1 : pattern === 'biweekly' ? 2 : 4,
        starts_at: startDate,
        ends_at: endDateValue,
        is_active: true,
      };

      console.info('[ROTATION DEBUG] Creating pattern with payload:', requestPayload);

      const patternResponse = await fetch('/api/v2/shifts/rotation/patterns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestPayload),
      });

      console.info('[ROTATION DEBUG] Pattern response status:', patternResponse.status);

      if (!patternResponse.ok) {
        const errorText = await patternResponse.text();
        console.error('[ROTATION ERROR] Response:', errorText);
        console.error('[ROTATION ERROR] Status:', patternResponse.status);
        throw new Error(`Fehler beim Erstellen des Rotationsmusters: ${errorText}`);
      }

      const patternResult = (await patternResponse.json()) as { data: { pattern: { id: number } } };
      const patternId = patternResult.data.pattern.id;

      // Step 2: Assign employees to pattern
      // Note: shiftGroups already collected from drag & drop zones above

      const assignResponse = await fetch('/api/v2/shifts/rotation/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pattern_id: patternId,
          user_ids: selectedEmployees,
          team_id: teamId ?? null,
          shift_groups: shiftGroups,
          starts_at: startDate,
          ends_at: endDate.toISOString().split('T')[0],
        }),
      });

      if (!assignResponse.ok) {
        throw new Error('Fehler beim Zuweisen der Mitarbeiter');
      }

      // Step 3: Generate shifts
      const generateResponse = await fetch('/api/v2/shifts/rotation/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pattern_id: patternId,
          start_date: startDate,
          end_date: endDate.toISOString().split('T')[0],
          preview: false,
        }),
      });

      if (!generateResponse.ok) {
        // Check if it's an overlap error
        const errorData = (await generateResponse.json()) as { error?: { message?: string } };
        const errorMessage = errorData.error?.message ?? '';

        if (errorMessage.includes('Überlappung') || errorMessage.includes('existiert bereits')) {
          throw new Error(
            '⚠️ ÜBERLAPPUNG ERKANNT: Es existieren bereits Schichten für dieses Team in diesem Zeitraum! Bitte löschen Sie zuerst die bestehenden Schichten oder wählen Sie einen anderen Zeitraum.',
          );
        }
        throw new Error('Fehler beim Generieren der Schichten');
      }

      const generateResult = (await generateResponse.json()) as { data: { generatedShifts: unknown[] } };

      showSuccessAlert(
        `Rotation erfolgreich erstellt! ${generateResult.data.generatedShifts.length} Schichten wurden generiert.`,
      );

      // Close modal
      this.closeRotationModal();

      // Save rotation preference
      await this.saveUserPreferenceToDatabase('shift_rotation_pattern_id', String(patternId));

      // Keep the checkbox checked since we successfully created a rotation pattern
      this.rotationConfig.enabled = true;
      const rotationCheckbox = $$<HTMLInputElement>('#shift-rotation');
      if (rotationCheckbox) {
        rotationCheckbox.checked = true;
      }

      // Reload shift plan to show the rotation data from shift_rotation_history
      console.info('[SHIFTS ROTATION] Reloading shift plan to display rotation data');
      await this.loadCurrentWeekData();
    } catch (error) {
      console.error('Error creating rotation:', error);
      showErrorAlert(error instanceof Error ? error.message : 'Fehler beim Erstellen der Rotation');
    }
  }

  private showEditRotationButton(show: boolean): void {
    const editBtn = $$id<HTMLButtonElement>('edit-rotation-btn');
    if (editBtn) {
      editBtn.style.display = show ? 'inline-block' : 'none';
      console.info('[SHIFTS DEBUG] Edit rotation button visibility:', show);
    }
  }

  private async updateRotation(): Promise<void> {
    try {
      const token = getAuthToken();
      if (token === null || token === '') {
        showErrorAlert('Nicht angemeldet');
        return;
      }

      if (this.currentPatternId === null) {
        showErrorAlert('Kein Muster zum Bearbeiten ausgewählt');
        return;
      }

      // Get form values
      const patternSelect = $$id<HTMLSelectElement>('rotation-pattern');
      const startInput = $$id<HTMLInputElement>('rotation-start-date');
      const endInput = $$id<HTMLInputElement>('rotation-end-date');
      const skipWeekendsInput = $$id<HTMLInputElement>('rotation-skip-weekends');
      const ignoreNightInput = $$id<HTMLInputElement>('rotation-ignore-night');

      const pattern = patternSelect?.value;
      const startDate = startInput?.value;
      const endDateValue = endInput?.value;
      const skipWeekends = skipWeekendsInput?.checked ?? false;
      const ignoreNightShift = ignoreNightInput?.checked ?? false;

      // Validate required fields
      if (pattern === undefined || pattern === '') {
        showErrorAlert('Bitte wählen Sie ein Rotationsmuster');
        return;
      }

      if (startDate === undefined || startDate === '') {
        showErrorAlert('Bitte wählen Sie ein Startdatum');
        return;
      }

      // Map select value to pattern type
      const patternTypeMap: Record<string, string> = {
        weekly: 'alternate_fs',
        biweekly: 'fixed_n',
        custom: 'custom',
      };

      const requestPayload = {
        name: `Team-Rotation ${this.selectedContext.teamId ?? 'Unknown'}`,
        description: 'Automatisch generierte Schichtrotation',
        team_id: this.selectedContext.teamId ?? null,
        // eslint-disable-next-line security/detect-object-injection
        pattern_type: patternTypeMap[pattern] ?? 'alternate_fs',
        pattern_config: {
          skipWeekends,
          ignoreNightShift,
        },
        starts_at: startDate,
        ends_at: endDateValue ?? startDate,
        is_active: true,
      };

      // Update pattern
      const response = await fetch(`/api/v2/shifts/rotation/patterns/${this.currentPatternId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorResponse = (await response.json()) as {
          error?: {
            code?: string;
            message?: string;
          };
        };
        const errorMessage = errorResponse.error?.message ?? 'Fehler beim Aktualisieren des Musters';
        throw new Error(errorMessage);
      }

      showSuccessAlert('Rotation erfolgreich aktualisiert');

      // Close modal
      this.closeRotationModal();

      // Reset edit mode
      this.editMode = false;
      this.currentPatternId = null;

      // Reload shift plan
      await this.loadCurrentWeekData();
    } catch (error) {
      console.error('Error updating rotation:', error);
      showErrorAlert(error instanceof Error ? error.message : 'Fehler beim Aktualisieren der Rotation');
    }
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
              assignmentDiv.innerHTML = '<div class="empty-slot">+</div>';
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
    card.append(nameDiv);

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
          // Set flag to prevent autofill when removing
          this.isRemoving = true;
          this.assignShift(cell as HTMLElement, employee.id);
          this.isRemoving = false;
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
                type: this.convertShiftTypeForAPI(shiftType),
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

        // Check if Kontischicht is active and get pattern
        const windowWithKontischicht = window as typeof window & {
          kontischichtManager: {
            isKontischichtActive: () => boolean;
            getSelectedPattern: () => {
              name: string;
              patternType: string;
            } | null;
          };
        };
        const kontischichtManager =
          'kontischichtManager' in window ? windowWithKontischicht.kontischichtManager : undefined;
        let planName = `Schichtplan KW${String(this.getWeekNumber(this.currentWeek))}/${String(new Date().getFullYear())}`;
        let kontischichtPattern: string | undefined;

        // Override dates for Kontischicht with modal dates
        let overrideStartDate = weekStart;
        let overrideEndDate = weekEnd;

        if (kontischichtManager?.isKontischichtActive() === true) {
          const pattern = kontischichtManager.getSelectedPattern();
          if (pattern !== null) {
            planName = `Kontischicht ${pattern.name} KW${String(this.getWeekNumber(this.currentWeek))}/${String(new Date().getFullYear())}`;
            kontischichtPattern = pattern.patternType;
            console.info('[SHIFTS] Kontischicht active with pattern:', pattern.name, pattern.patternType);

            // Use dates from Kontischicht modal
            if (pattern.startsAt !== '') {
              overrideStartDate = pattern.startsAt;
            }
            if (pattern.endsAt !== undefined && pattern.endsAt !== '') {
              overrideEndDate = pattern.endsAt;
            }
            console.info('[SHIFTS] Using Kontischicht dates:', overrideStartDate, 'to', overrideEndDate);
          }
        }

        // Erstelle Plan-Request für neuen /api/v2/shifts/plan Endpoint
        const planRequest = {
          startDate: overrideStartDate,
          endDate: overrideEndDate,
          areaId: nullToUndefined(this.selectedContext.areaId),
          departmentId: nullToUndefined(this.selectedContext.departmentId),
          teamId: nullToUndefined(this.selectedContext.teamId),
          machineId: nullToUndefined(this.selectedContext.machineId),
          name: planName,
          shiftNotes: notes !== '' ? notes : undefined, // API v2 uses camelCase
          shifts: shiftsForPlan,
          kontischichtPattern, // Add pattern type for backend
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

          // Check if it's an overlap error from the database trigger
          if (error instanceof Error) {
            const errorMessage = error.message;
            if (errorMessage.includes('Überlappung') || errorMessage.includes('existiert bereits')) {
              showErrorAlert(
                '⚠️ ÜBERLAPPUNG ERKANNT: Es existiert bereits eine Rotation für dieses Team und diesen Zeitraum! Bitte deaktivieren Sie zuerst die Rotation oder wählen Sie einen anderen Zeitraum.',
              );
            } else if (errorMessage.includes('404')) {
              console.warn('[SHIFTS PLAN DEBUG] Plan endpoint not available, falling back to individual creation');
              showErrorAlert('Plan-basierte Speicherung noch nicht verfügbar. Bitte Backend aktualisieren.');
            } else {
              showErrorAlert('Fehler beim Speichern des Schichtplans: ' + errorMessage);
            }
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

  async resetSchedule(): Promise<void> {
    if (!this.isAdmin) return;

    // Use showConfirm from alerts.ts - same pattern as rotation deactivation
    const confirmed = await showConfirm(
      '⚠️ Schichtplan zurücksetzen?\n\nAlle Schichten dieser Woche werden dauerhaft aus der Datenbank gelöscht!\nDer Schichtplan wird komplett geleert.\n\nWirklich fortfahren?',
    );

    if (!confirmed) return;

    try {
      // If we have a plan ID, delete it from database
      if (this.currentPlanId !== null && this.useV2API) {
        console.info('[SHIFTS RESET] Deleting plan from database:', this.currentPlanId);

        // Delete the plan via API
        const response = await this.apiClient.request(`/shifts/plan/${String(this.currentPlanId)}`, {
          method: 'DELETE',
        });

        console.info('[SHIFTS RESET] Delete response:', response);
        showSuccessAlert('Schichtplan wurde aus der Datenbank gelöscht');
      } else if (!this.useV2API) {
        // Legacy v1 API - delete individual shifts for the week
        const weekStart = this.formatDate(this.getWeekStart(this.currentWeek));
        const weekEnd = this.formatDate(this.getWeekEnd(this.currentWeek));

        console.info('[SHIFTS RESET] Deleting shifts for week:', weekStart, 'to', weekEnd);

        const response = await fetch('/api/shifts/bulk-delete', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken() ?? ''}`,
          },
          body: JSON.stringify({
            week_start: weekStart,
            week_end: weekEnd,
            department_id: this.selectedContext.departmentId,
            team_id: this.selectedContext.teamId,
            machine_id: this.selectedContext.machineId,
          }),
        });

        if (response.ok) {
          showSuccessAlert('Schichten wurden aus der Datenbank gelöscht');
        } else {
          console.error('[SHIFTS RESET] Failed to delete shifts');
        }
      }

      // Clear UI
      this.weeklyShifts = new Map();
      this.shiftDetails = new Map();
      this.currentPlanId = null;

      // Clear notes
      const notesTextarea = $$id<HTMLTextAreaElement>('weeklyNotes');
      if (notesTextarea) {
        notesTextarea.value = '';
      }

      // Clear info bar
      const infoBar = document.querySelector('.shift-info-bar');
      if (infoBar) {
        infoBar.innerHTML = '';
      }

      // Re-render view
      this.renderWeekView();
      // this.updateEmployeeShiftCounts(); // temporarily disabled

      showInfo('Schichtplan wurde zurückgesetzt');

      // No need to close modal - showConfirm handles that automatically
    } catch (error) {
      console.error('[SHIFTS RESET] Error during reset:', error);
      showErrorAlert('Fehler beim Zurücksetzen des Schichtplans');
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
    this.isPlanLocked = true;

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
    this.isPlanLocked = false;

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

      // Load teams for this machine but WITHOUT resetting teamId
      // Store team ID temporarily
      const savedTeamId = favorite.teamId;
      await this.onMachineSelected(favorite.machineId);
      // Restore team ID after onMachineSelected resets it
      this.selectedContext.teamId = savedTeamId;
      const teamSelect = $$id<HTMLInputElement>('teamSelect');
      if (teamSelect) teamSelect.value = String(favorite.teamId);

      const teamDisplay = document.querySelector('#teamDisplay span');
      if (teamDisplay) teamDisplay.textContent = favorite.teamName;

      // Trigger team selection logic (loads shift plan and preferences!)
      console.info('[LOADFAVORITE] Calling onTeamSelected with teamId:', savedTeamId);

      // WORKAROUND: Load preferences directly here since onTeamSelected seems to not work
      console.info('[LOADFAVORITE] Loading preferences directly for team:', savedTeamId);
      await this.loadUserPreferencesFromDatabase();

      try {
        // Call the method
        await this.onTeamSelected(savedTeamId);
        console.info('[LOADFAVORITE] onTeamSelected completed successfully');
      } catch (teamError) {
        console.error('[LOADFAVORITE] Error in onTeamSelected:', teamError);
      }

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
