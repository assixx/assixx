import { describe, expect, it } from 'vitest';

import {
  ShiftDateSchema,
  ShiftStatusSchema,
  ShiftTypeSchema,
  SortBySchema,
  SortOrderSchema,
  SwapRequestStatusSchema,
  TimeSchema,
  TimeWithSecondsSchema,
} from './common.dto.js';
import { CreateShiftSchema } from './create-shift.dto.js';
import { CreateSwapRequestSchema } from './create-swap-request.dto.js';
import { DeleteRotationHistoryByDateRangeSchema } from './delete-rotation-history-by-date-range.dto.js';
import { ExportShiftsSchema } from './export-shift.dto.js';
import { QueryShiftsSchema } from './query-shifts.dto.js';

// =============================================================
// Common Shift Schemas
// =============================================================

describe('ShiftDateSchema', () => {
  it('should accept YYYY-MM-DD format', () => {
    expect(ShiftDateSchema.safeParse('2025-06-15').success).toBe(true);
  });

  it('should accept ISO 8601 datetime format', () => {
    expect(ShiftDateSchema.safeParse('2025-06-15T08:00:00Z').success).toBe(true);
  });

  it('should reject invalid date format', () => {
    expect(ShiftDateSchema.safeParse('15/06/2025').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(ShiftDateSchema.safeParse('').success).toBe(false);
  });
});

describe('ShiftStatusSchema', () => {
  it.each(['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const)(
    'should accept status=%s',
    (status) => {
      expect(ShiftStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it('should reject invalid status', () => {
    expect(ShiftStatusSchema.safeParse('active').success).toBe(false);
  });
});

describe('ShiftTypeSchema', () => {
  it.each([
    'regular',
    'overtime',
    'standby',
    'vacation',
    'sick',
    'holiday',
    'early',
    'late',
    'night',
    'day',
    'flexible',
    'F',
    'S',
    'N',
  ] as const)('should accept type=%s', (type) => {
    expect(ShiftTypeSchema.safeParse(type).success).toBe(true);
  });

  it('should reject invalid type', () => {
    expect(ShiftTypeSchema.safeParse('morning').success).toBe(false);
  });
});

describe('TimeSchema', () => {
  it('should accept valid HH:MM', () => {
    expect(TimeSchema.safeParse('08:30').success).toBe(true);
  });

  it('should accept midnight', () => {
    expect(TimeSchema.safeParse('00:00').success).toBe(true);
  });

  it('should accept 23:59', () => {
    expect(TimeSchema.safeParse('23:59').success).toBe(true);
  });

  it('should reject 24:00', () => {
    expect(TimeSchema.safeParse('24:00').success).toBe(false);
  });

  it('should reject invalid minutes', () => {
    expect(TimeSchema.safeParse('08:60').success).toBe(false);
  });

  it('should reject missing leading zero', () => {
    expect(TimeSchema.safeParse('8:30').success).toBe(false);
  });
});

describe('TimeWithSecondsSchema', () => {
  it('should accept valid HH:MM:SS', () => {
    expect(TimeWithSecondsSchema.safeParse('14:30:00').success).toBe(true);
  });

  it('should reject HH:MM without seconds', () => {
    expect(TimeWithSecondsSchema.safeParse('14:30').success).toBe(false);
  });
});

describe('SortBySchema', () => {
  it.each(['date', 'startTime', 'endTime', 'userId', 'status', 'type'] as const)(
    'should accept sortBy=%s',
    (field) => {
      expect(SortBySchema.safeParse(field).success).toBe(true);
    },
  );
});

describe('SortOrderSchema', () => {
  it.each(['asc', 'desc'] as const)('should accept %s', (order) => {
    expect(SortOrderSchema.safeParse(order).success).toBe(true);
  });
});

describe('SwapRequestStatusSchema', () => {
  it.each(['pending', 'approved', 'rejected', 'cancelled'] as const)(
    'should accept %s',
    (status) => {
      expect(SwapRequestStatusSchema.safeParse(status).success).toBe(true);
    },
  );
});

// =============================================================
// QueryShiftsSchema
// =============================================================

describe('QueryShiftsSchema', () => {
  it('should accept empty query with defaults', () => {
    const data = QueryShiftsSchema.parse({});

    expect(data.page).toBe(1);
    expect(data.limit).toBe(20);
    expect(data.sortBy).toBe('date');
    expect(data.sortOrder).toBe('desc');
  });

  it('should coerce userId from string', () => {
    const data = QueryShiftsSchema.parse({ userId: '42' });

    expect(data.userId).toBe(42);
  });

  it('should reject limit > 100', () => {
    expect(QueryShiftsSchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('should accept valid date filter', () => {
    expect(QueryShiftsSchema.safeParse({ date: '2025-06-15' }).success).toBe(true);
  });
});

// =============================================================
// CreateShiftSchema
// =============================================================

describe('CreateShiftSchema', () => {
  const valid = {
    userId: 1,
    date: '2025-06-15',
    startTime: '08:00',
    endTime: '16:00',
    departmentId: 3,
  };

  it('should accept valid shift', () => {
    expect(CreateShiftSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject missing userId', () => {
    const { userId: _uid, ...noUserId } = valid;

    expect(CreateShiftSchema.safeParse(noUserId).success).toBe(false);
  });

  it('should reject missing date', () => {
    const { date: _d, ...noDate } = valid;

    expect(CreateShiftSchema.safeParse(noDate).success).toBe(false);
  });

  it('should reject invalid time format', () => {
    expect(CreateShiftSchema.safeParse({ ...valid, startTime: '8:00' }).success).toBe(false);
  });

  it('should reject title longer than 200 characters', () => {
    expect(CreateShiftSchema.safeParse({ ...valid, title: 'T'.repeat(201) }).success).toBe(false);
  });

  it('should reject notes longer than 1000 characters', () => {
    expect(CreateShiftSchema.safeParse({ ...valid, notes: 'N'.repeat(1001) }).success).toBe(false);
  });

  it('should reject negative breakMinutes', () => {
    expect(CreateShiftSchema.safeParse({ ...valid, breakMinutes: -1 }).success).toBe(false);
  });
});

// =============================================================
// ExportShiftsSchema
// =============================================================

describe('ExportShiftsSchema', () => {
  const valid = { startDate: '2025-06-01', endDate: '2025-06-30' };

  it('should accept valid export with default format', () => {
    const data = ExportShiftsSchema.parse(valid);

    expect(data.format).toBe('csv');
  });

  it.each(['csv', 'excel'] as const)('should accept format=%s', (format) => {
    expect(ExportShiftsSchema.safeParse({ ...valid, format }).success).toBe(true);
  });

  it('should reject missing startDate', () => {
    expect(ExportShiftsSchema.safeParse({ endDate: '2025-06-30' }).success).toBe(false);
  });
});

// =============================================================
// CreateSwapRequestSchema
// =============================================================

describe('CreateSwapRequestSchema', () => {
  it('should accept valid swap request', () => {
    expect(CreateSwapRequestSchema.safeParse({ shiftId: 1 }).success).toBe(true);
  });

  it('should reject missing shiftId', () => {
    expect(CreateSwapRequestSchema.safeParse({}).success).toBe(false);
  });

  it('should reject reason longer than 500 characters', () => {
    expect(
      CreateSwapRequestSchema.safeParse({
        shiftId: 1,
        reason: 'R'.repeat(501),
      }).success,
    ).toBe(false);
  });
});

// =============================================================
// DeleteRotationHistoryByDateRangeSchema
// =============================================================

describe('DeleteRotationHistoryByDateRangeSchema', () => {
  const valid = {
    teamId: '5',
    startDate: '2025-06-01',
    endDate: '2025-06-30',
  };

  it('should accept valid parameters', () => {
    const data = DeleteRotationHistoryByDateRangeSchema.parse(valid);

    expect(data.teamId).toBe(5);
  });

  it('should reject missing teamId', () => {
    const { teamId: _tid, ...noTeamId } = valid;

    expect(DeleteRotationHistoryByDateRangeSchema.safeParse(noTeamId).success).toBe(false);
  });

  it('should reject invalid date format', () => {
    expect(
      DeleteRotationHistoryByDateRangeSchema.safeParse({
        ...valid,
        startDate: '06/01/2025',
      }).success,
    ).toBe(false);
  });
});
