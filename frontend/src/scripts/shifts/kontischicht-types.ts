/**
 * Kontischicht Types and Constants
 * Type definitions and data structures for the 2-week shift planning system
 */

export interface DaySchedule {
  early: number[]; // User IDs for early shift
  late: number[]; // User IDs for late shift
  night: number[]; // User IDs for night shift
  free: number[]; // User IDs marked as free
}

export interface WeekData {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface KontischichtPattern {
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

export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  employeeCount: number;
  cycleWeeks: number;
  preview: string;
}

// Predefined Pattern Templates
export const PATTERN_TEMPLATES: PatternTemplate[] = [
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

// Constants
export const SHIFT_ROW_SELECTOR = '.shift-row';
