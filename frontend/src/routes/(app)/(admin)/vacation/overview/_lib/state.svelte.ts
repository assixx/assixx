// =============================================================================
// VACATION OVERVIEW — REACTIVE STATE (Svelte 5 Runes)
// Cascade: Machine → Team → Year → Month → Calendar
// =============================================================================

import type {
  BlackoutPeriod,
  CalendarDayCell,
  CalendarUserRow,
  MachineAvailabilityEntry,
  MachineListItem,
  StaffingRule,
  TeamCalendarData,
  TeamCalendarEntry,
  TeamListItem,
  VacationBalance,
  VacationHalfDay,
  YearMonthCell,
  YearMonthVacationSummary,
  YearUserRow,
} from './types';

// ─── Data ───────────────────────────────────────────────────────────

let machines = $state<MachineListItem[]>([]);
let teams = $state<TeamListItem[]>([]);
let blackouts = $state<BlackoutPeriod[]>([]);
let staffingRules = $state<StaffingRule[]>([]);
let calendarData = $state<TeamCalendarData | null>(null);
let balance = $state<VacationBalance | null>(null);

// ─── Cascade selection ──────────────────────────────────────────────

let selectedMachineId = $state<number | null>(null);
let selectedTeamId = $state<number | null>(null);
let selectedYear = $state<number | null>(null);
let selectedMonth = $state<number | null>(null);

// ─── Year overview ───────────────────────────────────────────────

let yearCalendarData = $state<TeamCalendarData[] | null>(null);

// ─── Machine availability ───────────────────────────────────────────

let machineAvailEntries = $state<MachineAvailabilityEntry[]>([]);

// ─── UI ─────────────────────────────────────────────────────────────

let isLoading = $state(false);
let isLoadingTeams = $state(false);
let isLoadingCalendar = $state(false);
let isLoadingBalance = $state(false);
let isLoadingYearCalendar = $state(false);

// ─── Derived ────────────────────────────────────────────────────────

/** Whether team dropdown is enabled (machine selected AND teams loaded) */
const canSelectTeam = $derived(selectedMachineId !== null && !isLoadingTeams);

/** Whether year dropdown is enabled (team selected) */
const canSelectYear = $derived(selectedTeamId !== null);

/** Whether month dropdown is enabled (year selected) */
const canSelectMonth = $derived(selectedYear !== null);

/** Number of days in the selected month */
const daysInMonth = $derived(
  selectedYear !== null && selectedMonth !== null ?
    new Date(selectedYear, selectedMonth, 0).getDate()
  : 0,
);

/**
 * Map of day numbers (1-based) that fall within a blackout period.
 * Value = blackout name for tooltip.
 */
const blackoutDays = $derived.by((): Map<number, string> => {
  const result = new Map<number, string>();
  if (blackouts.length === 0 || selectedYear === null || selectedMonth === null)
    return result;

  const monthStartDate = new Date(selectedYear, selectedMonth - 1, 1);
  const monthEndDate = new Date(selectedYear, selectedMonth - 1, daysInMonth);

  for (const bo of blackouts) {
    const boStart = new Date(bo.startDate + 'T00:00:00');
    const boEnd = new Date(bo.endDate + 'T00:00:00');

    if (boEnd < monthStartDate || boStart > monthEndDate) continue;

    const rangeStart = boStart > monthStartDate ? boStart : monthStartDate;
    const rangeEnd = boEnd < monthEndDate ? boEnd : monthEndDate;

    const current = new Date(rangeStart);
    while (current <= rangeEnd) {
      result.set(current.getDate(), bo.name);
      current.setDate(current.getDate() + 1);
    }
  }

  return result;
});

/** Map of day numbers (1-based) to machine availability status. */
const machineAvailDays = $derived.by((): Map<number, string> => {
  if (
    machineAvailEntries.length === 0 ||
    selectedYear === null ||
    selectedMonth === null
  )
    return new Map();

  return buildAvailDayMap(
    machineAvailEntries,
    selectedYear,
    selectedMonth,
    daysInMonth,
  );
});

/** Selected machine name */
const selectedMachineName = $derived.by(() => {
  if (selectedMachineId === null) return '';
  return machines.find((m) => m.id === selectedMachineId)?.name ?? '';
});

/** Selected team name */
const selectedTeamName = $derived.by(() => {
  if (selectedTeamId === null) return '';
  return teams.find((t) => t.id === selectedTeamId)?.name ?? '';
});

/** Transform calendar entries into a grid structure for rendering */
const calendarGrid = $derived.by((): CalendarUserRow[] => {
  if (calendarData === null || selectedYear === null || selectedMonth === null)
    return [];

  const userMap = new Map<
    number,
    { userName: string; entries: TeamCalendarEntry[] }
  >();

  for (const entry of calendarData.entries) {
    const existing = userMap.get(entry.userId);
    if (existing !== undefined) {
      existing.entries.push(entry);
    } else {
      userMap.set(entry.userId, {
        userName: entry.userName,
        entries: [entry],
      });
    }
  }

  const rows: CalendarUserRow[] = [];

  for (const [userId, { userName, entries }] of userMap) {
    const days = new Map<number, CalendarDayCell>();

    for (const entry of entries) {
      fillDaysFromEntry(days, entry);
    }

    rows.push({ userId, userName, days });
  }

  rows.sort((a, b) => a.userName.localeCompare(b.userName, 'de'));

  return rows;
});

// ─── Year overview derived ───────────────────────────────────────

/** Whether the year overview is active (year selected, no month) */
const showYearOverview = $derived(
  selectedYear !== null && selectedMonth === null,
);

/** Transform 12 months of calendar data into a year grid for rendering */
const yearGrid = $derived.by((): YearUserRow[] => {
  if (yearCalendarData === null || yearCalendarData.length === 0) return [];

  const userMap = buildYearUserMap(yearCalendarData);
  return buildYearRows(userMap);
});

/** Map of month numbers (1-12) that contain at least one blackout day. */
const yearBlackoutMonths = $derived.by((): Map<number, string> => {
  if (blackouts.length === 0 || selectedYear === null) return new Map();
  return buildYearBlackoutMap(blackouts, selectedYear);
});

// ─── Year overview helpers (extracted to reduce cognitive complexity) ─

interface YearUserMapEntry {
  userName: string;
  months: Map<number, YearMonthCell>;
}

/** Build a user map from 12 months of calendar data. */
function buildYearUserMap(
  data: TeamCalendarData[],
): Map<number, YearUserMapEntry> {
  const userMap = new Map<number, YearUserMapEntry>();

  for (const monthData of data) {
    processMonthEntries(userMap, monthData);
  }

  return userMap;
}

/** Process entries for a single month into the user map. */
function processMonthEntries(
  userMap: Map<number, YearUserMapEntry>,
  monthData: TeamCalendarData,
): void {
  for (const entry of monthData.entries) {
    let user = userMap.get(entry.userId);
    if (user === undefined) {
      user = { userName: entry.userName, months: new Map() };
      userMap.set(entry.userId, user);
    }

    const dayCount = countEntryDaysInMonth(
      entry,
      monthData.year,
      monthData.month,
    );
    if (dayCount === 0) continue;

    addToYearMonthCell(user.months, monthData.month, {
      vacationType: entry.vacationType,
      days: dayCount,
    });
  }
}

/** Convert user map to sorted YearUserRow array. */
function buildYearRows(userMap: Map<number, YearUserMapEntry>): YearUserRow[] {
  const rows: YearUserRow[] = [];

  for (const [userId, { userName, months }] of userMap) {
    let totalDays = 0;
    for (const cell of months.values()) {
      totalDays += cell.totalDays;
    }
    rows.push({ userId, userName, months, totalDays });
  }

  rows.sort((a, b) => a.userName.localeCompare(b.userName, 'de'));
  return rows;
}

/** Build a map of months (1-12) → blackout name for a given year. */
function buildYearBlackoutMap(
  periods: BlackoutPeriod[],
  year: number,
): Map<number, string> {
  const result = new Map<number, string>();

  for (const bo of periods) {
    const boStart = new Date(bo.startDate + 'T00:00:00');
    const boEnd = new Date(bo.endDate + 'T00:00:00');
    fillBlackoutMonths(result, boStart, boEnd, year);
  }

  return result;
}

/** Mark months that overlap with a blackout period. */
function fillBlackoutMonths(
  result: Map<number, string>,
  boStart: Date,
  boEnd: Date,
  year: number,
): void {
  for (let m = 1; m <= 12; m++) {
    if (result.has(m)) continue;
    const monthStart = new Date(year, m - 1, 1);
    const monthEnd = new Date(year, m, 0);
    if (boEnd >= monthStart && boStart <= monthEnd) {
      result.set(m, '');
    }
  }
}

// ─── Year overview helpers (entry-level) ────────────────────────

/** Count how many days an entry occupies within a specific month. */
function countEntryDaysInMonth(
  entry: TeamCalendarEntry,
  year: number,
  month: number,
): number {
  const entryStart = new Date(entry.startDate + 'T00:00:00');
  const entryEnd = new Date(entry.endDate + 'T00:00:00');
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const rangeStart = entryStart > monthStart ? entryStart : monthStart;
  const rangeEnd = entryEnd < monthEnd ? entryEnd : monthEnd;

  if (rangeStart > rangeEnd) return 0;

  let count = 0;
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Add a vacation summary to a month cell, merging same types. */
function addToYearMonthCell(
  months: Map<number, YearMonthCell>,
  month: number,
  summary: YearMonthVacationSummary,
): void {
  const existing = months.get(month);
  if (existing !== undefined) {
    const sameType = existing.entries.find(
      (e) => e.vacationType === summary.vacationType,
    );
    if (sameType !== undefined) {
      sameType.days += summary.days;
    } else {
      existing.entries.push({ ...summary });
    }
    existing.totalDays += summary.days;
  } else {
    months.set(month, {
      totalDays: summary.days,
      entries: [{ ...summary }],
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Fill day numbers from a single availability entry, clipped to month bounds. */
function fillAvailDays(
  result: Map<number, string>,
  entry: MachineAvailabilityEntry,
  monthStart: Date,
  monthEnd: Date,
): void {
  const entryStart = new Date(entry.startDate + 'T00:00:00');
  const entryEnd = new Date(entry.endDate + 'T00:00:00');

  if (entryEnd < monthStart || entryStart > monthEnd) return;

  const rangeStart = entryStart > monthStart ? entryStart : monthStart;
  const rangeEnd = entryEnd < monthEnd ? entryEnd : monthEnd;

  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const dayNum = cursor.getDate();
    if (!result.has(dayNum)) {
      result.set(dayNum, entry.status);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
}

/**
 * Build a day-number-to-status map from availability entries,
 * clipped to the given month. First entry wins per day.
 */
function buildAvailDayMap(
  entries: MachineAvailabilityEntry[],
  year: number,
  month: number,
  days: number,
): Map<number, string> {
  const result = new Map<number, string>();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, days);

  for (const entry of entries) {
    if (entry.status === 'operational') continue;
    fillAvailDays(result, entry, monthStart, monthEnd);
  }

  return result;
}

/** Fill day cells from a single calendar entry, clipped to the selected month. */
function fillDaysFromEntry(
  days: Map<number, CalendarDayCell>,
  entry: TeamCalendarEntry,
): void {
  if (selectedYear === null || selectedMonth === null) return;

  const entryStart = new Date(entry.startDate + 'T00:00:00');
  const entryEnd = new Date(entry.endDate + 'T00:00:00');

  const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
  const monthEnd = new Date(selectedYear, selectedMonth - 1, daysInMonth);

  const rangeStart = entryStart > monthStart ? entryStart : monthStart;
  const rangeEnd = entryEnd < monthEnd ? entryEnd : monthEnd;

  const current = new Date(rangeStart);
  while (current <= rangeEnd) {
    const dayNum = current.getDate();
    const isFirstDay = current.getTime() === entryStart.getTime();
    const isLastDay = current.getTime() === entryEnd.getTime();

    let halfDay: VacationHalfDay = 'none';
    if (isFirstDay && entry.halfDayStart !== 'none') {
      halfDay = entry.halfDayStart;
    } else if (isLastDay && entry.halfDayEnd !== 'none') {
      halfDay = entry.halfDayEnd;
    }

    days.set(dayNum, {
      vacationType: entry.vacationType,
      halfDay,
      isContinuation: !isFirstDay,
    });

    current.setDate(current.getDate() + 1);
  }
}

// ─── Cascade methods ────────────────────────────────────────────────

/** Select machine → reset downstream (team, year, month, calendar) */
function selectMachine(machineId: number) {
  selectedMachineId = machineId;
  selectedTeamId = null;
  selectedYear = null;
  selectedMonth = null;
  teams = [];
  calendarData = null;
  machineAvailEntries = [];
}

/** Select team → reset downstream (year, month, calendar) */
function selectTeam(teamId: number) {
  selectedTeamId = teamId;
  selectedYear = null;
  selectedMonth = null;
  calendarData = null;
}

/** Select year → reset downstream (month, calendar) + clear year data */
function setYear(year: number) {
  selectedYear = year;
  selectedMonth = null;
  calendarData = null;
  yearCalendarData = null;
  machineAvailEntries = [];
}

/** Select month → reset calendar (will be loaded after) */
function setMonth(month: number) {
  selectedMonth = month;
  calendarData = null;
  machineAvailEntries = [];
}

/** Clear month selection → back to year overview */
function clearMonth() {
  selectedMonth = null;
  calendarData = null;
  machineAvailEntries = [];
}

function reset() {
  machines = [];
  teams = [];
  blackouts = [];
  staffingRules = [];
  selectedMachineId = null;
  selectedTeamId = null;
  calendarData = null;
  yearCalendarData = null;
  balance = null;
  selectedYear = null;
  selectedMonth = null;
  machineAvailEntries = [];
  isLoading = false;
  isLoadingTeams = false;
  isLoadingCalendar = false;
  isLoadingYearCalendar = false;
  isLoadingBalance = false;
}

// ─── Exported state object ──────────────────────────────────────────

export const overviewState = {
  // Data getters
  get machines() {
    return machines;
  },
  get teams() {
    return teams;
  },
  get selectedMachineId() {
    return selectedMachineId;
  },
  get selectedTeamId() {
    return selectedTeamId;
  },
  get calendarData() {
    return calendarData;
  },
  get balance() {
    return balance;
  },
  get selectedMonth() {
    return selectedMonth;
  },
  get selectedYear() {
    return selectedYear;
  },
  get daysInMonth() {
    return daysInMonth;
  },
  get selectedMachineName() {
    return selectedMachineName;
  },
  get selectedTeamName() {
    return selectedTeamName;
  },
  get calendarGrid() {
    return calendarGrid;
  },
  get blackoutDays() {
    return blackoutDays;
  },
  get staffingRules() {
    return staffingRules;
  },
  get machineAvailDays() {
    return machineAvailDays;
  },

  // Year overview
  get yearGrid() {
    return yearGrid;
  },
  get yearBlackoutMonths() {
    return yearBlackoutMonths;
  },
  get showYearOverview() {
    return showYearOverview;
  },
  get isLoadingYearCalendar() {
    return isLoadingYearCalendar;
  },

  // Cascade flags
  get canSelectTeam() {
    return canSelectTeam;
  },
  get canSelectYear() {
    return canSelectYear;
  },
  get canSelectMonth() {
    return canSelectMonth;
  },

  // Data setters
  setMachines: (data: MachineListItem[]) => {
    machines = data;
  },
  setTeams: (data: TeamListItem[]) => {
    teams = data;
  },
  setBlackouts: (data: BlackoutPeriod[]) => {
    blackouts = data;
  },
  setStaffingRules: (data: StaffingRule[]) => {
    staffingRules = data;
  },
  setCalendarData: (data: TeamCalendarData | null) => {
    calendarData = data;
  },
  setBalance: (data: VacationBalance | null) => {
    balance = data;
  },
  setMachineAvailEntries: (data: MachineAvailabilityEntry[]) => {
    machineAvailEntries = data;
  },
  setYearCalendarData: (data: TeamCalendarData[] | null) => {
    yearCalendarData = data;
  },
  setLoadingYearCalendar: (val: boolean) => {
    isLoadingYearCalendar = val;
  },

  // UI getters
  get isLoading() {
    return isLoading;
  },
  get isLoadingTeams() {
    return isLoadingTeams;
  },
  get isLoadingCalendar() {
    return isLoadingCalendar;
  },
  get isLoadingBalance() {
    return isLoadingBalance;
  },

  // UI setters
  setLoading: (val: boolean) => {
    isLoading = val;
  },
  setLoadingTeams: (val: boolean) => {
    isLoadingTeams = val;
  },
  setLoadingCalendar: (val: boolean) => {
    isLoadingCalendar = val;
  },
  setLoadingBalance: (val: boolean) => {
    isLoadingBalance = val;
  },

  // Cascade navigation
  selectMachine,
  selectTeam,
  setMonth,
  setYear,
  clearMonth,

  // Global
  reset,
};
