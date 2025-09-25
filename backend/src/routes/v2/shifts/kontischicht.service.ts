/**
 * Kontischicht Pattern Generation Service
 * Handles all Kontischicht-specific shift pattern generation logic
 */

interface ShiftEntry {
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
}

export class KontischichtService {
  /**
   * Check if a plan is a Kontischicht type plan
   * @param planName - Name of the plan
   * @param dataName - Optional name from data
   * @param kontischichtPattern - Optional pattern indicator
   * @returns true if this is a Kontischicht plan
   */
  isKontischichtPlan(planName: string, dataName?: string, kontischichtPattern?: string): boolean {
    return (
      planName.toLowerCase().includes('kontischicht') ||
      dataName?.toLowerCase().includes('kontischicht') === true ||
      kontischichtPattern !== undefined
    );
  }

  /**
   * Calculate end of first week (KW1) in the next year
   * @param fromDate - Date to calculate from
   * @returns Date representing Sunday of KW1 next year
   */
  calculateEndOfFirstWeekNextYear(fromDate: Date): Date {
    const nextYear = fromDate.getFullYear() + 1;
    const jan1 = new Date(nextYear, 0, 1);
    const dayOfWeek = jan1.getDay() || 7;
    const daysToThursday = (4 - dayOfWeek + 7) % 7 || 7;
    const firstThursday = new Date(nextYear, 0, 1 + daysToThursday);

    const sundayKW1 = new Date(firstThursday);
    sundayKW1.setDate(firstThursday.getDate() + (7 - firstThursday.getDay()));

    return sundayKW1;
  }

  /**
   * Calculate date range for Kontischicht plans
   * @param startDate - Start date string
   * @param endDate - Optional end date string
   * @returns Object with planStartDate and planEndDate
   */
  calculateKontischichtDateRange(
    startDate: string,
    endDate?: string,
  ): { planStartDate: string; planEndDate: string } {
    const planStartDate = startDate;
    let planEndDate = endDate ?? '';

    if (!endDate) {
      const startDateObj = new Date(startDate);
      const endOfKW1 = this.calculateEndOfFirstWeekNextYear(startDateObj);
      planEndDate = endOfKW1.toISOString().split('T')[0];
    }

    console.info('[KONTISCHICHT] Using dates for shift_plan:', {
      startDate: planStartDate,
      endDate: planEndDate,
    });

    return { planStartDate, planEndDate };
  }

  /**
   * Prepare shifts for creation, handling Kontischicht pattern generation if needed
   * @param data - Shift plan data
   * @param isKontischicht - Whether this is a Kontischicht plan
   * @returns Array of shifts to create
   */
  prepareShiftsForCreation(
    data: {
      startDate: string;
      endDate?: string;
      name?: string;
      shifts: ShiftEntry[];
    },
    isKontischicht: boolean,
  ): ShiftEntry[] {
    if (!isKontischicht || data.shifts.length === 0) {
      return data.shifts;
    }

    console.info('[KONTISCHICHT] Generating pattern from template');
    const patternType = this.detectPatternType(data);
    console.info(`[KONTISCHICHT] Pattern type detected: ${patternType}`);

    const effectiveEndDateStr = this.calculateEffectiveEndDate(data);
    const startDate = new Date(data.startDate);
    const endDate = new Date(effectiveEndDateStr);
    const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

    console.info(
      `[KONTISCHICHT] Generating pattern from ${data.startDate} to ${effectiveEndDateStr} (${weeks} weeks)`,
    );

    const generatedShifts = this.generateKontischichtPeriod(
      data.shifts,
      data.startDate,
      effectiveEndDateStr,
      patternType,
    );

    console.info(
      `[KONTISCHICHT] Generated ${generatedShifts.length} shifts for period ${data.startDate} to ${effectiveEndDateStr}`,
    );

    return generatedShifts;
  }

  /**
   * Calculate effective end date for Kontischicht
   * @param data - Shift plan data
   * @returns Effective end date string
   */
  private calculateEffectiveEndDate(data: { startDate: string; endDate?: string }): string {
    if (data.endDate) {
      console.info(`[KONTISCHICHT] Using provided end date from modal: ${data.endDate}`);
      return data.endDate;
    }

    const startDate = new Date(data.startDate);
    const seventeenWeeksLater = new Date(startDate);
    seventeenWeeksLater.setDate(startDate.getDate() + 17 * 7);

    const endOfKW1NextYear = this.calculateEndOfFirstWeekNextYear(startDate);

    const effectiveEndDate =
      seventeenWeeksLater > endOfKW1NextYear ? seventeenWeeksLater : endOfKW1NextYear;
    const effectiveEndDateStr = effectiveEndDate.toISOString().split('T')[0];

    console.info(`[KONTISCHICHT] Calculated default end date: ${effectiveEndDateStr}`);
    return effectiveEndDateStr;
  }

  /**
   * Helper to get week number
   * @param date - Parameter description
   * @returns ISO week number
   */
  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() !== 0 ? d.getUTCDay() : 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Detect the pattern type from shift data
   */
  detectPatternType(data: {
    name?: string;
    patternType?: string;
    kontischichtPattern?: string;
    shifts: unknown[];
  }): 'auto' | '3er' | '4er-standard' | '4er-lang' | 'custom' {
    // Check if pattern type is explicitly provided
    if (data.kontischichtPattern) {
      console.info(`[KONTISCHICHT] Pattern provided from frontend: ${data.kontischichtPattern}`);
      return data.kontischichtPattern as 'auto' | '3er' | '4er-standard' | '4er-lang' | 'custom';
    }

    if (data.patternType) {
      return data.patternType as 'auto' | '3er' | '4er-standard' | '4er-lang' | 'custom';
    }

    // Check name for pattern hints
    if (data.name) {
      const nameLower = data.name.toLowerCase();
      if (nameLower.includes('3er')) return '3er';
      if (nameLower.includes('4er')) return '4er-standard';
    }

    // Auto-detect from employee count
    const uniqueEmployees = new Set(
      data.shifts.map((s) => {
        const shift = s as { userId?: number };
        return shift.userId;
      }),
    ).size;

    if (uniqueEmployees === 3) return '3er';
    if (uniqueEmployees === 4) return '4er-standard';

    return 'auto';
  }

  /**
   * Generate Kontischicht for a specific period based on pattern type
   */
  private generateKontischichtPeriod(
    templateShifts: ShiftEntry[],
    startDate: string,
    endDate: string,
    patternType: string,
  ): ShiftEntry[] {
    // For 4er-standard, use special logic
    if (patternType === '4er-standard') {
      return this.generate4erStandardPeriod(templateShifts, startDate, endDate);
    }

    // For other patterns, generate for the year and filter
    const year = new Date(startDate).getFullYear();
    const allShifts = this.generateKontischichtYear(templateShifts, year, patternType);

    // Filter to only the requested period
    const start = new Date(startDate);
    const end = new Date(endDate);
    return allShifts.filter((shift) => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= start && shiftDate <= end;
    });
  }

  /**
   * Generate 4er Standard pattern for specific period
   */
  private generate4erStandardPeriod(
    templateShifts: ShiftEntry[],
    startDateStr: string,
    endDateStr: string,
  ): ShiftEntry[] {
    const yearShifts: ShiftEntry[] = [];
    const employees = [...new Set(templateShifts.map((s) => s.userId))].slice(0, 4);

    if (employees.length !== 4) {
      console.warn('[4ER STANDARD PERIOD] Need exactly 4 employees, falling back');
      return templateShifts;
    }

    // 4er Standard Kontischicht: 2-2-2 Rotation
    const cyclePattern = [
      // Day 0-1: A=Früh, B=Spät, C=Nacht, D=Frei
      { shifts: { F: [0], S: [1], N: [2] } },
      { shifts: { F: [0], S: [1], N: [2] } },
      // Day 2-3: A=Spät, B=Nacht, C=Frei, D=Früh
      { shifts: { F: [3], S: [0], N: [1] } },
      { shifts: { F: [3], S: [0], N: [1] } },
      // Day 4-5: A=Nacht, B=Frei, C=Früh, D=Spät
      { shifts: { F: [2], S: [3], N: [0] } },
      { shifts: { F: [2], S: [3], N: [0] } },
      // Day 6-7: A=Frei, B=Früh, C=Spät, D=Nacht
      { shifts: { F: [1], S: [2], N: [3] } },
      { shifts: { F: [1], S: [2], N: [3] } },
    ];

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const patternStart = new Date(2025, 0, 1); // Pattern reference start

    // Process each day in the period
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      // Calculate which day in the 8-day cycle we're on
      const daysSincePatternStart = Math.floor(
        (date.getTime() - patternStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      const cycleDay = daysSincePatternStart % 8; // 8-day cycle

      // Use Map instead of direct array access to avoid injection warning
      const patternMap = new Map(cyclePattern.entries());
      const pattern = patternMap.get(cycleDay);
      if (!pattern) continue;

      // Generate shifts for this day
      Object.entries(pattern.shifts).forEach(([shiftType, employeeIndices]) => {
        employeeIndices.forEach((empIdx) => {
          yearShifts.push({
            // eslint-disable-next-line security/detect-object-injection -- empIdx is from controlled array
            userId: employees[empIdx],
            date: date.toISOString().split('T')[0],
            startTime:
              shiftType === 'F' ? '06:00'
              : shiftType === 'S' ? '14:00'
              : '22:00',
            endTime:
              shiftType === 'F' ? '14:00'
              : shiftType === 'S' ? '22:00'
              : '06:00',
            type:
              shiftType === 'F' ? 'early'
              : shiftType === 'S' ? 'late'
              : 'night',
          });
        });
      });
    }

    return yearShifts;
  }

  /**
   * Generate Kontischicht year based on pattern type
   */
  private generateKontischichtYear(
    templateShifts: ShiftEntry[],
    year: number,
    patternType: string,
  ): ShiftEntry[] {
    switch (patternType) {
      case '3er':
        return this.generate3erRotation(templateShifts, year);
      case '4er-standard':
        return this.generate4erStandardRotation(templateShifts, year);
      case '4er-lang':
        return this.generate4erLangRotation(templateShifts, year);
      case 'custom':
      case 'auto':
      default:
        // Use existing 2-week pattern repetition
        return this.generateYearPatternFromTwoWeeks(templateShifts, year);
    }
  }

  /**
   * Get shift times based on shift type
   */
  private getShiftTimes(shiftType: string): { startTime: string; endTime: string } {
    const shiftTimeMap: Record<string, { startTime: string; endTime: string }> = {
      F: { startTime: '06:00', endTime: '14:00' },
      S: { startTime: '14:00', endTime: '22:00' },
      N: { startTime: '22:00', endTime: '06:00' },
    };
    // eslint-disable-next-line security/detect-object-injection -- shiftType is from controlled enum
    return shiftTimeMap[shiftType] ?? { startTime: '00:00', endTime: '00:00' };
  }

  /**
   * Create a shift entry object
   */
  private createShiftEntry(userId: number, date: string, shiftType: string): ShiftEntry {
    const { startTime, endTime } = this.getShiftTimes(shiftType);
    return { userId, date, startTime, endTime, type: shiftType };
  }

  /**
   * Process daily shifts for 3er rotation
   */
  private processDailyShifts(
    employees: number[],
    currentDate: Date,
    patternIndex: number,
    employeeOffset: number,
  ): ShiftEntry[] {
    const rotationPattern = [
      { days: 3, shift: 'F' },
      { days: 3, shift: 'S' },
      { days: 3, shift: 'N' },
      { days: 3, shift: null },
    ];

    const shifts: ShiftEntry[] = [];
    const dateString = currentDate.toISOString().split('T')[0];

    for (let i = 0; i < 3; i++) {
      const employeeIndex = (i + employeeOffset) % 3;
      const patternPhase = (patternIndex + i) % 4;
      // eslint-disable-next-line security/detect-object-injection -- bounded by modulo
      const shiftType = rotationPattern[patternPhase].shift;

      if (shiftType) {
        // eslint-disable-next-line security/detect-object-injection -- bounded by modulo
        shifts.push(this.createShiftEntry(employees[employeeIndex], dateString, shiftType));
      }
    }

    return shifts;
  }

  /**
   * Generate 3er rotation pattern (3 employees, 9-day cycle)
   */
  private generate3erRotation(templateShifts: ShiftEntry[], year: number): ShiftEntry[] {
    const employees = [...new Set(templateShifts.map((s) => s.userId))].slice(0, 3);

    if (employees.length !== 3) {
      console.warn('[3ER ROTATION] Need exactly 3 employees, falling back to standard');
      return this.generateYearPatternFromTwoWeeks(templateShifts, year);
    }

    const yearShifts: ShiftEntry[] = [];
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    let currentDate = new Date(yearStart);
    let patternIndex = 0;
    let employeeOffset = 0;

    while (currentDate <= yearEnd) {
      const dailyShifts = this.processDailyShifts(
        employees,
        currentDate,
        patternIndex,
        employeeOffset,
      );

      yearShifts.push(...dailyShifts);
      currentDate.setDate(currentDate.getDate() + 1);

      const daysSinceStart = Math.floor(
        (currentDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceStart % 3 === 0) {
        patternIndex = (patternIndex + 1) % 4;
      }

      if (daysSinceStart % 12 === 0) {
        employeeOffset = (employeeOffset + 1) % 3;
      }
    }

    return yearShifts;
  }

  /**
   * Generate 4er standard rotation (4 employees, 2-2-2 pattern)
   */
  private generate4erStandardRotation(templateShifts: ShiftEntry[], year: number): ShiftEntry[] {
    const yearShifts: ShiftEntry[] = [];

    // Analyze the template to understand the pattern
    const employees = [...new Set(templateShifts.map((s) => s.userId))].slice(0, 4);
    if (employees.length !== 4) {
      console.warn('[4ER STANDARD] Need exactly 4 employees, falling back');
      return this.generateYearPatternFromTwoWeeks(templateShifts, year);
    }

    // 4er Standard Kontischicht: 2-2-2 Rotation
    // Each employee works 2 days per shift type, then 2 days free
    // Complete cycle: 8 days (2F-2S-2N-2Free)
    // A: FF SS NN -- | B: SS NN -- FF | C: NN -- FF SS | D: -- FF SS NN
    const cyclePattern = new Map<
      number,
      { day: number; shifts: { F: number[]; S: number[]; N: number[] } }
    >([
      // Day 0-1: A=Früh, B=Spät, C=Nacht, D=Frei
      [0, { day: 0, shifts: { F: [0], S: [1], N: [2] } }], // Day 1
      [1, { day: 1, shifts: { F: [0], S: [1], N: [2] } }], // Day 2
      // Day 2-3: A=Spät, B=Nacht, C=Frei, D=Früh
      [2, { day: 2, shifts: { F: [3], S: [0], N: [1] } }], // Day 3
      [3, { day: 3, shifts: { F: [3], S: [0], N: [1] } }], // Day 4
      // Day 4-5: A=Nacht, B=Frei, C=Früh, D=Spät
      [4, { day: 4, shifts: { F: [2], S: [3], N: [0] } }], // Day 5
      [5, { day: 5, shifts: { F: [2], S: [3], N: [0] } }], // Day 6
      // Day 6-7: A=Frei, B=Früh, C=Spät, D=Nacht
      [6, { day: 6, shifts: { F: [1], S: [2], N: [3] } }], // Day 7
      [7, { day: 7, shifts: { F: [1], S: [2], N: [3] } }], // Day 8 (wraps to day 0)
    ]);

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // Process each day of the year
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      // Calculate which day in the 8-day cycle we're on
      const daysSinceStart = Math.floor(
        (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const cycleDay = daysSinceStart % 8; // 8-day cycle

      // Get pattern for this cycle day from Map
      const pattern = cyclePattern.get(cycleDay);
      if (!pattern) continue; // Skip if no pattern defined

      // Generate shifts for this day
      Object.entries(pattern.shifts).forEach(([shiftType, employeeIndices]) => {
        employeeIndices.forEach((empIdx) => {
          yearShifts.push({
            // eslint-disable-next-line security/detect-object-injection -- empIdx is from controlled array
            userId: employees[empIdx],
            date: date.toISOString().split('T')[0],
            startTime:
              shiftType === 'F' ? '06:00'
              : shiftType === 'S' ? '14:00'
              : '22:00',
            endTime:
              shiftType === 'F' ? '14:00'
              : shiftType === 'S' ? '22:00'
              : '06:00',
            type:
              shiftType === 'F' ? 'early'
              : shiftType === 'S' ? 'late'
              : 'night',
          });
        });
      });
    }

    return yearShifts;
  }

  /**
   * Process daily shifts for 4er rotation
   */
  private process4erDailyShifts(
    employees: number[],
    currentDate: Date,
    phaseIndex: number,
  ): ShiftEntry[] {
    const rotationPattern = [
      { days: 4, shift: 'F' },
      { days: 4, shift: 'S' },
      { days: 4, shift: 'N' },
      { days: 4, shift: null }, // Free
    ];

    const shifts: ShiftEntry[] = [];

    const dateString = currentDate.toISOString().split('T')[0];

    for (let i = 0; i < 4; i++) {
      const employeePhase = (phaseIndex + i) % 4;
      // eslint-disable-next-line security/detect-object-injection -- bounded by modulo
      const shiftType = rotationPattern[employeePhase].shift;

      if (shiftType) {
        // eslint-disable-next-line security/detect-object-injection -- bounded by for loop
        shifts.push(this.createShiftEntry(employees[i], dateString, shiftType));
      }
    }

    return shifts;
  }

  /**
   * Generate 4er long rotation (4 employees, 4-4-4 pattern)
   */
  private generate4erLangRotation(templateShifts: ShiftEntry[], year: number): ShiftEntry[] {
    const employees = [...new Set(templateShifts.map((s) => s.userId))].slice(0, 4);

    if (employees.length !== 4) {
      return this.generateYearPatternFromTwoWeeks(templateShifts, year);
    }

    const yearShifts: ShiftEntry[] = [];
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    let currentDate = new Date(yearStart);
    let dayCount = 0;

    while (currentDate <= yearEnd) {
      const cycleDay = dayCount % 16;
      const phaseIndex = Math.floor(cycleDay / 4);

      const dailyShifts = this.process4erDailyShifts(employees, currentDate, phaseIndex);
      yearShifts.push(...dailyShifts);

      currentDate.setDate(currentDate.getDate() + 1);
      dayCount++;
    }

    return yearShifts;
  }

  /**
   * Group shifts by week
   */
  private groupShiftsByWeek(
    sortedTemplate: ShiftEntry[],
    firstTemplateDate: Date,
  ): {
    weekA: ShiftEntry[];
    weekB: ShiftEntry[];
  } {
    const weekAShifts: ShiftEntry[] = [];
    const weekBShifts: ShiftEntry[] = [];
    const firstWeekNumber = this.getWeekNumber(firstTemplateDate);

    for (const shift of sortedTemplate) {
      const shiftDate = new Date(shift.date);
      const weekNumber = this.getWeekNumber(shiftDate);

      if (weekNumber === firstWeekNumber) {
        weekAShifts.push(shift);
      } else {
        weekBShifts.push(shift);
      }
    }

    return { weekA: weekAShifts, weekB: weekBShifts };
  }

  /**
   * Generate shifts for a single week
   */
  private generateWeekShifts(
    templateWeek: ShiftEntry[],
    currentWeekMonday: Date,
    year: number,
  ): ShiftEntry[] {
    const weekShifts: ShiftEntry[] = [];

    for (const templateShift of templateWeek) {
      const templateDate = new Date(templateShift.date);
      const templateWeekday = templateDate.getDay() || 7;

      const shiftDate = new Date(currentWeekMonday);
      shiftDate.setDate(currentWeekMonday.getDate() + (templateWeekday - 1));

      if (shiftDate.getFullYear() === year) {
        weekShifts.push({
          userId: templateShift.userId,
          date: shiftDate.toISOString().split('T')[0],
          startTime: templateShift.startTime,
          endTime: templateShift.endTime,
          type: templateShift.type,
        });
      }
    }

    return weekShifts;
  }

  /**
   * Generate year-long shift pattern from 2-week Kontischicht template
   * @param twoWeekShifts - Array of shifts for 2 weeks (template)
   * @param year - Target year to generate shifts for
   * @returns Array of shifts for the entire year
   */
  private generateYearPatternFromTwoWeeks(twoWeekShifts: ShiftEntry[], year: number): ShiftEntry[] {
    const sortedTemplate = [...twoWeekShifts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    if (sortedTemplate.length === 0) {
      return [];
    }

    const firstTemplateDate = new Date(sortedTemplate[0].date);
    const { weekA, weekB } = this.groupShiftsByWeek(sortedTemplate, firstTemplateDate);

    console.info('[KONTISCHICHT] Pattern analysis:', {
      weekACount: weekA.length,
      weekBCount: weekB.length,
      year,
    });

    const yearShifts: ShiftEntry[] = [];
    const yearStart = new Date(year, 0, 1);
    const firstMonday = new Date(yearStart);
    const yearStartWeekday = yearStart.getDay() || 7;

    if (yearStartWeekday !== 1) {
      firstMonday.setDate(yearStart.getDate() + (8 - yearStartWeekday));
    }

    for (let weekOffset = 0; weekOffset < 52; weekOffset++) {
      const currentWeekMonday = new Date(firstMonday);
      currentWeekMonday.setDate(firstMonday.getDate() + weekOffset * 7);

      const templateWeek = weekOffset % 2 === 0 ? weekA : weekB;
      const weekShifts = this.generateWeekShifts(templateWeek, currentWeekMonday, year);
      yearShifts.push(...weekShifts);
    }

    console.info(`[KONTISCHICHT] Generated ${yearShifts.length} shifts for year ${year}`);
    return yearShifts;
  }
}

// Export singleton instance
export const kontischichtService = new KontischichtService();
