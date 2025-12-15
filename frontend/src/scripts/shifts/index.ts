/* eslint-disable max-lines */
/**
 * Shift Planning System - Main Orchestrator
 *
 * This file orchestrates all shift planning functionality by importing
 * and coordinating specialized modules. Business logic lives in:
 * - data-processing.ts: Data transformation
 * - week-renderer.ts: Week rendering
 * - lock-mode.ts: Edit mode and lock state
 * - handlers/*.ts: Event handlers
 *
 * @module shifts/index
 */

import type { ShiftFavorite, User } from './types';
import { showInfo } from '../auth/index';
import { showErrorAlert, showConfirmWarning } from '../utils/alerts';
import { $$id, setData } from '../../utils/dom-utils';
import {
  getCurrentWeek,
  setCurrentWeek,
  getSelectedContext,
  getEmployees,
  setAreas,
  getAreas,
  getDepartments,
  getMachines,
  getTeams,
  getFavorites,
  setFavorites,
  isAdmin as getIsAdmin,
  setIsAdmin,
  setUserRole,
  setCurrentUserId,
  setHasFullAccess,
  canEditShifts,
  isEditMode as getIsEditMode,
  getCurrentPlanId,
  setAutofillConfig,
  isContextComplete,
  setSelectedContext,
  setEmployees,
} from './state';
import { fetchCurrentUser, fetchAreas, fetchTeamMembers } from './api';
import { populateDropdown, updateDropdownDisplay, setDropdownDisabled, renderEmployeesList } from './ui';
import {
  setupWeekNavigation,
  setupAdminActions,
  setupCheckboxHandler,
  setupGlobalActionHandler,
  setupKeyboardShortcut,
  setupCustomDropdown,
} from './events';
import {
  setupGlobalDragStart,
  setupGlobalDragEnd,
  setupGlobalDragOver,
  setupGlobalDragLeave,
  setupGlobalDrop,
} from './drag-drop';
import { hideRotationModal } from './modals';
import {
  loadFavorites,
  addToFavorites,
  removeFavorite,
  renderFavoritesList,
  ensureFavoritesContainer,
  getFavoritesListElement,
} from './favorites';
import { addWeeks } from './utils';
import { DROPDOWN_PLACEHOLDERS, DOM_IDS } from './constants';
import { initDropdownListeners } from './filters';
import { customRotationManager } from './custom-rotation';
import {
  handleRotationToggle,
  handleSaveRotation,
  updateRotationPatternInfo,
  setRenderWeekCallback as setRotationRenderWeekCallback,
} from './rotation';
import { renderCurrentWeek, setApplyLockStateCallback } from './week-renderer';
import { applyPlanLockState, setSaveScheduleCallback } from './lock-mode';
import {
  handleDropdownChange,
  handleShiftDrop,
  handleRemoveShiftAction,
  handleSaveSchedule,
  handleResetSchedule,
  handleDiscardWeek,
  handleDiscardTeamPlan,
  setDropdownRenderWeekCallback,
  setSaveContextCallback,
  setSaveDiscardRenderWeekCallback,
  setSaveDiscardApplyLockStateCallback,
  loadFavoriteWithDropdowns,
  setFavoritesSaveContextCallback,
} from './handlers';

// ============== EMPLOYEE TEAM INFO ==============

/**
 * Employee team hierarchy from /users/me endpoint
 * Used for auto-loading employee's shift plan
 */
interface EmployeeTeamInfo {
  teamId: number;
  teamName: string;
  departmentId: number;
  departmentName: string;
  areaId: number;
  areaName: string;
  machineId?: number;
  machineName?: string;
}

let employeeTeamInfo: EmployeeTeamInfo | null = null;

// ============== INITIALIZATION ==============

/**
 * Initialize the shift planning system
 */
async function init(): Promise<void> {
  console.info('[SHIFTS] Initializing Shift Planning System...');

  // Clear any stale context from previous sessions
  localStorage.removeItem('shifts_context');

  try {
    // 1. Register callbacks for modules (avoid circular imports)
    registerModuleCallbacks();

    // 2. Load user data and set permissions
    const user = await initializeUserData();

    // 3. Check if employee with team assignment -> special read-only view
    const isEmployeeWithTeam = user?.role === 'employee' && employeeTeamInfo !== null;
    const isEmployeeWithoutTeam = user?.role === 'employee' && employeeTeamInfo === null;

    if (isEmployeeWithTeam || isEmployeeWithoutTeam) {
      // EMPLOYEE VIEW: Remove admin UI and auto-load team plan
      console.info('[SHIFTS] Detected employee user - setting up read-only view');

      // Setup employee view (removes admin UI, shows team info)
      await setupEmployeeView();

      // Setup minimal event listeners (only week navigation for employees)
      setupWeekNavigation(
        () => void navigateWeek(-1),
        () => void navigateWeek(1),
      );

      // Register render callback for rotation module
      setRotationRenderWeekCallback(() => renderCurrentWeek());

      // Render the employee's team shift plan
      await renderCurrentWeek();

      // Render employees list for sidebar
      const employees = getEmployees();
      if (employees.length > 0) {
        renderEmployeesList(employees);
      }

      console.info('[SHIFTS] Employee view initialization complete');
      return;
    }

    // ADMIN/ROOT VIEW: Full functionality
    console.info('[SHIFTS] Admin/Root user - setting up full view');

    // Show admin UI elements (hidden by default to prevent flicker for employees)
    showAdminUI();

    // 3. Load hierarchy data (areas, departments, machines, teams)
    await loadHierarchyData();

    // 4. Load favorites
    await initializeFavorites();

    // 5. Setup event listeners
    setupEventListeners();

    // 6. Setup drag and drop
    setupDragAndDrop();

    // 7. Initialize Custom Rotation (2-week pattern) system
    customRotationManager.init();

    // 8. Register render callback for rotation module
    setRotationRenderWeekCallback(() => renderCurrentWeek());

    // 9. Render initial week (empty - no shifts until team selected)
    await renderCurrentWeek();

    console.info('[SHIFTS] Initialization complete');
  } catch (error) {
    console.error('[SHIFTS] Initialization failed:', error);
    showErrorAlert('Fehler beim Laden der Schichtplanung');
  }
}

/**
 * Register callbacks for modules to avoid circular imports
 */
function registerModuleCallbacks(): void {
  // week-renderer needs applyPlanLockState
  setApplyLockStateCallback(applyPlanLockState);

  // lock-mode needs handleSaveSchedule
  setSaveScheduleCallback(handleSaveSchedule);

  // dropdown handler needs renderCurrentWeek and saveContextToStorage
  setDropdownRenderWeekCallback(() => renderCurrentWeek());
  setSaveContextCallback(saveContextToStorage);

  // save-discard handler needs renderCurrentWeek and applyPlanLockState
  setSaveDiscardRenderWeekCallback(() => renderCurrentWeek());
  setSaveDiscardApplyLockStateCallback(applyPlanLockState);

  // favorites handler needs saveContextToStorage
  setFavoritesSaveContextCallback(saveContextToStorage);
}

/**
 * Initialize user data and permissions
 * Returns the user object for further processing
 */
async function initializeUserData(): Promise<User | null> {
  const user = await fetchCurrentUser();

  if (user === null) {
    console.warn('[SHIFTS] No user data available');
    return null;
  }

  // Set user info in state
  setCurrentUserId(user.id);
  setUserRole(user.role);
  setIsAdmin(user.role === 'admin' || user.role === 'root');

  // Set full access flag (can be boolean or number from API)
  const hasAccess = user.hasFullAccess === true || user.hasFullAccess === 1;
  setHasFullAccess(hasAccess);

  // Update UI with user info
  const userNameDisplay = $$id('user-name-display');
  if (userNameDisplay !== null) {
    userNameDisplay.textContent = user.username;
  }

  // EMPLOYEE TEAM INFO: Extract team hierarchy for employees
  if (user.role === 'employee' && user.teamId !== undefined) {
    employeeTeamInfo = {
      teamId: user.teamId,
      teamName: user.teamName ?? 'Unbekanntes Team',
      departmentId: user.teamDepartmentId ?? 0,
      departmentName: user.teamDepartmentName ?? 'Unbekannte Abteilung',
      areaId: user.teamAreaId ?? 0,
      areaName: user.teamAreaName ?? 'Unbekannter Bereich',
    };
    console.info('[SHIFTS] Employee team info extracted:', employeeTeamInfo);
  }

  console.info('[SHIFTS] User initialized:', user.username, 'Role:', user.role, 'hasFullAccess:', hasAccess);
  return user;
}

/**
 * Load hierarchy data with cascading logic
 */
async function loadHierarchyData(): Promise<void> {
  const areas = await fetchAreas();
  setAreas(areas);

  populateDropdown('areaDropdown', areas, 'area', 'Keine Bereiche verfügbar');

  // Disable dependent dropdowns until parent is selected
  setDropdownDisabled('department', true, DROPDOWN_PLACEHOLDERS.AWAIT_AREA);
  setDropdownDisabled('machine', true, DROPDOWN_PLACEHOLDERS.AWAIT_DEPARTMENT);
  setDropdownDisabled('team', true, DROPDOWN_PLACEHOLDERS.AWAIT_DEPARTMENT);

  console.info('[SHIFTS] Initial hierarchy loaded:', { areas: areas.length });
}

/**
 * Initialize favorites
 */
async function initializeFavorites(): Promise<void> {
  const favorites = await loadFavorites();
  setFavorites(favorites);

  const favoritesListElement = ensureFavoritesContainer();

  if (favoritesListElement !== null) {
    renderFavoritesList(
      favoritesListElement,
      favorites,
      (fav) => void handleFavoriteClick(fav),
      (id) => void handleFavoriteDelete(id),
    );
  }

  console.info('[SHIFTS] Favorites initialized:', favorites.length, 'items');
}

/**
 * Remove admin-only UI elements from DOM (security: don't just hide!)
 */
function removeAdminUIFromDOM(): void {
  const elementsToRemove = [
    $$id('admin-filter-controls'),
    $$id('favoritesContainer'),
    document.querySelector('.shift-controls'),
    $$id('adminActions'),
    document.querySelector('.employee-sidebar'),
  ];

  for (const element of elementsToRemove) {
    if (element !== null) {
      element.remove();
    }
  }

  // Adjust grid layout since sidebar is removed for employees
  const mainPlanningArea = document.querySelector<HTMLElement>('.main-planning-area');
  if (mainPlanningArea !== null) {
    mainPlanningArea.style.gridTemplateColumns = '1fr';
  }

  console.info('[SHIFTS] Admin UI elements removed from DOM');
}

/**
 * Show admin-only UI elements (hidden by default to prevent flicker)
 * NOTE: Only shows filter controls here. Planning UI (shift-controls,
 * mainPlanningArea, adminActions, employee-sidebar) is shown via
 * showPlanningUI() when team is selected or favorite is clicked.
 */
function showAdminUI(): void {
  // Only show filter controls - Planning UI stays hidden until team selected
  const filterControls = $$id('admin-filter-controls');
  if (filterControls !== null) {
    filterControls.classList.remove('u-hidden');
  }

  // Show department notice (prompts user to select filters)
  const departmentNotice = $$id('departmentNotice');
  if (departmentNotice !== null) {
    departmentNotice.classList.remove('hidden');
  }

  console.info('[SHIFTS] Admin filter controls shown (Planning UI hidden until team selected)');
}

/**
 * Show employee team info bar with team hierarchy
 */
function showEmployeeTeamInfoBar(teamInfo: EmployeeTeamInfo): void {
  const employeeInfoBar = $$id('employee-team-info');
  if (employeeInfoBar === null) return;

  employeeInfoBar.classList.remove('u-hidden');

  const teamNameEl = $$id('employee-team-name');
  const deptNameEl = $$id('employee-department-name');
  const areaNameEl = $$id('employee-area-name');

  if (teamNameEl !== null) teamNameEl.textContent = teamInfo.teamName;
  if (deptNameEl !== null) deptNameEl.textContent = teamInfo.departmentName;
  if (areaNameEl !== null) areaNameEl.textContent = teamInfo.areaName;
}

/**
 * Load team members and convert to Employee format
 */
async function loadEmployeeTeamMembers(teamId: number): Promise<void> {
  try {
    const teamMembers = await fetchTeamMembers(teamId);
    const employees = teamMembers.map((member) => ({
      id: member.id,
      username: member.username,
      firstName: member.firstName,
      lastName: member.lastName,
      email: '',
      role: 'employee' as const,
      tenantId: 0,
      isActive: 1 as const,
      createdAt: '',
      updatedAt: '',
      availabilityStatus: member.availabilityStatus,
      availabilityStart: member.availabilityStart,
      availabilityEnd: member.availabilityEnd,
    }));
    setEmployees(employees);
    console.info('[SHIFTS] Loaded', employees.length, 'team members');
  } catch (error) {
    console.error('[SHIFTS] Error loading team members:', error);
  }
}

/**
 * Show planning area and hide notice for employees
 */
function showEmployeePlanningArea(): void {
  const mainPlanningArea = $$id('mainPlanningArea');
  const weekNavigation = document.querySelector('.week-navigation');
  const departmentNotice = $$id('departmentNotice');

  if (mainPlanningArea !== null) mainPlanningArea.classList.remove('u-hidden');
  if (weekNavigation !== null) weekNavigation.classList.remove('u-hidden');
  if (departmentNotice !== null) departmentNotice.classList.add('hidden');
}

/**
 * Show "no team assigned" notice for employees without team
 */
function showNoTeamNotice(): void {
  const departmentNotice = $$id('departmentNotice');
  if (departmentNotice !== null) {
    departmentNotice.classList.remove('hidden');
    departmentNotice.innerHTML = `
      <div class="notice-icon"><i class="fas fa-exclamation-triangle"></i></div>
      <h3>Kein Team zugewiesen</h3>
      <p>Du bist noch keinem Team zugeordnet. Bitte wende dich an deinen Administrator.</p>
    `;
  }
}

/**
 * Setup Employee View - READ-ONLY mode
 */
async function setupEmployeeView(): Promise<void> {
  // Security: Always remove admin UI from DOM
  removeAdminUIFromDOM();

  if (employeeTeamInfo === null) {
    console.warn('[SHIFTS] Employee has no team assigned');
    showNoTeamNotice();
    return;
  }

  console.info('[SHIFTS] Setting up Employee View for team:', employeeTeamInfo.teamName);

  // Show team info bar
  showEmployeeTeamInfoBar(employeeTeamInfo);

  // Set context from employee's team info
  setSelectedContext({
    areaId: employeeTeamInfo.areaId,
    departmentId: employeeTeamInfo.departmentId,
    teamId: employeeTeamInfo.teamId,
    machineId: employeeTeamInfo.machineId ?? null,
    teamLeaderId: null,
  });

  // Load team members
  await loadEmployeeTeamMembers(employeeTeamInfo.teamId);

  // Show planning area
  showEmployeePlanningArea();

  console.info('[SHIFTS] Employee view setup complete');
}

// ============== EVENT LISTENERS ==============

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
  // Week navigation
  setupWeekNavigation(
    () => void navigateWeek(-1),
    () => void navigateWeek(1),
  );

  // Admin actions (save/reset)
  if (getIsAdmin()) {
    setupAdminActions(
      () => void handleSaveSchedule(),
      () => void handleResetSchedule(),
    );
  }

  // Checkbox handlers
  setupCheckboxHandler('shift-autofill', handleAutofillToggle);

  // Standard rotation toggle with mutual exclusion
  const standardRotationToggle = $$id(DOM_IDS.SHIFT_ROTATION) as HTMLInputElement | null;
  if (standardRotationToggle !== null) {
    standardRotationToggle.addEventListener('change', () => {
      void handleStandardRotationToggleWithExclusion(standardRotationToggle.checked);
    });
  }

  // Custom dropdown for rotation pattern
  setupCustomDropdown('rotation-pattern-trigger', 'rotation-pattern-menu', 'rotation-pattern', (value) => {
    updateRotationPatternInfo(value);
  });

  // Global action handlers
  const actionHandlers = new Map<string, (target: HTMLElement, event: Event) => void>();
  actionHandlers.set('add-to-favorites', () => void handleAddToFavoritesAction());
  actionHandlers.set('remove-shift', handleRemoveShiftAction);
  actionHandlers.set('close-modal', handleCloseModalAction);
  actionHandlers.set('close-rotation-modal', () => {
    hideRotationModal();
    const standardToggle = $$id(DOM_IDS.SHIFT_ROTATION) as HTMLInputElement | null;
    if (standardToggle !== null) {
      standardToggle.checked = false;
    }
  });
  actionHandlers.set('toggle-dropdown', handleToggleDropdownAction);
  actionHandlers.set('save-rotation', () => void handleSaveRotation());
  setupGlobalActionHandler(actionHandlers);

  // Save rotation button
  const saveRotationBtn = $$id('save-rotation-btn');
  if (saveRotationBtn !== null) {
    saveRotationBtn.addEventListener('click', () => void handleSaveRotation());
  }

  // Discard buttons
  const discardWeekBtn = $$id('discardWeekBtn');
  if (discardWeekBtn !== null) {
    discardWeekBtn.addEventListener('click', () => void handleDiscardWeek());
  }

  const discardTeamPlanBtn = $$id('discardTeamPlanBtn');
  if (discardTeamPlanBtn !== null) {
    discardTeamPlanBtn.addEventListener('click', () => void handleDiscardTeamPlan());
  }

  // Keyboard shortcuts
  setupKeyboardShortcut('s', { ctrl: true }, () => void handleSaveSchedule());
  setupKeyboardShortcut('Escape', {}, handleEscapeKey);

  // Dropdown listeners
  setupDropdownListeners();
}

/**
 * Setup dropdown change listeners
 */
function setupDropdownListeners(): void {
  initDropdownListeners();

  document.addEventListener('dropdownChange', (e: Event) => {
    const event = e as CustomEvent<{ type: string; value: string; text: string }>;
    const { type, value } = event.detail;
    void handleDropdownChange(type, value);
  });

  // Listen for custom rotation refresh requests
  document.addEventListener('shiftsNeedRefresh', () => {
    console.info('[SHIFTS] Refresh requested via custom event');
    void renderCurrentWeek();
  });
}

// ============== DRAG AND DROP ==============

/**
 * Setup drag and drop functionality
 */
function setupDragAndDrop(): void {
  setupGlobalDragStart(
    () => {
      const canEdit = canEditShifts();
      const currentPlanId = getCurrentPlanId();
      const isEditMode = getIsEditMode();
      return canEdit && (currentPlanId === null || isEditMode);
    },
    (employeeId: string) => {
      console.info('[SHIFTS] Drag started:', employeeId);
    },
    () => {
      if (!canEditShifts()) {
        showInfo('Keine Berechtigung zum Bearbeiten (nur Team-Lead oder Admin)');
      } else {
        const currentPlanId = getCurrentPlanId();
        if (currentPlanId !== null) {
          showInfo('Bearbeitungsmodus nicht aktiv - Klicken Sie auf "Bearbeiten"');
        }
      }
    },
  );

  setupGlobalDragEnd(() => {
    console.info('[SHIFTS] Drag ended');
  });

  setupGlobalDragOver();
  setupGlobalDragLeave();

  setupGlobalDrop((employeeId, cell) => void handleShiftDrop(employeeId, cell));
}

// ============== NAVIGATION ==============

/**
 * Navigate to previous or next week
 */
async function navigateWeek(direction: number): Promise<void> {
  const currentWeek = getCurrentWeek();
  const newWeek = addWeeks(currentWeek, direction);
  setCurrentWeek(newWeek);

  await renderCurrentWeek();

  const employees = getEmployees();
  if (employees.length > 0) {
    renderEmployeesList(employees);
    applyPlanLockState();
  }
}

// ============== TOGGLE HANDLERS ==============

/**
 * Handle autofill toggle
 */
function handleAutofillToggle(enabled: boolean): void {
  setAutofillConfig({ enabled });
  if (enabled) {
    showInfo('Autofill aktiviert: Woche wird automatisch ausgefüllt beim Zuweisen');
  } else {
    showInfo('Autofill deaktiviert');
  }
  console.info('[SHIFTS] Autofill:', enabled ? 'enabled' : 'disabled');
}

/**
 * Handle Standard rotation toggle with mutual exclusion
 */
async function handleStandardRotationToggleWithExclusion(wantsEnabled: boolean): Promise<void> {
  const standardToggle = $$id(DOM_IDS.SHIFT_ROTATION) as HTMLInputElement | null;
  const customToggle = $$id('shift-custom-rotation') as HTMLInputElement | null;

  if (!wantsEnabled) {
    handleRotationToggle(false);
    return;
  }

  if (customToggle?.checked === true) {
    const confirmed = await showConfirmWarning(
      'Standard und Benutzerdefiniert können nicht gleichzeitig aktiv sein. Möchten Sie zu Standard wechseln?',
      'Rotationsmodus wechseln',
    );

    if (confirmed) {
      customToggle.checked = false;
      customToggle.dispatchEvent(new Event('change'));
      handleRotationToggle(true);
    } else {
      if (standardToggle !== null) {
        standardToggle.checked = false;
      }
    }
    return;
  }

  handleRotationToggle(true);
}

// ============== FAVORITES HANDLERS ==============

/**
 * Handle click on a favorite
 */
async function handleFavoriteClick(favorite: ShiftFavorite): Promise<void> {
  console.info('[SHIFTS] Loading favorite:', favorite.name);
  await loadFavoriteWithDropdowns(favorite);
}

/**
 * Handle deleting a favorite
 */
async function handleFavoriteDelete(favoriteId: string | number): Promise<void> {
  const result = await removeFavorite(favoriteId, getFavorites());
  if (result.success) {
    setFavorites(result.favorites);
    const listElement = getFavoritesListElement();
    if (listElement !== null) {
      renderFavoritesList(
        listElement,
        result.favorites,
        (fav) => void handleFavoriteClick(fav),
        (id) => void handleFavoriteDelete(id),
      );
    }
  }
}

/**
 * Handle adding current context to favorites
 */
async function handleAddToFavoritesAction(): Promise<void> {
  if (!isContextComplete()) {
    showErrorAlert('Bitte wählen Sie zuerst alle Filter aus (Bereich, Abteilung, Maschine, Team)');
    return;
  }

  const result = await addToFavorites(
    getSelectedContext(),
    getFavorites(),
    getAreas(),
    getDepartments(),
    getMachines(),
    getTeams(),
  );

  if (result.success) {
    setFavorites(result.favorites);
    const listElement = getFavoritesListElement();
    if (listElement !== null) {
      renderFavoritesList(
        listElement,
        result.favorites,
        (fav) => void handleFavoriteClick(fav),
        (id) => void handleFavoriteDelete(id),
      );
    }
  }
}

// ============== MODAL/UI HANDLERS ==============

/**
 * Handle closing modals
 */
function handleCloseModalAction(): void {
  const modals = document.querySelectorAll('.modal.active, .modal[style*="display: flex"]');
  modals.forEach((modal) => {
    (modal as HTMLElement).style.display = 'none';
    modal.classList.remove('active');
  });
  hideRotationModal();

  const standardToggle = $$id(DOM_IDS.SHIFT_ROTATION) as HTMLInputElement | null;
  if (standardToggle !== null) {
    standardToggle.checked = false;
  }
}

/**
 * Handle toggling dropdowns
 */
function handleToggleDropdownAction(target: HTMLElement): void {
  const dropdownId = target.dataset['dropdown'];
  if (dropdownId === undefined) return;

  const dropdown = $$id(dropdownId);
  if (dropdown === null) return;

  dropdown.classList.toggle('active');
  target.classList.toggle('active');
}

/**
 * Handle Escape key press
 */
function handleEscapeKey(): void {
  document.querySelectorAll('.dropdown.active').forEach((el) => {
    el.classList.remove('active');
  });
  handleCloseModalAction();
}

// ============== CONTEXT PERSISTENCE ==============

/**
 * Save context to localStorage
 */
function saveContextToStorage(): void {
  const context = getSelectedContext();
  localStorage.setItem('shifts_context', JSON.stringify(context));
}

// ============== GLOBAL EXPORTS ==============

/**
 * Global function for dropdown selection (called from HTML onclick)
 */
function selectOption(type: string, value: string, text: string): void {
  updateDropdownDisplay(type, text);

  const displayElement = $$id(`${type}Display`);
  if (displayElement !== null) {
    setData(displayElement, 'value', value);
  }

  const changeEvent = new CustomEvent('dropdownChange', {
    detail: { type, value, text },
    bubbles: true,
  });
  displayElement?.dispatchEvent(changeEvent);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  void init();
});

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  interface ShiftsWindow extends Window {
    selectOption: typeof selectOption;
  }
  (window as unknown as ShiftsWindow).selectOption = selectOption;
}
