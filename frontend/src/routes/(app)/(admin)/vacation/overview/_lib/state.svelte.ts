// =============================================================================
// VACATION OVERVIEW — REACTIVE STATE (Svelte 5 Runes)
// Team selection, month/year navigation, calendar data
// =============================================================================

import type {
  CalendarDayCell,
  CalendarUserRow,
  TeamCalendarData,
  TeamCalendarEntry,
  TeamListItem,
  VacationBalance,
  VacationHalfDay,
} from './types';

// ─── Data ───────────────────────────────────────────────────────────

let teams = $state<TeamListItem[]>([]);
let selectedTeamId = $state<number | null>(null);
let calendarData = $state<TeamCalendarData | null>(null);
let balance = $state<VacationBalance | null>(null);

// ─── Navigation ─────────────────────────────────────────────────────

let selectedMonth = $state<number>(new Date().getMonth() + 1);
let selectedYear = $state<number>(new Date().getFullYear());

// ─── UI ─────────────────────────────────────────────────────────────

let isLoading = $state(false);
let isLoadingCalendar = $state(false);
let isLoadingBalance = $state(false);

// ─── Derived ────────────────────────────────────────────────────────

/** Number of days in the selected month */
const daysInMonth = $derived(
  new Date(selectedYear, selectedMonth, 0).getDate(),
);

/** Selected team name */
const selectedTeamName = $derived.by(() => {
  if (selectedTeamId === null) return '';
  const team = teams.find((t) => t.id === selectedTeamId);
  return team?.name ?? '';
});

/** Transform calendar entries into a grid structure for rendering */
const calendarGrid = $derived.by((): CalendarUserRow[] => {
  if (calendarData === null) return [];

  /** Group entries by userId */
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

  /** Build grid rows */
  const rows: CalendarUserRow[] = [];

  for (const [userId, { userName, entries }] of userMap) {
    const days = new Map<number, CalendarDayCell>();

    for (const entry of entries) {
      fillDaysFromEntry(days, entry);
    }

    rows.push({ userId, userName, days });
  }

  /** Sort by name */
  rows.sort((a, b) => a.userName.localeCompare(b.userName, 'de'));

  return rows;
});

// ─── Helpers ────────────────────────────────────────────────────────

/** Fill day cells from a single calendar entry, clipped to the selected month. */
function fillDaysFromEntry(
  days: Map<number, CalendarDayCell>,
  entry: TeamCalendarEntry,
): void {
  const entryStart = new Date(entry.startDate + 'T00:00:00');
  const entryEnd = new Date(entry.endDate + 'T00:00:00');

  /** Clip to month boundaries */
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

// ─── Methods ────────────────────────────────────────────────────────

function selectTeam(teamId: number) {
  selectedTeamId = teamId;
  calendarData = null;
}

function navigateMonth(direction: -1 | 1) {
  let newMonth = selectedMonth + direction;
  let newYear = selectedYear;

  if (newMonth < 1) {
    newMonth = 12;
    newYear -= 1;
  } else if (newMonth > 12) {
    newMonth = 1;
    newYear += 1;
  }

  selectedMonth = newMonth;
  selectedYear = newYear;
  calendarData = null;
}

function setMonth(month: number) {
  selectedMonth = month;
  calendarData = null;
}

function setYear(year: number) {
  selectedYear = year;
  calendarData = null;
}

function reset() {
  teams = [];
  selectedTeamId = null;
  calendarData = null;
  balance = null;
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  isLoading = false;
  isLoadingCalendar = false;
  isLoadingBalance = false;
}

// ─── Exported state object ──────────────────────────────────────────

export const overviewState = {
  // Data getters
  get teams() {
    return teams;
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
  get selectedTeamName() {
    return selectedTeamName;
  },
  get calendarGrid() {
    return calendarGrid;
  },

  // Data setters
  setTeams: (data: TeamListItem[]) => {
    teams = data;
  },
  setCalendarData: (data: TeamCalendarData | null) => {
    calendarData = data;
  },
  setBalance: (data: VacationBalance | null) => {
    balance = data;
  },

  // UI getters
  get isLoading() {
    return isLoading;
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
  setLoadingCalendar: (val: boolean) => {
    isLoadingCalendar = val;
  },
  setLoadingBalance: (val: boolean) => {
    isLoadingBalance = val;
  },

  // Navigation
  selectTeam,
  navigateMonth,
  setMonth,
  setYear,

  // Global
  reset,
};
