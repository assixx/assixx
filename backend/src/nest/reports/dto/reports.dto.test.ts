import { describe, expect, it } from 'vitest';

import { CustomReportBodySchema } from './custom-report.dto.js';
import { DateRangeQuerySchema } from './date-range-query.dto.js';
import { EmployeeReportQuerySchema } from './employee-report-query.dto.js';
import { ExportReportQuerySchema } from './export-report-query.dto.js';
import { KvpReportQuerySchema } from './kvp-report-query.dto.js';
import { ReportTypeParamSchema } from './report-type-param.dto.js';
import { ExportFormatSchema, ReportTypeSchema } from './report.schemas.js';
import { ShiftReportQuerySchema } from './shift-report-query.dto.js';

// =============================================================
// Shared Schemas
// =============================================================

describe('ReportTypeSchema', () => {
  const validTypes = ['overview', 'employees', 'departments', 'shifts', 'kvp'];

  it('should accept all valid report types', () => {
    for (const type of validTypes) {
      expect(ReportTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it('should reject invalid type', () => {
    expect(ReportTypeSchema.safeParse('custom').success).toBe(false);
  });
});

describe('ExportFormatSchema (reports)', () => {
  it('should accept csv', () => {
    expect(ExportFormatSchema.safeParse('csv').success).toBe(true);
  });

  it('should reject json (only csv allowed)', () => {
    expect(ExportFormatSchema.safeParse('json').success).toBe(false);
  });
});

// =============================================================
// ReportTypeParamSchema
// =============================================================

describe('ReportTypeParamSchema', () => {
  it('should accept valid report type', () => {
    expect(ReportTypeParamSchema.safeParse({ type: 'overview' }).success).toBe(
      true,
    );
  });

  it('should reject invalid type', () => {
    expect(ReportTypeParamSchema.safeParse({ type: 'invalid' }).success).toBe(
      false,
    );
  });

  it('should reject missing type', () => {
    expect(ReportTypeParamSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// Query Schemas
// =============================================================

describe('DateRangeQuerySchema', () => {
  it('should accept empty query', () => {
    expect(DateRangeQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept date range', () => {
    expect(
      DateRangeQuerySchema.safeParse({
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
      }).success,
    ).toBe(true);
  });

  it('should reject invalid date format', () => {
    expect(
      DateRangeQuerySchema.safeParse({ dateFrom: '01/01/2025' }).success,
    ).toBe(false);
  });
});

describe('KvpReportQuerySchema', () => {
  it('should accept empty query', () => {
    expect(KvpReportQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept with date range and category', () => {
    const data = {
      dateFrom: '2025-01-01',
      dateTo: '2025-06-30',
      categoryId: 5,
    };
    expect(KvpReportQuerySchema.safeParse(data).success).toBe(true);
  });
});

describe('ShiftReportQuerySchema', () => {
  it('should accept empty query', () => {
    expect(ShiftReportQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept with department and team filters', () => {
    const data = { departmentId: 1, teamId: 2 };
    expect(ShiftReportQuerySchema.safeParse(data).success).toBe(true);
  });
});

describe('EmployeeReportQuerySchema', () => {
  it('should accept empty query', () => {
    expect(EmployeeReportQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept with all filters', () => {
    const data = {
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
      departmentId: 1,
      teamId: 2,
    };
    expect(EmployeeReportQuerySchema.safeParse(data).success).toBe(true);
  });
});

describe('ExportReportQuerySchema', () => {
  it('should accept valid export query', () => {
    expect(ExportReportQuerySchema.safeParse({ format: 'csv' }).success).toBe(
      true,
    );
  });

  it('should reject invalid format', () => {
    expect(ExportReportQuerySchema.safeParse({ format: 'pdf' }).success).toBe(
      false,
    );
  });

  it('should reject missing format', () => {
    expect(ExportReportQuerySchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================
// CustomReportBodySchema (with .refine())
// =============================================================

describe('CustomReportBodySchema', () => {
  const valid = {
    name: 'Q3 Report',
    metrics: ['employees'],
    dateFrom: '2025-07-01',
    dateTo: '2025-09-30',
  };

  it('should accept valid custom report', () => {
    expect(CustomReportBodySchema.safeParse(valid).success).toBe(true);
  });

  it('should accept with all optional fields', () => {
    const data = {
      ...valid,
      description: 'Quarterly employee report',
      filters: { departmentIds: [1, 2], teamIds: [3] },
      groupBy: 'department' as const,
    };
    expect(CustomReportBodySchema.safeParse(data).success).toBe(true);
  });

  it('should accept all valid metrics', () => {
    for (const metric of [
      'employees',
      'departments',
      'shifts',
      'kvp',
      'attendance',
      'compliance',
    ]) {
      expect(
        CustomReportBodySchema.safeParse({ ...valid, metrics: [metric] })
          .success,
      ).toBe(true);
    }
  });

  it('should accept all valid groupBy values', () => {
    for (const group of ['department', 'team', 'week', 'month']) {
      expect(
        CustomReportBodySchema.safeParse({ ...valid, groupBy: group }).success,
      ).toBe(true);
    }
  });

  it('should reject empty metrics array', () => {
    expect(
      CustomReportBodySchema.safeParse({ ...valid, metrics: [] }).success,
    ).toBe(false);
  });

  it('should reject name under 3 chars', () => {
    expect(
      CustomReportBodySchema.safeParse({ ...valid, name: 'AB' }).success,
    ).toBe(false);
  });

  it('should reject name over 100 chars', () => {
    expect(
      CustomReportBodySchema.safeParse({ ...valid, name: 'a'.repeat(101) })
        .success,
    ).toBe(false);
  });

  it('should reject dateTo before dateFrom (cross-field refinement)', () => {
    const data = { ...valid, dateFrom: '2025-09-30', dateTo: '2025-07-01' };
    expect(CustomReportBodySchema.safeParse(data).success).toBe(false);
  });

  it('should reject missing required fields', () => {
    expect(CustomReportBodySchema.safeParse({}).success).toBe(false);
  });

  it('should reject invalid metric', () => {
    expect(
      CustomReportBodySchema.safeParse({ ...valid, metrics: ['invalid'] })
        .success,
    ).toBe(false);
  });
});
