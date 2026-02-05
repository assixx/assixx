import { describe, expect, it } from 'vitest';

import { CreateEventSchema } from './create-event.dto.js';
import { DashboardEventsQuerySchema } from './dashboard-event.dto.js';
import { ExportEventsQuerySchema } from './export-event.dto.js';
import { ListEventsQuerySchema } from './query-event.dto.js';
import { UpdateEventSchema } from './update-event.dto.js';

// =============================================================
// CreateEventSchema
// =============================================================

describe('CreateEventSchema', () => {
  const valid = {
    title: 'Sprint Planning',
    startTime: '2025-06-15T09:00:00Z',
    endTime: '2025-06-15T10:00:00Z',
  };

  it('should accept valid event', () => {
    expect(CreateEventSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject endTime before startTime (refinement)', () => {
    const result = CreateEventSchema.safeParse({
      ...valid,
      endTime: '2025-06-15T08:00:00Z',
    });

    expect(result.success).toBe(false);
  });

  it('should reject endTime equal to startTime (refinement)', () => {
    const result = CreateEventSchema.safeParse({
      ...valid,
      endTime: valid.startTime,
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing title', () => {
    const { title: _title, ...noTitle } = valid;

    expect(CreateEventSchema.safeParse(noTitle).success).toBe(false);
  });

  it('should reject empty title', () => {
    expect(
      CreateEventSchema.safeParse({ ...valid, title: '' }).success,
    ).toBe(false);
  });

  it('should accept valid hex color', () => {
    expect(
      CreateEventSchema.safeParse({ ...valid, color: '#FF5733' }).success,
    ).toBe(true);
  });

  it('should reject invalid hex color', () => {
    expect(
      CreateEventSchema.safeParse({ ...valid, color: 'red' }).success,
    ).toBe(false);
  });

  it('should accept lowercase hex color', () => {
    expect(
      CreateEventSchema.safeParse({ ...valid, color: '#ff5733' }).success,
    ).toBe(true);
  });

  it.each(['daily', 'weekly', 'monthly', 'yearly'] as const)(
    'should accept recurrence=%s',
    (recurrence) => {
      expect(
        CreateEventSchema.safeParse({ ...valid, recurrence }).success,
      ).toBe(true);
    },
  );

  it('should reject invalid recurrence', () => {
    expect(
      CreateEventSchema.safeParse({ ...valid, recurrence: 'hourly' }).success,
    ).toBe(false);
  });

  it('should accept recurrenceCount within range', () => {
    expect(
      CreateEventSchema.safeParse({ ...valid, recurrenceCount: 52 }).success,
    ).toBe(true);
  });

  it('should reject recurrenceCount > 365', () => {
    expect(
      CreateEventSchema.safeParse({ ...valid, recurrenceCount: 366 }).success,
    ).toBe(false);
  });

  it('should reject invalid datetime format', () => {
    expect(
      CreateEventSchema.safeParse({ ...valid, startTime: '2025-06-15' })
        .success,
    ).toBe(false);
  });
});

// =============================================================
// UpdateEventSchema
// =============================================================

describe('UpdateEventSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateEventSchema.safeParse({}).success).toBe(true);
  });

  it('should accept partial update with title only', () => {
    const result = UpdateEventSchema.safeParse({ title: 'New Title' });

    expect(result.success).toBe(true);
  });

  it('should reject when both times provided and end < start', () => {
    const result = UpdateEventSchema.safeParse({
      startTime: '2025-06-15T10:00:00Z',
      endTime: '2025-06-15T08:00:00Z',
    });

    expect(result.success).toBe(false);
  });

  it('should pass when only startTime is provided (no comparison)', () => {
    const result = UpdateEventSchema.safeParse({
      startTime: '2025-06-15T10:00:00Z',
    });

    expect(result.success).toBe(true);
  });

  it.each(['tentative', 'confirmed', 'cancelled'] as const)(
    'should accept status=%s',
    (status) => {
      expect(UpdateEventSchema.safeParse({ status }).success).toBe(true);
    },
  );
});

// =============================================================
// ListEventsQuerySchema
// =============================================================

describe('ListEventsQuerySchema', () => {
  it('should accept empty query', () => {
    expect(ListEventsQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should coerce page from string', () => {
    const data = ListEventsQuerySchema.parse({ page: '2' });

    expect(data.page).toBe(2);
  });

  it('should coerce limit from string', () => {
    const data = ListEventsQuerySchema.parse({ limit: '25' });

    expect(data.limit).toBe(25);
  });

  it('should reject limit > 100', () => {
    expect(
      ListEventsQuerySchema.safeParse({ limit: '101' }).success,
    ).toBe(false);
  });

  it('should reject page < 1', () => {
    expect(
      ListEventsQuerySchema.safeParse({ page: '0' }).success,
    ).toBe(false);
  });

  it.each([
    'all',
    'company',
    'department',
    'team',
    'area',
    'personal',
  ] as const)('should accept filter=%s', (filter) => {
    expect(
      ListEventsQuerySchema.safeParse({ filter }).success,
    ).toBe(true);
  });
});

// =============================================================
// DashboardEventsQuerySchema
// =============================================================

describe('DashboardEventsQuerySchema', () => {
  it('should accept empty query', () => {
    expect(DashboardEventsQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should coerce days from string', () => {
    const data = DashboardEventsQuerySchema.parse({ days: '7' });

    expect(data.days).toBe(7);
  });

  it('should reject days > 365', () => {
    expect(
      DashboardEventsQuerySchema.safeParse({ days: '366' }).success,
    ).toBe(false);
  });

  it('should reject limit > 50', () => {
    expect(
      DashboardEventsQuerySchema.safeParse({ limit: '51' }).success,
    ).toBe(false);
  });
});

// =============================================================
// ExportEventsQuerySchema
// =============================================================

describe('ExportEventsQuerySchema', () => {
  it.each(['ics', 'csv'] as const)(
    'should accept format=%s',
    (format) => {
      expect(ExportEventsQuerySchema.safeParse({ format }).success).toBe(true);
    },
  );

  it('should reject invalid format', () => {
    expect(
      ExportEventsQuerySchema.safeParse({ format: 'pdf' }).success,
    ).toBe(false);
  });

  it('should reject missing format', () => {
    expect(ExportEventsQuerySchema.safeParse({}).success).toBe(false);
  });
});
