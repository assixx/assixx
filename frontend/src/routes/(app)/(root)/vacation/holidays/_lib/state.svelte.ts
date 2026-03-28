// =============================================================================
// VACATION HOLIDAYS — REACTIVE STATE (Svelte 5 Runes)
// Holiday list, create/edit modal, delete confirm modal
// =============================================================================

import type { VacationHoliday } from './types';

// ─── Data ───────────────────────────────────────────────────────────

let holidays = $state<VacationHoliday[]>([]);
let selectedYear = $state(new Date().getFullYear());

// ─── UI ─────────────────────────────────────────────────────────────

let isLoading = $state(false);

// Form modal
let showHolidayForm = $state(false);
let editingHoliday = $state<VacationHoliday | null>(null);

// Delete confirm modal
let showDeleteConfirm = $state(false);
let deletingHoliday = $state<VacationHoliday | null>(null);

// ─── Derived ────────────────────────────────────────────────────────

/** Sort holidays by date ascending */
const sortedHolidays = $derived(
  [...holidays].sort((a, b) => a.holidayDate.localeCompare(b.holidayDate)),
);

const recurringCount = $derived(holidays.filter((h) => h.recurring).length);

const oneTimeCount = $derived(holidays.filter((h) => !h.recurring).length);

// ─── Methods ────────────────────────────────────────────────────────

function openCreateHoliday() {
  editingHoliday = null;
  showHolidayForm = true;
}

function openEditHoliday(holiday: VacationHoliday) {
  editingHoliday = holiday;
  showHolidayForm = true;
}

function closeHolidayForm() {
  showHolidayForm = false;
  editingHoliday = null;
}

function openDeleteHoliday(holiday: VacationHoliday) {
  deletingHoliday = holiday;
  showDeleteConfirm = true;
}

function closeDeleteHoliday() {
  showDeleteConfirm = false;
  deletingHoliday = null;
}

function reset() {
  holidays = [];
  selectedYear = new Date().getFullYear();
  isLoading = false;
  showHolidayForm = false;
  editingHoliday = null;
  showDeleteConfirm = false;
  deletingHoliday = null;
}

export const holidaysState = {
  // Data getters
  get holidays() {
    return holidays;
  },
  get sortedHolidays() {
    return sortedHolidays;
  },
  get selectedYear() {
    return selectedYear;
  },
  get recurringCount() {
    return recurringCount;
  },
  get oneTimeCount() {
    return oneTimeCount;
  },

  // Data setters
  setHolidays: (data: VacationHoliday[]) => {
    holidays = data;
  },
  setSelectedYear: (year: number) => {
    selectedYear = year;
  },

  // UI getters
  get isLoading() {
    return isLoading;
  },
  get showHolidayForm() {
    return showHolidayForm;
  },
  get editingHoliday() {
    return editingHoliday;
  },
  get showDeleteConfirm() {
    return showDeleteConfirm;
  },
  get deletingHoliday() {
    return deletingHoliday;
  },

  // UI setters
  setLoading: (val: boolean) => {
    isLoading = val;
  },

  // Holiday form
  openCreateHoliday,
  openEditHoliday,
  closeHolidayForm,

  // Delete confirm
  openDeleteHoliday,
  closeDeleteHoliday,

  // Global
  reset,
};
