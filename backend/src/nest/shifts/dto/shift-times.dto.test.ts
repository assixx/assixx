import { describe, expect, it } from 'vitest';

import { ShiftKeyParamSchema, ShiftKeySchema } from './shift-key-param.dto.js';
import { ShiftTimeResponseSchema } from './shift-time-response.dto.js';
import { UpdateAllShiftTimesSchema } from './update-all-shift-times.dto.js';
import { UpdateShiftTimeSchema } from './update-shift-time.dto.js';

// =============================================================
// ShiftKeySchema
// =============================================================

describe('ShiftKeySchema', () => {
  it.each(['early', 'late', 'night'] as const)(
    'should accept shift key=%s',
    (key) => {
      expect(ShiftKeySchema.safeParse(key).success).toBe(true);
    },
  );

  it('should reject invalid shift key', () => {
    expect(ShiftKeySchema.safeParse('morning').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(ShiftKeySchema.safeParse('').success).toBe(false);
  });

  it('should reject uppercase variants', () => {
    expect(ShiftKeySchema.safeParse('Early').success).toBe(false);
    expect(ShiftKeySchema.safeParse('LATE').success).toBe(false);
  });

  it('should reject rotation codes F/S/N', () => {
    expect(ShiftKeySchema.safeParse('F').success).toBe(false);
    expect(ShiftKeySchema.safeParse('S').success).toBe(false);
    expect(ShiftKeySchema.safeParse('N').success).toBe(false);
  });
});

// =============================================================
// ShiftKeyParamSchema
// =============================================================

describe('ShiftKeyParamSchema', () => {
  it('should accept valid param object', () => {
    const result = ShiftKeyParamSchema.safeParse({ shiftKey: 'early' });
    expect(result.success).toBe(true);
  });

  it('should reject missing shiftKey', () => {
    const result = ShiftKeyParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject invalid shiftKey value', () => {
    const result = ShiftKeyParamSchema.safeParse({ shiftKey: 'day' });
    expect(result.success).toBe(false);
  });
});

// =============================================================
// UpdateShiftTimeSchema
// =============================================================

describe('UpdateShiftTimeSchema', () => {
  it('should accept valid update payload', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: 'Frühschicht',
      startTime: '06:00',
      endTime: '14:00',
    });
    expect(result.success).toBe(true);
  });

  it('should accept custom shift times', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: 'Morgenschicht',
      startTime: '05:00',
      endTime: '13:00',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty label', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: '',
      startTime: '06:00',
      endTime: '14:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject label exceeding 100 characters', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: 'A'.repeat(101),
      startTime: '06:00',
      endTime: '14:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid time format', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: 'Test',
      startTime: '6:00',
      endTime: '14:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject time with seconds', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: 'Test',
      startTime: '06:00:00',
      endTime: '14:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject out-of-range hours', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: 'Test',
      startTime: '25:00',
      endTime: '14:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject out-of-range minutes', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: 'Test',
      startTime: '06:60',
      endTime: '14:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    expect(UpdateShiftTimeSchema.safeParse({ label: 'Test' }).success).toBe(
      false,
    );
    expect(
      UpdateShiftTimeSchema.safeParse({ startTime: '06:00' }).success,
    ).toBe(false);
    expect(UpdateShiftTimeSchema.safeParse({}).success).toBe(false);
  });

  it('should accept midnight boundary times', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: 'Nachtschicht',
      startTime: '22:00',
      endTime: '06:00',
    });
    expect(result.success).toBe(true);
  });

  it('should accept 00:00 as valid time', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: 'Midnight',
      startTime: '00:00',
      endTime: '08:00',
    });
    expect(result.success).toBe(true);
  });

  it('should accept 23:59 as valid time', () => {
    const result = UpdateShiftTimeSchema.safeParse({
      label: 'Late',
      startTime: '23:59',
      endTime: '08:00',
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================
// UpdateAllShiftTimesSchema
// =============================================================

describe('UpdateAllShiftTimesSchema', () => {
  it('should accept valid bulk update with 3 entries', () => {
    const result = UpdateAllShiftTimesSchema.safeParse({
      shiftTimes: [
        {
          shiftKey: 'early',
          label: 'Frühschicht',
          startTime: '06:00',
          endTime: '14:00',
        },
        {
          shiftKey: 'late',
          label: 'Spätschicht',
          startTime: '14:00',
          endTime: '22:00',
        },
        {
          shiftKey: 'night',
          label: 'Nachtschicht',
          startTime: '22:00',
          endTime: '06:00',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept single entry', () => {
    const result = UpdateAllShiftTimesSchema.safeParse({
      shiftTimes: [
        {
          shiftKey: 'early',
          label: 'Morgenschicht',
          startTime: '05:00',
          endTime: '13:00',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty array', () => {
    const result = UpdateAllShiftTimesSchema.safeParse({ shiftTimes: [] });
    expect(result.success).toBe(false);
  });

  it('should reject more than 3 entries', () => {
    const result = UpdateAllShiftTimesSchema.safeParse({
      shiftTimes: [
        { shiftKey: 'early', label: 'A', startTime: '06:00', endTime: '14:00' },
        { shiftKey: 'late', label: 'B', startTime: '14:00', endTime: '22:00' },
        { shiftKey: 'night', label: 'C', startTime: '22:00', endTime: '06:00' },
        { shiftKey: 'early', label: 'D', startTime: '05:00', endTime: '13:00' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid shift key in array entries', () => {
    const result = UpdateAllShiftTimesSchema.safeParse({
      shiftTimes: [
        {
          shiftKey: 'morning',
          label: 'Test',
          startTime: '06:00',
          endTime: '14:00',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing shiftTimes property', () => {
    const result = UpdateAllShiftTimesSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// =============================================================
// ShiftTimeResponseSchema
// =============================================================

describe('ShiftTimeResponseSchema', () => {
  it('should validate a valid response object', () => {
    const result = ShiftTimeResponseSchema.safeParse({
      shiftKey: 'early',
      label: 'Frühschicht',
      startTime: '06:00',
      endTime: '14:00',
      sortOrder: 1,
      isActive: 1,
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing fields', () => {
    const result = ShiftTimeResponseSchema.safeParse({
      shiftKey: 'early',
      label: 'Frühschicht',
    });
    expect(result.success).toBe(false);
  });
});
