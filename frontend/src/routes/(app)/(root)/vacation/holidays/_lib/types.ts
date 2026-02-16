/**
 * Vacation Holidays — Frontend Type Definitions
 * Mirrors backend vacation.types.ts for holidays.
 */

// ─── API response types ─────────────────────────────────────────────

export interface VacationHoliday {
  id: string;
  holidayDate: string;
  name: string;
  recurring: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Create / Update payloads ───────────────────────────────────────

export interface CreateHolidayPayload {
  holidayDate: string;
  name: string;
  recurring: boolean;
}

export interface UpdateHolidayPayload {
  holidayDate?: string;
  name?: string;
  recurring?: boolean;
}

// ─── SSR page data ──────────────────────────────────────────────────

export interface VacationHolidaysPageData {
  holidays: VacationHoliday[];
  currentYear: number;
}
