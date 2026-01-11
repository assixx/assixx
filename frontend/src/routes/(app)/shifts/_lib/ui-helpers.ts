// =============================================================================
// SHIFTS - UI HELPERS
// Based on: frontend/src/scripts/shifts/ui.ts + week-renderer.ts
// Adapted for Svelte 5 (pure functions, no DOM manipulation)
// =============================================================================

import {
  AVAILABILITY_LABELS,
  AVAILABILITY_ICONS,
  AVAILABILITY_COLORS,
  SHIFT_TIMES,
} from './constants';
import { getEffectiveAvailability } from './utils';

import type { Employee, AvailabilityStatus, ShiftType } from './types';

// =============================================================================
// EMPLOYEE DISPLAY
// =============================================================================

/**
 * Get display name for an employee
 */
export function getEmployeeDisplayName(employee: Employee): string {
  const firstName = employee.firstName ?? '';
  const lastName = employee.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : employee.username;
}

/**
 * Get initials for an employee (for avatar display)
 */
export function getEmployeeInitials(employee: Employee): string {
  const firstName = employee.firstName ?? '';
  const lastName = employee.lastName ?? '';

  if (firstName !== '' && lastName !== '') {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }

  if (firstName !== '') {
    return firstName.substring(0, 2).toUpperCase();
  }

  if (lastName !== '') {
    return lastName.substring(0, 2).toUpperCase();
  }

  return employee.username.substring(0, 2).toUpperCase();
}

// =============================================================================
// AVAILABILITY DISPLAY
// =============================================================================

/**
 * Get availability badge info for display
 */
export function getAvailabilityBadgeInfo(status: AvailabilityStatus): {
  label: string;
  icon: string;
  colorClass: string;
} {
  return {
    label: AVAILABILITY_LABELS[status],
    icon: AVAILABILITY_ICONS[status],
    colorClass: AVAILABILITY_COLORS[status],
  };
}

/**
 * Get effective availability info for an employee on a specific date
 */
export function getEmployeeAvailabilityInfo(
  employee: Employee,
  date: Date,
): {
  status: AvailabilityStatus;
  label: string;
  icon: string;
  colorClass: string;
  isAvailable: boolean;
} {
  const status = getEffectiveAvailability(employee, date);
  const badgeInfo = getAvailabilityBadgeInfo(status);

  return {
    status,
    ...badgeInfo,
    isAvailable: status === 'available',
  };
}

// =============================================================================
// SHIFT DISPLAY
// =============================================================================

/**
 * Get shift display info
 */
export function getShiftDisplayInfo(shiftType: ShiftType): {
  label: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  colorClass: string;
} {
  const shiftInfo = SHIFT_TIMES[shiftType];

  return {
    label: shiftInfo.label,
    startTime: shiftInfo.start,
    endTime: shiftInfo.end,
    timeRange: `${shiftInfo.start} - ${shiftInfo.end}`,
    colorClass: `shift-type-${shiftType}`,
  };
}

/**
 * Get shift name in German
 */
export function getShiftName(shiftType: string): string {
  const shiftNames = new Map<string, string>([
    ['early', 'Frühschicht'],
    ['late', 'Spätschicht'],
    ['night', 'Nachtschicht'],
    ['F', 'Frühschicht'],
    ['S', 'Spätschicht'],
    ['N', 'Nachtschicht'],
  ]);
  return shiftNames.get(shiftType) ?? shiftType;
}

// =============================================================================
// WEEK DISPLAY
// =============================================================================

/**
 * Format week info for display (KW X - DD.MM.YYYY bis DD.MM.YYYY)
 */
export function formatWeekInfo(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekNumber = getWeekNumber(weekStart);
  const startStr = formatDateGerman(weekStart);
  const endStr = formatDateGerman(weekEnd);

  return `KW ${weekNumber} - ${startStr} bis ${endStr}`;
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() !== 0 ? d.getUTCDay() : 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Format date in German format (DD.MM.YYYY)
 */
function formatDateGerman(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
}

/**
 * Get day header info for display
 */
export function getDayHeaderInfo(date: Date): {
  dayName: string;
  dayShort: string;
  dateStr: string;
  isToday: boolean;
  isWeekend: boolean;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  const dayOfWeek = date.getDay();
  const dayNames = [
    'Sonntag',
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag',
  ];
  const dayNamesShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  return {
    dayName: dayNames[dayOfWeek] ?? '',
    dayShort: dayNamesShort[dayOfWeek] ?? '',
    dateStr: `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`,
    isToday: checkDate.getTime() === today.getTime(),
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  };
}

// =============================================================================
// LOCK MODE DISPLAY
// =============================================================================

/**
 * Get lock mode button info
 */
export function getLockModeButtonInfo(isLocked: boolean): {
  text: string;
  icon: string;
  title: string;
  colorClass: string;
} {
  if (isLocked) {
    return {
      text: 'Bearbeiten',
      icon: 'fa-edit',
      title: 'Schichtplan bearbeiten',
      colorClass: 'btn-primary',
    };
  }

  return {
    text: 'Sperren',
    icon: 'fa-lock',
    title: 'Schichtplan sperren',
    colorClass: 'btn-warning',
  };
}

// =============================================================================
// EMPTY STATE DISPLAY
// =============================================================================

/**
 * Get empty shift cell info
 */
export function getEmptyShiftCellInfo(): {
  text: string;
  icon: string;
} {
  return {
    text: '+',
    icon: 'fa-plus',
  };
}

/**
 * Get no employees message
 */
export function getNoEmployeesMessage(teamSelected: boolean): string {
  if (!teamSelected) {
    return 'Wählen Sie ein Team aus, um Mitarbeiter zu sehen';
  }
  return 'Keine Mitarbeiter im ausgewählten Team gefunden';
}
