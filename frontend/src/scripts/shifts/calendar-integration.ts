/**
 * Shifts in Calendar Integration
 * Shows user's shift assignments (F/S/N) in the calendar view
 */

import { getAuthToken } from '../auth/index';
import { $$id } from '../../utils/dom-utils';

interface UserShift {
  date: string;
  type: 'F' | 'S' | 'N';
}

interface ShiftApiResponse {
  success: boolean;
  data: UserShift[];
}

// FullCalendar types (matching calendar.ts)
interface FullCalendarApi {
  view: {
    activeStart: Date;
    activeEnd: Date;
  };
  on(eventName: string, callback: (info: FullCalendarDatesSetInfo) => void): void;
}

interface FullCalendarDatesSetInfo {
  start: Date;
  end: Date;
}

export class ShiftCalendarIntegration {
  private showShifts = false;
  private shiftsCache = new Map<string, UserShift>();
  private calendar: FullCalendarApi | null = null;

  constructor() {
    // Load saved preference from localStorage
    this.showShifts = localStorage.getItem('showShiftsInCalendar') === 'true';
  }

  /**
   * Initialize the shift calendar integration
   * @param calendar - FullCalendar instance
   */
  public init(calendar: FullCalendarApi): void {
    this.calendar = calendar;
    this.addCheckbox();

    // If shifts should be shown, fetch them
    if (this.showShifts) {
      const checkbox = $$id('showShiftsCheckbox') as HTMLInputElement | null;
      if (checkbox) {
        checkbox.checked = true;
      }
      void this.onCheckboxChange(true);
    }

    // Listen to calendar navigation events
    calendar.on('datesSet', (info: FullCalendarDatesSetInfo) => {
      if (this.showShifts) {
        void this.fetchAndRenderShifts(info.start, info.end);
      }
    });
  }

  /**
   * Add the checkbox to the filter bar
   */
  private addCheckbox(): void {
    // Find the legend container
    const legendLabel = [...document.querySelectorAll('.form-label')].find((el) => el.textContent.includes('Legende'));

    if (!legendLabel) {
      console.warn('[SHIFTS-IN-CALENDAR] Legend label not found');
      return;
    }

    const legendContainer = legendLabel.parentElement;
    if (!legendContainer) return;

    // Create checkbox container
    const checkboxDiv = document.createElement('div');
    checkboxDiv.className = 'form-group';
    checkboxDiv.style.marginRight = '20px';
    checkboxDiv.style.display = 'flex';
    checkboxDiv.style.alignItems = 'center';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'showShiftsCheckbox';
    checkbox.className = 'form-checkbox';
    checkbox.style.marginRight = '8px';

    checkbox.checked = this.showShifts;
    checkbox.addEventListener('change', () => {
      void this.onCheckboxChange(checkbox.checked);
    });

    const label = document.createElement('label');
    label.htmlFor = 'showShiftsCheckbox';
    label.className = 'form-label';
    label.style.margin = '0';
    label.style.cursor = 'pointer';
    label.style.whiteSpace = 'nowrap';
    label.textContent = 'Schicht anzeigen';

    checkboxDiv.append(checkbox, label);

    // Insert before legend
    legendContainer.parentElement?.insertBefore(checkboxDiv, legendContainer);
  }

  /**
   * Handle checkbox state change
   */
  private async onCheckboxChange(checked: boolean): Promise<void> {
    this.showShifts = checked;
    localStorage.setItem('showShiftsInCalendar', String(checked));

    if (checked && this.calendar) {
      // Get current calendar view dates
      const view = this.calendar.view;
      await this.fetchAndRenderShifts(view.activeStart, view.activeEnd);
    } else {
      // Remove all shift indicators
      this.removeAllShiftIndicators();
    }
  }

  /**
   * Fetch user's shifts from API
   */
  private async fetchUserShifts(startDate: Date, endDate: Date): Promise<UserShift[]> {
    try {
      // Verify user is logged in
      const userStr = localStorage.getItem('user');
      if (userStr === null) {
        console.warn('[SHIFTS-IN-CALENDAR] No user logged in');
        return [];
      }

      const token = getAuthToken();
      if (token === null || token === '') {
        console.warn('[SHIFTS-IN-CALENDAR] No auth token');
        return [];
      }

      // Format dates as YYYY-MM-DD
      const start = this.formatDate(startDate);
      const end = this.formatDate(endDate);

      // Call v2 API endpoint
      const response = await fetch(`/api/v2/shifts/my-calendar-shifts?startDate=${start}&endDate=${end}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[SHIFTS-IN-CALENDAR] Failed to fetch shifts:', response.status);
        return [];
      }

      const data = (await response.json()) as ShiftApiResponse;
      return data.data;
    } catch (error) {
      console.error('[SHIFTS-IN-CALENDAR] Error fetching shifts:', error);
      return [];
    }
  }

  /**
   * Fetch and render shifts for the current view
   */
  private async fetchAndRenderShifts(startDate: Date, endDate: Date): Promise<void> {
    const shifts = await this.fetchUserShifts(startDate, endDate);

    // Clear cache and rebuild
    this.shiftsCache.clear();
    shifts.forEach((shift) => {
      // Convert date string to YYYY-MM-DD format (remove time part)
      const dateOnly = shift.date.split('T')[0];
      this.shiftsCache.set(dateOnly, shift);
    });

    // Render indicators
    this.renderShiftIndicators();
  }

  /**
   * Render shift indicators in calendar cells
   */
  private renderShiftIndicators(): void {
    // Remove existing indicators first
    this.removeAllShiftIndicators();

    // Find all day cells in the calendar
    const dayCells = document.querySelectorAll('.fc-daygrid-day');

    dayCells.forEach((cell) => {
      const dateAttr = (cell as HTMLElement).dataset.date;
      if (dateAttr === undefined || dateAttr === '') return;

      const shift = this.shiftsCache.get(dateAttr);
      if (shift === undefined) return;

      // Find the day number element
      const dayTopElement = cell.querySelector('.fc-daygrid-day-top');
      if (!dayTopElement) return;

      // Create shift indicator
      const indicator = document.createElement('div');
      indicator.className = `shift-indicator shift-${shift.type}`;
      indicator.setAttribute('aria-label', `Schicht: ${this.getShiftName(shift.type)}`);
      indicator.textContent = shift.type;

      // Add to day cell
      dayTopElement.append(indicator);
    });
  }

  /**
   * Remove all shift indicators
   */
  private removeAllShiftIndicators(): void {
    const indicators = document.querySelectorAll('.shift-indicator');
    indicators.forEach((indicator) => {
      indicator.remove();
    });
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get friendly name for shift type
   */
  private getShiftName(type: 'F' | 'S' | 'N'): string {
    switch (type) {
      case 'F':
        return 'Frühschicht';
      case 'S':
        return 'Spätschicht';
      case 'N':
        return 'Nachtschicht';
      default:
        return type;
    }
  }
}

// Export singleton instance
export const shiftCalendarIntegration = new ShiftCalendarIntegration();
