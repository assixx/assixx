/* eslint-disable max-lines */
/**
 * Custom Rotation View - 2-Week Shift Planning
 * Extends the existing shift system with flexible 2-week patterns
 */

import { $$id } from '../../utils/dom-utils';
import { showConfirmWarning, showSuccessAlert, showErrorAlert } from '../utils/alerts';
import {
  DaySchedule,
  WeekData,
  CustomRotationPattern,
  PATTERN_TEMPLATES,
  SHIFT_ROW_SELECTOR,
  ShiftType,
  NthWeekdayFreeRule,
  EmployeeAssignment,
  ShiftGroup,
  GenerateRotationRequest,
} from './custom-rotation-types';
import { setupCustomDropdown } from './events';
import { setCurrentWeek } from './state';

class CustomRotationManager {
  /**
   * Change pattern - opens modal again
   */
  changePattern(): void {
    this.showPatternSelectionModal();
  }
  private currentWeek: 1 | 2 = 1;
  private week1Data: WeekData = {};
  private week2Data: WeekData = {};
  // TODO: Implement 3 and 4 week cycles
  // @ts-expect-error - Reserved for future 3-4 week cycles
  private week3Data: WeekData = {};
  // @ts-expect-error - Reserved for future 3-4 week cycles
  private week4Data: WeekData = {};
  private isActive = false;
  private selectedPattern: CustomRotationPattern | null = null;

  // Team members for rotation generation (loaded when modal opens)
  private teamMembers: { id: number; firstName: string; lastName: string }[] = [];

  // DOM Elements
  private checkbox: HTMLInputElement | null = null;
  private week2Headers: HTMLElement[] = [];
  private saveBtn: HTMLElement | null = null;
  private patternModal: HTMLElement | null = null;

  // Constants
  private readonly SCHEDULE_HEADER_SELECTOR = '.schedule-header';

  // Bound event handler for scroll detection
  private scrollHandler = (): void => {
    this.detectCurrentWeekFromScroll();
  };

  /**
   * Initialize the Custom Rotation system
   */
  init(): void {
    this.setupDOM();
    this.setupEventListeners();
    this.createWeek2Headers();

    // Keep legacy method reference to prevent TS6133 unused warning
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    void this.selectPatternLegacy;
  }

  /**
   * Setup DOM element references
   */
  private setupDOM(): void {
    const checkboxElement = document.querySelector('#shift-custom-rotation');
    const saveBtnElement = document.querySelector('#saveScheduleBtn');

    if (checkboxElement instanceof HTMLInputElement) {
      this.checkbox = checkboxElement;
    } else {
      console.error('Custom Rotation checkbox not found - need to add to HTML first');
    }

    if (saveBtnElement instanceof HTMLElement) {
      this.saveBtn = saveBtnElement;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    console.log('🎯 setupEventListeners called');
    // Checkbox toggle
    if (this.checkbox !== null) {
      console.log('✅ Adding change listener to checkbox');
      this.checkbox.addEventListener('change', () => {
        console.log('📌 Checkbox change event triggered!');
        void this.handleCheckboxToggle();
      });
    } else {
      console.error('❌ Cannot add event listener - checkbox is null!');
    }

    // Save button integration
    if (this.saveBtn !== null) {
      this.saveBtn.addEventListener('click', (e) => {
        if (this.isActive) {
          e.preventDefault();
          e.stopPropagation();
          void this.handleSave();
        }
        // If not active, let normal save handler proceed
      });
    }
  }

  /**
   * Handle checkbox toggle - show/hide Custom Rotation mode
   * Includes mutual exclusion with Standard rotation toggle
   */
  private async handleCheckboxToggle(): Promise<void> {
    console.log('🔧 handleCheckboxToggle called');
    if (this.checkbox === null) {
      console.error('❌ Checkbox is null!');
      return;
    }

    const wantsEnabled = this.checkbox.checked;
    console.log(`📊 Checkbox wants: ${wantsEnabled ? 'ON' : 'OFF'}`);

    // If turning OFF, just proceed
    if (!wantsEnabled) {
      console.log('❌ Disabling Custom Rotation mode');
      this.isActive = false;
      this.disableCustomRotationMode();
      return;
    }

    // If turning ON, check if Standard is already ON
    const standardToggle = $$id('shift-rotation') as HTMLInputElement | null;
    if (standardToggle?.checked === true) {
      const confirmed = await showConfirmWarning(
        'Standard und Benutzerdefiniert können nicht gleichzeitig aktiv sein. Möchten Sie zu Benutzerdefiniert wechseln?',
        'Rotationsmodus wechseln',
      );

      if (confirmed) {
        // Turn off Standard first
        standardToggle.checked = false;
        standardToggle.dispatchEvent(new Event('change'));
        // Then enable Custom
        this.isActive = true;
        console.log('✅ Enabling Custom Rotation mode - showing modal');
        this.showPatternSelectionModal();
      } else {
        // User cancelled - revert toggle
        this.checkbox.checked = false;
        this.isActive = false;
      }
      return;
    }

    // No conflict - proceed normally
    this.isActive = true;
    console.log('✅ Enabling Custom Rotation mode - showing modal');
    this.showPatternSelectionModal();
  }

  /**
   * Show pattern selection modal (uses static HTML modal from shifts.html)
   */
  private showPatternSelectionModal(): void {
    console.log('📋 showPatternSelectionModal called');

    // Get static modal from DOM
    this.patternModal = $$id('custom-rotation-modal');

    if (this.patternModal === null) {
      console.error('❌ Custom Rotation pattern modal not found in HTML!');
      return;
    }

    // Setup date inputs and populate pattern cards
    this.initializeModalContent();

    // Setup event listeners (only once)
    const listenersSetup = this.patternModal.dataset['listenersSetup'];
    if (listenersSetup === undefined || listenersSetup === '') {
      this.setupPatternModalListeners();
      this.patternModal.dataset['listenersSetup'] = 'true';
    }

    // Load team members for assignment section
    void this.loadTeamMembers();

    // Show modal - Design System uses modal-overlay--active class
    console.log('👁️ Adding modal-overlay--active class');
    this.patternModal.classList.add('modal-overlay--active');
  }

  /**
   * Initialize modal content (date inputs and pattern cards)
   * Uses static HTML modal from shifts.html - populates dynamic content only
   */
  private initializeModalContent(): void {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0] ?? '';

    // Setup date inputs
    const startDateInput = $$id('custom-rotation-start-date');
    const endDateInput = $$id('custom-rotation-end-date');

    if (startDateInput instanceof HTMLInputElement) {
      startDateInput.min = todayStr;
      startDateInput.value = todayStr;
    }

    if (endDateInput instanceof HTMLInputElement) {
      const endOfKW1 = this.getEndOfFirstWeekNextYear(today);
      const maxDate = new Date(today);
      maxDate.setMonth(today.getMonth() + 18);

      endDateInput.min = todayStr;
      endDateInput.max = maxDate.toISOString().split('T')[0] ?? '';
      endDateInput.value = endOfKW1.toISOString().split('T')[0] ?? '';
    }
  }

  /**
   * Setup event listeners for pattern modal (static HTML modal)
   */
  private setupPatternModalListeners(): void {
    if (this.patternModal === null) return;

    // Setup date input change handler
    const startDateInput = $$id('custom-rotation-start-date');
    const endDateInput = $$id('custom-rotation-end-date');

    if (startDateInput instanceof HTMLInputElement && endDateInput instanceof HTMLInputElement) {
      startDateInput.addEventListener('change', () => {
        endDateInput.min = startDateInput.value;

        // Update max to 1.5 years from start date
        const startDate = new Date(startDateInput.value);
        const newMaxDate = new Date(startDate);
        newMaxDate.setMonth(startDate.getMonth() + 18);
        endDateInput.max = newMaxDate.toISOString().split('T')[0] ?? '';
      });
    }

    // Close buttons (X and Cancel button use data-action="close-custom-rotation-modal")
    const closeButtons = this.patternModal.querySelectorAll('[data-action="close-custom-rotation-modal"]');
    closeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.closePatternModal();
      });
    });

    // Click outside to close (backdrop click)
    this.patternModal.addEventListener('click', (e) => {
      if (e.target === this.patternModal) {
        this.closePatternModal();
      }
    });

    // Generate button - collects config + assignments and calls backend
    const generateBtn = $$id('generate-rotation-btn');
    if (generateBtn !== null) {
      generateBtn.addEventListener('click', () => {
        void this.generateRotation();
      });
    }

    // Initialize custom dropdowns
    this.initializeCustomDropdowns();
  }

  /**
   * Initialize all custom dropdowns in the modal
   * Reuses setupCustomDropdown from events.ts for consistent behavior
   */
  private initializeCustomDropdowns(): void {
    // Setup each dropdown with the standard pattern: trigger, menu, hidden input
    setupCustomDropdown('start-shift-trigger', 'start-shift-menu', 'start-shift-select');
    setupCustomDropdown('shift-sequence-trigger', 'shift-sequence-menu', 'shift-sequence-select');
    setupCustomDropdown('nth-value-trigger', 'nth-value-menu', 'nth-value-select');
    setupCustomDropdown('weekday-value-trigger', 'weekday-value-menu', 'weekday-value-select');
  }

  /**
   * Get end of first week (Sunday) of next year
   */
  private getEndOfFirstWeekNextYear(fromDate: Date): Date {
    const nextYear = fromDate.getFullYear() + 1;
    // Find first Thursday of next year (determines KW1)
    const jan1 = new Date(nextYear, 0, 1);
    const dayOfWeek = jan1.getDay() === 0 ? 7 : jan1.getDay(); // Sunday = 7
    const daysToThursday = (4 - dayOfWeek + 7) % 7 === 0 ? 7 : (4 - dayOfWeek + 7) % 7;
    const firstThursday = new Date(nextYear, 0, 1 + daysToThursday);

    // Go to Sunday of that week
    const sundayKW1 = new Date(firstThursday);
    sundayKW1.setDate(firstThursday.getDate() + (7 - firstThursday.getDay()));

    return sundayKW1;
  }

  /**
   * Get number input value from DOM
   * @param id - Element ID
   * @returns Number value or null if not found/invalid
   */
  private getNumberInputValue(id: string): number | null {
    const input = $$id(id);
    if (input instanceof HTMLInputElement) {
      const value = Number.parseInt(input.value, 10);
      return Number.isNaN(value) ? null : value;
    }
    return null;
  }

  /**
   * Get select/hidden input value from DOM
   * Supports both native select elements and custom dropdowns with hidden inputs
   * @param id - Element ID
   * @returns Selected value or null if not found
   */
  private getSelectValue(id: string): string | null {
    const element = $$id(id);
    if (element instanceof HTMLSelectElement) {
      return element.value;
    }
    // Support custom dropdowns with hidden input
    if (element instanceof HTMLInputElement) {
      return element.value;
    }
    return null;
  }

  /**
   * Parse shift sequence string into array
   * @param value - Sequence string (e.g., 'early-late-night')
   * @returns Array of shift types
   */
  private parseShiftSequence(value: string): ShiftType[] {
    if (value === 'night-late-early') {
      return ['night', 'late', 'early'];
    }
    return ['early', 'late', 'night']; // Default forward rotation
  }

  /**
   * Collect special rules from modal inputs
   * @returns Array of special rules
   */
  private collectSpecialRules(): NthWeekdayFreeRule[] {
    const rules: NthWeekdayFreeRule[] = [];
    const checkbox = $$id('nth-weekday-free-checkbox');

    if (checkbox instanceof HTMLInputElement && checkbox.checked) {
      const nthValue = this.getNumberInputValue('nth-value-select');
      const weekdayValue = this.getNumberInputValue('weekday-value-select');

      if (nthValue !== null && weekdayValue !== null) {
        const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        // eslint-disable-next-line security/detect-object-injection -- weekdayValue is validated 0-6 from select input
        const weekdayName = weekdayNames[weekdayValue] ?? 'Tag';

        rules.push({
          type: 'nth_weekday_free',
          name: `Jeder ${nthValue}. ${weekdayName} frei`,
          weekday: weekdayValue,
          n: nthValue,
        });
      }
    }

    return rules;
  }

  /**
   * Select a pattern and enable Custom Rotation mode (LEGACY)
   * @deprecated - Legacy method, replaced by generateRotation() for new algorithm-based approach
   * Called by enableCustomRotationMode flow for backwards compatibility
   */
  private selectPatternLegacy(patternId: string): void {
    const template = PATTERN_TEMPLATES.find((t) => t.id === patternId);
    if (!template) return;

    // Get dates from modal inputs
    const startDateInput = $$id('custom-rotation-start-date');
    const endDateInput = $$id('custom-rotation-end-date');

    const startDate =
      (startDateInput instanceof HTMLInputElement ? startDateInput.value : null) ??
      new Date().toISOString().split('T')[0] ??
      '';
    const endDate =
      (endDateInput instanceof HTMLInputElement ? endDateInput.value : null) ??
      this.getEndOfFirstWeekNextYear(new Date()).toISOString().split('T')[0] ??
      '';

    // Read shift block configuration from modal inputs
    const shiftBlockLength = this.getNumberInputValue('shift-block-length') ?? 10;
    const freeDays = this.getNumberInputValue('free-days-count') ?? 2;
    const startShift = this.getSelectValue('start-shift-select') ?? 'early';
    const shiftSequenceValue = this.getSelectValue('shift-sequence-select') ?? 'early-late-night';
    const shiftSequence = this.parseShiftSequence(shiftSequenceValue);
    const specialRules = this.collectSpecialRules();

    // Store selected pattern with dates and shift block config
    this.selectedPattern = {
      name: template.name,
      patternType: 'auto-detect',
      cycleLengthWeeks: template.cycleWeeks !== 0 ? template.cycleWeeks : 2,
      employeeCount: template.employeeCount,
      patternConfig: {
        shiftBlockLength,
        freeDays,
        startShift: startShift as ShiftType,
        shiftSequence,
        specialRules: specialRules.length > 0 ? specialRules : undefined,
      },
      startsAt: startDate,
      endsAt: endDate,
    };

    console.info(`📋 Selected Custom Rotation pattern: ${template.name}`, this.selectedPattern);
    console.info(`📅 Period: ${startDate} to ${endDate}`);
    console.info(`🔧 Shift block config: ${shiftBlockLength} days work + ${freeDays} days free`);

    // Close modal
    this.closePatternModal();

    // Enable Custom Rotation mode
    this.enableCustomRotationMode();

    // Show pattern info
    this.showPatternInfo();
  }

  // ============================================================
  // NEW: Algorithm-based rotation generation
  // ============================================================

  /**
   * Main method: Generate rotation from config + employee assignments
   * Called when user clicks "Rotation generieren" button
   */
  private async generateRotation(): Promise<void> {
    console.info('🔄 Generating rotation...');

    // 1. Collect algorithm config from modal
    const config = this.collectAlgorithmConfig();
    if (config === null) {
      this.showError('Bitte füllen Sie alle Konfigurationsfelder aus.');
      return;
    }

    // 2. Collect employee assignments
    const assignments = this.collectEmployeeAssignments();
    if (assignments.length === 0) {
      this.showError('Bitte weisen Sie mindestens einem Mitarbeiter eine Schichtgruppe zu.');
      return;
    }

    // 3. Get date range
    const startDateInput = $$id('custom-rotation-start-date');
    const endDateInput = $$id('custom-rotation-end-date');
    const startDate = startDateInput instanceof HTMLInputElement ? startDateInput.value : '';
    const endDate = endDateInput instanceof HTMLInputElement ? endDateInput.value : '';

    if (startDate === '' || endDate === '') {
      this.showError('Bitte wählen Sie Start- und Enddatum.');
      return;
    }

    // 4. Get team/department IDs from current selection
    const teamId = this.getCurrentTeamId();
    const departmentId = this.getCurrentDepartmentId();

    // 5. Build request
    const request: GenerateRotationRequest = {
      config,
      assignments,
      startDate,
      endDate,
      teamId,
      departmentId,
    };

    console.info('📤 Sending rotation request:', request);

    try {
      // 6. Call backend API
      const response = await this.callGenerateRotationAPI(request);
      console.info('✅ Rotation generated:', response);

      // 7. Close modal and show success
      this.closePatternModal();
      this.showSuccessMessage(`Schichtplan erfolgreich generiert für ${assignments.length} Mitarbeiter.`);

      // 8. Navigate to the week containing the start date
      this.navigateToWeekContainingDate(startDate);

      // 9. Refresh the shifts view to show generated shifts
      this.refreshShiftsView();
    } catch (error) {
      console.error('❌ Failed to generate rotation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      this.showError(`Fehler beim Generieren: ${errorMessage}`);
    }
  }

  /**
   * Collect algorithm configuration from modal inputs
   */
  private collectAlgorithmConfig(): GenerateRotationRequest['config'] | null {
    const shiftBlockLength = this.getNumberInputValue('shift-block-length');
    const freeDays = this.getNumberInputValue('free-days-count');
    const startShift = this.getSelectValue('start-shift-select');
    const shiftSequenceValue = this.getSelectValue('shift-sequence-select');

    if (shiftBlockLength === null || freeDays === null) {
      return null;
    }
    if (startShift === null || shiftSequenceValue === null) {
      return null;
    }

    const shiftSequence = this.parseShiftSequence(shiftSequenceValue);
    const specialRules = this.collectSpecialRules();

    return {
      shiftBlockLength,
      freeDays,
      startShift: startShift as ShiftType,
      shiftSequence,
      specialRules: specialRules.length > 0 ? specialRules : undefined,
    };
  }

  /**
   * Collect employee assignments from the UI
   */
  private collectEmployeeAssignments(): EmployeeAssignment[] {
    const assignments: EmployeeAssignment[] = [];

    // Read from each drop zone
    const zones: { id: string; group: ShiftGroup }[] = [
      { id: 'custom-drop-zone-f', group: 'F' },
      { id: 'custom-drop-zone-s', group: 'S' },
      { id: 'custom-drop-zone-n', group: 'N' },
    ];

    zones.forEach(({ id, group }) => {
      const zone = $$id(id);
      if (zone === null) return;

      const items = zone.querySelectorAll('.employee-item');
      items.forEach((item) => {
        const employeeIdAttr = item.getAttribute('data-employee-id');
        const employeeNameAttr = item.getAttribute('data-employee-name');

        if (employeeIdAttr !== null && employeeNameAttr !== null) {
          const userId = Number.parseInt(employeeIdAttr, 10);
          if (!Number.isNaN(userId)) {
            assignments.push({ userId, userName: employeeNameAttr, startGroup: group });
          }
        }
      });
    });

    return assignments;
  }

  /**
   * Load team members when modal opens
   */
  async loadTeamMembers(): Promise<void> {
    const teamId = this.getCurrentTeamId();
    console.log('🔍 loadTeamMembers - teamId:', teamId);
    if (teamId === undefined) {
      console.warn('No team selected, cannot load members');
      return;
    }

    try {
      const accessToken = localStorage.getItem('accessToken') ?? '';
      const response = await fetch(`/api/v2/teams/${teamId}/members`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        data: { id: number; firstName: string; lastName: string }[];
      };
      this.teamMembers = data.data.map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
      }));

      console.info(`📥 Loaded ${this.teamMembers.length} team members`);
      this.populateEmployeeAssignmentList();
    } catch (error) {
      console.error('Failed to load team members:', error);
      this.teamMembers = [];
    }
  }

  /**
   * Populate the employee assignment list UI with draggable items
   */
  private populateEmployeeAssignmentList(): void {
    const container = $$id('custom-available-employees');
    if (container === null) return;

    // Clear drop zones
    this.clearDropZones();

    if (this.teamMembers.length === 0) {
      // Safe: static content
      container.innerHTML = `
        <div class="text-[var(--color-text-tertiary)] text-sm italic py-2">
          <i class="fas fa-info-circle mr-1"></i>
          Keine Teammitglieder gefunden.
        </div>
      `;
      return;
    }

    // Render employees as draggable items
    // Safe: content from API, user names are text-only
    // eslint-disable-next-line no-unsanitized/property
    container.innerHTML = this.teamMembers
      .map((member) => {
        const fullName = `${member.firstName} ${member.lastName}`;
        return `
        <div class="employee-item" data-employee-id="${member.id}" data-employee-name="${fullName}" draggable="true">
          <div class="employee-info">
            <span class="employee-name">${fullName}</span>
          </div>
        </div>
      `;
      })
      .join('');

    // Setup drag-and-drop
    this.setupCustomDragDrop();
  }

  /**
   * Clear all drop zones
   */
  private clearDropZones(): void {
    ['custom-drop-zone-f', 'custom-drop-zone-s', 'custom-drop-zone-n'].forEach((id) => {
      const zone = $$id(id);
      if (zone !== null) zone.innerHTML = '';
    });
  }

  /**
   * Setup drag-and-drop event listeners for custom rotation modal
   */
  private setupCustomDragDrop(): void {
    const availableContainer = $$id('custom-available-employees');
    const zoneF = $$id('custom-drop-zone-f');
    const zoneS = $$id('custom-drop-zone-s');
    const zoneN = $$id('custom-drop-zone-n');
    const dropZones = [zoneF, zoneS, zoneN].filter((z): z is HTMLElement => z !== null);

    if (availableContainer === null) return;

    // Setup dragstart on employee items
    const employeeItems = availableContainer.querySelectorAll('.employee-item');
    employeeItems.forEach((item) => {
      item.addEventListener('dragstart', (e: Event) => {
        const dragEvent = e as DragEvent;
        const target = dragEvent.target as HTMLElement;
        const employeeId = target.getAttribute('data-employee-id');
        if (employeeId !== null && dragEvent.dataTransfer !== null) {
          dragEvent.dataTransfer.setData('text/plain', employeeId);
          target.classList.add('dragging');
        }
      });
      item.addEventListener('dragend', (e: Event) => {
        const target = e.target as HTMLElement;
        target.classList.remove('dragging');
      });
    });

    // Setup drop zones
    dropZones.forEach((zone) => {
      zone.addEventListener('dragover', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', (e: Event) => {
        e.stopPropagation();
        zone.classList.remove('drag-over');
      });
      zone.addEventListener('drop', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        zone.classList.remove('drag-over');
        const dragEvent = e as DragEvent;
        if (dragEvent.dataTransfer === null) return;

        const employeeId = dragEvent.dataTransfer.getData('text/plain');
        this.moveEmployeeToZone(employeeId, zone);
      });
    });

    // Also setup available container as drop target (to move back)
    availableContainer.addEventListener('dragover', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    });
    availableContainer.addEventListener('drop', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const dragEvent = e as DragEvent;
      if (dragEvent.dataTransfer === null) return;
      const employeeId = dragEvent.dataTransfer.getData('text/plain');
      this.moveEmployeeToAvailable(employeeId);
    });
  }

  /**
   * Move an employee item to a shift zone
   * Includes duplicate validation to prevent same employee in multiple zones
   */
  private moveEmployeeToZone(employeeId: string, zone: HTMLElement): void {
    // IMPORTANT: Search only within the custom-rotation-modal to avoid conflicts
    const modal = this.patternModal;
    if (modal === null) return;

    // Check if employee is already in THIS zone (prevent duplicate in same zone)
    const existingInZone = zone.querySelector(`.employee-item[data-employee-id="${employeeId}"]`);
    if (existingInZone !== null) {
      console.warn(`[CUSTOM-ROTATION] Employee ${employeeId} already in this zone - ignoring`);
      return;
    }

    // Find the employee item within the modal (could be in available or another zone)
    const item = modal.querySelector(`.employee-item[data-employee-id="${employeeId}"]`);
    if (item === null) {
      console.warn(`[CUSTOM-ROTATION] Employee ${employeeId} not found in modal`);
      return;
    }

    // Move to the zone (appendChild moves the element, doesn't duplicate)
    zone.appendChild(item);
    console.info(`[CUSTOM-ROTATION] Moved employee ${employeeId} to zone ${zone.id}`);
  }

  /**
   * Move an employee item back to available list
   */
  private moveEmployeeToAvailable(employeeId: string): void {
    // IMPORTANT: Search only within the custom-rotation-modal to avoid conflicts
    const modal = this.patternModal;
    if (modal === null) return;

    const availableContainer = $$id('custom-available-employees');
    if (availableContainer === null) return;

    // Check if employee is already in available (prevent duplicate)
    const existingInAvailable = availableContainer.querySelector(`.employee-item[data-employee-id="${employeeId}"]`);
    if (existingInAvailable !== null) {
      console.warn(`[CUSTOM-ROTATION] Employee ${employeeId} already in available - ignoring`);
      return;
    }

    // Find the employee item within the modal
    const item = modal.querySelector(`.employee-item[data-employee-id="${employeeId}"]`);
    if (item === null) {
      console.warn(`[CUSTOM-ROTATION] Employee ${employeeId} not found in modal`);
      return;
    }

    availableContainer.appendChild(item);
    console.info(`[CUSTOM-ROTATION] Moved employee ${employeeId} back to available`);
  }

  /**
   * Call the backend API to generate rotation shifts
   */
  private async callGenerateRotationAPI(
    request: GenerateRotationRequest,
  ): Promise<{ success: boolean; shiftsCreated: number }> {
    const accessToken = localStorage.getItem('accessToken') ?? '';

    const response = await fetch('/api/v2/shifts/rotation/generate-from-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: { message?: string } };
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}`);
    }

    return (await response.json()) as { success: boolean; shiftsCreated: number };
  }

  /**
   * Get current department ID from UI state (reads from departmentDisplay dropdown)
   */
  private getCurrentDepartmentId(): number | undefined {
    const departmentDisplay = $$id('departmentDisplay');
    if (departmentDisplay === null) return undefined;
    const valueAttr = departmentDisplay.getAttribute('data-value');
    if (valueAttr === null || valueAttr === '') return undefined;
    const id = Number.parseInt(valueAttr, 10);
    return Number.isNaN(id) ? undefined : id;
  }

  /**
   * Show error message to user
   */
  private showError(message: string): void {
    console.error('❌', message);
    showErrorAlert(message);
  }

  /**
   * Navigate to the week containing the given date
   * Sets currentWeek to Monday of that week
   */
  private navigateToWeekContainingDate(dateStr: string): void {
    const date = new Date(dateStr);
    // Get Monday of this week (ISO weeks start on Monday)
    const dayOfWeek = date.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, need to go back 6 days
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    setCurrentWeek(monday);
    console.info(
      '[CUSTOM ROTATION] Navigated to week containing:',
      dateStr,
      '→ Monday:',
      monday.toISOString().split('T')[0],
    );
  }

  /**
   * Refresh the shifts view to show newly generated shifts
   */
  private refreshShiftsView(): void {
    // Dispatch a custom event that the main shifts module can listen to
    const event = new CustomEvent('shiftsNeedRefresh', { bubbles: true });
    document.dispatchEvent(event);
  }

  /**
   * Close pattern modal
   */
  private closePatternModal(): void {
    if (this.patternModal) {
      this.patternModal.classList.remove('modal-overlay--active');
    }

    // If no pattern selected, uncheck the checkbox
    if (!this.selectedPattern && this.checkbox) {
      this.checkbox.checked = false;
      this.isActive = false;
    }
  }

  /**
   * Show selected pattern info (NO inline styles - uses Tailwind/CSS classes only)
   */
  private showPatternInfo(): void {
    if (this.selectedPattern === null) return;

    // Remove existing info first
    const existingInfo = document.querySelector('.custom-rotation-pattern-info');
    if (existingInfo !== null) existingInfo.remove();

    // Create info box using Design System alert structure
    const infoDiv = document.createElement('div');
    infoDiv.className = 'custom-rotation-pattern-info alert alert--warning mx-5 my-4';

    // Alert content container (Design System structure)
    const alertContent = document.createElement('div');
    alertContent.className = 'alert__content';

    // Header row: Title + Button (flex row, space-between)
    const headerRow = document.createElement('div');
    headerRow.className = 'alert__header';
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.width = '100%';

    // Title with Design System class
    const title = document.createElement('div');
    title.className = 'alert__title';
    title.style.margin = '0'; // Remove bottom margin since it's inline now
    title.textContent = 'Aktives Schichtmuster';

    // Change button (next to title, right side)
    const changeBtn = document.createElement('button');
    changeBtn.className = 'btn btn-edit';
    changeBtn.dataset['action'] = 'change-pattern';
    changeBtn.innerHTML = '<i class="fas fa-edit"></i> Ändern';

    headerRow.append(title);
    headerRow.append(changeBtn);

    // Message with pattern info
    const message = document.createElement('div');
    message.className = 'alert__message';

    const strong = document.createElement('strong');
    strong.textContent = this.selectedPattern.name;
    message.append(strong);

    if (this.selectedPattern.employeeCount !== undefined && this.selectedPattern.employeeCount !== 0) {
      message.append(document.createTextNode(` | ${this.selectedPattern.employeeCount} Mitarbeiter`));
    }

    alertContent.append(headerRow);
    alertContent.append(message);
    infoDiv.append(alertContent);

    // Insert info after header
    const scheduleHeader = document.querySelector('.schedule-header');
    if (scheduleHeader?.parentElement !== null && scheduleHeader?.parentElement !== undefined) {
      scheduleHeader.parentElement.insertBefore(infoDiv, scheduleHeader);
    }
  }

  /**
   * Enable Custom Rotation mode - show horizontal scroll and week 2 headers
   */
  private enableCustomRotationMode(): void {
    console.info('🔄 Enabling Custom Rotation mode');

    // Extend grid to 14 days (7+7)
    this.extendGridTo14Days();

    // Setup horizontal scroll system
    this.setupHorizontalScroll();

    // Update save button text
    if (this.saveBtn !== null) {
      this.saveBtn.textContent = 'Schichtmuster speichern';
    }
  }

  /**
   * Disable Custom Rotation mode - hide scroll navigation and week 2 headers
   */
  private disableCustomRotationMode(): void {
    console.info('❌ Disabling Custom Rotation mode');

    // Reset grid to 7 days
    this.resetGridTo7Days();

    // Reset scroll container
    this.resetScrollContainer();

    // Hide week 2 headers
    this.hideWeek2Headers();

    // Reset save button text
    if (this.saveBtn !== null) {
      this.saveBtn.textContent = 'Schichtplan speichern';
    }

    // Remove pattern info
    const patternInfo = document.querySelector('.custom-rotation-pattern-info');
    if (patternInfo) patternInfo.remove();

    // Clear stored data
    this.week1Data = {};
    this.week2Data = {};
    this.week3Data = {};
    this.week4Data = {};
    this.currentWeek = 1;
    this.selectedPattern = null;
  }

  /**
   * Reset scroll container to normal state
   */

  private resetScrollContainer(): void {
    const weekSchedule = document.querySelector('.week-schedule');
    const scheduleHeader = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
    if (!scheduleHeader) return;

    // Reset week-schedule container styles
    if (weekSchedule instanceof HTMLElement) {
      weekSchedule.classList.remove('custom-rotation-active');
      weekSchedule.style.overflowX = '';
      weekSchedule.style.overflowY = '';
      weekSchedule.style.position = '';
    }

    // Remove scroll classes and styles from header
    scheduleHeader.classList.remove('custom-rotation-scroll-container');
    if (scheduleHeader instanceof HTMLElement) {
      scheduleHeader.style.overflowX = '';
      scheduleHeader.style.overflowY = '';
      scheduleHeader.style.width = '';
      scheduleHeader.style.minWidth = '';
    }

    // Remove scroll classes and styles from all shift rows
    const SCROLL_CONTAINER_CLASS = 'custom-rotation-scroll-container';
    const shiftRows = document.querySelectorAll(SHIFT_ROW_SELECTOR);
    shiftRows.forEach((row) => {
      if (row instanceof HTMLElement) {
        row.classList.remove(SCROLL_CONTAINER_CLASS);
        row.style.overflowX = '';
        row.style.overflowY = '';
        row.style.width = '';
        row.style.minWidth = '';
        row.scrollTo({ left: 0, behavior: 'smooth' });
      }
    });

    // Reset scroll position
    scheduleHeader.scrollTo({ left: 0, behavior: 'smooth' });

    // Remove scroll event listeners
    scheduleHeader.removeEventListener('scroll', this.scrollHandler);

    // Remove week 2 shift cells
    this.removeWeek2ShiftCells();
  }

  /**
   * Extend grid layout to support 14 days (2 weeks)
   */
  private extendGridTo14Days(): void {
    console.info('🔄 Extending grid to 14 days');

    // Update schedule header grid - use fixed width columns for horizontal scrolling
    const scheduleHeader = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
    if (scheduleHeader instanceof HTMLElement) {
      scheduleHeader.style.gridTemplateColumns = '120px repeat(14, 120px)';
      scheduleHeader.style.display = 'grid';
      scheduleHeader.style.width = 'max-content'; // Important for horizontal scroll
      scheduleHeader.style.minWidth = '100%';
    }

    // Update all shift rows grid
    const shiftRows = document.querySelectorAll(SHIFT_ROW_SELECTOR);
    shiftRows.forEach((row) => {
      if (row instanceof HTMLElement) {
        row.style.gridTemplateColumns = '120px repeat(14, 120px)';
        row.style.display = 'grid';
        row.style.width = 'max-content'; // Important for horizontal scroll
        row.style.minWidth = '100%';
      }
    });

    // For mobile responsiveness
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    if (mediaQuery.matches) {
      const scheduleHeaderMobile = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
      if (scheduleHeaderMobile instanceof HTMLElement) {
        scheduleHeaderMobile.style.gridTemplateColumns = '80px repeat(14, 100px)';
      }
      shiftRows.forEach((row) => {
        if (row instanceof HTMLElement) {
          row.style.gridTemplateColumns = '80px repeat(14, 100px)';
        }
      });
    }
  }

  /**
   * Reset grid layout to normal 7 days
   */
  private resetGridTo7Days(): void {
    console.info('🔄 Resetting grid to 7 days');

    // Reset schedule header grid
    const scheduleHeader = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
    if (scheduleHeader instanceof HTMLElement) {
      scheduleHeader.style.gridTemplateColumns = '120px repeat(7, 1fr)';
    }

    // Reset all shift rows grid
    const shiftRows = document.querySelectorAll(SHIFT_ROW_SELECTOR);
    shiftRows.forEach((row) => {
      if (row instanceof HTMLElement) {
        row.style.gridTemplateColumns = '120px repeat(7, 1fr)';
      }
    });

    // For mobile responsiveness
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    if (mediaQuery.matches) {
      const scheduleHeaderMobile = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
      if (scheduleHeaderMobile instanceof HTMLElement) {
        scheduleHeaderMobile.style.gridTemplateColumns = '80px repeat(6, 1fr)';
      }
      shiftRows.forEach((row) => {
        if (row instanceof HTMLElement) {
          row.style.gridTemplateColumns = '80px repeat(6, 1fr)';
        }
      });
    }
  }

  /**
   * Setup horizontal scroll container for 2-week view
   */
  private setupHorizontalScroll(): void {
    // Find the entire week-schedule container
    const weekSchedule = document.querySelector('.week-schedule');
    if (!weekSchedule) return;

    // Make the entire week-schedule container scrollable
    weekSchedule.classList.add('custom-rotation-active');

    // Add explicit scroll container styles
    if (weekSchedule instanceof HTMLElement) {
      weekSchedule.style.overflowX = 'auto';
      weekSchedule.style.overflowY = 'hidden';
      weekSchedule.style.position = 'relative';
    }

    const scheduleHeader = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
    if (!scheduleHeader) return;

    // Add scroll container class to header for horizontal scrolling
    scheduleHeader.classList.add('custom-rotation-scroll-container');

    // Apply explicit overflow styles to header
    if (scheduleHeader instanceof HTMLElement) {
      scheduleHeader.style.overflowX = 'auto';
      scheduleHeader.style.overflowY = 'hidden';
    }

    // Add scroll container class to all shift rows for synchronized scrolling
    const shiftRows = document.querySelectorAll(SHIFT_ROW_SELECTOR);
    shiftRows.forEach((row) => {
      row.classList.add('custom-rotation-scroll-container');
      if (row instanceof HTMLElement) {
        row.style.overflowX = 'auto';
        row.style.overflowY = 'hidden';
      }
    });

    // Add scroll event listener for week detection
    if (scheduleHeader instanceof HTMLElement) {
      scheduleHeader.addEventListener('scroll', this.scrollHandler);

      // Synchronize scroll across all rows
      scheduleHeader.addEventListener('scroll', () => {
        const scrollLeft = scheduleHeader.scrollLeft;
        shiftRows.forEach((row) => {
          if (row instanceof HTMLElement) {
            row.scrollLeft = scrollLeft;
          }
        });
      });
    }

    // Show week 2 headers when active
    this.showWeek2Headers();

    // Add week 2 shift cells to all shift rows
    this.addWeek2ShiftCells();
  }

  /**
   * Add week 2 shift cells to all shift rows
   */
  private addWeek2ShiftCells(): void {
    console.info('🔄 Adding week 2 shift cells');

    const shiftRows = document.querySelectorAll(SHIFT_ROW_SELECTOR);
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

    shiftRows.forEach((row) => {
      // Check if week 2 cells already exist
      if (row.querySelectorAll('.week-2-cell').length > 0) return;

      // Determine which shift type this row is for
      const shiftLabel = row.querySelector('.shift-label');
      let shiftType = 'early'; // default

      if (shiftLabel instanceof HTMLElement) {
        // After instanceof check, textContent is guaranteed to be string
        if (shiftLabel.textContent.includes('Spätschicht')) {
          shiftType = 'late';
        } else if (shiftLabel.textContent.includes('Nachtschicht')) {
          shiftType = 'night';
        } else if (shiftLabel.textContent.includes('Info')) {
          // Skip info rows - they don't need shift cells
          return;
        }
      }

      // Add 7 week 2 cells to each shift row
      dayNames.forEach((dayName, dayIndex) => {
        const cell = document.createElement('div');
        // NO inline styles! CSS handles styling via .shift-cell and .week-2-cell classes
        cell.className = 'shift-cell week-2-cell';

        // Set proper data attributes for drag and drop
        cell.dataset['day'] = dayName;
        cell.dataset['shift'] = shiftType;

        // Calculate Week 2 date (add 7 days to current week)
        const week2Date = this.getWeek2DateForCell(dayIndex);
        if (week2Date !== '') {
          cell.dataset['date'] = week2Date;
        }

        // Add empty slot div like Week 1 cells
        const assignmentDiv = document.createElement('div');
        assignmentDiv.className = 'employee-assignment';

        const emptySlotDiv = document.createElement('div');
        emptySlotDiv.className = 'empty-slot';
        emptySlotDiv.textContent = '+';

        assignmentDiv.append(emptySlotDiv);
        cell.append(assignmentDiv);

        row.append(cell);
      });
    });
  }

  /**
   * Get Week 2 date in YYYY-MM-DD format for shift cells
   */
  private getWeek2DateForCell(dayIndex: number): string {
    const currentWeekInfo = document.querySelector('#currentWeekInfo')?.textContent;

    if (currentWeekInfo === undefined || currentWeekInfo === '') {
      return '';
    }

    // Extract start date from "KW 37 - 08.09.2025 bis 14.09.2025"
    const dateMatch = /(\d{2})\.(\d{2})\.(\d{4})/.exec(currentWeekInfo);
    if (!dateMatch) return '';

    const [, day, month, year] = dateMatch;
    const startDate = new Date(
      Number.parseInt(year ?? '0'),
      Number.parseInt(month ?? '0') - 1,
      Number.parseInt(day ?? '0'),
    );

    // Add 7 days for week 2, plus day index
    const week2Day = new Date(startDate);
    week2Day.setDate(startDate.getDate() + 7 + dayIndex);

    // Return in YYYY-MM-DD format
    const yyyy = week2Day.getFullYear();
    const mm = String(week2Day.getMonth() + 1).padStart(2, '0');
    const dd = String(week2Day.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Remove week 2 shift cells from all shift rows
   */
  private removeWeek2ShiftCells(): void {
    console.info('🔄 Removing week 2 shift cells');

    const week2Cells = document.querySelectorAll('.week-2-cell');
    week2Cells.forEach((cell) => {
      cell.remove();
    });
  }

  /**
   * Detect current week based on scroll position
   */
  private detectCurrentWeekFromScroll(): void {
    const scheduleHeader = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
    if (!scheduleHeader) return;

    const scrollLeft = scheduleHeader.scrollLeft;
    const maxScroll = scheduleHeader.scrollWidth - scheduleHeader.clientWidth;
    const scrollPercentage = scrollLeft / maxScroll;

    // Update current week based on scroll position
    const newWeek: 1 | 2 = scrollPercentage > 0.3 ? 2 : 1;

    if (newWeek !== this.currentWeek) {
      this.currentWeek = newWeek;
      this.saveCurrentWeekData();
      this.loadWeekData(newWeek === 1 ? this.week1Data : this.week2Data);
    }
  }

  /**
   * Create week 2 headers integrated into DOM flow
   */
  private createWeek2Headers(): void {
    const scheduleHeader = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
    if (!scheduleHeader) return;

    const dayHeaders = scheduleHeader.querySelectorAll('.day-header');
    if (dayHeaders.length < 8) return; // Need at least 8 headers (1 for "Schicht" + 7 days)

    // Only create if they don't exist yet
    if (scheduleHeader.querySelectorAll('.week-2-header').length > 0) return;

    const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

    // Create week 2 headers (append after existing headers for horizontal flow)
    days.forEach((dayName, index) => {
      const week2Date = this.getWeek2Date(index);
      const headerElement = document.createElement('div');
      headerElement.className = 'day-header week-2-header';
      headerElement.dataset['day'] = index.toString();
      // Initially hidden until Custom Rotation mode is activated
      headerElement.style.display = 'none';

      const dayNameText = document.createTextNode(dayName);
      const br = document.createElement('br');
      const dateSpan = document.createElement('span');
      dateSpan.className = 'u-fs-12 u-fw-400';
      dateSpan.textContent = week2Date;

      headerElement.append(dayNameText);
      headerElement.append(br);
      headerElement.append(dateSpan);

      scheduleHeader.append(headerElement);
    });

    // Store references to week 2 headers
    this.week2Headers = [...scheduleHeader.querySelectorAll('.week-2-header')] as HTMLElement[];
  }

  /**
   * Calculate week 2 dates based on current week
   */
  private getWeek2Date(dayIndex: number): string {
    const currentWeekInfo = document.querySelector('#currentWeekInfo')?.textContent;

    if (currentWeekInfo === undefined || currentWeekInfo === '') {
      return `${dayIndex + 8}.09`;
    }

    // Extract start date from "KW 37 - 08.09.2025 bis 14.09.2025"
    const dateMatch = /(\d{2})\.(\d{2})\.(\d{4})/.exec(currentWeekInfo);
    if (!dateMatch) return `${dayIndex + 8}.09`;

    const [, day, month, year] = dateMatch;
    const startDate = new Date(
      Number.parseInt(year ?? '0'),
      Number.parseInt(month ?? '0') - 1,
      Number.parseInt(day ?? '0'),
    );

    // Add 7 days for week 2, plus day index
    const week2Day = new Date(startDate);
    week2Day.setDate(startDate.getDate() + 7 + dayIndex);

    return `${week2Day.getDate().toString().padStart(2, '0')}.${(week2Day.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  /**
   * Show week 2 headers when Custom Rotation mode is active
   */
  private showWeek2Headers(): void {
    // Show all week 2 headers
    this.week2Headers.forEach((header) => {
      header.style.display = ''; // Reset to default display
    });
    console.info('Week 2 headers shown for horizontal scroll');
  }

  /**
   * Remove week 2 headers when disabling Custom Rotation mode
   */
  private hideWeek2Headers(): void {
    this.week2Headers.forEach((header) => {
      header.remove();
    });
    this.week2Headers = [];
  }

  // Removed unused updateSliderButtons method

  /**
   * Save current visible week data
   */
  private saveCurrentWeekData(): void {
    const currentData = this.extractCurrentScheduleData();

    if (this.currentWeek === 1) {
      this.week1Data = { ...this.week1Data, ...currentData };
    } else {
      this.week2Data = { ...this.week2Data, ...currentData };
    }

    console.info(`💾 Saved week ${this.currentWeek} data:`, currentData);

    // Update pattern completion info
    this.updatePatternCompletionInfo();
  }

  /**
   * Count days with at least one shift assigned
   */
  private countFilledShiftDays(): number {
    let count = 0;
    const allWeekData = [this.week1Data, this.week2Data];
    const days: (keyof WeekData)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    for (const weekData of allWeekData) {
      count += this.countFilledDaysInWeek(weekData, days);
    }

    return count;
  }

  /**
   * Count filled days in a single week
   */
  private countFilledDaysInWeek(weekData: WeekData, days: (keyof WeekData)[]): number {
    let count = 0;
    for (const day of days) {
      // eslint-disable-next-line security/detect-object-injection -- day is from controlled array of valid keys
      const daySchedule = weekData[day];
      if (daySchedule !== undefined) {
        const hasAnyEmployee =
          daySchedule.early.length > 0 || daySchedule.late.length > 0 || daySchedule.night.length > 0;
        if (hasAnyEmployee) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Update pattern completion info box
   * Shows status when pattern has enough data for generation
   */
  private updatePatternCompletionInfo(): void {
    if (this.selectedPattern === null) return;

    const patternConfig = this.selectedPattern.patternConfig;
    const shiftBlockLength = patternConfig.shiftBlockLength ?? 10;
    const freeDays = patternConfig.freeDays ?? 2;
    const filledDays = this.countFilledShiftDays();

    // Remove existing completion info
    const existingCompletionInfo = document.querySelector('.pattern-completion-info');
    if (existingCompletionInfo !== null) {
      existingCompletionInfo.remove();
    }

    // Only show if we have enough days filled
    if (filledDays < shiftBlockLength) {
      return;
    }

    this.createAndInsertCompletionInfoBox(shiftBlockLength, freeDays);
  }

  /**
   * Create and insert the completion info box into DOM
   */
  private createAndInsertCompletionInfoBox(shiftBlockLength: number, freeDays: number): void {
    if (this.selectedPattern === null) return;

    const totalBlockLength = shiftBlockLength + freeDays;
    const totalDaysToGenerate = this.calculateTotalDaysToGenerate();

    // Create completion info box
    const infoDiv = document.createElement('div');
    infoDiv.className = 'pattern-completion-info alert alert--success mx-5 my-2';

    const alertContent = document.createElement('div');
    alertContent.className = 'alert__content';

    const title = document.createElement('div');
    title.className = 'alert__title';
    title.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Muster vollständig!';

    const message = document.createElement('div');
    message.className = 'alert__message';
    message.textContent = `${shiftBlockLength} Schichttage + ${freeDays} Freitage = ${totalBlockLength} Tage Block.`;

    if (totalDaysToGenerate > 0) {
      message.textContent += ` Bereit für ${totalDaysToGenerate} Tage Generierung.`;
    }

    alertContent.append(title);
    alertContent.append(message);
    infoDiv.append(alertContent);

    this.insertCompletionInfoBox(infoDiv);
  }

  /**
   * Calculate total days to generate based on date range
   */
  private calculateTotalDaysToGenerate(): number {
    if (this.selectedPattern === null) return 0;

    const startDate = this.selectedPattern.startsAt;
    const endDate = this.selectedPattern.endsAt ?? '';

    if (startDate === '' || endDate === '') {
      return 0;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  }

  /**
   * Insert completion info box into DOM
   */
  private insertCompletionInfoBox(infoDiv: HTMLElement): void {
    const patternInfo = document.querySelector('.custom-rotation-pattern-info');
    if (patternInfo !== null) {
      patternInfo.after(infoDiv);
      return;
    }

    const scheduleHeader = document.querySelector('.schedule-header');
    if (scheduleHeader?.parentElement !== null && scheduleHeader?.parentElement !== undefined) {
      scheduleHeader.parentElement.insertBefore(infoDiv, scheduleHeader);
    }
  }

  /**
   * Get day mapping for schedule data
   */
  private getDayMapping(): Record<string, keyof WeekData | undefined> {
    return {
      monday: 'monday',
      tuesday: 'tuesday',
      wednesday: 'wednesday',
      thursday: 'thursday',
      friday: 'friday',
      saturday: 'saturday',
      sunday: 'sunday',
    };
  }

  /**
   * Get shift type mapping
   */
  private getShiftMapping(): Record<string, keyof DaySchedule | undefined> {
    return {
      early: 'early',
      late: 'late',
      night: 'night',
    };
  }

  /**
   * Process a single shift cell and add assignments to data
   */
  private processShiftCell(
    cell: HTMLElement,
    data: WeekData,
    dayMapping: Record<string, keyof WeekData | undefined>,
    shiftMapping: Record<string, keyof DaySchedule | undefined>,
  ): void {
    const day = cell.dataset['day'];
    const shiftType = cell.dataset['shift'];

    if (day === undefined || day === '' || shiftType === undefined || shiftType === '') {
      console.warn('[CUSTOM-ROTATION] Shift cell missing data attributes:', cell);
      return;
    }

    const dayKey = dayMapping[day.toLowerCase()];
    const shiftKey = shiftMapping[shiftType.toLowerCase()];

    if (dayKey === undefined || shiftKey === undefined) {
      console.warn(`[CUSTOM-ROTATION] Unknown day or shift: ${day}, ${shiftType}`);
      return;
    }

    // eslint-disable-next-line security/detect-object-injection -- dayKey is validated from predefined mapping
    data[dayKey] ??= { early: [], late: [], night: [], free: [] };

    const assignments = cell.querySelectorAll('.employee-assignment');
    assignments.forEach((assignment) => {
      const badge = assignment.querySelector('.employee-badge[data-employee-id]');
      if (
        badge instanceof HTMLElement &&
        badge.dataset['employeeId'] !== undefined &&
        badge.dataset['employeeId'] !== ''
      ) {
        const employeeId = Number.parseInt(badge.dataset['employeeId'], 10);
        if (!Number.isNaN(employeeId)) {
          // eslint-disable-next-line security/detect-object-injection -- dayKey is validated from predefined mapping
          const daySchedule = data[dayKey];
          // eslint-disable-next-line security/detect-object-injection -- shiftKey is validated from predefined mapping
          if (daySchedule && !daySchedule[shiftKey].includes(employeeId)) {
            // eslint-disable-next-line security/detect-object-injection -- shiftKey is validated from predefined mapping
            daySchedule[shiftKey].push(employeeId);
            console.info(`[CUSTOM-ROTATION] Added employee ${employeeId} to ${dayKey} ${shiftKey}`);
          }
        }
      }
    });
  }

  /**
   * Collect all employee IDs from the employee list
   */
  private collectAllEmployeeIds(): Set<number> {
    const allEmployeeIds = new Set<number>();
    const employeeItems = document.querySelectorAll('.employee-item[data-employee-id]');

    employeeItems.forEach((item) => {
      if (
        item instanceof HTMLElement &&
        item.dataset['employeeId'] !== undefined &&
        item.dataset['employeeId'] !== ''
      ) {
        const id = Number.parseInt(item.dataset['employeeId'], 10);
        if (!Number.isNaN(id)) {
          allEmployeeIds.add(id);
        }
      }
    });

    return allEmployeeIds;
  }

  /**
   * Mark employees as free who are not assigned to any shift
   */
  private markFreeEmployees(data: WeekData, allEmployeeIds: Set<number>): void {
    Object.keys(data).forEach((dayKey) => {
      const day = data[dayKey as keyof WeekData];
      if (day) {
        const dayAssigned = new Set<number>();
        day.early.forEach((id) => dayAssigned.add(id));
        day.late.forEach((id) => dayAssigned.add(id));
        day.night.forEach((id) => dayAssigned.add(id));

        allEmployeeIds.forEach((id) => {
          if (!dayAssigned.has(id) && !day.free.includes(id)) {
            day.free.push(id);
            console.info(`[CUSTOM-ROTATION] Marked employee ${id} as free on ${dayKey}`);
          }
        });
      }
    });
  }

  /**
   * Extract schedule data from current DOM state
   */
  private extractCurrentScheduleData(): WeekData {
    const data: WeekData = {};
    console.info('[CUSTOM-ROTATION] Extracting schedule data from DOM...');

    const dayMapping = this.getDayMapping();
    const shiftMapping = this.getShiftMapping();

    const shiftCells = document.querySelectorAll('.shift-cell');
    console.info(`[CUSTOM-ROTATION] Found ${shiftCells.length} shift cells`);

    shiftCells.forEach((cell) => {
      if (!(cell instanceof HTMLElement)) return;
      this.processShiftCell(cell, data, dayMapping, shiftMapping);
    });

    console.info('[CUSTOM-ROTATION] Extracted week data:', data);

    const allEmployeeIds = this.collectAllEmployeeIds();
    this.markFreeEmployees(data, allEmployeeIds);

    return data;
  }

  /**
   * Load week data into the UI
   */
  private loadWeekData(weekData: WeekData): void {
    // This would load the week data into the shift assignment UI
    // For now, just log the data
    console.info('📋 Loading week data:', weekData);

    // TODO: Implement actual data loading into shift cells
  }

  /**
   * Handle save operation for Custom Rotation pattern
   */
  private async handleSave(): Promise<void> {
    console.info('💾 Saving shift pattern...');

    // Save current week data before processing
    this.saveCurrentWeekData();

    // Validate that both weeks have data
    if (Object.keys(this.week1Data).length === 0 && Object.keys(this.week2Data).length === 0) {
      // Using a custom notification instead of alert
      this.showErrorMessage('Bitte tragen Sie Schichten für mindestens eine Woche ein.');
      return;
    }

    try {
      const pattern = this.createCustomRotationPattern();
      await this.savePattern(pattern);

      // Show success message
      this.showSuccessMessage('Schichtmuster erfolgreich gespeichert!');
    } catch (error) {
      console.error('❌ Error saving Custom Rotation pattern:', error);
      // Check if it's an overlap error from the database trigger
      if (error instanceof Error) {
        const errorMessage = error.message;
        if (errorMessage.includes('Überlappung') || errorMessage.includes('existiert bereits')) {
          this.showErrorMessage(
            '⚠️ ÜBERLAPPUNG ERKANNT: Es existieren bereits Schichten für dieses Team in diesem Zeitraum! Bitte löschen Sie zuerst die bestehenden Schichten oder wählen Sie einen anderen Zeitraum.',
          );
        } else {
          this.showErrorMessage('Fehler beim Speichern des Schichtmusters: ' + errorMessage);
        }
      } else {
        this.showErrorMessage('Fehler beim Speichern des Schichtmusters. Bitte versuchen Sie es erneut.');
      }
    }
  }

  /**
   * Create Custom Rotation pattern object
   */
  private createCustomRotationPattern(): CustomRotationPattern {
    const currentWeekInfo = document.querySelector('#currentWeekInfo')?.textContent ?? '';
    const teamId = this.getCurrentTeamId();

    // Use the selected pattern type if available
    const patternType = this.selectedPattern?.patternType ?? 'auto-detect';
    const cycleLengthWeeks = this.selectedPattern?.cycleLengthWeeks ?? 2;

    // Use dates from selected pattern
    const startDate = this.selectedPattern?.startsAt ?? this.getCurrentStartDate();
    const endDate =
      this.selectedPattern?.endsAt ?? this.getEndOfFirstWeekNextYear(new Date()).toISOString().split('T')[0] ?? '';

    console.info(`[CUSTOM-ROTATION] Creating pattern with type: ${patternType}, cycleWeeks: ${cycleLengthWeeks}`);
    console.info(`[CUSTOM-ROTATION] Date range: ${startDate} to ${endDate}`);

    // Get shift block config from selected pattern (set in selectPattern())
    const shiftBlockConfig = this.selectedPattern?.patternConfig ?? {};

    // Map 'auto-detect' to 'custom' for backend compatibility
    const backendPatternType = patternType === 'auto-detect' ? 'custom' : patternType;

    return {
      name: this.selectedPattern?.name ?? `Schichtmuster ${currentWeekInfo}`,
      patternType: backendPatternType,
      cycleLengthWeeks: cycleLengthWeeks,
      employeeCount: this.selectedPattern?.employeeCount,
      patternConfig: {
        // Grid data (existing)
        customPattern: {
          week1: this.week1Data,
          week2: this.week2Data,
        },
        rotationType: shiftBlockConfig.rotationType ?? ('forward' as const),
        shiftDuration: shiftBlockConfig.shiftDuration ?? 2,
        // NEW: Shift block algorithm config
        shiftBlockLength: shiftBlockConfig.shiftBlockLength,
        freeDays: shiftBlockConfig.freeDays,
        startShift: shiftBlockConfig.startShift,
        shiftSequence: shiftBlockConfig.shiftSequence,
        specialRules: shiftBlockConfig.specialRules,
      },
      startsAt: startDate,
      endsAt: endDate,
      teamId,
    };
  }

  /**
   * Get current team ID from UI state (reads from teamDisplay dropdown)
   */
  private getCurrentTeamId(): number | undefined {
    const teamDisplay = $$id('teamDisplay');
    if (teamDisplay === null) return undefined;
    const valueAttr = teamDisplay.getAttribute('data-value');
    if (valueAttr === null || valueAttr === '') return undefined;
    const id = Number.parseInt(valueAttr, 10);
    return Number.isNaN(id) ? undefined : id;
  }

  /**
   * Get current start date in ISO format
   */
  private getCurrentStartDate(): string {
    return new Date().toISOString().split('T')[0] ?? '';
  }

  /**
   * Get current selected pattern for external use
   */
  public getSelectedPattern(): CustomRotationPattern | null {
    return this.selectedPattern;
  }

  /**
   * Check if Custom Rotation is currently active
   */
  public isCustomRotationActive(): boolean {
    return this.checkbox?.checked ?? false;
  }

  /**
   * Save pattern via API
   */
  private async savePattern(pattern: CustomRotationPattern): Promise<void> {
    // Use the existing rotation API endpoint
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken === null || accessToken === '') {
      throw new Error('No access token available');
    }

    const response = await fetch('/api/v2/shifts/rotation/patterns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(pattern),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    await response.json();
  }

  /**
   * Show success message (uses standard toast from alerts.ts)
   */
  private showSuccessMessage(message: string): void {
    showSuccessAlert(message);
  }

  /**
   * Show error message (uses standard toast from alerts.ts)
   */
  private showErrorMessage(message: string): void {
    showErrorAlert(message);
  }

  /**
   * Check if Custom Rotation mode is currently active
   */
  public isActiveMode(): boolean {
    return this.isActive;
  }

  /**
   * Get current week number
   */
  public getCurrentWeek(): 1 | 2 {
    return this.currentWeek;
  }

  /**
   * Get stored data for debugging
   */
  public getStoredData(): { week1: WeekData; week2: WeekData } {
    return {
      week1: this.week1Data,
      week2: this.week2Data,
    };
  }
}

// Export singleton instance
export const customRotationManager = new CustomRotationManager();

// Make it globally available for other modules
declare global {
  interface Window {
    customRotationManager: CustomRotationManager;
  }
}
window.customRotationManager = customRotationManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    customRotationManager.init();

    // Event delegation for change pattern button
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle change pattern
      const changeBtn = target.closest<HTMLElement>('[data-action="change-pattern"]');
      if (changeBtn) {
        customRotationManager.changePattern();
      }
    });
  });
} else {
  customRotationManager.init();

  // Event delegation for change pattern button
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle change pattern
    const changeBtn = target.closest<HTMLElement>('[data-action="change-pattern"]');
    if (changeBtn) {
      customRotationManager.changePattern();
    }
  });
}
