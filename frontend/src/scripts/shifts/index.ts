/* eslint-disable max-lines */
/**
 * New Shift Planning System - TypeScript Implementation
 * Interactive weekly shift planning with drag & drop functionality
 */

import type { User } from '../../types/api.types';
import { ApiClient } from '../../utils/api-client';
import {
  mapTeams,
  mapUsers,
  mapRotationPatterns,
  type TeamAPIResponse,
  type UserAPIResponse,
  type RotationPatternAPIResponse,
} from '../../utils/api-mappers';
import { $$, $$id, createElement, setData } from '../../utils/dom-utils';
import { getAuthToken, showInfo } from '../auth/index';
// escapeHtml removed - using DOM manipulation instead
import { showSuccessAlert, showErrorAlert, showConfirm } from '../utils/alerts';
import { openModal } from '../utils/modal-manager';

interface ShiftDetailData {
  employee_id: number;
  first_name: string;
  last_name: string;
  username: string;
}

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
  private shiftDetails: Map<string, ShiftDetailData>;
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
    // Feature flags removed - always use v2
    this.useV2API = true;

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

  private restoreSavedContext(): boolean {
    const savedContextStr = localStorage.getItem('shiftsReloadContext');
    if (savedContextStr === null) return false;

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
      if (ageInMs >= 5 * 60 * 1000) {
        console.info('[SHIFTS RELOAD DEBUG] Saved context is too old, ignoring');
        localStorage.removeItem('shiftsReloadContext');
        return false;
      }

      console.info('[SHIFTS RELOAD DEBUG] Restoring saved context after reload:', savedContext);

      // Restore the context
      this.selectedContext.areaId = savedContext.areaId;
      this.selectedContext.departmentId = savedContext.departmentId;
      this.selectedContext.machineId = savedContext.machineId;
      this.selectedContext.teamId = savedContext.teamId;
      this.currentWeek = new Date(savedContext.currentWeek);
      this.currentPlanId = savedContext.planId;

      // Store for later use after loadContextData() populates the dropdowns
      // Using explicit interface for better type safety
      interface WindowWithShifts extends Window {
        shiftsRestoringFromReload?: boolean;
        shiftsSavedReloadContext?: typeof savedContext;
      }
      (window as WindowWithShifts).shiftsRestoringFromReload = true;
      (window as WindowWithShifts).shiftsSavedReloadContext = savedContext;

      localStorage.removeItem('shiftsReloadContext');
      console.info('[SHIFTS RELOAD DEBUG] Context restored and cleared from localStorage');
      return true;
    } catch (error) {
      console.error('[SHIFTS RELOAD DEBUG] Error parsing saved context:', error);
      localStorage.removeItem('shiftsReloadContext');
      return false;
    }
  }

  private setCustomDropdown(_selectId: string, displayId: string, value: number | null, label?: string): void {
    if (value === null) return;

    const display = $$id(displayId);
    if (display !== null) {
      setData(display, 'value', String(value));
      if (label !== undefined) {
        const span = display.querySelector('span');
        if (span !== null) {
          span.textContent = label;
        }
      }
    }
  }

  private async restoreAreaSelection(areaId: number | null): Promise<void> {
    if (areaId === null) return;

    const area = this.areas.find((a) => a.id === areaId);
    if (area !== undefined) {
      this.setCustomDropdown('areaSelect', 'areaDisplay', areaId, area.name);
      await this.loadDepartments(areaId);
      this.populateDepartmentSelect();
    }
  }

  private async restoreDepartmentSelection(departmentId: number | null): Promise<void> {
    if (departmentId === null) return;

    const dept = this.departments.find((d) => d.id === departmentId);
    if (dept !== undefined) {
      this.setCustomDropdown('departmentSelect', 'departmentDisplay', departmentId, dept.name);
      this.selectedContext.departmentId = departmentId;
      await this.loadMachines();
      this.populateMachineSelect();
    }
  }

  private async restoreMachineSelection(machineId: number | null): Promise<void> {
    if (machineId === null) return;

    const machine = this.machines.find((m) => m.id === machineId);
    if (machine !== undefined) {
      this.setCustomDropdown('machineSelect', 'machineDisplay', machineId, machine.name);
      await this.loadTeamsForMachine(machineId);
      this.populateTeamSelect();
    }
  }

  private restoreTeamSelection(teamId: number | null): void {
    if (teamId === null) return;

    const team = this.teams.find((t) => t.id === teamId);
    if (team !== undefined) {
      this.setCustomDropdown('teamSelect', 'teamDisplay', teamId, team.name);
    }
  }

  private async restoreDropdownSelections(): Promise<void> {
    interface WindowWithShifts extends Window {
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
    }

    const windowWithShifts = window as WindowWithShifts;
    if (
      windowWithShifts.shiftsRestoringFromReload !== true ||
      windowWithShifts.shiftsSavedReloadContext === undefined
    ) {
      return;
    }

    console.info('[SHIFTS RELOAD DEBUG] Restoring dropdown selections...');
    const context = windowWithShifts.shiftsSavedReloadContext;

    // Restore each dropdown selection
    await this.restoreAreaSelection(context.areaId);
    await this.restoreDepartmentSelection(context.departmentId);
    await this.restoreMachineSelection(context.machineId);
    this.restoreTeamSelection(context.teamId);

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

  private shouldLoadInitialData(): boolean {
    return this.isAdmin
      ? this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0
      : this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0;
  }

  private async loadInitialData(): Promise<void> {
    console.info('[SHIFTS DEBUG] Team/Department selected, loading data...');

    // Load user preferences for the selected team
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
  }

  private async finalizeInitialization(): Promise<void> {
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
    this.restoreSavedContext();

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
      await this.restoreDropdownSelections();

      // Only load data if a team is already selected
      if (this.shouldLoadInitialData()) {
        await this.loadInitialData();
      } else {
        console.info('[SHIFTS DEBUG] No team/department selected, skipping initial data load');
      }

      // Finalize initialization
      await this.finalizeInitialization();

      console.info('[SHIFTS] Shift Planning System initialized successfully');
    } catch (error) {
      console.error('[SHIFTS ERROR] Failed to initialize:', error);
    }
  }

  private setUserRoleAndPermissions(user: User, activeRole: string | null): void {
    this.userRole = activeRole ?? user.role;
    this.isAdmin = ['admin', 'root', 'manager', 'team_lead'].includes(this.userRole);
    this.currentUserId = user.id;
  }

  private updateUserNameDisplay(username: string): void {
    const userNameElement = document.querySelector('#userName');
    if (userNameElement) {
      userNameElement.textContent = username;
    }
  }

  private setEmployeeDepartment(user: User): void {
    if (!this.isAdmin && user.department_id !== undefined && user.department_id !== 0) {
      this.selectedContext.departmentId = user.department_id;
      console.info('[SHIFTS DEBUG] Employee department auto-selected:', user.department_id);
    }
  }

  private updateDepartmentDisplay(departmentId: number | undefined): void {
    const currentDeptElement = document.querySelector('#currentDepartment');
    if (currentDeptElement && departmentId !== undefined && departmentId !== 0) {
      currentDeptElement.textContent = `Department ${String(departmentId)}`;
    }
  }

  private updateTeamLeaderDisplay(user: User): void {
    const currentTeamLeaderElement = document.querySelector('#currentTeamLeader');
    if (currentTeamLeaderElement && user.position !== undefined && user.position !== '') {
      currentTeamLeaderElement.textContent = user.username;
    }
  }

  async checkUserRole(): Promise<void> {
    try {
      const activeRole = localStorage.getItem('activeRole');
      const user = await this.getStoredUserData();

      if (user) {
        this.setUserRoleAndPermissions(user, activeRole);
        this.updateUserNameDisplay(user.username);
        this.setEmployeeDepartment(user);
        this.updateDepartmentDisplay(user.department_id);
        this.updateTeamLeaderDisplay(user);
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

  private handleScheduleButtons(target: HTMLElement): void {
    if (target.id === 'editScheduleBtn') {
      this.toggleEditMode(true);
    } else if (target.id === 'updateScheduleBtn') {
      void this.updateSchedule();
    }
  }

  private handleRemoveShiftAction(e: Event, target: HTMLElement): void {
    if (target.dataset.action !== 'remove-shift' && target.parentElement?.dataset.action !== 'remove-shift') {
      return;
    }

    console.info('[REMOVE DEBUG] Remove button clicked!', {
      target: target.tagName,
      action: target.dataset.action,
      parentAction: target.parentElement?.dataset.action,
      classList: target.classList.toString(),
    });
    e.stopPropagation();
    e.preventDefault();

    const btn = target.dataset.action === 'remove-shift' ? target : target.parentElement;
    if (!btn) return;

    const employeeId = btn.dataset.employeeId;
    const card = btn.closest('.employee-card');
    const cell = card?.closest(CSS_SELECTORS.SHIFT_CELL);

    console.info('[REMOVE DEBUG] Button details:', {
      btn,
      employeeId,
      card,
      cell,
      cellDataset: (cell as HTMLElement | null)?.dataset,
    });

    if (cell && employeeId !== undefined && employeeId !== '') {
      console.info('[REMOVE DEBUG] Removing employee', employeeId, 'from shift');
      this.removeEmployeeFromShift(cell as HTMLElement, Number(employeeId));
    } else {
      console.error('[REMOVE DEBUG] Missing data:', { cell: !!cell, employeeId });
    }
  }

  private handleCloseModalAction(target: HTMLElement): void {
    if (target.dataset.action !== 'close-modal') return;

    const w = window as unknown as { modalManager?: { closeModal?: () => void } };
    if (w.modalManager && typeof w.modalManager.closeModal === 'function') {
      w.modalManager.closeModal();
    }
  }

  private handleAddToFavoritesAction(target: HTMLElement): void {
    if (target.dataset.action === 'add-to-favorites') {
      void this.addToFavorites();
    }
  }

  private handleDropdownOption(target: HTMLElement): void {
    const option = target.closest<HTMLElement>('.dropdown-option');
    if (!option) return;

    const type = option.dataset.type;
    const value = option.dataset.value;
    const text = option.dataset.text;

    if (type !== undefined && type !== '' && value !== undefined && value !== '' && text !== undefined && text !== '') {
      this.selectOption(type, value, text);
    }
  }

  setupEventListeners(): void {
    console.info('[SHIFTS DEBUG] Setting up event listeners');

    // Setup all event listeners
    this.setupWeekNavigation();
    this.setupDragDetection();
    this.setupClickHandlers();
    this.setupDragAndDrop();
    this.setupContextEvents();
    this.setupNotesEvents();
    this.setupAdminActions();
    this.setupGlobalClickHandler();
    this.setupShiftControls();
  }

  private setupWeekNavigation(): void {
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
  }

  private setupDragDetection(): void {
    let mouseDownTime = 0;
    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);
      if (employeeItem && employeeItem.getAttribute('draggable') === 'false') {
        mouseDownTime = Date.now();
        this.setupDragAttemptListeners(e, employeeItem);
      }
    });

    // Employee selection (fallback for non-drag interaction)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);
      if (employeeItem && !this.isDragging && Date.now() - mouseDownTime < 200) {
        this.selectEmployee(employeeItem as HTMLElement);
      }
    });
  }

  private setupDragAttemptListeners(e: MouseEvent, _employeeItem: Element): void {
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const distance = Math.sqrt(
        Math.pow(moveEvent.clientX - e.clientX, 2) + Math.pow(moveEvent.clientY - e.clientY, 2),
      );

      if (distance > 5) {
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

  private setupClickHandlers(): void {
    // Shift cell assignment (fallback for non-drag interaction)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const shiftCell = target.closest(CSS_SELECTORS.SHIFT_CELL);
      if (shiftCell && this.isAdmin && !this.isDragging) {
        this.assignEmployeeToShift(shiftCell as HTMLElement);
      } else if (shiftCell && !this.isAdmin && !this.isDragging) {
        this.showShiftDetailsModal(shiftCell as HTMLElement);
      }
    });
  }

  private setupAdminActions(): void {
    document.querySelector('#saveScheduleBtn')?.addEventListener('click', () => {
      void this.saveSchedule();
    });
    document.querySelector('#resetScheduleBtn')?.addEventListener('click', () => {
      void this.resetSchedule();
    });
  }

  private setupGlobalClickHandler(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      this.handleScheduleButtons(target);
      this.handleRemoveShiftAction(e, target);
      this.handleCloseModalAction(target);
      this.handleAddToFavoritesAction(target);
      this.handleDropdownOption(target);
    });
  }

  setupDragAndDrop(): void {
    console.info('[SHIFTS DEBUG] Setting up drag and drop. Is admin:', this.isAdmin);
    if (!this.isAdmin) {
      console.info('[SHIFTS DEBUG] User is not admin, drag & drop disabled');
      return;
    }

    this.setupDragStartHandler();
    this.setupDragEndHandler();
    this.setupDragOverHandler();
    this.setupDragLeaveHandler();
    this.setupDropHandlers();
  }

  private setupDragStartHandler(): void {
    document.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);

      if (employeeItem) {
        console.info('[SHIFTS DEBUG] Drag start on employee:', (employeeItem as HTMLElement).dataset.employeeId);

        if (employeeItem.getAttribute('draggable') === 'false') {
          console.info('[SHIFTS DEBUG] Employee not draggable, preventing drag');
          e.preventDefault();

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
  }

  private setupDragEndHandler(): void {
    document.addEventListener('dragend', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);

      if (employeeItem) {
        this.isDragging = false;
        employeeItem.classList.remove('dragging');
      }
    });
  }

  private setupDragOverHandler(): void {
    document.addEventListener('dragover', (e) => {
      const target = e.target as HTMLElement;

      const rotationModal = target.closest('#rotation-setup-modal');
      if (rotationModal) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      if (target.classList.contains('drop-zone') || target.closest('.drop-zone')) {
        console.info('[GLOBAL DRAGOVER] Over drop zone, preventDefault called');
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        return;
      }

      const shiftCell = target.closest(CSS_SELECTORS.SHIFT_CELL);
      if (shiftCell) {
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
        shiftCell.classList.add('drag-over');
      }
    });
  }

  private setupDragLeaveHandler(): void {
    document.addEventListener('dragleave', (e) => {
      const target = e.target as HTMLElement;
      const shiftCell = target.closest(CSS_SELECTORS.SHIFT_CELL);

      if (shiftCell) {
        shiftCell.classList.remove('drag-over');
      }
    });
  }

  private setupDropHandlers(): void {
    // Drop on shift cells - Listen in bubble phase
    document.addEventListener(
      'drop',
      (e) => {
        this.handleDropOnShiftCell(e);
      },
      false,
    );

    // Add another listener in capture phase for debugging
    document.addEventListener(
      'drop',
      (e) => {
        this.handleDropInCapturePhase(e);
      },
      true,
    );
  }

  private handleDropOnShiftCell(e: DragEvent): void {
    const target = e.target as HTMLElement;

    console.info('[GLOBAL DROP CAPTURE] !!!!! Drop event in CAPTURE phase on:', target.className, target.id);
    console.info('[GLOBAL DROP] Event details:', e.dataTransfer?.types, e.dataTransfer?.effectAllowed);

    if (target.classList.contains('drop-zone') || target.closest('.drop-zone')) {
      console.info('[SHIFTS DEBUG] Drop on rotation zone, letting specific handler manage it');
      return;
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
  }

  private handleDropInCapturePhase(e: DragEvent): void {
    const target = e.target as HTMLElement;
    console.info('[GLOBAL DROP DEBUG] Drop detected anywhere! Target:', target.className);

    const rotationModal = target.closest('#rotation-setup-modal');
    if (rotationModal) {
      console.info('[GLOBAL DROP DEBUG] Drop within rotation modal - preventing default');
      e.preventDefault();
    }
  }

  setupContextEvents(): void {
    // Area selection (TOP of hierarchy) - Listen for custom dropdownChange event
    const areaDisplay = document.querySelector('#areaDisplay');
    if (areaDisplay !== null) {
      areaDisplay.addEventListener('dropdownChange', (e) => {
        const event = e as CustomEvent<{ value: string }>;
        const value = event.detail.value;
        this.selectedContext.areaId = value !== '' ? Number.parseInt(value, 10) : null;
        void this.onAreaSelected(this.selectedContext.areaId ?? undefined);
      });
    }

    // Department selection - Listen for custom dropdownChange event
    const departmentDisplay = document.querySelector('#departmentDisplay');
    if (departmentDisplay !== null) {
      departmentDisplay.addEventListener('dropdownChange', (e) => {
        const event = e as CustomEvent<{ value: string }>;
        const value = event.detail.value;
        this.selectedContext.departmentId = value !== '' ? Number.parseInt(value, 10) : null;
        void this.onContextChange();
        this.togglePlanningAreaVisibility();
      });
    }

    // Team selection - Listen for custom dropdownChange event
    const teamDisplay = document.querySelector('#teamDisplay');
    if (teamDisplay !== null) {
      teamDisplay.addEventListener('dropdownChange', (e) => {
        const event = e as CustomEvent<{ value: string }>;
        const value = event.detail.value;
        this.selectedContext.teamId = value !== '' ? Number.parseInt(value, 10) : null;
        void this.onTeamSelected(this.selectedContext.teamId ?? undefined);
      });
    }

    // Machine selection (now filters teams!) - Listen for custom dropdownChange event
    const machineDisplay = document.querySelector('#machineDisplay');
    if (machineDisplay !== null) {
      machineDisplay.addEventListener('dropdownChange', (e) => {
        const event = e as CustomEvent<{ value: string }>;
        const value = event.detail.value;
        this.selectedContext.machineId = value !== '' ? Number.parseInt(value, 10) : null;
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

  private buildTeamsUrl(baseUrl: string, isV2: boolean): string {
    if (this.selectedContext.departmentId === null || this.selectedContext.departmentId === 0) {
      return baseUrl;
    }

    const paramName = isV2 ? 'departmentId' : 'department_id';
    return `${baseUrl}?${paramName}=${String(this.selectedContext.departmentId)}`;
  }

  private async loadTeamsV1(): Promise<void> {
    try {
      const url = this.buildTeamsUrl('/api/teams', false);
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
  }

  private async loadTeamsV2(): Promise<void> {
    try {
      const url = this.buildTeamsUrl('/teams', true);
      const response = await this.apiClient.request<TeamAPIResponse[]>(url, {
        method: 'GET',
      });

      const mappedTeams = mapTeams(response);
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

  async loadTeams(): Promise<void> {
    if (!this.useV2API) {
      await this.loadTeamsV1();
    } else {
      await this.loadTeamsV2();
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
      option.dataset.type = 'area';
      option.dataset.text = area.name;
      option.textContent = area.name;
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
      option.dataset.value = dept.id.toString();
      option.dataset.type = 'department';
      option.dataset.text = dept.name;
      option.textContent = dept.name;
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
      option.dataset.value = machine.id.toString();
      option.dataset.type = 'machine';
      option.dataset.text = machine.name;
      option.textContent = machine.name;
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
      option.dataset.value = team.id.toString();
      option.dataset.type = 'team';
      option.dataset.text = team.name;
      option.textContent = team.name;
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
      option.dataset.value = leader.id.toString();
      option.dataset.type = 'teamLeader';
      option.dataset.text = leader.name !== '' ? leader.name : leader.username;
      option.textContent = leader.name !== '' ? leader.name : leader.username;
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

    // Clear team dropdown display and value
    const teamDisplay = $$id('teamDisplay');
    if (teamDisplay !== null) {
      delete teamDisplay.dataset.value;
      const span = teamDisplay.querySelector('span');
      if (span !== null) {
        span.textContent = 'Team wählen...';
      }
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

      // IMPORTANT: Show UI IMMEDIATELY before loading data
      this.togglePlanningAreaVisibility();
      console.info('[SHIFTS DEBUG] UI visibility updated, now loading data...');

      // Then load the data
      await this.loadTeamMembers();
      await this.loadEmployees(); // Load employees FIRST
      await this.loadCurrentWeekData(); // Then load shifts (can now use employee names)
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

        const cellElement = cell as HTMLElement;
        this.handleShiftAssignment(dragEvent, cellElement);
      });
    });
  }

  private getEmployeeDisplayName(employee: Employee): string {
    const firstName = employee.first_name ?? '';
    const lastName = employee.last_name ?? '';
    const name = `${firstName} ${lastName}`.trim();
    return name !== '' ? name : employee.username;
  }

  private formatDateForDisplay(date: string): string {
    const dateObj = new Date(date);
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}.${month}.${year}`;
  }

  private handleEmployeeAvailability(
    employee: Employee,
    date: string,
    shiftType: string,
    cellElement: HTMLElement,
  ): void {
    if (this.isEmployeeAvailableOnDate(employee, date)) {
      void this.assignUserToShift(employee.id, date, shiftType, cellElement);
    } else {
      const displayName = this.getEmployeeDisplayName(employee);
      const formattedDate = this.formatDateForDisplay(date);
      showErrorAlert(`${displayName} ist am ${formattedDate} nicht verfügbar`);
    }
  }

  private handleShiftAssignment(dragEvent: DragEvent, cellElement: HTMLElement): void {
    const userId = dragEvent.dataTransfer?.getData('userId') ?? '';
    const date = cellElement.dataset.date;
    const shiftType = cellElement.dataset.shiftType;

    if (userId === '' || date === undefined || date === '' || shiftType === undefined || shiftType === '') {
      return;
    }

    const employeeId = Number(userId);
    const employee = this.employees.find((emp) => emp.id === employeeId);

    if (employee !== undefined) {
      this.handleEmployeeAvailability(employee, date, shiftType, cellElement);
    }
  }

  private validateAreaSelection(): { valid: boolean; message?: string } | null {
    if (this.areas.length > 0 && (this.selectedContext.areaId === null || this.selectedContext.areaId === 0)) {
      return { valid: false, message: 'Bitte wählen Sie einen Bereich aus' };
    }
    return null;
  }

  private validateDepartmentSelection(): { valid: boolean; message?: string } | null {
    if (this.selectedContext.departmentId === null || this.selectedContext.departmentId === 0) {
      return { valid: false, message: 'Bitte wählen Sie eine Abteilung aus' };
    }
    return null;
  }

  private validateMachineSelection(): { valid: boolean; message?: string } | null {
    if (this.selectedContext.machineId === null || this.selectedContext.machineId === 0) {
      return null;
    }

    const machine = this.machines.find((m) => m.id === this.selectedContext.machineId);
    if (!machine) {
      return { valid: false, message: 'Ungültige Maschinen-Auswahl' };
    }
    if (machine.department_id !== this.selectedContext.departmentId) {
      return { valid: false, message: 'Maschine gehört nicht zur ausgewählten Abteilung' };
    }
    return null;
  }

  private validateTeamSelection(): { valid: boolean; message?: string } | null {
    if (this.selectedContext.teamId === null || this.selectedContext.teamId === 0) {
      return null;
    }

    const team = this.teams.find((t) => t.id === this.selectedContext.teamId);
    if (!team) {
      return { valid: false, message: 'Ungültige Team-Auswahl' };
    }
    if (team.department_id !== this.selectedContext.departmentId) {
      return { valid: false, message: 'Team gehört nicht zur ausgewählten Abteilung' };
    }
    return null;
  }

  private validateDepartmentBelongsToArea(): { valid: boolean; message?: string } | null {
    if (this.selectedContext.areaId === null || this.selectedContext.areaId === 0) {
      return null;
    }

    const department = this.departments.find((d) => d.id === this.selectedContext.departmentId);
    if (
      department?.area_id !== undefined &&
      department.area_id !== 0 &&
      department.area_id !== this.selectedContext.areaId
    ) {
      return { valid: false, message: 'Abteilung gehört nicht zum ausgewählten Bereich' };
    }
    return null;
  }

  validateHierarchy(): { valid: boolean; message?: string } {
    // Run each validation and return first error if found
    const validations = [
      this.validateAreaSelection(),
      this.validateDepartmentSelection(),
      this.validateMachineSelection(),
      this.validateTeamSelection(),
      this.validateDepartmentBelongsToArea(),
    ];

    for (const result of validations) {
      if (result !== null) {
        return result;
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
    // Use switch to avoid object injection vulnerability
    switch (frontendType) {
      case 'early':
        return 'F'; // Frühschicht
      case 'late':
        return 'S'; // Spätschicht
      case 'night':
        return 'N'; // Nachtschicht
      default:
        return frontendType;
    }
  }

  private buildShiftPayload(userId: number, date: string, shiftType: string, isV2: boolean): Record<string, unknown> {
    const convertedType = this.convertShiftTypeForAPI(shiftType);
    const startTime = this.getShiftStartTime(shiftType);
    const endTime = this.getShiftEndTime(shiftType);

    if (isV2) {
      return {
        userId,
        date,
        type: convertedType,
        departmentId: this.selectedContext.departmentId,
        teamId: this.selectedContext.teamId,
        machineId: this.selectedContext.machineId,
        startTime,
        endTime,
      };
    }

    return {
      user_id: userId,
      date,
      type: convertedType,
      department_id: this.selectedContext.departmentId,
      team_id: this.selectedContext.teamId,
      machine_id: this.selectedContext.machineId,
      start_time: startTime,
      end_time: endTime,
    };
  }

  private handleShiftAssignmentSuccess(cellElement: HTMLElement, userId: number, shiftType: string): void {
    this.updateShiftCell(cellElement, userId, shiftType);

    const day = cellElement.dataset.day;
    if (this.autofillConfig.enabled && day !== undefined && day !== '') {
      this.performAutofill(userId, day, shiftType);
    }
  }

  private async assignShiftV1(
    userId: number,
    date: string,
    shiftType: string,
    cellElement: HTMLElement,
  ): Promise<void> {
    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken() ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildShiftPayload(userId, date, shiftType, false)),
      });

      if (response.ok) {
        await response.json();
        showSuccessAlert('Schicht zugewiesen');
        this.handleShiftAssignmentSuccess(cellElement, userId, shiftType);
      } else {
        showErrorAlert(ERROR_MESSAGES.SHIFT_ASSIGNMENT_FAILED);
      }
    } catch (error) {
      console.error('Error assigning shift (v1):', error);
      showErrorAlert('Fehler beim Zuweisen der Schicht');
    }
  }

  private async assignShiftV2(
    userId: number,
    date: string,
    shiftType: string,
    cellElement: HTMLElement,
  ): Promise<void> {
    try {
      await this.apiClient.request('/shifts', {
        method: 'POST',
        body: JSON.stringify(this.buildShiftPayload(userId, date, shiftType, true)),
      });

      showSuccessAlert('Schicht erfolgreich zugewiesen');
      this.handleShiftAssignmentSuccess(cellElement, userId, shiftType);
    } catch (error) {
      console.error('Error assigning shift (v2):', error);
      showErrorAlert(ERROR_MESSAGES.SHIFT_ASSIGNMENT_FAILED);
    }
  }

  async assignUserToShift(userId: number, date: string, shiftType: string, cellElement: HTMLElement): Promise<void> {
    const validation = this.validateHierarchy();
    if (!validation.valid) {
      showErrorAlert(validation.message ?? 'Ungültige Auswahl-Hierarchie');
      return;
    }

    if (!this.useV2API) {
      await this.assignShiftV1(userId, date, shiftType, cellElement);
    } else {
      await this.assignShiftV2(userId, date, shiftType, cellElement);
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

  private updateDropdownDisplay(type: string, displayText: string): void {
    const displayElement = $$id(`${type}Display`);
    if (!displayElement) return;

    const span = displayElement.querySelector('span');
    if (span) {
      span.textContent = displayText;
    }

    const dropdown = $$id(`${type}Dropdown`);
    if (dropdown) {
      dropdown.classList.remove('active');
    }
    displayElement.classList.remove('active');
  }

  private handleAreaSelection(value: string): void {
    const areaId = value !== '' ? Number(value) : undefined;
    void this.onAreaSelected(areaId);
  }

  private handleDepartmentSelection(value: string): void {
    this.selectedContext.departmentId = value !== '' ? Number(value) : null;
    void this.onContextChange();
  }

  private handleMachineSelection(value: string): void {
    const machineId = value !== '' ? Number(value) : undefined;
    if (machineId !== undefined) {
      void this.onMachineSelected(machineId);
    }
  }

  private handleTeamSelection(value: string): void {
    const teamId = value !== '' ? Number(value) : undefined;
    if (teamId !== undefined) {
      void this.onTeamSelected(teamId);
    }
  }

  private selectOption(type: string, value: string, displayText: string): void {
    this.updateDropdownDisplay(type, displayText);

    // Use Map to avoid complex if-else chain
    const handlers = new Map<string, (value: string) => void>([
      [
        'area',
        (v) => {
          this.handleAreaSelection(v);
        },
      ],
      [
        'department',
        (v) => {
          this.handleDepartmentSelection(v);
        },
      ],
      [
        'machine',
        (v) => {
          this.handleMachineSelection(v);
        },
      ],
      [
        'team',
        (v) => {
          this.handleTeamSelection(v);
        },
      ],
    ]);

    const handler = handlers.get(type);
    if (handler) {
      handler(value);
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

  private getPlanningAreaElements(): {
    departmentNotice: Element | null;
    mainPlanningArea: Element | null;
    adminActions: Element | null;
    weekNavigation: Element | null;
    shiftControls: Element | null;
  } {
    return {
      departmentNotice: document.querySelector('#departmentNotice'),
      mainPlanningArea: document.querySelector('#mainPlanningArea'),
      adminActions: document.querySelector('#adminActions'),
      weekNavigation: document.querySelector('.week-navigation'),
      shiftControls: document.querySelector('.shift-controls'),
    };
  }

  private shouldShowPlanningArea(): boolean {
    // Planning area should be shown when we have data to load
    // This aligns UI visibility with data availability
    return this.shouldLoadInitialData();
  }

  private toggleElement(element: Element | null, hide: boolean, elementName: string): void {
    if (!element) {
      if (elementName === 'week navigation' || elementName === 'shift controls') {
        console.error(`[SHIFTS UI] ${elementName} element not found!`);
      }
      return;
    }

    const htmlElement = element as HTMLElement;
    if (hide) {
      htmlElement.classList.add('u-hidden');
      console.info(`[SHIFTS UI] Hidden ${elementName}`);
    } else {
      htmlElement.classList.remove('u-hidden');
      console.info(`[SHIFTS UI] Shown ${elementName}`);
    }
  }

  private showPlanningArea(elements: ReturnType<typeof this.getPlanningAreaElements>): void {
    console.info('[SHIFTS UI] Showing planning area elements...');

    this.toggleElement(elements.departmentNotice, true, 'department notice');
    this.toggleElement(elements.mainPlanningArea, false, 'main planning area');

    if (this.isAdmin) {
      this.toggleElement(elements.adminActions, false, 'admin actions');
    }

    this.toggleElement(elements.weekNavigation, false, 'week navigation');
    this.toggleElement(elements.shiftControls, false, 'shift controls');

    console.info('[SHIFTS UI] UI visibility update completed');
  }

  private hidePlanningArea(elements: ReturnType<typeof this.getPlanningAreaElements>): void {
    console.info('[SHIFTS UI] Hiding planning area elements...');

    this.toggleElement(elements.departmentNotice, false, 'department notice');
    this.toggleElement(elements.mainPlanningArea, true, 'main planning area');
    this.toggleElement(elements.adminActions, true, 'admin actions');
    this.toggleElement(elements.weekNavigation, true, 'week navigation');
    this.toggleElement(elements.shiftControls, true, 'shift controls');
  }

  togglePlanningAreaVisibility(): void {
    const elements = this.getPlanningAreaElements();

    console.info('[SHIFTS UI] togglePlanningAreaVisibility called');
    console.info('[SHIFTS UI] isAdmin:', this.isAdmin);
    console.info('[SHIFTS UI] selectedContext:', this.selectedContext);
    console.info('[SHIFTS UI] Elements found:', {
      departmentNotice: !!elements.departmentNotice,
      mainPlanningArea: !!elements.mainPlanningArea,
      adminActions: !!elements.adminActions,
      weekNavigation: !!elements.weekNavigation,
      shiftControls: !!elements.shiftControls,
    });

    const shouldShow = this.shouldShowPlanningArea();
    console.info('[SHIFTS UI] shouldShowPlanning:', shouldShow);

    if (shouldShow) {
      this.showPlanningArea(elements);
    } else {
      this.hidePlanningArea(elements);
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
      const users = await this.fetchAndFilterUsers();
      this.employees = this.mapUsersToEmployees(users);
      this.logLoadedEmployeesInfo();
      this.renderEmployeeList();
    } catch (error) {
      console.error('Error loading employees:', error);
      this.employees = [];
      this.renderEmployeeList();
    }
  }

  private async fetchAndFilterUsers(): Promise<UserAPIResponse[]> {
    const apiClientInstance = ApiClient.getInstance();
    console.info('[SHIFTS DEBUG] Loading all users via v2 API for availability data');
    const allUsers = await apiClientInstance.get<UserAPIResponse[]>('/users');

    if (this.selectedContext.teamId !== null && this.selectedContext.teamId !== 0) {
      return await this.filterUsersByTeam(allUsers);
    }

    return this.filterUsersByDepartment(allUsers);
  }

  private async filterUsersByTeam(allUsers: UserAPIResponse[]): Promise<UserAPIResponse[]> {
    console.info('[SHIFTS DEBUG] Filtering users by team ID:', this.selectedContext.teamId);
    const apiClientInstance = ApiClient.getInstance();
    const teamMembers = await apiClientInstance.get<UserAPIResponse[]>(
      `/teams/${String(this.selectedContext.teamId)}/members`,
    );
    const teamMemberIds = teamMembers.map((m) => m.id);
    return allUsers.filter((u) => teamMemberIds.includes(u.id));
  }

  private filterUsersByDepartment(users: UserAPIResponse[]): UserAPIResponse[] {
    if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
      return users.filter((u) => {
        const deptId = u.department_id ?? u.departmentId;
        return deptId === this.selectedContext.departmentId;
      });
    }
    return users;
  }

  private mapUsersToEmployees(users: UserAPIResponse[]): Employee[] {
    const mappedUsers = mapUsers(users);
    return mappedUsers.map(
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
  }

  private logLoadedEmployeesInfo(): void {
    console.info('[SHIFTS DEBUG] Employees loaded:', this.employees.length, 'employees');
    console.info('[SHIFTS DEBUG] Employee data:', this.employees);
    console.info(
      '[SHIFTS DEBUG] Employee IDs:',
      this.employees.map((e) => e.id),
    );

    this.employees.forEach((emp) => {
      console.info('[SHIFTS DEBUG] Employee availability:', {
        email: emp.email,
        availability_status: emp.availability_status,
        availabilityStatus: emp.availabilityStatus,
      });
    });

    console.info('[SHIFTS] Using availability data from v2 API');
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

  private createEmployeeListItem(employee: Employee): HTMLElement {
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

    this.logEmployeeItemInfo(employee, isDraggable, availabilityStatus);

    // Add visual indicators for unavailable employees
    if (availabilityStatus !== 'available') {
      item.classList.add('unavailable', `status-${availabilityStatus}`);
    }

    const infoDiv = this.buildEmployeeInfoDiv(employee, availabilityStatus);
    item.append(infoDiv);

    return item;
  }

  private logEmployeeItemInfo(employee: Employee, isDraggable: boolean, availabilityStatus?: string): void {
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
  }

  private buildEmployeeInfoDiv(employee: Employee, availabilityStatus?: string): HTMLElement {
    const name = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
    const displayName = name !== '' ? name : employee.username;

    // Build DOM structure safely
    const infoDiv = createElement('div', { className: 'employee-info' });
    const nameSpan = createElement('span', { className: CSS_CLASSES.EMPLOYEE_NAME }, displayName);
    infoDiv.append(nameSpan);

    // Add status icon if present
    const iconElement = this.createAvailabilityIcon(availabilityStatus);
    if (iconElement) {
      infoDiv.append(iconElement);
    }

    // Add status badge if present
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

    // Add "Verfügbar ab" date if relevant
    this.addAvailabilityReturnDate(infoDiv, employee);

    return infoDiv;
  }

  private addAvailabilityReturnDate(infoDiv: HTMLElement, employee: Employee): void {
    if (employee.availability_end === undefined || employee.availability_end === '') {
      return;
    }

    const endDate = new Date(employee.availability_end);
    endDate.setDate(endDate.getDate() + 1); // Add one day (this is when employee returns)

    // Get current week boundaries
    const weekStart = this.getWeekStart(this.currentWeek);
    const weekEnd = this.getWeekEnd(this.currentWeek);

    // Only show "Verfügbar ab" if the return date is within the current week
    if (endDate < weekStart || endDate > weekEnd) return;

    const day = endDate.getDate().toString().padStart(2, '0');
    const month = (endDate.getMonth() + 1).toString().padStart(2, '0');
    const year = endDate.getFullYear();
    const availableFromDate = `${day}.${month}.${year}`;

    const availableFromSpan = createElement(
      'div',
      { className: 'availability-return-date' },
      `Verfügbar ab ${availableFromDate}`,
    );
    availableFromSpan.style.fontSize = '11px';
    availableFromSpan.style.color = '#4caf50';
    availableFromSpan.style.marginTop = '2px';
    infoDiv.append(availableFromSpan);
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
      const item = this.createEmployeeListItem(employee);
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
  private parseAvailabilityStatus(baseStatus: string): string {
    if (baseStatus === '') return 'available';

    const parts = baseStatus.trim().split(/\s+/);
    if (parts.length > 1) {
      return parts[1]; // e.g., "available vacation" -> "vacation"
    }
    return parts[0] !== '' ? parts[0] : 'available';
  }

  private getEmployeeName(employee: Employee): string {
    const firstName = employee.first_name ?? 'Unknown';
    const lastName = employee.last_name ?? 'Unknown';
    return `${firstName} ${lastName}`;
  }

  private logAvailabilityCheck(employee: Employee, actualStatus: string, weekStart: Date, weekEnd: Date): void {
    console.info(`[SHIFTS DEBUG] Checking week availability for ${this.getEmployeeName(employee)}:`, {
      actualStatus,
      weekRange: `${this.formatDate(weekStart)} to ${this.formatDate(weekEnd)}`,
      availStart: employee.availability_start,
      availEnd: employee.availability_end,
    });
  }

  private checkStatusAppliesThisWeek(employee: Employee, actualStatus: string): boolean {
    const weekStart = this.getWeekStart(this.currentWeek);
    const weekEnd = this.getWeekEnd(this.currentWeek);

    this.logAvailabilityCheck(employee, actualStatus, weekStart, weekEnd);

    // If no date ranges, status always applies
    if (employee.availability_start === undefined && employee.availability_end === undefined) {
      return true;
    }

    const availStart = employee.availability_start !== undefined ? new Date(employee.availability_start) : null;
    const availEnd = employee.availability_end !== undefined ? new Date(employee.availability_end) : null;

    const overlaps = this.checkDateRangeOverlap(availStart, availEnd, weekStart, weekEnd);

    console.info(`[SHIFTS DEBUG] Overlap check for ${this.getEmployeeName(employee)}:`, {
      overlaps,
      availRange: `${availStart ? this.formatDate(availStart) : 'null'} to ${availEnd ? this.formatDate(availEnd) : 'null'}`,
    });

    if (!overlaps) {
      console.info(
        `[SHIFTS] Employee ${this.getEmployeeName(employee)} status "${actualStatus}" doesn't apply to week ${this.formatWeekRange(weekStart)}`,
      );
    }

    return overlaps;
  }

  getWeekAvailabilityStatus(employee: Employee): string {
    const baseStatus = employee.availability_status ?? employee.availabilityStatus ?? 'available';
    const actualStatus = this.parseAvailabilityStatus(baseStatus);

    // If status is already "available", no need to check dates
    if (actualStatus === 'available') {
      return 'available';
    }

    // Check if the special status applies to this week
    if (!this.checkStatusAppliesThisWeek(employee, actualStatus)) {
      return 'available';
    }

    // The special status applies to this week
    console.info(`[SHIFTS DEBUG] ${this.getEmployeeName(employee)} status for this week: ${actualStatus}`);
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
  private normalizeDateForAvailability(date: Date, type: 'check' | 'start' | 'end'): void {
    if (type === 'check') {
      date.setHours(12, 0, 0, 0); // Noon to avoid timezone issues
    } else if (type === 'start') {
      date.setHours(0, 0, 0, 0); // Start of day
    } else {
      date.setHours(23, 59, 59, 999); // End of day
    }
  }

  private getAvailabilityDates(
    employee: Employee,
    dateString: string,
  ): {
    checkDate: Date;
    startDate: Date | null;
    endDate: Date | null;
  } {
    const checkDate = new Date(dateString);
    const startDate = employee.availability_start !== undefined ? new Date(employee.availability_start) : null;
    const endDate = employee.availability_end !== undefined ? new Date(employee.availability_end) : null;

    // Normalize dates to avoid timezone issues
    this.normalizeDateForAvailability(checkDate, 'check');
    if (startDate !== null) {
      this.normalizeDateForAvailability(startDate, 'start');
    }
    if (endDate !== null) {
      this.normalizeDateForAvailability(endDate, 'end');
    }

    return { checkDate, startDate, endDate };
  }

  isEmployeeAvailableOnDate(employee: Employee, dateString: string): boolean {
    const rawStatus = employee.availability_status ?? employee.availabilityStatus ?? 'available';
    const status = this.parseAvailabilityStatus(rawStatus);

    // If status is available, no need to check dates
    if (status === 'available') {
      return true;
    }

    // Get normalized dates
    const { checkDate, startDate, endDate } = this.getAvailabilityDates(employee, dateString);

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

  removeEmployeeFromShift(shiftCell: HTMLElement, employeeId: number): void {
    const date = shiftCell.dataset.date;
    const shift = shiftCell.dataset.shift;

    if (date === undefined || date === '' || shift === undefined || shift === '') {
      console.error('[SHIFTS ERROR] Missing date or shift data on cell');
      return;
    }

    // Get current employees for this shift
    const currentEmployees = this.getShiftEmployees(date, shift);

    // Check if employee is assigned to this shift
    const index = currentEmployees.indexOf(employeeId);
    if (index !== -1) {
      // Remove assignment
      const updatedEmployees = [...currentEmployees];
      updatedEmployees.splice(index, 1);
      this.setShiftEmployees(date, shift, updatedEmployees);

      // Update UI
      this.renderShiftAssignments(shiftCell, date, shift);

      console.info('[SHIFTS DEBUG] Removed employee', employeeId, 'from shift', shift, 'on', date);
    }
  }

  private calculateDateFromDay(day: string): string | null {
    const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(day);
    if (dayIndex === -1) return null;

    const weekStart = this.getWeekStart(this.currentWeek);
    const cellDate = new Date(weekStart);
    cellDate.setDate(cellDate.getDate() + dayIndex);
    return this.formatDateKey(cellDate);
  }

  private getShiftDate(shiftCell: HTMLElement): string | undefined {
    let date = shiftCell.dataset.date;
    const day = shiftCell.dataset.day;

    if ((date === undefined || date === '') && day !== undefined && day !== '') {
      const calculatedDate = this.calculateDateFromDay(day);
      if (calculatedDate !== null) {
        date = calculatedDate;
        shiftCell.dataset.date = date;
      }
    }

    return date;
  }

  private validateShiftData(date: string | undefined, shift: string | undefined): boolean {
    if (date === undefined || date === '' || shift === undefined || shift === '') {
      console.error('[SHIFTS ERROR] Missing date or shift data on cell');
      return false;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error('Invalid date format:', date);
      return false;
    }

    return true;
  }

  private findEmployee(employeeId: number): Employee | undefined {
    const employee = this.employees.find((e) => e.id === employeeId);
    if (employee === undefined) {
      console.error('[SHIFTS ERROR] Employee not found:', employeeId);
    }
    return employee;
  }

  private getStatusText(status: string): string {
    const statusTexts = new Map<string, string>([
      ['vacation', 'im Urlaub'],
      ['sick', 'krankgemeldet'],
      ['unavailable', 'nicht verfügbar'],
      ['training', 'in Schulung'],
      ['other', 'anderweitig abwesend'],
    ]);
    return statusTexts.get(status) ?? 'nicht verfügbar';
  }

  private buildUnavailabilityMessage(employee: Employee, date: string): string {
    const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
    const employeeName = fullName !== '' ? fullName : employee.username;

    const dateObj = new Date(date);
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    const formattedDate = `${day}.${month}.${year}`;

    const rawStatus = employee.availability_status ?? employee.availabilityStatus ?? 'available';
    const status = this.parseAvailabilityStatus(rawStatus);
    const statusText = this.getStatusText(status);

    let errorMsg = `${employeeName} ist am ${formattedDate} ${statusText}`;

    const reason = employee.availability_reason;
    if (reason !== undefined && reason !== '') {
      errorMsg += `: ${reason}`;
    }

    return errorMsg;
  }

  private checkAvailability(employee: Employee, date: string): boolean {
    if (!this.isEmployeeAvailableOnDate(employee, date)) {
      const errorMsg = this.buildUnavailabilityMessage(employee, date);
      showErrorAlert(errorMsg);
      return false;
    }
    return true;
  }

  private getShiftName(shiftType: string): string {
    const shiftNames = new Map<string, string>([
      ['early', 'Frühschicht'],
      ['late', 'Spätschicht'],
      ['night', 'Nachtschicht'],
    ]);
    return shiftNames.get(shiftType) ?? shiftType;
  }

  private checkDuplicateShifts(employee: Employee, date: string, targetShift: string): boolean {
    const shiftTypes = ['early', 'late', 'night'] as const;

    for (const shiftType of shiftTypes) {
      if (shiftType === targetShift) continue;

      const employees = this.getShiftEmployees(date, shiftType);
      if (employees.includes(employee.id)) {
        const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
        const employeeName = fullName !== '' ? fullName : employee.username;
        const shiftName = this.getShiftName(shiftType);

        showErrorAlert(
          `Doppelschicht nicht erlaubt! ${employeeName} ist bereits für die ${shiftName} eingeteilt. Ein Mitarbeiter kann nur eine Schicht pro Tag übernehmen.`,
        );
        return false;
      }
    }
    return true;
  }

  private toggleShiftAssignment(date: string, shift: string, employeeId: number): void {
    const currentEmployees = this.getShiftEmployees(date, shift);
    const index = currentEmployees.indexOf(employeeId);

    let updatedEmployees: number[];
    if (index !== -1) {
      updatedEmployees = [...currentEmployees];
      updatedEmployees.splice(index, 1);
    } else {
      updatedEmployees = [...currentEmployees, employeeId];
    }

    this.setShiftEmployees(date, shift, updatedEmployees);
  }

  private shouldTriggerAutofill(day: string | undefined): boolean {
    return this.autofillConfig.enabled && day !== undefined && day !== '' && !this.isAutofilling && !this.isRemoving;
  }

  assignShift(shiftCell: HTMLElement, employeeId: number): void {
    const date = this.getShiftDate(shiftCell);
    const day = shiftCell.dataset.day;
    const shift = shiftCell.dataset.shift;

    console.info('[SHIFTS DEBUG] Assigning shift:', { date, day, shift, employeeId });

    if (!this.validateShiftData(date, shift)) {
      return;
    }

    // After validation, we know date and shift are defined and non-empty
    // TypeScript doesn't know this, so we need to check again
    if (date === undefined || shift === undefined) {
      return; // This will never happen due to validateShiftData, but satisfies TypeScript
    }

    const employee = this.findEmployee(employeeId);
    if (employee === undefined) {
      return;
    }

    console.info('[SHIFTS DEBUG] Found employee:', employee);

    if (!this.checkAvailability(employee, date)) {
      return;
    }

    if (!this.checkDuplicateShifts(employee, date, shift)) {
      return;
    }

    this.toggleShiftAssignment(date, shift, employeeId);

    this.renderShiftAssignments(shiftCell, date, shift);

    if (this.shouldTriggerAutofill(day) && day !== undefined) {
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

  private async loadRotationShifts(startStr: string, endStr: string): Promise<boolean> {
    console.info('[SHIFTS ROTATION] Loading from shift_rotation_history');

    const response = await fetch(`/api/v2/shifts/rotation/history?start_date=${startStr}&end_date=${endStr}`, {
      headers: {
        Authorization: `Bearer ${getAuthToken() ?? ''}`,
      },
    });

    if (!response.ok) {
      console.error('[SHIFTS ROTATION] Failed to load rotation history');
      return false;
    }

    const data = (await response.json()) as {
      data?: {
        history?: {
          shiftDate: string;
          shiftType: string;
          userId: number;
          status: string;
        }[];
      };
    };

    console.info('[SHIFTS ROTATION] History data:', data);

    if (!data.data?.history || data.data.history.length === 0) {
      console.info('[SHIFTS ROTATION] No rotation history found for this period');
      return false;
    }

    const shifts = this.convertRotationToShifts(data.data.history);
    this.processShiftData(shifts);
    this.renderWeekView();
    this.showEditRotationButton(true);
    this.lockShiftPlan();

    console.info('[SHIFTS ROTATION] Plan locked - rotation mode active');
    this.updateInfoBar('<span style="color: #4CAF50;">🔄 Automatische Rotation aktiv</span>');

    return true;
  }

  private convertRotationToShifts(
    history: { shiftDate: string; shiftType: string; userId: number; status: string }[],
  ): {
    date: string;
    shift_type: string;
    employee_id: number;
    first_name: string;
    last_name: string;
    username: string;
  }[] {
    return history.map((h) => {
      const employee = this.employees.find((e) => e.id === h.userId);
      const shiftType = this.convertShiftType(h.shiftType);

      return {
        date: h.shiftDate,
        shift_type: shiftType,
        employee_id: h.userId,
        first_name: employee?.first_name ?? '',
        last_name: employee?.last_name ?? '',
        username: employee?.username ?? '',
      };
    });
  }

  private convertShiftType(dbShiftType: string): string {
    if (dbShiftType === 'F') {
      return 'early';
    }
    if (dbShiftType === 'S') {
      return 'late';
    }
    if (dbShiftType === 'N') {
      return 'night';
    }
    return dbShiftType;
  }

  private updateInfoBar(content: string): void {
    const infoBar = document.querySelector('.shift-info-bar');
    if (infoBar === null) {
      return;
    }

    // Clear existing content
    while (infoBar.firstChild) {
      infoBar.firstChild.remove();
    }

    // Create span element safely
    const span = document.createElement('span');

    // Determine style and text based on content type
    if (content.includes('Automatische Rotation aktiv')) {
      span.style.color = '#4CAF50';
      span.textContent = '🔄 Automatische Rotation aktiv';
    } else if (content.includes('Normale Schichten (Fallback-Modus)')) {
      span.style.color = '#FFC107';
      span.textContent = '📋 Normale Schichten (Fallback-Modus)';
    } else if (content === '') {
      // Empty content - do nothing
      return;
    } else {
      span.textContent = content;
    }

    infoBar.append(span);
  }

  private clearShiftData(): void {
    this.weeklyShifts = new Map();
    this.shiftDetails = new Map();
    this.currentPlanId = null;
    this.clearNotesTextarea();
  }

  private clearNotesTextarea(): void {
    const notesTextarea = $$id('weeklyNotes') as HTMLTextAreaElement | null;
    if (notesTextarea !== null) {
      notesTextarea.value = '';
    }
  }

  private async loadV1Shifts(startStr: string, endStr: string): Promise<void> {
    const response = await fetch(`/api/shifts?start=${startStr}&end=${endStr}`, {
      headers: {
        Authorization: `Bearer ${getAuthToken() ?? ''}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load shift data');
    }

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

    this.processShiftData(data.shifts ?? []);
    this.renderWeekView();
  }

  private async loadV2Shifts(startStr: string, endStr: string): Promise<void> {
    const params = this.buildV2QueryParams(startStr, endStr);

    console.info('[SHIFTS PLAN DEBUG] Loading plan with params:', params.toString());

    const response = await this.apiClient.request(`/shifts/plan?${params.toString()}`, {
      method: 'GET',
    });

    console.info('[SHIFTS PLAN DEBUG] Plan Response received');

    if (response === null || typeof response !== 'object') {
      this.clearShiftData();
      this.renderWeekView();
      return;
    }

    if ('shifts' in response) {
      this.processV2Response(response);
    } else if ('message' in response) {
      console.info('[SHIFTS PLAN DEBUG] No plan found for this week');
      this.clearShiftData();
    }

    this.renderWeekView();
  }

  private buildV2QueryParams(startStr: string, endStr: string): URLSearchParams {
    const params = new URLSearchParams({
      startDate: startStr,
      endDate: endStr,
    });

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

    return params;
  }

  private processV2Response(response: unknown): void {
    const planData = response as {
      plan?: {
        id: number;
        name: string;
        shiftNotes?: string;
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

    this.handlePlanData(planData.plan);

    console.info('[SHIFTS PLAN DEBUG] Number of shifts:', planData.shifts.length);

    const legacyShifts = this.convertV2ShiftsToLegacy(planData.shifts);
    this.processShiftData(legacyShifts);
  }

  private handlePlanData(plan?: {
    id: number;
    name: string;
    shiftNotes?: string;
    startDate: string;
    endDate: string;
  }): void {
    const notesTextarea = $$id('weeklyNotes') as HTMLTextAreaElement | null;

    if (plan !== undefined) {
      console.info('[SHIFTS PLAN DEBUG] Plan loaded:', plan);
      this.currentPlanId = plan.id;
      this.isEditMode = false;

      if (plan.shiftNotes !== undefined && plan.shiftNotes !== '' && notesTextarea !== null) {
        notesTextarea.value = plan.shiftNotes;
      } else if (notesTextarea !== null) {
        notesTextarea.value = '';
      }

      this.updateButtonVisibility();
      this.lockShiftPlan();
    } else {
      console.info('[SHIFTS PLAN DEBUG] No plan found for this week - clearing notes');
      this.currentPlanId = null;
      this.isEditMode = false;

      if (notesTextarea !== null) {
        notesTextarea.value = '';
      }

      this.updateButtonVisibility();
      this.unlockShiftPlan();
    }
  }

  private convertV2ShiftsToLegacy(
    shifts: {
      userId: number;
      date: string;
      type: string;
      user?: { firstName: string; lastName: string; username: string };
    }[],
  ): {
    date: string;
    shift_type: string;
    employee_id: number;
    first_name: string;
    last_name: string;
    username: string;
  }[] {
    return shifts.map((shift) => {
      const employee = this.employees.find((emp) => emp.id === shift.userId);

      return {
        date: shift.date,
        shift_type: shift.type,
        employee_id: shift.userId,
        first_name: employee?.first_name ?? shift.user?.firstName ?? 'Unknown',
        last_name: employee?.last_name ?? shift.user?.lastName ?? 'User',
        username: employee?.email ?? shift.user?.username ?? `user_${String(shift.userId)}`,
      };
    });
  }

  async loadCurrentWeekData(): Promise<void> {
    console.info('[SHIFTS RELOAD DEBUG] loadCurrentWeekData called');
    console.info('[SHIFTS RELOAD DEBUG] Current context:', this.selectedContext);
    console.info('[SHIFTS RELOAD DEBUG] useV2API:', this.useV2API);
    console.info('[SHIFTS RELOAD DEBUG] Rotation enabled:', this.rotationConfig.enabled);

    try {
      const weekStart = this.getWeekStart(this.currentWeek);
      const weekEnd = this.getWeekEnd(this.currentWeek);
      const startStr = this.formatDate(weekStart);
      const endStr = this.formatDate(weekEnd);

      console.info('[SHIFTS PLAN DEBUG] Loading shifts for range:', startStr, 'to', endStr);

      // Handle rotation shifts
      if (this.rotationConfig.enabled) {
        const rotationLoaded = await this.loadRotationShifts(startStr, endStr);

        if (rotationLoaded) {
          this.finishLoadingData();
          return;
        }

        if (!this.fallbackConfig.enabled) {
          this.clearShiftData();
          this.showEditRotationButton(false);
          this.unlockShiftPlan();
          this.updateInfoBar('');
          this.renderWeekView();
          this.finishLoadingData();
          return;
        }

        console.info('[SHIFTS FALLBACK] Loading normal shifts as fallback');
        this.updateInfoBar('<span style="color: #FFC107;">📋 Normale Schichten (Fallback-Modus)</span>');
      }

      // Load normal shifts
      this.showEditRotationButton(false);
      this.unlockShiftPlan();

      if (!this.useV2API) {
        await this.loadV1Shifts(startStr, endStr);
      } else {
        await this.loadV2Shifts(startStr, endStr);
      }
    } catch (error) {
      console.error('Error loading shift data:', error);
      this.clearShiftData();
      this.renderWeekView();
    }

    this.finishLoadingData();
  }

  private finishLoadingData(): void {
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
    this.shiftDetails = new Map();
    console.info('[SHIFTS DEBUG] Processing shifts:', shifts);

    for (const shift of shifts) {
      this.processSingleShift(shift);
    }

    console.info('[SHIFTS DEBUG] Final weeklyShifts:', this.weeklyShifts);
    console.info('[SHIFTS DEBUG] Shift details:', this.shiftDetails);
  }

  private processSingleShift(shift: {
    date: string;
    shift_type: string;
    employee_id: number;
    first_name: string;
    last_name: string;
    username: string;
  }): void {
    const date = shift.date.split('T')[0];
    const shiftType = this.normalizeShiftType(shift.shift_type);

    if (shiftType === 'custom') {
      console.info('[SHIFTS DEBUG] Skipping custom shift type');
      return;
    }

    const displayName = this.getShiftEmployeeDisplayName(shift);

    console.info('[SHIFTS DEBUG] Processing shift:', {
      originalDate: shift.date,
      extractedDate: date,
      shiftType,
      employee_id: shift.employee_id,
      employee_name: displayName,
      raw_first_name: shift.first_name,
      raw_last_name: shift.last_name,
      raw_username: shift.username,
    });

    this.addEmployeeToShift(date, shiftType, shift.employee_id);
    this.storeShiftDetails(date, shiftType, shift);
  }

  private normalizeShiftType(shiftType: string): string {
    if (shiftType === 'F') {
      return 'early';
    }
    if (shiftType === 'S') {
      return 'late';
    }
    if (shiftType === 'N') {
      return 'night';
    }
    return shiftType;
  }

  private getShiftEmployeeDisplayName(shift: {
    employee_id: number;
    first_name: string;
    last_name: string;
    username: string;
  }): string {
    const employee = this.employees.find((emp) => emp.id === shift.employee_id);

    const firstName = this.getValidName(employee?.first_name, shift.first_name);
    const lastName = this.getValidName(employee?.last_name, shift.last_name);
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName !== '') {
      return fullName;
    }

    if (employee?.email !== undefined && employee.email !== '') {
      return employee.email;
    }

    if (shift.username !== '') {
      return shift.username;
    }

    return `Employee #${shift.employee_id}`;
  }

  private getValidName(employeeName: string | undefined, shiftName: string): string {
    if (employeeName !== undefined && employeeName !== '') {
      return employeeName;
    }
    return shiftName !== '' ? shiftName : '';
  }

  private addEmployeeToShift(date: string, shiftType: string, employeeId: number): void {
    const currentEmployees = this.getShiftEmployees(date, shiftType);
    this.setShiftEmployees(date, shiftType, [...currentEmployees, employeeId]);
  }

  private storeShiftDetails(
    date: string,
    shiftType: string,
    shift: {
      employee_id: number;
      first_name: string;
      last_name: string;
      username: string;
    },
  ): void {
    const shiftKey = `${date}_${shiftType}_${String(shift.employee_id)}`;
    if (!this.shiftDetails.has(shiftKey)) {
      this.shiftDetails.set(shiftKey, {
        employee_id: shift.employee_id,
        first_name: shift.first_name,
        last_name: shift.last_name,
        username: shift.username,
      });
    }
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

    const autofillCheckbox = $$('#shift-autofill') as HTMLInputElement | null;
    const rotationCheckbox = $$('#shift-rotation') as HTMLInputElement | null;

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
        void this.handleRotationToggle(e, rotationCheckbox);
      });
    }

    this.setupFallbackCheckbox();
  }

  private async handleRotationToggle(e: Event, rotationCheckbox: HTMLInputElement): Promise<void> {
    const newValue = (e.target as HTMLInputElement).checked;

    if (newValue) {
      await this.enableRotation(rotationCheckbox);
    } else {
      await this.disableRotation(rotationCheckbox);
    }

    void this.saveUserPreferenceToDatabase('shift_rotation_enabled', this.rotationConfig.enabled);
  }

  private async enableRotation(rotationCheckbox: HTMLInputElement): Promise<void> {
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
  }

  private async disableRotation(rotationCheckbox: HTMLInputElement): Promise<void> {
    const confirmed = await showConfirm(
      '⚠️ Rotation deaktivieren?\n\nAlle automatisch generierten Schichten werden gelöscht!\nDie normale manuelle Schichtplanung wird wieder aktiviert.\n\nWirklich fortfahren?',
    );

    if (!confirmed) {
      this.rotationConfig.enabled = true;
      rotationCheckbox.checked = true;
      return;
    }

    this.rotationConfig.enabled = false;
    await this.deleteRotationHistory();
    void this.loadCurrentWeekData();
  }

  private async deleteRotationHistory(): Promise<void> {
    const token = getAuthToken();
    if (token === null || token === '') {
      return;
    }

    const teamId = this.selectedContext.teamId;
    if (teamId === null || teamId === 0) {
      showErrorAlert('Kein Team ausgewählt. Bitte wählen Sie zuerst ein Team.');
      return;
    }

    try {
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
    } catch (error) {
      console.error('[SHIFTS ROTATION] Error deleting history:', error);
      showErrorAlert('Fehler beim Löschen der Rotation-Historie');
    }
  }

  private setupFallbackCheckbox(): void {
    // Setup fallback checkbox
    const fallbackCheckbox = $$('#shift-fallback') as HTMLInputElement | null;
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
    const editRotationBtn = $$id('edit-rotation-btn') as HTMLButtonElement | null;
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
    if (!this.canPerformAutofill()) {
      return;
    }

    this.isAutofilling = true;

    const daysToFill = this.getDaysToFill(day);
    console.info('[SHIFTS AUTOFILL] Filling week for employee:', userId, 'Shift type:', shiftType);

    for (const weekDay of daysToFill) {
      this.autofillSingleDay(weekDay, shiftType, userId);
    }

    this.isAutofilling = false;
  }

  private canPerformAutofill(): boolean {
    return this.autofillConfig.enabled && this.isAdmin && !this.isAutofilling;
  }

  private getDaysToFill(excludeDay: string): string[] {
    const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    return weekDays.filter((weekDay) => weekDay !== excludeDay);
  }

  private autofillSingleDay(weekDay: string, shiftType: string, userId: number): void {
    const shiftCell = $$(`.shift-cell[data-day="${weekDay}"][data-shift="${shiftType}"]`);

    if (shiftCell === null) {
      return;
    }

    const existingEmployee = shiftCell.querySelector('.employee-card');
    if (existingEmployee === null) {
      console.info('[SHIFTS AUTOFILL] Assigning', weekDay, 'for employee:', userId);
      this.assignShift(shiftCell, userId);
    } else {
      console.info('[SHIFTS AUTOFILL] Skipping', weekDay, '- already has employee');
    }

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
    const dropZones = ['drop-zone-f', 'drop-zone-s', 'drop-zone-n'];
    dropZones.forEach((zoneId) => {
      this.setupDropZone(zoneId);
    });
  }

  private setupDropZone(zoneId: string): void {
    const dropZone = $$id(zoneId) as HTMLDivElement | null;
    if (!dropZone) {
      console.error('[ROTATION SETUP] Drop zone not found:', zoneId);
      return;
    }
    console.info('[ROTATION SETUP] Setting up drop zone:', zoneId);

    this.setInlineHandlers(dropZone);
    this.removeExistingHandlers(dropZone, zoneId);

    const handlers = this.createDropZoneHandlers(dropZone, zoneId);
    this.registerHandlers(dropZone, zoneId, handlers);
  }

  private setInlineHandlers(dropZone: HTMLDivElement): void {
    dropZone.ondragover = (e) => {
      e.preventDefault();
      return false;
    };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      return false;
    };
  }

  private removeExistingHandlers(dropZone: HTMLDivElement, zoneId: string): void {
    const existingHandlers = this.rotationDropHandlers.get(zoneId);
    if (existingHandlers) {
      if ('dragenter' in existingHandlers && typeof existingHandlers.dragenter === 'function') {
        dropZone.removeEventListener('dragenter', existingHandlers.dragenter);
      }
      dropZone.removeEventListener('dragover', existingHandlers.dragover);
      dropZone.removeEventListener('dragleave', existingHandlers.dragleave);
      dropZone.removeEventListener('drop', existingHandlers.drop);
    }
  }

  private createDropZoneHandlers(
    dropZone: HTMLDivElement,
    zoneId: string,
  ): {
    dragenter: (e: Event) => void;
    dragover: (e: Event) => void;
    dragleave: (e: Event) => void;
    drop: (e: Event) => void;
  } {
    return {
      dragenter: this.createDragEnterHandler(dropZone, zoneId),
      dragover: this.createDragOverHandler(dropZone, zoneId),
      dragleave: this.createDragLeaveHandler(dropZone, zoneId),
      drop: this.createDropHandler(dropZone, zoneId),
    };
  }

  private createDragEnterHandler(dropZone: HTMLDivElement, zoneId: string): (e: Event) => void {
    return (e: Event) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      dragEvent.stopImmediatePropagation();

      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.dropEffect = 'move';
      }

      console.info('[ROTATION DRAGENTER] Entering zone:', zoneId);
      dropZone.classList.add('drag-over');
    };
  }

  private createDragOverHandler(dropZone: HTMLDivElement, zoneId: string): (e: Event) => void {
    return (e: Event) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      dragEvent.stopImmediatePropagation();

      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.dropEffect = 'move';
        dragEvent.dataTransfer.effectAllowed = 'move';
      }

      if (!dropZone.classList.contains('drag-over')) {
        console.info('[ROTATION DRAGOVER] Drag over zone:', zoneId);
        dropZone.classList.add('drag-over');
      }
    };
  }

  private createDragLeaveHandler(dropZone: HTMLDivElement, zoneId: string): (e: Event) => void {
    return (e: Event) => {
      const dragEvent = e as DragEvent;
      const relatedTarget = (dragEvent as DragEvent & { relatedTarget?: EventTarget }).relatedTarget as
        | HTMLElement
        | null
        | undefined;

      if (!relatedTarget || !dropZone.contains(relatedTarget)) {
        console.info('[ROTATION DRAGLEAVE] Actually leaving zone:', zoneId);
        dropZone.classList.remove('drag-over');
      } else {
        console.info('[ROTATION DRAGLEAVE] False leave (still in zone):', zoneId);
      }
    };
  }

  private createDropHandler(dropZone: HTMLDivElement, zoneId: string): (e: Event) => void {
    return (e: Event) => {
      console.info('[ROTATION DROP] DROP EVENT FIRED! Zone:', zoneId);
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      dragEvent.stopImmediatePropagation();
      dropZone.classList.remove('drag-over');

      const employeeData = this.extractEmployeeData(dragEvent, zoneId);
      if (!employeeData) return;

      this.removeExistingEmployee(employeeData.id);
      const employeeDiv = this.createRotationEmployeeElement(employeeData, dropZone);
      this.addEmployeeHandlers(employeeDiv, employeeData);

      dropZone.append(employeeDiv);
      console.info('[ROTATION DROP] Employee added to zone:', zoneId, 'ID:', employeeData.id);
    };
  }

  private extractEmployeeData(dragEvent: DragEvent, zoneId: string): { id: string; name: string } | null {
    console.info('[ROTATION DROP] Drop event triggered on zone:', zoneId, 'Event:', dragEvent);

    if (!dragEvent.dataTransfer) {
      console.error('[ROTATION DROP] No dataTransfer object!');
      return null;
    }

    let employeeId = dragEvent.dataTransfer.getData('employeeId');
    if (employeeId === '') {
      employeeId = dragEvent.dataTransfer.getData('text/plain');
    }
    const employeeName = dragEvent.dataTransfer.getData('employeeName');

    console.info('[ROTATION DROP] Received data - ID:', employeeId, 'Name:', employeeName);

    if (employeeId === '') {
      console.error('[ROTATION DROP] No employee ID received!');
      return null;
    }

    return { id: employeeId, name: employeeName };
  }

  private removeExistingEmployee(employeeId: string): void {
    const existingElement = document.querySelector(`.drop-zone [data-employee-id="${employeeId}"]`);
    if (existingElement !== null) {
      existingElement.remove();
    }
  }

  private createRotationEmployeeElement(
    employeeData: { id: string; name: string },
    dropZone: HTMLDivElement,
  ): HTMLDivElement {
    const employeeDiv = document.createElement('div');
    employeeDiv.className = 'employee-item';
    employeeDiv.dataset.employeeId = employeeData.id;
    employeeDiv.dataset.shiftType = dropZone.dataset.shift ?? '';
    employeeDiv.textContent = employeeData.name;
    employeeDiv.draggable = true;
    return employeeDiv;
  }

  private addEmployeeHandlers(employeeDiv: HTMLDivElement, employeeData: { id: string; name: string }): void {
    employeeDiv.addEventListener('dragstart', (dragEvent) => {
      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.effectAllowed = 'move';
        dragEvent.dataTransfer.setData('employeeId', employeeData.id);
        dragEvent.dataTransfer.setData('employeeName', employeeData.name);
        employeeDiv.classList.add('dragging');
      }
    });

    employeeDiv.addEventListener('dragend', () => {
      employeeDiv.classList.remove('dragging');
    });

    employeeDiv.addEventListener('click', (clickEvent) => {
      const target = clickEvent.target as HTMLElement;
      const rect = target.getBoundingClientRect();
      const clickX = clickEvent.clientX - rect.left;

      if (clickX > rect.width - 30) {
        employeeDiv.remove();
      }
    });
  }

  private registerHandlers(
    dropZone: HTMLDivElement,
    zoneId: string,
    handlers: {
      dragenter: (e: Event) => void;
      dragover: (e: Event) => void;
      dragleave: (e: Event) => void;
      drop: (e: Event) => void;
    },
  ): void {
    console.info('[ROTATION SETUP] Registering event handlers for zone:', zoneId);
    dropZone.addEventListener('dragenter', handlers.dragenter, true);
    dropZone.addEventListener('dragover', handlers.dragover, true);
    dropZone.addEventListener('dragleave', handlers.dragleave, true);
    dropZone.addEventListener('drop', handlers.drop, true);

    console.info('[ROTATION SETUP] Drop handler registered for zone:', zoneId, dropZone);

    this.rotationDropHandlers.set(zoneId, handlers);
    console.info('[ROTATION SETUP] Handlers stored for zone:', zoneId);
  }

  private async loadUserPreferencesFromDatabase(): Promise<void> {
    try {
      const settings = await this.fetchUserSettings();
      if (settings === null) {
        return;
      }

      for (const setting of settings) {
        await this.processSingleSetting(setting);
        this.userPreferencesCache[setting.settingKey] = String(setting.settingValue);
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  }

  private async fetchUserSettings(): Promise<
    { settingKey: string; settingValue: boolean | string | number; valueType: string }[] | null
  > {
    const token = getAuthToken();
    if (token === null || token === '') {
      return null;
    }

    const teamId = this.selectedContext.teamId;
    console.info('[SHIFTS DEBUG] Loading preferences for team_id:', teamId);

    const queryParams = new URLSearchParams({ category: 'shifts' });
    if (teamId !== null) {
      queryParams.append('team_id', String(teamId));
    }

    const response = await fetch(`/api/v2/settings/user?${queryParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn('Could not load user preferences');
      return null;
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

    return result.data?.settings ?? [];
  }

  private async processSingleSetting(setting: {
    settingKey: string;
    settingValue: boolean | string | number;
    valueType: string;
  }): Promise<void> {
    switch (setting.settingKey) {
      case 'shift_autofill_enabled':
        this.processAutofillSetting(setting.settingValue);
        break;
      case 'shift_rotation_enabled':
        await this.processRotationSetting(setting.settingValue);
        break;
      case 'shift_fallback_enabled':
        this.processFallbackSetting(setting.settingValue);
        break;
      case 'shift_autofill_config':
        this.processAutofillConfig(setting.settingValue);
        break;
    }
  }

  private processAutofillSetting(value: boolean | string | number): void {
    this.autofillConfig.enabled = value === true;
    const autofillCheckbox = $$('#shift-autofill') as HTMLInputElement | null;
    if (autofillCheckbox !== null) {
      autofillCheckbox.checked = this.autofillConfig.enabled;
    }
    console.info('[SHIFTS DEBUG] Loaded autofill setting from DB:', this.autofillConfig.enabled);
  }

  private async processRotationSetting(value: boolean | string | number): Promise<void> {
    const dbEnabled = value === true;
    const patternExists = await this.checkRotationPatternExists(this.selectedContext.teamId);

    this.rotationConfig.enabled = dbEnabled && patternExists;

    const rotationCheckbox = $$('#shift-rotation') as HTMLInputElement | null;
    if (rotationCheckbox !== null) {
      rotationCheckbox.checked = this.rotationConfig.enabled;
    }

    console.info('[SHIFTS DEBUG] Loaded rotation setting from DB:', dbEnabled);
    console.info('[SHIFTS DEBUG] Pattern exists for team:', patternExists);
    console.info('[SHIFTS DEBUG] Final rotation enabled state:', this.rotationConfig.enabled);
  }

  private processFallbackSetting(value: boolean | string | number): void {
    this.fallbackConfig.enabled = value === true;
    const fallbackCheckbox = $$('#shift-fallback') as HTMLInputElement | null;
    if (fallbackCheckbox !== null) {
      fallbackCheckbox.checked = this.fallbackConfig.enabled;
    }
    console.info('[SHIFTS DEBUG] Loaded fallback setting from DB:', this.fallbackConfig.enabled);
  }

  private processAutofillConfig(value: boolean | string | number): void {
    try {
      if (typeof value === 'object') {
        Object.assign(this.autofillConfig, value);
      } else if (typeof value === 'string') {
        Object.assign(this.autofillConfig, JSON.parse(value));
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Helper function to create drag event handlers for an employee element
  private createEmployeeDragHandlers(element: HTMLDivElement, employeeId: number, employeeName: string): void {
    element.addEventListener('dragstart', (e) => {
      console.info('[ROTATION DRAG] Starting drag for employee:', employeeId, employeeName);
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(employeeId));
        e.dataTransfer.setData('employeeId', String(employeeId));
        e.dataTransfer.setData('employeeName', employeeName);
        element.classList.add('dragging');
        console.info('[ROTATION DRAG] Data set in dataTransfer');
      }
    });

    element.addEventListener('dragend', (dragEndEvent) => {
      console.info('[ROTATION DRAG] Drag ended for employee:', employeeId, employeeName);
      console.info('[ROTATION DRAG] DragEnd event details:', dragEndEvent.dataTransfer?.dropEffect);
      element.classList.remove('dragging');
    });
  }

  // Helper function to create employee element
  private createEmployeeElement(
    employee: { id: number; first_name?: string; last_name?: string; is_active?: boolean },
    draggable = true,
  ): HTMLDivElement {
    const employeeDiv = document.createElement('div');
    employeeDiv.className = 'employee-item';
    employeeDiv.draggable = draggable;
    employeeDiv.dataset.employeeId = String(employee.id);
    const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
    employeeDiv.dataset.employeeName = fullName;
    employeeDiv.textContent = fullName;

    if (draggable) {
      this.createEmployeeDragHandlers(employeeDiv, employee.id, fullName);
    }

    return employeeDiv;
  }

  // Helper function to setup available employees
  private setupAvailableEmployees(container: HTMLDivElement | null): void {
    if (container === null) {
      console.error('[ROTATION SETUP] Available employees container not found!');
      return;
    }

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

    console.info('[ROTATION SETUP] Found available employees container, adding', teamEmployees.length, 'employees');

    // Clear existing content
    while (container.firstChild) {
      container.firstChild.remove();
    }

    // Create draggable employee items
    teamEmployees.forEach((employee) => {
      const employeeDiv = this.createEmployeeElement(employee);
      container.append(employeeDiv);
    });

    console.info('[ROTATION SETUP] Added all employees. Container now has', container.children.length, 'children');
  }

  // Helper function to get next Monday
  private getNextMonday(date: Date): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    // If today is Monday (1), get next Monday (+7 days)
    // Otherwise calculate days until next Monday
    const daysUntilMonday = dayOfWeek === 1 ? 7 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    result.setDate(result.getDate() + daysUntilMonday);
    return result;
  }

  // Helper function to get second Friday after a given date
  private getSecondFridayAfter(date: Date): Date {
    const result = new Date(date);
    // First, get to the next Friday
    const dayOfWeek = result.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 12 - dayOfWeek;
    result.setDate(result.getDate() + daysUntilFriday);
    // Then add one more week to get the second Friday
    result.setDate(result.getDate() + 7);
    return result;
  }

  // Helper function to configure date inputs
  // Helper to set date input constraints
  private setDateInputConstraints(input: HTMLInputElement | null, min: string, max?: string, value?: string): void {
    if (input === null) return;
    input.min = min;
    if (max !== undefined) input.max = max;
    if (value !== undefined) input.value = value;
  }

  // Helper to setup auto-adjust handler
  private setupDateAutoAdjust(startInput: HTMLInputElement, endInput: HTMLInputElement): void {
    startInput.addEventListener('change', () => {
      const newStartDate = new Date(startInput.value);
      const newEndDate = this.getSecondFridayAfter(newStartDate);
      endInput.value = newEndDate.toISOString().split('T')[0];
    });
  }

  private configureDateInputs(editMode: boolean): void {
    const startDateInput = $$id('rotation-start-date') as HTMLInputElement | null;
    const endDateInput = $$id('rotation-end-date') as HTMLInputElement | null;
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const maxDate = `${today.getFullYear()}-12-31`;

    if (editMode) {
      this.setDateInputConstraints(startDateInput, todayString);
      this.setDateInputConstraints(endDateInput, todayString, maxDate);
      return;
    }

    // CREATE mode
    const nextMonday = this.getNextMonday(today);
    const secondFriday = this.getSecondFridayAfter(nextMonday);

    this.setDateInputConstraints(startDateInput, todayString, undefined, nextMonday.toISOString().split('T')[0]);

    this.setDateInputConstraints(endDateInput, todayString, maxDate, secondFriday.toISOString().split('T')[0]);

    // Auto-adjust end date when start date changes
    if (startDateInput !== null && endDateInput !== null) {
      this.setupDateAutoAdjust(startDateInput, endDateInput);
    }
  }

  // Helper function to setup pattern select handler
  private setupPatternSelectHandler(): void {
    const patternSelect = $$id('rotation-pattern') as HTMLSelectElement | null;
    const customConfig = $$id('custom-pattern-config') as HTMLDivElement | null;
    const ignoreNightGroup = $$id('ignore-night-shift-group') as HTMLDivElement | null;

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
  }

  // Helper function to load existing pattern data into form
  private loadExistingPatternData(existingPattern: {
    id?: number;
    name: string;
    description?: string;
    patternType: string;
    patternConfig: Record<string, unknown>;
    startsAt: string;
    endsAt?: string | null;
  }): void {
    const rotationStartInput = $$id('rotation-start-date') as HTMLInputElement | null;
    const rotationEndInput = $$id('rotation-end-date') as HTMLInputElement | null;
    const rotationPatternSelect = $$id('rotation-pattern') as HTMLSelectElement | null;
    const skipWeekendsInput = $$id('rotation-skip-weekends') as HTMLInputElement | null;
    const ignoreNightInput = $$id('rotation-ignore-night') as HTMLInputElement | null;

    if (rotationPatternSelect) {
      const selectValue = this.mapPatternTypeToSelectValue(existingPattern);
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
    if (skipWeekendsInput && 'skipWeekends' in existingPattern.patternConfig) {
      skipWeekendsInput.checked = existingPattern.patternConfig.skipWeekends as boolean;
    }

    if (ignoreNightInput && 'ignoreNightShift' in existingPattern.patternConfig) {
      ignoreNightInput.checked = existingPattern.patternConfig.ignoreNightShift as boolean;
    }

    // Load employee shift assignments if they exist
    if ('shiftGroups' in existingPattern.patternConfig) {
      this.loadShiftAssignments(existingPattern.patternConfig.shiftGroups as Record<string, string>);
    }
  }

  // Helper function to map pattern type to select value
  private mapPatternTypeToSelectValue(existingPattern: {
    patternType: string;
    patternConfig: Record<string, unknown>;
  }): string {
    let selectValue = 'weekly'; // default

    if (existingPattern.patternType === 'alternate_fs') {
      selectValue = 'weekly';
    } else if (existingPattern.patternType === 'fixed_n') {
      selectValue = 'biweekly';
    } else if (existingPattern.patternType === 'custom') {
      // Check if it's actually a weekly rotation disguised as custom
      if ('cycleWeeks' in existingPattern.patternConfig && existingPattern.patternConfig.cycleWeeks === 1) {
        selectValue = 'weekly';
      } else {
        selectValue = 'custom';
      }
    }

    return selectValue;
  }

  // Helper function to load shift assignments into drop zones
  private loadShiftAssignments(shiftAssignments: Record<string, string>): void {
    // Clear all drop zones first
    ['drop-zone-f', 'drop-zone-s', 'drop-zone-n'].forEach((zoneId) => {
      const zone = $$id(zoneId) as HTMLDivElement | null;
      if (zone) {
        while (zone.firstChild) {
          zone.firstChild.remove();
        }
      }
    });

    const availableContainer = $$id('rotation-available-employees') as HTMLDivElement | null;

    // Place employees in their assigned shift columns
    Object.entries(shiftAssignments).forEach(([employeeId, shiftType]) => {
      const availableEmployee = availableContainer?.querySelector(
        `[data-employee-id="${employeeId}"]`,
      ) as HTMLDivElement | null;

      if (availableEmployee === null) return;

      // Determine target drop zone
      const targetZoneId = this.getDropZoneIdForShiftType(shiftType);
      const targetZone = $$id(targetZoneId) as HTMLDivElement | null;

      if (targetZone === null) return;

      this.addEmployeeToDropZone(targetZone, employeeId, shiftType, availableEmployee.dataset.employeeName ?? '');
    });
  }

  // Helper function to get drop zone ID for shift type
  private getDropZoneIdForShiftType(shiftType: string): string {
    if (shiftType === 'S') return 'drop-zone-s';
    if (shiftType === 'N') return 'drop-zone-n';
    return 'drop-zone-f';
  }

  // Helper function to add employee to drop zone
  private addEmployeeToDropZone(
    targetZone: HTMLDivElement,
    employeeId: string,
    shiftType: string,
    employeeName: string,
  ): void {
    const employeeDiv = document.createElement('div');
    employeeDiv.className = 'employee-item';
    employeeDiv.dataset.employeeId = employeeId;
    employeeDiv.dataset.shiftType = shiftType;
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

  // Helper function to setup modal event handlers
  private setupModalEventHandlers(): void {
    const saveBtn = $$id('save-rotation-btn') as HTMLButtonElement | null;
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
  }

  // Main function refactored
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

    // Setup available employees
    const availableContainer = $$id('rotation-available-employees') as HTMLDivElement | null;
    this.setupAvailableEmployees(availableContainer);

    // Configure date inputs
    this.configureDateInputs(this.editMode);

    // Setup pattern select handler
    this.setupPatternSelectHandler();

    // Update modal title based on mode
    this.updateModalTitle();

    // If editing, populate form with existing data
    if (this.editMode && existingPattern !== undefined) {
      this.loadExistingPatternData(existingPattern);
    }

    // Setup event handlers
    this.setupModalEventHandlers();

    // Show the modal
    this.showRotationModal();
  }

  // Helper function to update modal title
  private updateModalTitle(): void {
    const modal = $$id('rotation-setup-modal') as HTMLDivElement | null;
    if (modal) {
      const modalHeader = modal.querySelector('.modal-header h2');
      if (modalHeader) {
        modalHeader.textContent = this.editMode ? 'Schichtrotation bearbeiten' : 'Schichtrotation einrichten';
      }
    }
  }

  // Helper function to show the rotation modal
  private showRotationModal(): void {
    const modal = $$id('rotation-setup-modal') as HTMLDivElement | null;
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('show');
      console.info('[SHIFTS DEBUG] Opened rotation setup modal in', this.editMode ? 'EDIT' : 'CREATE', 'mode');
    } else {
      console.error('[SHIFTS DEBUG] Modal element not found: rotation-setup-modal');
    }
  }

  private closeRotationModal(): void {
    const modal = $$id('rotation-setup-modal') as HTMLDivElement | null;
    if (modal) {
      modal.classList.remove('show');
      console.info('[SHIFTS DEBUG] Closed rotation setup modal');
    }

    // Reset checkbox if modal was closed without saving
    const rotationCheckbox = $$('#shift-rotation') as HTMLInputElement | null;
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

  // Helper to validate rotation form input
  private validateRotationInput(): {
    valid: boolean;
    pattern?: string;
    startDate?: string;
    endDate?: string;
    skipWeekends: boolean;
    ignoreNightShift: boolean;
  } {
    const patternSelect = $$id('rotation-pattern') as HTMLSelectElement | null;
    const startInput = $$id('rotation-start-date') as HTMLInputElement | null;
    const endInput = $$id('rotation-end-date') as HTMLInputElement | null;
    const skipWeekendsInput = $$id('rotation-skip-weekends') as HTMLInputElement | null;
    const ignoreNightInput = $$id('rotation-ignore-night') as HTMLInputElement | null;

    const pattern = patternSelect?.value;
    const startDate = startInput?.value;
    const endDate = endInput?.value;

    if (pattern === undefined || pattern === '') {
      showErrorAlert('Bitte wählen Sie ein Rotationsmuster');
      return { valid: false, skipWeekends: false, ignoreNightShift: false };
    }

    if (startDate === undefined || startDate === '') {
      showErrorAlert('Bitte wählen Sie ein Startdatum');
      return { valid: false, skipWeekends: false, ignoreNightShift: false };
    }

    if (endDate === undefined || endDate === '') {
      showErrorAlert('Bitte wählen Sie ein Enddatum');
      return { valid: false, skipWeekends: false, ignoreNightShift: false };
    }

    return {
      valid: true,
      pattern,
      startDate,
      endDate,
      skipWeekends: skipWeekendsInput?.checked ?? false,
      ignoreNightShift: ignoreNightInput?.checked ?? false,
    };
  }

  // Helper to validate date range
  private validateDateRange(startDate: string, endDate: string): boolean {
    const end = new Date(endDate);
    const start = new Date(startDate);

    if (end <= start) {
      showErrorAlert('Das Enddatum muss nach dem Startdatum liegen');
      return false;
    }

    const currentYear = new Date().getFullYear();
    const maxEndDate = new Date(currentYear, 11, 31);
    if (end > maxEndDate) {
      showErrorAlert(`Das Enddatum darf maximal bis zum 31.12.${currentYear} gehen (Datenbankschutz)`);
      return false;
    }

    return true;
  }

  // Helper to collect employees from drop zones
  private collectEmployeesFromZones(): { employees: number[]; shiftGroups: Record<number, string> } {
    const shiftGroups: Record<number, string> = {};
    const employees: number[] = [];

    const zones = [
      { id: 'drop-zone-f', shift: 'F' },
      { id: 'drop-zone-s', shift: 'S' },
      { id: 'drop-zone-n', shift: 'N' },
    ];

    zones.forEach(({ id, shift }) => {
      const zone = $$id(id) as HTMLDivElement | null;
      if (zone === null) return;

      const items = zone.querySelectorAll<HTMLDivElement>('.employee-item');
      items.forEach((emp) => {
        const empId = Number(emp.dataset.employeeId);
        if (empId !== 0 && !Number.isNaN(empId)) {
          employees.push(empId);
          Reflect.set(shiftGroups, empId, shift);
        }
      });
    });

    return { employees, shiftGroups };
  }

  // Helper to create rotation pattern
  private async createRotationPattern(
    token: string,
    pattern: string,
    startDate: string,
    endDate: string,
    skipWeekends: boolean,
    ignoreNightShift: boolean,
    shiftGroups: Record<number, string>,
  ): Promise<number> {
    const teamId = this.selectedContext.teamId;
    const cycleWeeks = pattern === 'weekly' ? 1 : pattern === 'biweekly' ? 2 : 4;

    const requestPayload = {
      name: `${pattern} Rotation`,
      description: `Automatische ${pattern} Rotation`,
      team_id: teamId ?? null,
      pattern_type: 'custom',
      pattern_config: {
        skipWeekends,
        cycleWeeks,
        ignoreNightShift,
        shiftGroups,
      },
      cycle_length_weeks: cycleWeeks,
      starts_at: startDate,
      ends_at: endDate,
      is_active: true,
    };

    const response = await fetch('/api/v2/shifts/rotation/patterns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fehler beim Erstellen des Rotationsmusters: ${errorText}`);
    }

    const result = (await response.json()) as { data: { pattern: { id: number } } };
    return result.data.pattern.id;
  }

  // Helper to assign and generate shifts
  private async assignAndGenerateShifts(
    token: string,
    patternId: number,
    employees: number[],
    shiftGroups: Record<number, string>,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    // Assign employees
    const assignResponse = await fetch('/api/v2/shifts/rotation/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pattern_id: patternId,
        user_ids: employees,
        team_id: this.selectedContext.teamId ?? null,
        shift_groups: shiftGroups,
        starts_at: startDate,
        ends_at: endDate,
      }),
    });

    if (!assignResponse.ok) {
      throw new Error('Fehler beim Zuweisen der Mitarbeiter');
    }

    // Generate shifts
    const generateResponse = await fetch('/api/v2/shifts/rotation/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pattern_id: patternId,
        start_date: startDate,
        end_date: endDate,
      }),
    });

    if (!generateResponse.ok) {
      throw new Error('Fehler beim Generieren der Schichten');
    }
  }

  private async createRotation(): Promise<void> {
    try {
      const token = getAuthToken();
      if (token === null || token === '') {
        showErrorAlert('Nicht angemeldet');
        return;
      }

      // Validate form input
      const input = this.validateRotationInput();
      if (!input.valid || input.pattern === undefined || input.startDate === undefined || input.endDate === undefined) {
        return;
      }

      // Validate date range
      if (!this.validateDateRange(input.startDate, input.endDate)) {
        return;
      }

      // Collect employees from drop zones
      const { employees, shiftGroups } = this.collectEmployeesFromZones();
      if (employees.length === 0) {
        showErrorAlert('Bitte ziehen Sie mindestens einen Mitarbeiter in eine Schicht-Spalte');
        return;
      }

      // Create pattern, assign employees, and generate shifts
      const patternId = await this.createRotationPattern(
        token,
        input.pattern,
        input.startDate,
        input.endDate,
        input.skipWeekends,
        input.ignoreNightShift,
        shiftGroups,
      );

      await this.assignAndGenerateShifts(token, patternId, employees, shiftGroups, input.startDate, input.endDate);

      showSuccessAlert('Rotation erfolgreich erstellt!');

      // Close modal
      this.closeRotationModal();

      // Save rotation preference
      await this.saveUserPreferenceToDatabase('shift_rotation_pattern_id', String(patternId));

      // Keep the checkbox checked since we successfully created a rotation pattern
      this.rotationConfig.enabled = true;
      const rotationCheckbox = $$('#shift-rotation') as HTMLInputElement | null;
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
    const editBtn = $$id('edit-rotation-btn') as HTMLButtonElement | null;
    if (editBtn) {
      editBtn.style.display = show ? 'inline-block' : 'none';
      console.info('[SHIFTS DEBUG] Edit rotation button visibility:', show);
    }
  }

  private async updateRotation(): Promise<void> {
    try {
      const token = this.validateAuthAndPattern();
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token === null) return;

      const formValues = this.getRotationFormValues();
      if (!this.validateRotationFormValues(formValues)) return;

      const requestPayload = this.buildRotationPayload(formValues);
      await this.sendRotationUpdate(requestPayload, token);

      this.handleRotationUpdateSuccess();
      await this.loadCurrentWeekData();
    } catch (error) {
      console.error('Error updating rotation:', error);
      showErrorAlert(error instanceof Error ? error.message : 'Fehler beim Aktualisieren der Rotation');
    }
  }

  private validateAuthAndPattern(): string | null {
    const token = getAuthToken();
    if (token === null || token === '') {
      showErrorAlert('Nicht angemeldet');
      return null;
    }

    if (this.currentPatternId === null) {
      showErrorAlert('Kein Muster zum Bearbeiten ausgewählt');
      return null;
    }

    return token;
  }

  private getRotationFormValues(): {
    pattern: string | undefined;
    startDate: string | undefined;
    endDateValue: string | undefined;
    skipWeekends: boolean;
    ignoreNightShift: boolean;
  } {
    const patternSelect = $$id('rotation-pattern') as HTMLSelectElement | null;
    const startInput = $$id('rotation-start-date') as HTMLInputElement | null;
    const endInput = $$id('rotation-end-date') as HTMLInputElement | null;
    const skipWeekendsInput = $$id('rotation-skip-weekends') as HTMLInputElement | null;
    const ignoreNightInput = $$id('rotation-ignore-night') as HTMLInputElement | null;

    return {
      pattern: patternSelect?.value,
      startDate: startInput?.value,
      endDateValue: endInput?.value,
      skipWeekends: skipWeekendsInput?.checked ?? false,
      ignoreNightShift: ignoreNightInput?.checked ?? false,
    };
  }

  private validateRotationFormValues(formValues: {
    pattern: string | undefined;
    startDate: string | undefined;
  }): boolean {
    if (formValues.pattern === undefined || formValues.pattern === '') {
      showErrorAlert('Bitte wählen Sie ein Rotationsmuster');
      return false;
    }

    if (formValues.startDate === undefined || formValues.startDate === '') {
      showErrorAlert('Bitte wählen Sie ein Startdatum');
      return false;
    }

    return true;
  }

  private buildRotationPayload(formValues: {
    pattern: string | undefined;
    startDate: string | undefined;
    endDateValue: string | undefined;
    skipWeekends: boolean;
    ignoreNightShift: boolean;
  }): Record<string, unknown> {
    const patternTypeMap: Record<string, string> = {
      weekly: 'alternate_fs',
      biweekly: 'fixed_n',
      custom: 'custom',
    };

    return {
      name: `Team-Rotation ${String(this.selectedContext.teamId ?? 'Unknown')}`,
      description: 'Automatisch generierte Schichtrotation',
      team_id: this.selectedContext.teamId ?? null,
      pattern_type: patternTypeMap[formValues.pattern ?? ''] ?? 'alternate_fs',
      pattern_config: {
        skipWeekends: formValues.skipWeekends,
        ignoreNightShift: formValues.ignoreNightShift,
      },
      starts_at: formValues.startDate,
      ends_at: formValues.endDateValue ?? formValues.startDate,
      is_active: true,
    };
  }

  private async sendRotationUpdate(requestPayload: Record<string, unknown>, token: string): Promise<void> {
    const response = await fetch(`/api/v2/shifts/rotation/patterns/${String(this.currentPatternId)}`, {
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
  }

  private handleRotationUpdateSuccess(): void {
    showSuccessAlert('Rotation erfolgreich aktualisiert');
    this.closeRotationModal();
    this.editMode = false;
    this.currentPatternId = null;
  }

  updateShiftCells(weekStart: Date): void {
    console.info('[SHIFTS DEBUG] Updating shift cells for week starting:', weekStart);

    this.updateDayHeaders(weekStart);
    this.updateAllShiftAssignments(weekStart);
  }

  private updateDayHeaders(weekStart: Date): void {
    const dayHeaders = document.querySelectorAll('.day-header');
    dayHeaders.forEach((header, index) => {
      if (index === 0) return; // Skip the first header which is "Schicht"

      const date = new Date(weekStart);
      date.setDate(date.getDate() + (index - 1));

      const dateSpan = header.querySelector('span');
      if (dateSpan) {
        dateSpan.textContent = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }
    });
  }

  private updateAllShiftAssignments(weekStart: Date): void {
    const shiftTypes = ['early', 'late', 'night'];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    shiftTypes.forEach((shiftType) => {
      days.forEach((day, dayIndex) => {
        this.updateSingleShiftCell(weekStart, day, dayIndex, shiftType);
      });
    });
  }

  private updateSingleShiftCell(weekStart: Date, day: string, dayIndex: number, shiftType: string): void {
    const cell = document.querySelector(`.shift-cell[data-day="${day}"][data-shift="${shiftType}"]`);
    if (!cell) {
      console.warn(`[SHIFTS WARN] Cell not found for ${day} ${shiftType}`);
      return;
    }

    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayIndex);
    const dateKey = this.formatDateKey(date);

    const assignmentDiv = cell.querySelector(CSS_SELECTORS.EMPLOYEE_ASSIGNMENT);
    if (!assignmentDiv) return;

    assignmentDiv.innerHTML = '';
    const assignments = this.getShiftEmployees(dateKey, shiftType);

    console.info('[SHIFTS DEBUG] Updating cell:', { day, shiftType, dateKey, assignments });

    if (assignments.length > 0) {
      assignments.forEach((employeeId) => {
        this.renderEmployeeAssignment(assignmentDiv, employeeId, dateKey, shiftType);
      });
    } else {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'empty-slot';
      emptySlot.textContent = this.isAdmin ? '+' : '-';
      assignmentDiv.append(emptySlot);
    }
  }

  private renderEmployeeAssignment(
    assignmentDiv: Element,
    employeeId: number,
    dateKey: string,
    shiftType: string,
  ): void {
    const employee = this.employees.find((e) => e.id === employeeId);
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
      const tempEmployee = this.createTempEmployeeFromShiftDetail(shiftDetail);
      const employeeCard = this.createEmployeeCard(tempEmployee);
      assignmentDiv.append(employeeCard);
    } else {
      console.error('[SHIFTS ERROR] Employee not found:', employeeId);
      this.renderFallbackEmployeeCard(assignmentDiv, employeeId);
    }
  }

  private createTempEmployeeFromShiftDetail(shiftDetail: ShiftDetailData): Employee {
    const firstName = shiftDetail.first_name !== '' ? shiftDetail.first_name : undefined;
    const lastName = shiftDetail.last_name !== '' ? shiftDetail.last_name : undefined;
    const username = shiftDetail.username !== '' ? shiftDetail.username : `Employee #${shiftDetail.employee_id}`;

    return {
      id: shiftDetail.employee_id,
      first_name: firstName,
      last_name: lastName,
      username: username,
      position: 'Mitarbeiter',
      email: '',
      role: 'employee' as const,
      tenant_id: 0,
      created_at: '',
      updated_at: '',
      is_active: true,
      is_archived: false,
    };
  }

  private renderFallbackEmployeeCard(assignmentDiv: Element, employeeId: number): void {
    const tempCard = document.createElement('div');
    tempCard.className = 'employee-card';
    const nameDiv = document.createElement('div');
    nameDiv.className = CSS_CLASSES.EMPLOYEE_NAME;
    nameDiv.textContent = `Mitarbeiter #${String(employeeId)}`;
    tempCard.append(nameDiv);
    assignmentDiv.append(tempCard);
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
      removeBtn.dataset.action = 'remove-shift';
      removeBtn.dataset.employeeId = String(employee.id);
      const removeIcon = createElement('i', { className: 'fas fa-times' });
      removeBtn.append(removeIcon);
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

  // Helper: Validate prerequisites for saving
  private validateSavePrerequisites(): boolean {
    if (!this.isAdmin) {
      console.warn('[SHIFTS SAVE DEBUG] Not admin, returning');
      return false;
    }

    if (this.selectedContext.departmentId === null || this.selectedContext.departmentId === 0) {
      console.warn('[SHIFTS SAVE DEBUG] No department selected, returning');
      showErrorAlert('Bitte wählen Sie zuerst eine Abteilung aus');
      return false;
    }

    return true;
  }

  // Helper: Collect assignments for v1 API
  private collectV1Assignments(
    weekStart: string,
    weekEnd: string,
  ): {
    employee_id: number;
    shift_date: string;
    shift_type: string;
    week_start: string;
    week_end: string;
    department_id?: number;
    machine_id?: number;
    team_leader_id?: number;
  }[] {
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

    return assignments;
  }

  // Helper: Save with v1 API
  private async saveWithV1API(weekStart: string, weekEnd: string, notes: string): Promise<void> {
    const assignments = this.collectV1Assignments(weekStart, weekEnd);

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
      showSuccessAlert('Schichtplan erfolgreich gespeichert!');
      await this.loadCurrentWeekData();
    } else {
      const error = (await response.json()) as { message?: string };
      showErrorAlert(error.message ?? 'Fehler beim Speichern des Schichtplans');
    }
  }

  // Helper: Collect shifts for v2 API plan
  private collectShiftsForPlan(): {
    userId: number;
    date: string;
    type: string;
    startTime: string;
    endTime: string;
  }[] {
    const shiftsForPlan: {
      userId: number;
      date: string;
      type: string;
      startTime: string;
      endTime: string;
    }[] = [];

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

    return shiftsForPlan;
  }

  // Helper: Get Kontischicht info if active
  private getKontischichtInfo(): { planName: string; pattern?: string; startDate?: string; endDate?: string } | null {
    const windowWithKontischicht = window as typeof window & {
      kontischichtManager: {
        isKontischichtActive: () => boolean;
        getSelectedPattern: () => {
          name: string;
          patternType: string;
          startsAt?: string;
          endsAt?: string;
        } | null;
      };
    };

    const kontischichtManager =
      'kontischichtManager' in window ? windowWithKontischicht.kontischichtManager : undefined;

    if (kontischichtManager?.isKontischichtActive() !== true) {
      return null;
    }

    const pattern = kontischichtManager.getSelectedPattern();
    if (pattern === null) {
      return null;
    }

    const weekNumber = this.getWeekNumber(this.currentWeek);
    const year = new Date().getFullYear();

    return {
      planName: `Kontischicht ${pattern.name} KW${String(weekNumber)}/${String(year)}`,
      pattern: pattern.patternType,
      startDate: pattern.startsAt,
      endDate: pattern.endsAt,
    };
  }

  // Helper: Build plan request for v2 API
  private buildPlanRequest(
    weekStart: string,
    weekEnd: string,
    notes: string,
    shiftsForPlan: { userId: number; date: string; type: string; startTime: string; endTime: string }[],
  ): Record<string, unknown> {
    const nullToUndefined = <T>(value: T | null): T | undefined => value ?? undefined;
    const kontischichtInfo = this.getKontischichtInfo();

    let planName = `Schichtplan KW${String(this.getWeekNumber(this.currentWeek))}/${String(new Date().getFullYear())}`;
    let overrideStartDate = weekStart;
    let overrideEndDate = weekEnd;
    let kontischichtPattern: string | undefined;

    if (kontischichtInfo !== null) {
      planName = kontischichtInfo.planName;
      kontischichtPattern = kontischichtInfo.pattern;
      if (kontischichtInfo.startDate !== undefined && kontischichtInfo.startDate !== '') {
        overrideStartDate = kontischichtInfo.startDate;
      }
      if (kontischichtInfo.endDate !== undefined && kontischichtInfo.endDate !== '') {
        overrideEndDate = kontischichtInfo.endDate;
      }
    }

    return {
      startDate: overrideStartDate,
      endDate: overrideEndDate,
      areaId: nullToUndefined(this.selectedContext.areaId),
      departmentId: nullToUndefined(this.selectedContext.departmentId),
      teamId: nullToUndefined(this.selectedContext.teamId),
      machineId: nullToUndefined(this.selectedContext.machineId),
      name: planName,
      shiftNotes: notes !== '' ? notes : undefined,
      shifts: shiftsForPlan,
      kontischichtPattern,
    };
  }

  // Helper: Handle success after save
  private handleSaveSuccess(isUpdate: boolean, planId?: number): void {
    if (planId !== undefined) {
      this.currentPlanId = planId;
    }

    showSuccessAlert(isUpdate ? 'Schichtplan wurde aktualisiert' : 'Schichtplan erfolgreich gespeichert!');

    if (isUpdate && this.isEditMode) {
      this.toggleEditMode(false);
    }

    // Save context and reload
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

    setTimeout(() => {
      console.info('[SHIFTS RELOAD DEBUG] Performing full page reload...');
      window.location.reload();
    }, 500);
  }

  // Helper: Handle save error
  private handleSaveError(error: unknown): void {
    console.error('[SHIFTS PLAN DEBUG] Failed to create shift plan:', error);

    if (!(error instanceof Error)) {
      showErrorAlert('Fehler beim Speichern des Schichtplans');
      return;
    }

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
  }

  // Helper: Save with v2 API
  private async saveWithV2API(isUpdate: boolean, weekStart: string, weekEnd: string, notes: string): Promise<void> {
    const shiftsForPlan = this.collectShiftsForPlan();

    // Check if shift plan is incomplete
    const expectedMinShifts = 10;
    if (shiftsForPlan.length < expectedMinShifts) {
      const confirmed = await showConfirm(
        `Der Schichtplan ist unvollständig (${String(shiftsForPlan.length)} von mindestens ${String(expectedMinShifts)} Schichten ausgefüllt). Trotzdem speichern?`,
      );
      if (!confirmed) {
        console.info('[SHIFTS PLAN DEBUG] User cancelled save due to incomplete plan');
        return;
      }
    }

    const planRequest = this.buildPlanRequest(weekStart, weekEnd, notes, shiftsForPlan);

    console.info('[SHIFTS PLAN DEBUG] Sending plan to API:', planRequest);

    const endpoint =
      isUpdate && this.currentPlanId !== null ? `/shifts/plan/${String(this.currentPlanId)}` : '/shifts/plan';

    try {
      const response = await this.apiClient.request(endpoint, {
        method: isUpdate && this.currentPlanId !== null ? 'PUT' : 'POST',
        body: JSON.stringify(planRequest),
      });

      console.info('[SHIFTS PLAN DEBUG] API Response:', response);

      let planId: number | undefined;
      if (response !== null && typeof response === 'object' && 'planId' in response) {
        const result = response as { planId: number; shiftIds: number[]; message?: string };
        planId = result.planId;
        console.info('[SHIFTS PLAN DEBUG] Created plan ID:', result.planId);
        console.info('[SHIFTS PLAN DEBUG] Created shift IDs:', result.shiftIds);
      }

      this.handleSaveSuccess(isUpdate, planId);
    } catch (error) {
      this.handleSaveError(error);
    }
  }

  // Main save schedule function (refactored)
  async saveSchedule(isUpdate = false): Promise<void> {
    console.info('[SHIFTS SAVE DEBUG] saveSchedule called, isUpdate:', isUpdate);
    console.info('[SHIFTS SAVE DEBUG] currentPlanId:', this.currentPlanId);
    console.info('[SHIFTS SAVE DEBUG] useV2API:', this.useV2API);

    if (!this.validateSavePrerequisites()) {
      return;
    }

    console.info('[SHIFTS SAVE DEBUG] Starting save process...');
    try {
      const weekStart = this.formatDate(this.getWeekStart(this.currentWeek));
      const weekEnd = this.formatDate(this.getWeekEnd(this.currentWeek));

      // Get notes from textarea
      const notesTextarea = $$id('weeklyNotes') as HTMLTextAreaElement | null;
      const notes = notesTextarea !== null ? notesTextarea.value : '';

      if (!this.useV2API) {
        await this.saveWithV1API(weekStart, weekEnd, notes);
      } else {
        await this.saveWithV2API(isUpdate, weekStart, weekEnd, notes);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      showErrorAlert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  // Helper: Delete plan from database
  private async deletePlanFromDatabase(): Promise<void> {
    if (this.currentPlanId === null) return;

    console.info('[SHIFTS RESET] Deleting plan from database:', this.currentPlanId);
    const response = await this.apiClient.request(`/shifts/plan/${String(this.currentPlanId)}`, {
      method: 'DELETE',
    });

    console.info('[SHIFTS RESET] Delete response:', response);
    showSuccessAlert('Schichtplan wurde aus der Datenbank gelöscht');
  }

  // Helper: Delete shifts using v1 API
  private async deleteShiftsV1API(): Promise<void> {
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

  // Helper: Clear UI after reset
  private clearUIAfterReset(): void {
    this.weeklyShifts = new Map();
    this.shiftDetails = new Map();
    this.currentPlanId = null;

    const notesTextarea = $$id('weeklyNotes') as HTMLTextAreaElement | null;
    if (notesTextarea !== null) {
      notesTextarea.value = '';
    }
  }

  async resetSchedule(): Promise<void> {
    if (!this.isAdmin) return;

    const confirmed = await showConfirm(
      '⚠️ Schichtplan zurücksetzen?\n\nAlle Schichten dieser Woche werden dauerhaft aus der Datenbank gelöscht!\nDer Schichtplan wird komplett geleert.\n\nWirklich fortfahren?',
    );

    if (!confirmed) return;

    try {
      if (this.useV2API && this.currentPlanId !== null) {
        await this.deletePlanFromDatabase();
      } else if (!this.useV2API) {
        await this.deleteShiftsV1API();
      }

      // Clear UI
      this.clearUIAfterReset();

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
  // Helper: Remove existing edit/update buttons
  private removeExistingButtons(): void {
    const existingEditBtn = document.querySelector('#editScheduleBtn');
    const existingUpdateBtn = document.querySelector('#updateScheduleBtn');
    if (existingEditBtn !== null) existingEditBtn.remove();
    if (existingUpdateBtn !== null) existingUpdateBtn.remove();
  }

  // Helper: Create edit button
  private createEditButton(): HTMLButtonElement {
    const editBtn = document.createElement('button');
    editBtn.id = 'editScheduleBtn';
    editBtn.className = 'admin-btn';
    editBtn.textContent = 'Bearbeiten';
    return editBtn;
  }

  // Helper: Create update button
  private createUpdateButton(): HTMLButtonElement {
    const updateBtn = document.createElement('button');
    updateBtn.id = 'updateScheduleBtn';
    updateBtn.className = 'admin-btn';
    updateBtn.textContent = 'Schichtplan aktualisieren';
    return updateBtn;
  }

  // Helper: Show buttons for edit mode
  private showEditModeButtons(
    saveBtn: HTMLButtonElement | null,
    resetBtn: HTMLButtonElement | null,
    adminActions: HTMLElement,
  ): void {
    if (saveBtn !== null) saveBtn.style.display = DISPLAY.NONE;
    if (resetBtn !== null) resetBtn.style.display = DISPLAY.INLINE_BLOCK;

    const updateBtn = this.createUpdateButton();
    if (resetBtn !== null) {
      resetBtn.before(updateBtn);
    } else {
      adminActions.append(updateBtn);
    }
  }

  // Helper: Show buttons for read-only mode
  private showReadOnlyButtons(
    saveBtn: HTMLButtonElement | null,
    resetBtn: HTMLButtonElement | null,
    adminActions: HTMLElement,
  ): void {
    if (saveBtn !== null) saveBtn.style.display = 'none';
    if (resetBtn !== null) resetBtn.style.display = 'none';

    const editBtn = this.createEditButton();
    adminActions.insertBefore(editBtn, adminActions.firstChild);
  }

  // Helper: Show normal save buttons
  private showNormalButtons(saveBtn: HTMLButtonElement | null, resetBtn: HTMLButtonElement | null): void {
    if (saveBtn !== null) saveBtn.style.display = DISPLAY.INLINE_BLOCK;
    if (resetBtn !== null) resetBtn.style.display = DISPLAY.INLINE_BLOCK;
  }

  updateButtonVisibility(): void {
    const saveBtn = $$id('saveScheduleBtn') as HTMLButtonElement | null;
    const resetBtn = $$id('resetScheduleBtn') as HTMLButtonElement | null;
    const adminActions = $$id('adminActions');

    if (adminActions === null || !this.isAdmin) return;

    this.removeExistingButtons();

    if (this.currentPlanId === null) {
      this.showNormalButtons(saveBtn, resetBtn);
      return;
    }

    // Plan exists
    if (this.isEditMode) {
      this.showEditModeButtons(saveBtn, resetBtn, adminActions);
    } else {
      this.showReadOnlyButtons(saveBtn, resetBtn, adminActions);
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

  // Helper: Show/hide elements by class
  private toggleElementsByClass(selector: string, hide: boolean): void {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      if (hide) {
        el.classList.add('hidden');
      } else {
        el.classList.remove('hidden');
      }
    });
  }

  // Helper: Set element display style
  private setElementDisplay(element: Element | null, display: string): void {
    if (element !== null) {
      (element as HTMLElement).style.display = display;
    }
  }

  // Helper: Configure admin UI
  private configureAdminUI(employeeSidebar: Element | null, notesTextarea: Element | null): void {
    this.toggleElementsByClass('.admin-controls', false);
    this.toggleElementsByClass('.employee-info-section', true);
    this.setElementDisplay(employeeSidebar, 'block');

    if (notesTextarea !== null) {
      notesTextarea.removeAttribute('readonly');
    }
  }

  // Helper: Configure employee UI
  private configureEmployeeUI(
    adminActions: Element | null,
    employeeSidebar: Element | null,
    infoRow: Element | null,
    mainPlanningArea: Element | null,
    notesTextarea: Element | null,
  ): void {
    this.toggleElementsByClass('.admin-controls', true);
    this.toggleElementsByClass('.employee-info-section', false);
    this.setElementDisplay(adminActions, 'none');
    this.setElementDisplay(employeeSidebar, 'none');
    this.setElementDisplay(infoRow, 'none');

    if (mainPlanningArea !== null) {
      mainPlanningArea.classList.add('full-width');
    }

    if (notesTextarea !== null) {
      notesTextarea.setAttribute('readonly', 'readonly');
      notesTextarea.parentElement?.classList.add('readonly');
    }
  }

  // Helper: Update instructions text
  private updateInstructions(): void {
    const instructions = $$id('instructions');
    if (instructions === null) return;

    // Clear existing content
    while (instructions.firstChild) {
      instructions.firstChild.remove();
    }

    // Create paragraph element with text content
    const p = createElement('p');
    p.textContent = this.isAdmin
      ? 'Ziehen Sie Mitarbeiter auf die gewünschten Schichten oder klicken Sie erst auf einen Mitarbeiter und dann auf eine Schicht.'
      : 'Hier sehen Sie Ihren aktuellen Schichtplan. Ihre Schichten sind hervorgehoben.';

    instructions.append(p);
  }

  updateUIForRole(): void {
    const adminActions = document.querySelector('#adminActions');
    const employeeSidebar = document.querySelector('.employee-sidebar');
    const mainPlanningArea = document.querySelector('.main-planning-area');
    const notesTextarea = document.querySelector(DOM_IDS.WEEKLY_NOTES);
    const infoRow = document.querySelector('.shift-info-row');

    if (this.isAdmin) {
      this.configureAdminUI(employeeSidebar, notesTextarea);
    } else {
      this.configureEmployeeUI(adminActions, employeeSidebar, infoRow, mainPlanningArea, notesTextarea);
    }

    this.updateInstructions();
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

  private readonly shiftTimes = new Map<string, string>([
    ['early', '06:00 - 14:00'],
    ['late', '14:00 - 22:00'],
    ['night', '22:00 - 06:00'],
  ]);

  private readonly shiftNames = new Map<string, string>([
    ['early', 'Frühschicht'],
    ['late', 'Spätschicht'],
    ['night', 'Nachtschicht'],
  ]);

  private showShiftDetailsModal(shiftCell: HTMLElement): void {
    const date = shiftCell.dataset.date;
    const shift = shiftCell.dataset.shift;

    if (date === undefined || date === '' || shift === undefined || shift === '') return;

    const shiftDate = new Date(date);
    const dayName = shiftDate.toLocaleDateString('de-DE', { weekday: 'long' });
    const dateStr = shiftDate.toLocaleDateString('de-DE');

    const assignedEmployees = this.getAssignedEmployeeNames(date, shift);
    const modalContent = this.buildShiftModalContent(shift, dayName, dateStr, assignedEmployees);

    openModal(modalContent, {
      title: 'Schichtdetails',
      size: 'md',
    });
  }

  private getAssignedEmployeeNames(date: string, shift: string): string {
    const employeeIds = this.getShiftEmployees(date, shift);
    return employeeIds
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
  }

  private buildShiftModalContent(shift: string, dayName: string, dateStr: string, assignedEmployees: string): string {
    const departmentRow = this.buildDepartmentRow();
    const machineRow = this.buildMachineRow();

    return `
      <div class="shift-detail-modal">
        <h3>${this.shiftNames.get(shift) ?? shift} - ${dayName}</h3>
        <div class="shift-detail-info">
          <div class="detail-row">
            <span class="detail-label">Datum:</span>
            <span class="detail-value">${dateStr}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Zeit:</span>
            <span class="detail-value">${this.shiftTimes.get(shift) ?? ''}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Zugewiesene Mitarbeiter:</span>
            <span class="detail-value">${assignedEmployees !== '' ? assignedEmployees : 'Keine Mitarbeiter zugewiesen'}</span>
          </div>
          ${departmentRow}
          ${machineRow}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-action="close-modal">Schließen</button>
        </div>
      </div>
    `;
  }

  private buildDepartmentRow(): string {
    if (this.selectedContext.departmentId !== null && this.selectedContext.departmentId !== 0) {
      const deptName = this.departments.find((d) => d.id === this.selectedContext.departmentId)?.name ?? '-';
      return `
          <div class="detail-row">
            <span class="detail-label">Abteilung:</span>
            <span class="detail-value">${deptName}</span>
          </div>`;
    }
    return '';
  }

  private buildMachineRow(): string {
    if (this.selectedContext.machineId !== null && this.selectedContext.machineId !== 0) {
      const machineName = this.machines.find((m) => m.id === this.selectedContext.machineId)?.name ?? '-';
      return `
          <div class="detail-row">
            <span class="detail-label">Maschine:</span>
            <span class="detail-value">${machineName}</span>
          </div>`;
    }
    return '';
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
  // Helper: Check if all context fields are selected
  private isContextComplete(): boolean {
    return (
      this.selectedContext.areaId !== null &&
      this.selectedContext.departmentId !== null &&
      this.selectedContext.machineId !== null &&
      this.selectedContext.teamId !== null
    );
  }

  // Helper: Get context names for favorite
  private getContextNames(): { area: Area; department: Department; machine: Machine; team: Team } | null {
    const area = this.areas.find((a) => a.id === this.selectedContext.areaId);
    const department = this.departments.find((d) => d.id === this.selectedContext.departmentId);
    const machine = this.machines.find((m) => m.id === this.selectedContext.machineId);
    const team = this.teams.find((t) => t.id === this.selectedContext.teamId);

    if (!area || !department || !machine || !team) {
      return null;
    }

    return { area, department, machine, team };
  }

  // Helper: Check for duplicate favorite by team
  private checkDuplicateFavoriteByTeam(): boolean {
    if (this.selectedContext.teamId === null) return false;

    const existingFavorite = this.favorites.find((fav) => fav.teamId === this.selectedContext.teamId);
    if (existingFavorite !== undefined) {
      console.info('[FAVORITE ADD] Team already exists as favorite:', existingFavorite);
      showErrorAlert(`Diese Kombination ist bereits als Favorit "${existingFavorite.name}" gespeichert!`);
      return true;
    }

    return false;
  }

  // Helper: Create favorite via API
  private async createFavoriteAPI(names: {
    area: Area;
    department: Department;
    machine: Machine;
    team: Team;
  }): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (token === null || token === '') {
      showErrorAlert('Nicht authentifiziert');
      return false;
    }

    const response = await fetch('/api/v2/shifts/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: names.team.name,
        areaId: this.selectedContext.areaId,
        areaName: names.area.name,
        departmentId: this.selectedContext.departmentId,
        departmentName: names.department.name,
        machineId: this.selectedContext.machineId,
        machineName: names.machine.name,
        teamId: this.selectedContext.teamId,
        teamName: names.team.name,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        showInfo('Ein Favorit mit diesem Namen existiert bereits');
      } else {
        const error = (await response.json()) as { error?: { message?: string } };
        showErrorAlert(error.error?.message ?? 'Fehler beim Speichern des Favoriten');
      }
      return false;
    }

    return true;
  }

  private async addToFavorites(): Promise<void> {
    console.info('[FAVORITE ADD] Current context:', this.selectedContext);

    // Check for duplicate by team
    if (this.checkDuplicateFavoriteByTeam()) {
      return;
    }

    // Check if all required fields are selected
    if (!this.isContextComplete()) {
      showErrorAlert('Bitte wählen Sie alle Filter aus (Bereich, Abteilung, Maschine und Team)');
      return;
    }

    // Double-check if this exact combination is already favorited
    if (this.isCombinationFavorited()) {
      showErrorAlert('Diese Kombination existiert bereits als Favorit!');
      return;
    }

    // Get names for display
    const names = this.getContextNames();
    if (names === null) {
      showErrorAlert('Fehler beim Speichern des Favoriten');
      return;
    }

    // Create new favorite via API
    try {
      const success = await this.createFavoriteAPI(names);
      if (!success) {
        return;
      }

      // Refresh favorites list
      await this.refreshFavorites();
      showSuccessAlert(`Favorit "${names.team.name}" wurde gespeichert`);

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
  // Helper: Update display element with value and text
  private updateDisplayElement(elementId: string, value: number, text: string): void {
    const display = $$id(elementId);
    if (display === null) {
      console.error(`[LOADFAVORITE] ${elementId} element not found!`);
      return;
    }

    display.dataset.value = String(value);
    const span = display.querySelector('span');
    if (span !== null) {
      span.textContent = text;
      console.info(`[LOADFAVORITE] ${elementId} updated to:`, text);
    }
  }

  // Helper: Set area context and display
  private setAreaContext(favorite: ShiftFavorite): void {
    console.info('[LOADFAVORITE] Setting area:', favorite.areaId, favorite.areaName);
    this.selectedContext.areaId = favorite.areaId;
    this.updateDisplayElement('areaDisplay', favorite.areaId, favorite.areaName);

    // Use the global selectOption to trigger loading departments
    const shiftsWindow = window as unknown as ShiftsWindow;
    shiftsWindow.selectOption('area', String(favorite.areaId), favorite.areaName);
  }

  // Helper: Set department context and display
  private async setDepartmentContext(favorite: ShiftFavorite): Promise<void> {
    console.info('[LOADFAVORITE] Setting department:', favorite.departmentId, favorite.departmentName);
    this.selectedContext.departmentId = favorite.departmentId;
    this.updateDisplayElement('departmentDisplay', favorite.departmentId, favorite.departmentName);

    // Load machines for this department
    console.info('[LOADFAVORITE] Loading machines for department');
    await this.loadMachines();
  }

  // Helper: Set machine context and display
  private async setMachineContext(favorite: ShiftFavorite): Promise<void> {
    this.selectedContext.machineId = favorite.machineId;
    this.updateDisplayElement('machineDisplay', favorite.machineId, favorite.machineName);

    // Load teams for this machine but WITHOUT resetting teamId
    const savedTeamId = favorite.teamId;
    await this.onMachineSelected(favorite.machineId);
    // Restore team ID after onMachineSelected resets it
    this.selectedContext.teamId = savedTeamId;
  }

  // Helper: Set team context and display
  private async setTeamContext(favorite: ShiftFavorite): Promise<void> {
    this.updateDisplayElement('teamDisplay', favorite.teamId, favorite.teamName);

    console.info('[LOADFAVORITE] Loading preferences directly for team:', favorite.teamId);
    await this.loadUserPreferencesFromDatabase();

    try {
      await this.onTeamSelected(favorite.teamId);
      console.info('[LOADFAVORITE] onTeamSelected completed successfully');
    } catch (teamError) {
      console.error('[LOADFAVORITE] Error in onTeamSelected:', teamError);
    }
  }

  private async loadFavorite(favorite: ShiftFavorite): Promise<void> {
    console.info('[LOADFAVORITE] Starting to load favorite:', favorite);
    console.info('[LOADFAVORITE] Current favorites list:', this.favorites);
    console.info('[LOADFAVORITE] Initial context:', this.selectedContext);

    try {
      // 1. Set and load Area
      this.setAreaContext(favorite);

      // 2. Set and load Department
      await this.setDepartmentContext(favorite);

      // 3. Set and load Machine
      await this.setMachineContext(favorite);

      // 4. Set and load Team
      await this.setTeamContext(favorite);

      // Update button visibility (should hide since we loaded a favorited combination)
      console.info('[LOADFAVORITE] Final context before button update:', this.selectedContext);
      console.info('[LOADFAVORITE] Updating add favorite button visibility');

      // Small delay to ensure DOM is updated
      setTimeout(() => {
        console.info('[LOADFAVORITE] In timeout - context:', this.selectedContext);
        this.updateAddFavoriteButton();
      }, 100);

      // NOTE: togglePlanningAreaVisibility wird bereits in onTeamSelected aufgerufen
      // Kein doppelter Aufruf nötig!

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
    this.ensureFavoritesContainer();

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
      if (fav.id === '' || fav.teamName === '') {
        console.warn('Skipping invalid favorite:', fav);
        return;
      }

      const button = this.createFavoriteButton(fav);
      favoritesList.append(button);
    });

    // Show/hide add to favorites button based on team selection
    this.updateAddFavoriteButton();
  }

  private ensureFavoritesContainer(): void {
    const existing = document.querySelector('#favoritesContainer');
    if (existing) return;

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
  }

  private createFavoriteButton(fav: ShiftFavorite): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'favorite-btn';
    button.dataset.favoriteId = String(fav.id);
    button.title = `${fav.areaName} → ${fav.departmentName} → ${fav.machineName} → ${fav.teamName}`;

    // Add team name text
    button.append(document.createTextNode(fav.teamName));

    // Add remove button
    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-favorite';
    removeBtn.dataset.favoriteId = String(fav.id);
    removeBtn.textContent = '×';
    button.append(removeBtn);

    // Add click event listener
    button.addEventListener('click', (e) => {
      this.handleFavoriteClick(e, button);
    });

    return button;
  }

  private handleFavoriteClick(e: Event, button: HTMLButtonElement): void {
    console.info('[FAVORITE DEBUG] Button clicked!', e.target);
    const target = e.target as HTMLElement;

    if (target.classList.contains('remove-favorite')) {
      console.info('[FAVORITE DEBUG] Remove button clicked, favId:', target.dataset.favoriteId);
      e.stopPropagation();
      const favId = target.dataset.favoriteId;
      if (favId !== undefined && favId !== '') void this.removeFavorite(favId);
    } else {
      // Load the favorite
      const favId = button.dataset.favoriteId;
      console.info('[FAVORITE DEBUG] Loading favorite with ID:', favId, 'Type:', typeof favId);
      console.info('[FAVORITE DEBUG] All favorites:', this.favorites);
      console.info(
        '[FAVORITE DEBUG] Favorite IDs in list:',
        this.favorites.map((f) => ({ id: f.id, stringId: String(f.id), type: typeof f.id })),
      );
      const favorite = this.favorites.find((f) => String(f.id) === favId);
      console.info('[FAVORITE DEBUG] Found favorite:', favorite);
      if (favorite) {
        console.info('[FAVORITE DEBUG] Calling loadFavorite with:', favorite);
        void this.loadFavorite(favorite);
      } else {
        console.error('[FAVORITE DEBUG] Favorite not found!');
      }
    }
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
      console.info('[FAVORITE CHECK] Missing context values:', this.selectedContext);
      return false;
    }

    const result = this.favorites.some((fav) => {
      const match =
        fav.areaId === this.selectedContext.areaId &&
        fav.departmentId === this.selectedContext.departmentId &&
        fav.machineId === this.selectedContext.machineId &&
        fav.teamId === this.selectedContext.teamId;

      if (match) {
        console.info('[FAVORITE CHECK] Found matching favorite:', {
          favorite: fav,
          context: this.selectedContext,
        });
      }

      return match;
    });

    console.info('[FAVORITE CHECK] Combination check result:', {
      isFavorited: result,
      currentContext: this.selectedContext,
      totalFavorites: this.favorites.length,
    });

    return result;
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
      fullContext: this.selectedContext,
      teamId: this.selectedContext.teamId,
      isFavorited,
      shouldShowButton,
      buttonExists: addBtn !== null,
      favoritesCount: this.favorites.length,
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
        btn.dataset.action = 'add-to-favorites';
        btn.innerHTML = '⭐ Zu Favoriten hinzufügen';

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

  // Store value in data attribute on display element (no hidden input anymore)
  const displayElement = document.querySelector(`#${type}Display`);
  if (displayElement instanceof HTMLElement) {
    setData(displayElement, 'value', value);
    displayElement.classList.remove('active');
  }

  // Trigger custom event for selection change
  const changeEvent = new CustomEvent('dropdownChange', {
    detail: { type, value, text },
    bubbles: true,
  });
  displayElement?.dispatchEvent(changeEvent);

  // Close dropdown
  const dropdown = document.querySelector(`#${type}Dropdown`);
  if (dropdown) {
    dropdown.classList.remove('active');
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
