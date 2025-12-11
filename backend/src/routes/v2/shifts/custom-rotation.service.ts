/**
 * Custom Rotation Pattern Generation Service
 * Handles all shift pattern generation logic for custom rotation configurations
 */

interface ShiftEntry {
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
}

class CustomRotationService {
  /**
   * Check if a plan is a Custom Rotation type plan
   * @param planName - Name of the plan
   * @param dataName - Optional name from data
   * @param customRotationPattern - Optional pattern indicator
   * @returns true if this is a Custom Rotation plan
   */
  isCustomRotationPlan(
    planName: string,
    dataName?: string,
    customRotationPattern?: string,
  ): boolean {
    return (
      planName.toLowerCase().includes('custom') ||
      planName.toLowerCase().includes('rotation') ||
      dataName?.toLowerCase().includes('custom') === true ||
      dataName?.toLowerCase().includes('rotation') === true ||
      customRotationPattern !== undefined
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
    // getDay() returns 0 for Sunday, we want 7 for ISO week calculation
    const dayOfWeek = jan1.getDay() === 0 ? 7 : jan1.getDay();
    const daysToThursdayRaw = (4 - dayOfWeek + 7) % 7;
    const daysToThursday = daysToThursdayRaw === 0 ? 7 : daysToThursdayRaw;
    const firstThursday = new Date(nextYear, 0, 1 + daysToThursday);

    const sundayKW1 = new Date(firstThursday);
    sundayKW1.setDate(firstThursday.getDate() + (7 - firstThursday.getDay()));

    return sundayKW1;
  }

  /**
   * Calculate date range for Custom Rotation plans
   * @param startDate - Start date string
   * @param endDate - Optional end date string
   * @returns Object with planStartDate and planEndDate
   */
  calculateCustomRotationDateRange(
    startDate: string,
    endDate?: string,
  ): { planStartDate: string; planEndDate: string } {
    const planStartDate = startDate;
    let planEndDate: string;

    if (endDate === undefined) {
      const startDateObj = new Date(startDate);
      const endOfKW1 = this.calculateEndOfFirstWeekNextYear(startDateObj);
      const endDateStr = endOfKW1.toISOString().split('T')[0];
      if (endDateStr === undefined) {
        throw new Error('Failed to calculate end date');
      }
      planEndDate = endDateStr;
    } else {
      planEndDate = endDate;
    }

    console.info('[CUSTOM-ROTATION] Using dates for shift_plan:', {
      startDate: planStartDate,
      endDate: planEndDate,
    });

    return { planStartDate, planEndDate };
  }

  /**
   * Prepare shifts for creation, handling Custom Rotation pattern generation if needed
   * @param data - Shift plan data
   * @param isCustomRotation - Whether this is a Custom Rotation plan
   * @returns Array of shifts to create
   */
  prepareShiftsForCreation(
    data: {
      startDate: string;
      endDate?: string;
      name?: string;
      shifts: ShiftEntry[];
    },
    isCustomRotation: boolean,
  ): ShiftEntry[] {
    if (!isCustomRotation || data.shifts.length === 0) {
      return data.shifts;
    }

    console.info('[CUSTOM-ROTATION] Generating pattern from template');
    const patternType = this.detectPatternType(data);
    console.info(`[CUSTOM-ROTATION] Pattern type detected: ${patternType}`);

    const effectiveEndDateStr = this.calculateEffectiveEndDate(data);
    const startDate = new Date(data.startDate);
    const endDate = new Date(effectiveEndDateStr);
    const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

    console.info(
      `[CUSTOM-ROTATION] Generating pattern from ${data.startDate} to ${effectiveEndDateStr} (${weeks} weeks)`,
    );

    const generatedShifts = this.generateCustomRotationPeriod(
      data.shifts,
      data.startDate,
      effectiveEndDateStr,
      patternType,
    );

    console.info(
      `[CUSTOM-ROTATION] Generated ${generatedShifts.length} shifts for period ${data.startDate} to ${effectiveEndDateStr}`,
    );

    return generatedShifts;
  }

  /**
   * Calculate effective end date for Custom Rotation
   * @param data - Shift plan data
   * @returns Effective end date string
   */
  private calculateEffectiveEndDate(data: { startDate: string; endDate?: string }): string {
    if (data.endDate !== undefined) {
      console.info(`[CUSTOM-ROTATION] Using provided end date from modal: ${data.endDate}`);
      return data.endDate;
    }

    const startDate = new Date(data.startDate);
    const seventeenWeeksLater = new Date(startDate);
    seventeenWeeksLater.setDate(startDate.getDate() + 17 * 7);

    const endOfKW1NextYear = this.calculateEndOfFirstWeekNextYear(startDate);

    const effectiveEndDate =
      seventeenWeeksLater > endOfKW1NextYear ? seventeenWeeksLater : endOfKW1NextYear;
    const effectiveEndDateStr = effectiveEndDate.toISOString().split('T')[0];
    if (effectiveEndDateStr === undefined) {
      throw new Error('Failed to calculate effective end date');
    }

    console.info(`[CUSTOM-ROTATION] Calculated default end date: ${effectiveEndDateStr}`);
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
   * Always returns 'auto' - uses 2-week pattern repetition
   */
  detectPatternType(_data: {
    name?: string;
    patternType?: string;
    customRotationPattern?: string;
    shifts: unknown[];
  }): 'auto' {
    // All patterns use 2-week auto-detection and repetition
    return 'auto';
  }

  /**
   * Generate Custom Rotation for a specific period based on pattern type
   */
  private generateCustomRotationPeriod(
    templateShifts: ShiftEntry[],
    startDate: string,
    endDate: string,
    patternType: string,
  ): ShiftEntry[] {
    // Generate for the year and filter to requested period
    const year = new Date(startDate).getFullYear();
    const allShifts = this.generateCustomRotationYear(templateShifts, year, patternType);

    // Filter to only the requested period
    const start = new Date(startDate);
    const end = new Date(endDate);
    return allShifts.filter((shift: ShiftEntry) => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= start && shiftDate <= end;
    });
  }

  /**
   * Generate Custom Rotation year based on pattern type
   */
  private generateCustomRotationYear(
    templateShifts: ShiftEntry[],
    year: number,
    _patternType: string,
  ): ShiftEntry[] {
    // All patterns use 2-week pattern repetition (auto-detect)
    return this.generateYearPatternFromTwoWeeks(templateShifts, year);
  }

  /**
   * Generate year pattern from 2-week template
   * This is the CORE ALGORITHM that repeats a 2-week template for an entire year
   *
   * @param twoWeekShifts - Array of shifts from the 14-day grid
   * @param year - Target year for generation
   * @returns Array of generated shifts for the entire year
   */
  private generateYearPatternFromTwoWeeks(twoWeekShifts: ShiftEntry[], year: number): ShiftEntry[] {
    // 1. VALIDATION
    if (twoWeekShifts.length === 0) {
      console.warn('[CUSTOM-ROTATION] Empty template - returning empty array');
      return [];
    }

    // 2. ANALYZE TEMPLATE
    const templateAnalysis = this.analyzeTemplate(twoWeekShifts);
    if (templateAnalysis === null) {
      console.warn('[CUSTOM-ROTATION] Failed to analyze template');
      return [];
    }

    const { templateStartDate, templateLengthDays, shiftsByDayIndex } = templateAnalysis;

    console.info('[CUSTOM-ROTATION] Template analysis:', {
      templateStartDate: templateStartDate.toISOString().split('T')[0],
      templateLengthDays,
      totalShifts: twoWeekShifts.length,
      daysWithShifts: shiftsByDayIndex.size,
    });

    // 3. DEFINE TARGET RANGE (full year)
    const targetStartDate = new Date(year, 0, 1); // January 1st
    const targetEndDate = new Date(year, 11, 31); // December 31st

    // 4. REPEAT PATTERN
    const result: ShiftEntry[] = [];
    let currentDate = new Date(targetStartDate);
    let daysSinceStart = 0;

    while (currentDate <= targetEndDate) {
      // Calculate which day in the template this corresponds to
      const templateDayIndex = daysSinceStart % templateLengthDays;

      // Get shifts for this day from template
      const templateShiftsForDay = shiftsByDayIndex.get(templateDayIndex);

      if (templateShiftsForDay !== undefined && templateShiftsForDay.length > 0) {
        const dateStr = this.formatDateISO(currentDate);

        // Create shift entries for this day
        for (const templateShift of templateShiftsForDay) {
          result.push({
            userId: templateShift.userId,
            date: dateStr,
            startTime: templateShift.startTime,
            endTime: templateShift.endTime,
            type: templateShift.type,
          });
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      daysSinceStart++;
    }

    console.info(`[CUSTOM-ROTATION] Generated ${result.length} shifts for year ${year}`);
    return result;
  }

  /**
   * Analyze template to extract metadata for pattern repetition
   */
  private analyzeTemplate(templateShifts: ShiftEntry[]): {
    templateStartDate: Date;
    templateLengthDays: number;
    shiftsByDayIndex: Map<number, ShiftEntry[]>;
  } | null {
    if (templateShifts.length === 0) {
      return null;
    }

    // Find date boundaries
    const dateBounds = this.findDateBoundaries(templateShifts);
    if (dateBounds === null) {
      return null;
    }

    const { earliestDate, latestDate } = dateBounds;
    const msPerDay = 24 * 60 * 60 * 1000;

    // Calculate template length in days (inclusive), minimum 14 days
    const rawLengthDays =
      Math.floor((latestDate.getTime() - earliestDate.getTime()) / msPerDay) + 1;
    const templateLengthDays = Math.max(rawLengthDays, 14);

    // Group shifts by day index
    const shiftsByDayIndex = this.groupShiftsByDayIndex(templateShifts, earliestDate, msPerDay);

    return { templateStartDate: earliestDate, templateLengthDays, shiftsByDayIndex };
  }

  /**
   * Find earliest and latest dates in template shifts
   */
  private findDateBoundaries(
    templateShifts: ShiftEntry[],
  ): { earliestDate: Date; latestDate: Date } | null {
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    for (const shift of templateShifts) {
      const shiftDate = new Date(shift.date);
      if (earliestDate === null || shiftDate < earliestDate) {
        earliestDate = shiftDate;
      }
      if (latestDate === null || shiftDate > latestDate) {
        latestDate = shiftDate;
      }
    }

    if (earliestDate === null || latestDate === null) {
      return null;
    }
    return { earliestDate, latestDate };
  }

  /**
   * Group shifts by their day index relative to template start
   */
  private groupShiftsByDayIndex(
    templateShifts: ShiftEntry[],
    earliestDate: Date,
    msPerDay: number,
  ): Map<number, ShiftEntry[]> {
    const shiftsByDayIndex = new Map<number, ShiftEntry[]>();

    for (const shift of templateShifts) {
      const shiftDate = new Date(shift.date);
      const dayIndex = Math.floor((shiftDate.getTime() - earliestDate.getTime()) / msPerDay);

      const existingShifts = shiftsByDayIndex.get(dayIndex);
      if (existingShifts === undefined) {
        shiftsByDayIndex.set(dayIndex, [shift]);
      } else {
        existingShifts.push(shift);
      }
    }

    return shiftsByDayIndex;
  }

  /**
   * Format date as ISO string (YYYY-MM-DD)
   */
  private formatDateISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Export singleton instance
export const customRotationService = new CustomRotationService();
