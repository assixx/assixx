/**
 * Constants for Shift Planning System
 * Extracted from index.ts for modular architecture
 */

// CSS Selectors for DOM queries
export const CSS_SELECTORS = {
  EMPLOYEE_ITEM: '.employee-item',
  SHIFT_CELL: '.shift-cell',
  EMPLOYEE_ASSIGNMENT: '.employee-assignment',
  SHIFT_HEADER: '.shift-header',
} as const;

// DOM Element IDs
export const DOM_IDS = {
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
  SHIFT_ROTATION: 'shift-rotation',
} as const;

// CSS Classes to avoid duplicate strings
export const CSS_CLASSES = {
  DROPDOWN_OPTION: 'dropdown__option',
  DROPDOWN_MESSAGE: 'dropdown__message',
  EMPLOYEE_NAME: 'employee-name',
  EMPLOYEE_ITEM: 'employee-item',
  HIDDEN: 'hidden',
  ACTIVE: 'active',
  DRAGGING: 'dragging',
  DRAG_OVER: 'drag-over',
  ASSIGNED: 'assigned',
} as const;

// Display values for visibility toggling
export const DISPLAY = {
  NONE: 'none',
  BLOCK: 'block',
  INLINE_BLOCK: 'inline-block',
  FLEX: 'flex',
} as const;

// Error Messages for user feedback
export const ERROR_MESSAGES = {
  SHIFT_ASSIGNMENT_FAILED: 'Fehler beim Zuweisen der Schicht',
  NO_DEPARTMENT_SELECTED: 'Bitte wählen Sie zuerst eine Abteilung aus',
  NO_TEAM_SELECTED: 'Bitte wählen Sie zuerst ein Team aus',
  INVALID_HIERARCHY: 'Ungültige Auswahl-Hierarchie',
  LOAD_FAILED: 'Fehler beim Laden der Daten',
  SAVE_FAILED: 'Fehler beim Speichern',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  SHIFT_ASSIGNED: 'Schicht erfolgreich zugewiesen',
  SCHEDULE_SAVED: 'Schichtplan erfolgreich gespeichert!',
  SCHEDULE_UPDATED: 'Schichtplan wurde aktualisiert',
  SCHEDULE_RESET: 'Schichtplan wurde zurückgesetzt',
  PLAN_DELETED: 'Schichtplan wurde aus der Datenbank gelöscht',
} as const;

// Shift time mappings
export const SHIFT_TIMES = {
  early: { start: '06:00', end: '14:00', label: 'Frühschicht' },
  late: { start: '14:00', end: '22:00', label: 'Spätschicht' },
  night: { start: '22:00', end: '06:00', label: 'Nachtschicht' },
  F: { start: '06:00', end: '14:00', label: 'Frühschicht' },
  S: { start: '14:00', end: '22:00', label: 'Spätschicht' },
  N: { start: '22:00', end: '06:00', label: 'Nachtschicht' },
} as const;

// Shift type conversions (frontend to API)
export const SHIFT_TYPE_MAP = {
  early: 'F',
  late: 'S',
  night: 'N',
} as const;

// Day names for display
export const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

// Full day names
export const FULL_DAY_NAMES = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const;

// Admin roles that can edit shifts
export const ADMIN_ROLES = ['admin', 'root', 'manager', 'team_lead'] as const;

// Local storage keys
export const STORAGE_KEYS = {
  RELOAD_CONTEXT: 'shiftsReloadContext',
  ACTIVE_ROLE: 'activeRole',
} as const;

// Dropdown placeholders for cascading selection
export const DROPDOWN_PLACEHOLDERS = {
  AREA: 'Bereich wählen...',
  DEPARTMENT: 'Abteilung wählen...',
  MACHINE: 'Maschine wählen...',
  TEAM: 'Team wählen...',
  AWAIT_AREA: 'Erst Bereich wählen...',
  AWAIT_DEPARTMENT: 'Erst Abteilung wählen...',
  AWAIT_MACHINE: 'Erst Maschine wählen...',
} as const;
