/**
 * Kontischicht Ansicht - 2-Wochen Schichtplanung
 * Erweitert das bestehende Shift-System um flexible 2-Wochen-Muster
 */

import { $$id } from '../utils/dom-utils';

// Constants
const SHIFT_ROW_SELECTOR = '.shift-row';

interface DaySchedule {
  early: number[]; // User IDs for early shift
  late: number[]; // User IDs for late shift
  night: number[]; // User IDs for night shift
  free: number[]; // User IDs marked as free
}

interface WeekData {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

interface KontischichtPattern {
  name: string;
  patternType: 'custom' | '3er-rotation' | '4er-standard' | '4er-lang' | 'auto-detect';
  cycleLengthWeeks: number;
  employeeCount?: number;
  patternConfig: {
    customPattern?: {
      week1: WeekData;
      week2: WeekData;
      week3?: WeekData;
      week4?: WeekData;
    };
    rotationType?: 'forward' | 'backward';
    shiftDuration?: number; // days per shift type
  };
  startsAt: string;
  endsAt?: string;
  teamId?: number;
}

interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  employeeCount: number;
  cycleWeeks: number;
  preview: string;
}

class KontischichtManager {
  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

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
  private selectedPattern: KontischichtPattern | null = null;

  // DOM Elements
  private checkbox: HTMLInputElement | null = null;
  private week2Headers: HTMLElement[] = [];
  private saveBtn: HTMLElement | null = null;
  private patternModal: HTMLElement | null = null;

  // Constants
  private readonly SCHEDULE_HEADER_SELECTOR = '.schedule-header';

  // Predefined Pattern Templates
  private readonly PATTERN_TEMPLATES: PatternTemplate[] = [
    {
      id: '3er-rotation',
      name: '3er Rotation',
      description: '3 Mitarbeiter, 9-Tage-Zyklus (3xF → 3xS → 3xN → 3xFrei)',
      employeeCount: 3,
      cycleWeeks: 2,
      preview: 'A: FFF SSS NNN --- | B: SSS NNN --- FFF | C: NNN --- FFF SSS',
    },
    {
      id: '4er-standard',
      name: '4er Standard',
      description: '4 Mitarbeiter, klassische Kontischicht (2-2-2 Rotation)',
      employeeCount: 4,
      cycleWeeks: 4,
      preview: 'A: FF SS NN -- | B: SS NN -- FF | C: NN -- FF SS | D: -- FF SS NN',
    },
    {
      id: '4er-lang',
      name: '4er Lang',
      description: '4 Mitarbeiter, längere Schichtblöcke (4-4-4 Rotation)',
      employeeCount: 4,
      cycleWeeks: 4,
      preview: 'A: FFFF SSSS NNNN ---- | B: SSSS NNNN ---- FFFF',
    },
    {
      id: 'custom',
      name: 'Benutzerdefiniert',
      description: 'Eigenes Muster erstellen und für das Jahr wiederholen',
      employeeCount: 0,
      cycleWeeks: 0,
      preview: 'Flexibles Pattern nach Ihren Anforderungen',
    },
    {
      id: 'auto-detect',
      name: 'Auto-Erkennung',
      description: 'System versucht das Muster aus den ersten Wochen zu erkennen',
      employeeCount: 0,
      cycleWeeks: 0,
      preview: '⚠️ Experimentell - Bitte Ergebnis prüfen!',
    },
  ];

  // Bound event handler for scroll detection
  private scrollHandler = (): void => {
    this.detectCurrentWeekFromScroll();
  };

  /**
   * Initialize the Kontischicht system
   */
  init(): void {
    this.setupDOM();
    this.setupEventListeners();
    this.createWeek2Headers();
  }

  /**
   * Setup DOM element references
   */
  private setupDOM(): void {
    const checkboxElement = document.querySelector('#shift-kontischicht');
    const saveBtnElement = document.querySelector('#saveScheduleBtn');

    if (checkboxElement instanceof HTMLInputElement) {
      this.checkbox = checkboxElement;
    } else {
      console.error('Kontischicht checkbox not found - need to add to HTML first');
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
        this.handleCheckboxToggle();
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
   * Handle checkbox toggle - show/hide Kontischicht mode
   */
  private handleCheckboxToggle(): void {
    console.log('🔧 handleCheckboxToggle called');
    if (this.checkbox === null) {
      console.error('❌ Checkbox is null!');
      return;
    }
    this.isActive = this.checkbox.checked;
    console.log(`📊 Checkbox checked: ${this.isActive}`);

    if (this.isActive) {
      console.log('✅ Enabling Kontischicht mode - showing modal');
      // Show pattern selection modal first
      this.showPatternSelectionModal();
    } else {
      console.log('❌ Disabling Kontischicht mode');
      this.disableKontischichtMode();
    }
  }

  /**
   * Show pattern selection modal
   */
  private showPatternSelectionModal(): void {
    console.log('📋 showPatternSelectionModal called');
    // Create modal if it doesn't exist
    if (!this.patternModal) {
      console.log('🔨 Creating pattern modal');
      this.createPatternModal();
    } else {
      console.log('✅ Pattern modal already exists');
    }

    // Show the modal
    if (this.patternModal) {
      console.log('👁️ Setting modal display to flex');
      this.patternModal.style.display = 'flex';
    } else {
      console.error('❌ Pattern modal is still null after creation!');
    }
  }

  /**
   * Create modal header HTML
   */
  private createModalHeader(): string {
    return `
      <div class="modal-header">
        <h2 class="modal-title">Kontischicht Pattern auswählen</h2>
        <button type="button" class="modal-close" data-action="close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }

  /**
   * Create date range selection HTML
   */
  private createDateRangeSection(): string {
    const today = new Date().toISOString().split('T')[0];
    return `
      <div class="rotation-box" style="margin-bottom: 20px; background: rgba(66, 153, 225, 0.05); border: 1px solid rgba(66, 153, 225, 0.3);">
        <h4 style="color: #4299e1; margin-bottom: 15px;">Zeitraum festlegen</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <label style="color: rgba(255, 255, 255, 0.7); display: block; margin-bottom: 5px; font-size: 14px;">
              <i class="fas fa-calendar"></i> Startdatum
            </label>
            <input type="date" id="kontischicht-start-date" name="startDate"
              class="form-control" required
              style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.2); color: #ffffff;"
              min="${today}"
              value="${today}">
          </div>
          <div>
            <label style="color: rgba(255, 255, 255, 0.7); display: block; margin-bottom: 5px; font-size: 14px;">
              <i class="fas fa-calendar-check"></i> Enddatum (max. 1.5 Jahre)
            </label>
            <input type="date" id="kontischicht-end-date" name="endDate"
              class="form-control" required
              style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.2); color: #ffffff;">
          </div>
        </div>
        <p style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin-top: 10px; margin-bottom: 0;">
          <i class="fas fa-info-circle"></i> Tipp: Wählen Sie Enddatum bis zum Ende der ersten KW des Folgejahres für nahtlosen Übergang.
        </p>
      </div>
    `;
  }

  /**
   * Create pattern template card HTML
   */
  private createPatternCard(template: PatternTemplate): string {
    const preview =
      template.preview !== ''
        ? `
      <div style="
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(66, 153, 225, 0.2);
        border-radius: 4px;
        padding: 10px;
        margin-top: 10px;
      ">
        <code style="color: #10b981; font-size: 12px; white-space: pre-wrap;">
          ${this.escapeHtml(template.preview)}
        </code>
      </div>
    `
        : '';

    const badges =
      template.employeeCount > 0
        ? `
      <div style="margin-top: 10px;">
        <span class="badge" style="
          background: rgba(66, 153, 225, 0.2);
          color: #4299e1;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          margin-right: 8px;
        ">${template.employeeCount} Mitarbeiter</span>
        <span class="badge" style="
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        ">${template.cycleWeeks} Wochen Zyklus</span>
      </div>
    `
        : '';

    return `
      <div class="rotation-box pattern-template-card" data-pattern-id="${this.escapeHtml(template.id)}" style="
        margin-bottom: 15px;
        cursor: pointer;
      ">
        <h4 style="color: #4299e1; margin-bottom: 10px;">
          ${this.escapeHtml(template.name)}
        </h4>
        <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin-bottom: 10px;">
          ${this.escapeHtml(template.description)}
        </p>
        ${preview}
        ${badges}
      </div>
    `;
  }

  /**
   * Create the pattern selection modal
   */
  private createPatternModal(): void {
    // Create modal overlay using existing classes
    const modal = document.createElement('div');
    modal.id = 'kontischicht-pattern-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';

    // Create modal container using Calendar modal structure
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container modal-lg';
    modalContainer.style.cssText = `
      backdrop-filter: blur(20px) saturate(180%);
      background: #121212c4;
      border: 1px solid hsla(0,0%,100%,.1);
      border-radius: var(--radius-md);
      box-shadow: 0 8px 32px #0006,inset 0 1px #ffffff1a;
      display: flex;
      flex-direction: column;
      max-height: 85vh !important;
      max-width: 900px;
      overflow: auto;
      transform: translateY(0);
      width: 90%;
    `;

    // Build modal content
    const patternCards = this.PATTERN_TEMPLATES.map((template) => this.createPatternCard(template)).join('');

    // eslint-disable-next-line no-unsanitized/property -- Template data is hardcoded and safe
    modalContainer.innerHTML = `
      ${this.createModalHeader()}
      <div class="modal-body" style="padding: 20px;">
        <p style="color: rgba(255, 255, 255, 0.8); margin-bottom: 20px;">
          Wählen Sie ein vordefiniertes Muster oder erstellen Sie ein eigenes.
          Das gewählte Muster wird automatisch für den gewählten Zeitraum wiederholt.
        </p>
        ${this.createDateRangeSection()}
        <div class="rotation-assignment-container">
          ${patternCards}
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="close">Abbrechen</button>
      </div>
    `;

    modal.append(modalContainer);
    document.body.append(modal);
    this.patternModal = modal;

    // Add event listeners
    this.setupPatternModalListeners();
  }

  /**
   * Setup event listeners for pattern modal
   */
  private setupPatternModalListeners(): void {
    if (!this.patternModal) return;

    // Setup date inputs
    const startDateInput = $$id('kontischicht-start-date');
    const endDateInput = $$id('kontischicht-end-date');

    if (startDateInput instanceof HTMLInputElement && endDateInput instanceof HTMLInputElement) {
      // Set default end date to end of KW1 next year
      const today = new Date();
      const endOfKW1 = this.getEndOfFirstWeekNextYear(today);

      // Set max date to 1.5 years from today
      const maxDate = new Date(today);
      maxDate.setMonth(today.getMonth() + 18);

      endDateInput.min = today.toISOString().split('T')[0];
      endDateInput.max = maxDate.toISOString().split('T')[0];
      endDateInput.value = endOfKW1.toISOString().split('T')[0];

      // Update end date min when start date changes
      startDateInput.addEventListener('change', () => {
        endDateInput.min = startDateInput.value;

        // Update max to 1.5 years from start date
        const startDate = new Date(startDateInput.value);
        const newMaxDate = new Date(startDate);
        newMaxDate.setMonth(startDate.getMonth() + 18);
        endDateInput.max = newMaxDate.toISOString().split('T')[0];
      });
    }

    // Close buttons (both X and Cancel)
    const closeButtons = this.patternModal.querySelectorAll('[data-action="close"]');
    closeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.closePatternModal();
      });
    });

    // Pattern cards with hover effect
    const patternCards = this.patternModal.querySelectorAll('.pattern-template-card');
    patternCards.forEach((card) => {
      const cardElement = card as HTMLElement;

      // Add hover effects
      cardElement.addEventListener('mouseenter', () => {
        cardElement.style.background = 'rgba(255, 255, 255, 0.05)';
        cardElement.style.borderColor = 'rgba(66, 153, 225, 0.5)';
      });

      cardElement.addEventListener('mouseleave', () => {
        cardElement.style.background = '';
        cardElement.style.borderColor = '';
      });

      cardElement.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const patternId = target.dataset.patternId;
        if (patternId !== undefined && patternId !== '') {
          this.selectPattern(patternId);
        }
      });
    });

    // Click outside to close
    this.patternModal.addEventListener('click', (e) => {
      if (e.target === this.patternModal) {
        this.closePatternModal();
      }
    });
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
   * Select a pattern and enable Kontischicht mode
   */
  private selectPattern(patternId: string): void {
    const template = this.PATTERN_TEMPLATES.find((t) => t.id === patternId);
    if (!template) return;

    // Get dates from modal inputs
    const startDateInput = $$id('kontischicht-start-date');
    const endDateInput = $$id('kontischicht-end-date');

    const startDate =
      (startDateInput instanceof HTMLInputElement ? startDateInput.value : null) ??
      new Date().toISOString().split('T')[0];
    const endDate =
      (endDateInput instanceof HTMLInputElement ? endDateInput.value : null) ??
      this.getEndOfFirstWeekNextYear(new Date()).toISOString().split('T')[0];

    // Store selected pattern with dates
    this.selectedPattern = {
      name: template.name,
      patternType: patternId as 'custom' | '3er-rotation' | '4er-standard' | '4er-lang' | 'auto-detect',
      cycleLengthWeeks: template.cycleWeeks !== 0 ? template.cycleWeeks : 2,
      employeeCount: template.employeeCount,
      patternConfig: {},
      startsAt: startDate,
      endsAt: endDate,
    };

    console.info(`📋 Selected Kontischicht pattern: ${template.name}`, this.selectedPattern);
    console.info(`📅 Period: ${startDate} to ${endDate}`);

    // Close modal
    this.closePatternModal();

    // Enable Kontischicht mode
    this.enableKontischichtMode();

    // Show pattern info
    this.showPatternInfo();
  }

  /**
   * Close pattern modal
   */
  private closePatternModal(): void {
    if (this.patternModal) {
      this.patternModal.style.display = 'none';
    }

    // If no pattern selected, uncheck the checkbox
    if (!this.selectedPattern && this.checkbox) {
      this.checkbox.checked = false;
      this.isActive = false;
    }
  }

  /**
   * Show selected pattern info
   */
  private showPatternInfo(): void {
    if (!this.selectedPattern) return;

    // Create info box using rotation-box style
    const infoDiv = document.createElement('div');
    infoDiv.className = 'rotation-box kontischicht-pattern-info';
    infoDiv.style.cssText = `
      background: rgba(16, 185, 129, 0.05);
      border: 1px solid rgba(16, 185, 129, 0.3);
      margin: 20px;
    `;
    // eslint-disable-next-line no-unsanitized/property -- All values are escaped
    infoDiv.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h4 style="color: #10b981; margin: 0 0 5px 0;">Aktives Kontischicht-Muster</h4>
          <p style="color: rgba(255, 255, 255, 0.8); margin: 0;">
            <strong>${this.escapeHtml(this.selectedPattern.name)}</strong> -
            ${this.selectedPattern.cycleLengthWeeks} Wochen Zyklus
            ${this.selectedPattern.employeeCount !== undefined && this.selectedPattern.employeeCount !== 0 ? ` | ${this.selectedPattern.employeeCount} Mitarbeiter` : ''}
          </p>
        </div>
        <button data-action="change-pattern" style="
          background: rgba(66, 153, 225, 0.2);
          color: #4299e1;
          border: 1px solid rgba(66, 153, 225, 0.4);
          padding: 8px 16px;
          border-radius: var(--radius-md);
          cursor: pointer;

        ">Muster ändern</button>
      </div>
    `;

    // Insert info after header
    const scheduleHeader = document.querySelector('.schedule-header');
    if (scheduleHeader?.parentElement) {
      const existingInfo = document.querySelector('.kontischicht-pattern-info');
      if (existingInfo) existingInfo.remove();
      scheduleHeader.parentElement.insertBefore(infoDiv, scheduleHeader);
    }
  }

  /**
   * Enable Kontischicht mode - show horizontal scroll and week 2 headers
   */
  private enableKontischichtMode(): void {
    console.info('🔄 Enabling Kontischicht mode');

    // Extend grid to 14 days (7+7)
    this.extendGridTo14Days();

    // Setup horizontal scroll system
    this.setupHorizontalScroll();

    // Initialize with Week 1
    this.scrollToWeek(1);

    // Update save button text
    if (this.saveBtn !== null) {
      this.saveBtn.textContent = 'Kontischicht Muster speichern';
    }
  }

  /**
   * Disable Kontischicht mode - hide scroll navigation and week 2 headers
   */
  private disableKontischichtMode(): void {
    console.info('❌ Disabling Kontischicht mode');

    // Reset grid to 7 days
    this.resetGridTo7Days();

    // Reset scroll container
    this.resetScrollContainer();

    // Hide week 2 headers
    this.hideWeek2Headers();

    // Remove scroll navigation
    this.removeScrollNavigation();

    // Reset save button text
    if (this.saveBtn !== null) {
      this.saveBtn.textContent = 'Schichtplan speichern';
    }

    // Remove pattern info
    const patternInfo = document.querySelector('.kontischicht-pattern-info');
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
      weekSchedule.classList.remove('kontischicht-active');
      weekSchedule.style.overflowX = '';
      weekSchedule.style.overflowY = '';
      weekSchedule.style.position = '';
    }

    // Remove scroll classes and styles from header
    scheduleHeader.classList.remove('kontischicht-scroll-container');
    if (scheduleHeader instanceof HTMLElement) {
      scheduleHeader.style.overflowX = '';
      scheduleHeader.style.overflowY = '';
      scheduleHeader.style.width = '';
      scheduleHeader.style.minWidth = '';
    }

    // Remove scroll classes and styles from all shift rows
    const SCROLL_CONTAINER_CLASS = 'kontischicht-scroll-container';
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
   * Remove scroll navigation elements
   */
  private removeScrollNavigation(): void {
    const navigation = document.querySelector('.week-scroll-navigation');
    if (navigation) {
      navigation.remove();
    }
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
    weekSchedule.classList.add('kontischicht-active');

    // Add explicit scroll container styles
    if (weekSchedule instanceof HTMLElement) {
      weekSchedule.style.overflowX = 'auto';
      weekSchedule.style.overflowY = 'hidden';
      weekSchedule.style.position = 'relative';
    }

    const scheduleHeader = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
    if (!scheduleHeader) return;

    // Add scroll container class to header for horizontal scrolling
    scheduleHeader.classList.add('kontischicht-scroll-container');

    // Apply explicit overflow styles to header
    if (scheduleHeader instanceof HTMLElement) {
      scheduleHeader.style.overflowX = 'auto';
      scheduleHeader.style.overflowY = 'hidden';
    }

    // Add scroll container class to all shift rows for synchronized scrolling
    const shiftRows = document.querySelectorAll(SHIFT_ROW_SELECTOR);
    shiftRows.forEach((row) => {
      row.classList.add('kontischicht-scroll-container');
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

    // Add scroll navigation arrows
    this.addScrollNavigation();
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
        cell.className = 'shift-cell week-2-cell';

        // Set proper data attributes for drag and drop
        cell.dataset.day = dayName;
        cell.dataset.shift = shiftType;

        // Calculate Week 2 date (add 7 days to current week)
        const week2Date = this.getWeek2DateForCell(dayIndex);
        if (week2Date !== '') {
          cell.dataset.date = week2Date;
        }

        // Style the cell
        cell.style.minHeight = '85px';
        cell.style.background = 'rgba(255, 255, 255, 0.02)';
        cell.style.border = '1px dashed rgba(255, 255, 255, 0.1)';
        cell.style.borderRadius = 'var(--radius-sm)';
        cell.style.backdropFilter = 'blur(5px)';

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
    const startDate = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day));

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
   * Add scroll navigation arrows for better UX
   */
  private addScrollNavigation(): void {
    const scheduleHeader = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
    if (!scheduleHeader?.parentNode) return;

    const navigationDiv = document.createElement('div');
    navigationDiv.className = 'week-scroll-navigation';
    navigationDiv.innerHTML = `
      <button class="scroll-nav-btn scroll-prev" id="scrollToPrevWeek" title="Woche 1">
        <i class="fas fa-chevron-left"></i>
        <span>Woche 1</span>
      </button>
      <div class="scroll-indicator">
        <div class="scroll-progress" id="scrollProgress"></div>
      </div>
      <button class="scroll-nav-btn scroll-next" id="scrollToNextWeek" title="Woche 2">
        <span>Woche 2</span>
        <i class="fas fa-chevron-right"></i>
      </button>
    `;

    scheduleHeader.parentNode.insertBefore(navigationDiv, scheduleHeader);

    // Setup navigation event listeners
    const prevBtn = document.querySelector('#scrollToPrevWeek');
    const nextBtn = document.querySelector('#scrollToNextWeek');

    prevBtn?.addEventListener('click', () => {
      this.scrollToWeek(1);
    });
    nextBtn?.addEventListener('click', () => {
      this.scrollToWeek(2);
    });
  }

  /**
   * Smooth scroll to specific week
   */
  private scrollToWeek(weekNum: 1 | 2): void {
    const scheduleHeader = document.querySelector(this.SCHEDULE_HEADER_SELECTOR);
    if (!scheduleHeader) return;

    const dayHeaders = scheduleHeader.querySelectorAll('.day-header');
    if (dayHeaders.length < 8) return; // Need at least 8 headers (Schicht + 7 days)

    // Calculate scroll position
    // Week 1: scroll to beginning, Week 2: scroll to show days 8-14
    const scrollPosition = weekNum === 1 ? 0 : scheduleHeader.scrollWidth / 2;

    scheduleHeader.scrollTo({
      left: scrollPosition,
      behavior: 'smooth',
    });

    this.currentWeek = weekNum;
    this.updateWeekInfo(`Woche ${weekNum}`);
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
      this.updateScrollIndicator();
      this.saveCurrentWeekData();
      this.loadWeekData(newWeek === 1 ? this.week1Data : this.week2Data);
    }
  }

  /**
   * Update scroll progress indicator
   */
  private updateScrollIndicator(): void {
    const progressBar = document.querySelector('#scrollProgress');
    if (!progressBar) return;

    const progress = this.currentWeek === 1 ? 0 : 100;
    (progressBar as HTMLElement).style.width = `${progress}%`;
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
      headerElement.dataset.day = index.toString();
      // Initially hidden until Kontischicht mode is activated
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
    const startDate = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day));

    // Add 7 days for week 2, plus day index
    const week2Day = new Date(startDate);
    week2Day.setDate(startDate.getDate() + 7 + dayIndex);

    return `${week2Day.getDate().toString().padStart(2, '0')}.${(week2Day.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  /**
   * Show week 2 headers when Kontischicht mode is active
   */
  private showWeek2Headers(): void {
    // Show all week 2 headers
    this.week2Headers.forEach((header) => {
      header.style.display = ''; // Reset to default display
    });
    console.info('Week 2 headers shown for horizontal scroll');
  }

  /**
   * Remove week 2 headers when disabling Kontischicht mode
   */
  private hideWeek2Headers(): void {
    this.week2Headers.forEach((header) => {
      header.remove();
    });
    this.week2Headers = [];
  }

  // Removed unused updateSliderButtons method

  /**
   * Update week info display
   */
  private updateWeekInfo(weekLabel: string): void {
    const weekInfo = document.querySelector('#currentWeekInfo');
    if (!(weekInfo instanceof HTMLElement)) return;

    const originalText = weekInfo.dataset.original ?? weekInfo.textContent;
    weekInfo.dataset.original ??= originalText;

    weekInfo.textContent = `${originalText} (${weekLabel})`;
  }

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
  }

  /**
   * Extract schedule data from current DOM state
   */
  private extractCurrentScheduleData(): WeekData {
    const data: WeekData = {};

    console.info('[KONTISCHICHT] Extracting schedule data from DOM...');

    // Map day names to WeekData keys
    const dayMapping: Record<string, keyof WeekData | undefined> = {
      monday: 'monday',
      tuesday: 'tuesday',
      wednesday: 'wednesday',
      thursday: 'thursday',
      friday: 'friday',
      saturday: 'saturday',
      sunday: 'sunday',
    };

    // Map shift types
    const shiftMapping: Record<string, keyof DaySchedule | undefined> = {
      early: 'early',
      late: 'late',
      night: 'night',
    };

    // Find all shift cells
    const shiftCells = document.querySelectorAll('.shift-cell');
    console.info(`[KONTISCHICHT] Found ${shiftCells.length} shift cells`);

    shiftCells.forEach((cell) => {
      if (!(cell instanceof HTMLElement)) return;

      // Get day and shift type from data attributes
      const day = cell.dataset.day;
      const shiftType = cell.dataset.shift;

      if (day === undefined || day === '' || shiftType === undefined || shiftType === '') {
        console.warn('[KONTISCHICHT] Shift cell missing data attributes:', cell);
        return;
      }

      // Convert to our keys
      const dayKey = dayMapping[day.toLowerCase()];
      const shiftKey = shiftMapping[shiftType.toLowerCase()];

      // Check if mappings exist (they could be undefined for unknown values)
      if (dayKey === undefined || shiftKey === undefined) {
        console.warn(`[KONTISCHICHT] Unknown day or shift: ${day}, ${shiftType}`);
        return;
      }

      // Initialize day schedule if not exists
      // eslint-disable-next-line security/detect-object-injection -- dayKey is validated from predefined mapping
      data[dayKey] ??= {
        early: [],
        late: [],
        night: [],
        free: [],
      };

      // Find all employee assignments in this cell
      const assignments = cell.querySelectorAll('.employee-assignment');
      assignments.forEach((assignment) => {
        // Look for employee badge with data-employee-id
        const badge = assignment.querySelector('.employee-badge[data-employee-id]');
        if (badge instanceof HTMLElement && badge.dataset.employeeId !== undefined && badge.dataset.employeeId !== '') {
          const employeeId = Number.parseInt(badge.dataset.employeeId, 10);
          if (!Number.isNaN(employeeId)) {
            // Add to the appropriate shift
            // eslint-disable-next-line security/detect-object-injection -- dayKey is validated from predefined mapping
            const daySchedule = data[dayKey];
            // eslint-disable-next-line security/detect-object-injection -- shiftKey is validated from predefined mapping
            if (daySchedule && !daySchedule[shiftKey].includes(employeeId)) {
              // eslint-disable-next-line security/detect-object-injection -- shiftKey is validated from predefined mapping
              daySchedule[shiftKey].push(employeeId);
              console.info(`[KONTISCHICHT] Added employee ${employeeId} to ${dayKey} ${shiftKey}`);
            }
          }
        }
      });
    });

    // Log the extracted data
    console.info('[KONTISCHICHT] Extracted week data:', data);

    // Find employees who are free (not assigned to any shift)
    const allEmployeeIds = new Set<number>();

    // Collect all available employees from employee list
    const employeeItems = document.querySelectorAll('.employee-item[data-employee-id]');
    employeeItems.forEach((item) => {
      if (item instanceof HTMLElement && item.dataset.employeeId !== undefined && item.dataset.employeeId !== '') {
        const id = Number.parseInt(item.dataset.employeeId, 10);
        if (!Number.isNaN(id)) {
          allEmployeeIds.add(id);
        }
      }
    });

    // Collect assigned employees for each day
    Object.keys(data).forEach((dayKey) => {
      const day = data[dayKey as keyof WeekData];
      if (day) {
        const dayAssigned = new Set<number>();
        day.early.forEach((id) => dayAssigned.add(id));
        day.late.forEach((id) => dayAssigned.add(id));
        day.night.forEach((id) => dayAssigned.add(id));

        // Mark free employees for this day
        allEmployeeIds.forEach((id) => {
          if (!dayAssigned.has(id) && !day.free.includes(id)) {
            day.free.push(id);
            console.info(`[KONTISCHICHT] Marked employee ${id} as free on ${dayKey}`);
          }
        });
      }
    });

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
   * Handle save operation for Kontischicht pattern
   */
  private async handleSave(): Promise<void> {
    console.info('💾 Saving Kontischicht pattern...');

    // Save current week data before processing
    this.saveCurrentWeekData();

    // Validate that both weeks have data
    if (Object.keys(this.week1Data).length === 0 && Object.keys(this.week2Data).length === 0) {
      // Using a custom notification instead of alert
      this.showErrorMessage('Bitte tragen Sie Schichten für mindestens eine Woche ein.');
      return;
    }

    try {
      const pattern = this.createKontischichtPattern();
      await this.savePattern(pattern);

      // Show success message
      this.showSuccessMessage('Kontischicht Muster erfolgreich gespeichert!');
    } catch (error) {
      console.error('❌ Error saving Kontischicht pattern:', error);
      // Check if it's an overlap error from the database trigger
      if (error instanceof Error) {
        const errorMessage = error.message;
        if (errorMessage.includes('Überlappung') || errorMessage.includes('existiert bereits')) {
          this.showErrorMessage(
            '⚠️ ÜBERLAPPUNG ERKANNT: Es existieren bereits Schichten für dieses Team in diesem Zeitraum! Bitte löschen Sie zuerst die bestehenden Schichten oder wählen Sie einen anderen Zeitraum.',
          );
        } else {
          this.showErrorMessage('Fehler beim Speichern des Kontischicht Musters: ' + errorMessage);
        }
      } else {
        this.showErrorMessage('Fehler beim Speichern des Kontischicht Musters. Bitte versuchen Sie es erneut.');
      }
    }
  }

  /**
   * Create Kontischicht pattern object
   */
  private createKontischichtPattern(): KontischichtPattern {
    const currentWeekInfo = document.querySelector('#currentWeekInfo')?.textContent ?? '';
    const teamId = this.getCurrentTeamId();

    // Use the selected pattern type if available
    const patternType = this.selectedPattern?.patternType ?? 'custom';
    const cycleLengthWeeks = this.selectedPattern?.cycleLengthWeeks ?? 2;

    // Use dates from selected pattern
    const startDate = this.selectedPattern?.startsAt ?? this.getCurrentStartDate();
    const endDate =
      this.selectedPattern?.endsAt ?? this.getEndOfFirstWeekNextYear(new Date()).toISOString().split('T')[0];

    console.info(`[KONTISCHICHT] Creating pattern with type: ${patternType}, cycleWeeks: ${cycleLengthWeeks}`);
    console.info(`[KONTISCHICHT] Date range: ${startDate} to ${endDate}`);

    return {
      name: this.selectedPattern?.name ?? `Kontischicht ${currentWeekInfo}`,
      patternType: patternType,
      cycleLengthWeeks: cycleLengthWeeks,
      employeeCount: this.selectedPattern?.employeeCount,
      patternConfig: {
        customPattern: {
          week1: this.week1Data,
          week2: this.week2Data,
        },
        rotationType: 'forward' as const,
        shiftDuration: 2, // 2 days per shift type (2-2-2 rotation)
      },
      startsAt: startDate,
      endsAt: endDate,
      teamId,
    };
  }

  /**
   * Get current team ID from UI state
   */
  private getCurrentTeamId(): number | undefined {
    // TODO: Extract team ID from current UI state
    return undefined;
  }

  /**
   * Get current start date in ISO format
   */
  private getCurrentStartDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get current selected pattern for external use
   */
  public getSelectedPattern(): KontischichtPattern | null {
    return this.selectedPattern;
  }

  /**
   * Check if Kontischicht is currently active
   */
  public isKontischichtActive(): boolean {
    return this.checkbox?.checked ?? false;
  }

  /**
   * Save pattern via API
   */
  private async savePattern(pattern: KontischichtPattern): Promise<void> {
    // Use the existing rotation API endpoint
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken === null || accessToken === '') {
      throw new Error('No access token available');
    }

    const response = await fetch('/api/v2/shifts/rotation', {
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
   * Show success message
   */
  private showSuccessMessage(message: string): void {
    // Create success overlay (following design standards)
    const overlay = document.createElement('div');
    overlay.className = 'success-overlay';

    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'success-icon';
    const icon = document.createElement('i');
    icon.className = 'fas fa-check-circle';
    iconDiv.append(icon);

    const textDiv = document.createElement('div');
    textDiv.className = 'success-text';
    textDiv.textContent = message;

    successDiv.append(iconDiv);
    successDiv.append(textDiv);
    overlay.append(successDiv);

    document.body.append(overlay);

    // Remove after animation
    setTimeout(() => {
      overlay.remove();
    }, 2000);
  }

  /**
   * Show error message
   */
  private showErrorMessage(message: string): void {
    // Create error overlay (following design standards)
    const overlay = document.createElement('div');
    overlay.className = 'error-overlay';

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'error-icon';
    const icon = document.createElement('i');
    icon.className = 'fas fa-exclamation-circle';
    iconDiv.append(icon);

    const textDiv = document.createElement('div');
    textDiv.className = 'error-text';
    textDiv.textContent = message;

    errorDiv.append(iconDiv);
    errorDiv.append(textDiv);
    overlay.append(errorDiv);

    document.body.append(overlay);

    // Remove after animation
    setTimeout(() => {
      overlay.remove();
    }, 3000);
  }

  /**
   * Check if Kontischicht mode is currently active
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
export const kontischichtManager = new KontischichtManager();

// Make it globally available for other modules
declare global {
  interface Window {
    kontischichtManager: KontischichtManager;
  }
}
window.kontischichtManager = kontischichtManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    kontischichtManager.init();

    // Event delegation for change pattern button
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle change pattern
      const changeBtn = target.closest<HTMLElement>('[data-action="change-pattern"]');
      if (changeBtn) {
        kontischichtManager.changePattern();
      }
    });
  });
} else {
  kontischichtManager.init();

  // Event delegation for change pattern button
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle change pattern
    const changeBtn = target.closest<HTMLElement>('[data-action="change-pattern"]');
    if (changeBtn) {
      kontischichtManager.changePattern();
    }
  });
}
