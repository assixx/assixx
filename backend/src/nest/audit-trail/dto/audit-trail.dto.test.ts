import { describe, expect, it } from 'vitest';

import { DeleteOldEntriesBodySchema } from './delete-entries.dto.js';
import { EntryIdParamSchema } from './entry-id-param.dto.js';
import { ExportEntriesQuerySchema } from './export-entries.dto.js';
import { GenerateReportBodySchema } from './generate-report.dto.js';
import { GetEntriesQuerySchema } from './get-entries.dto.js';
import { GetStatsQuerySchema } from './get-stats.dto.js';

// =============================================================
// EntryIdParamSchema
// =============================================================

describe('EntryIdParamSchema', () => {
  it('should accept positive integer', () => {
    expect(EntryIdParamSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('should accept string id (via IdSchema preprocess)', () => {
    const result = EntryIdParamSchema.safeParse({ id: '5' });
    expect(result.success).toBe(true);
  });

  it('should reject zero', () => {
    expect(EntryIdParamSchema.safeParse({ id: 0 }).success).toBe(false);
  });

  it('should reject negative', () => {
    expect(EntryIdParamSchema.safeParse({ id: -1 }).success).toBe(false);
  });
});

// =============================================================
// GetStatsQuerySchema
// =============================================================

describe('GetStatsQuerySchema', () => {
  it('should accept empty query', () => {
    expect(GetStatsQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept ISO date strings', () => {
    const data = {
      dateFrom: '2025-01-01T00:00:00Z',
      dateTo: '2025-06-30T23:59:59Z',
    };
    expect(GetStatsQuerySchema.safeParse(data).success).toBe(true);
  });

  it('should reject invalid date format', () => {
    expect(GetStatsQuerySchema.safeParse({ dateFrom: '2025-01-01' }).success).toBe(false);
  });
});

// =============================================================
// GetEntriesQuerySchema
// =============================================================

describe('GetEntriesQuerySchema', () => {
  it('should accept empty query with pagination defaults', () => {
    const result = GetEntriesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept all filter fields', () => {
    const data = {
      page: 1,
      limit: 20,
      action: 'login',
      resourceType: 'user',
      status: 'success',
      sortBy: 'created_at',
      sortOrder: 'desc',
    };
    expect(GetEntriesQuerySchema.safeParse(data).success).toBe(true);
  });

  it('should reject invalid status enum', () => {
    expect(GetEntriesQuerySchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('should reject invalid sortBy enum', () => {
    expect(GetEntriesQuerySchema.safeParse({ sortBy: 'invalid_field' }).success).toBe(false);
  });

  it('should reject invalid sortOrder enum', () => {
    expect(GetEntriesQuerySchema.safeParse({ sortOrder: 'random' }).success).toBe(false);
  });

  it('should accept valid status values', () => {
    expect(GetEntriesQuerySchema.safeParse({ status: 'success' }).success).toBe(true);
    expect(GetEntriesQuerySchema.safeParse({ status: 'failure' }).success).toBe(true);
  });

  it('should accept all valid sortBy values', () => {
    for (const field of ['created_at', 'action', 'user_id', 'resource_type']) {
      expect(GetEntriesQuerySchema.safeParse({ sortBy: field }).success).toBe(true);
    }
  });
});

// =============================================================
// ExportEntriesQuerySchema
// =============================================================

describe('ExportEntriesQuerySchema', () => {
  it('should accept empty query', () => {
    expect(ExportEntriesQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept json format', () => {
    expect(ExportEntriesQuerySchema.safeParse({ format: 'json' }).success).toBe(true);
  });

  it('should accept csv format', () => {
    expect(ExportEntriesQuerySchema.safeParse({ format: 'csv' }).success).toBe(true);
  });

  it('should reject invalid format', () => {
    expect(ExportEntriesQuerySchema.safeParse({ format: 'xml' }).success).toBe(false);
  });
});

// =============================================================
// DeleteOldEntriesBodySchema
// =============================================================

describe('DeleteOldEntriesBodySchema', () => {
  const valid = { olderThanDays: 90, confirmPassword: 'admin123' };

  it('should accept valid deletion request', () => {
    expect(DeleteOldEntriesBodySchema.safeParse(valid).success).toBe(true);
  });

  it('should accept days greater than 90', () => {
    expect(DeleteOldEntriesBodySchema.safeParse({ ...valid, olderThanDays: 365 }).success).toBe(
      true,
    );
  });

  it('should reject olderThanDays below 90', () => {
    expect(DeleteOldEntriesBodySchema.safeParse({ ...valid, olderThanDays: 89 }).success).toBe(
      false,
    );
    expect(DeleteOldEntriesBodySchema.safeParse({ ...valid, olderThanDays: 30 }).success).toBe(
      false,
    );
  });

  it('should reject missing confirmPassword', () => {
    expect(DeleteOldEntriesBodySchema.safeParse({ olderThanDays: 90 }).success).toBe(false);
  });

  it('should reject empty confirmPassword', () => {
    expect(DeleteOldEntriesBodySchema.safeParse({ ...valid, confirmPassword: '' }).success).toBe(
      false,
    );
  });
});

// =============================================================
// GenerateReportBodySchema
// =============================================================

describe('GenerateReportBodySchema', () => {
  const valid = {
    reportType: 'gdpr',
    dateFrom: '2025-01-01T00:00:00Z',
    dateTo: '2025-06-30T23:59:59Z',
  };

  it('should accept valid report request', () => {
    expect(GenerateReportBodySchema.safeParse(valid).success).toBe(true);
  });

  it('should accept all report types', () => {
    for (const type of ['gdpr', 'data_access', 'data_changes', 'user_activity']) {
      expect(GenerateReportBodySchema.safeParse({ ...valid, reportType: type }).success).toBe(true);
    }
  });

  it('should reject invalid report type', () => {
    expect(GenerateReportBodySchema.safeParse({ ...valid, reportType: 'custom' }).success).toBe(
      false,
    );
  });

  it('should reject dateTo before dateFrom (cross-field refinement)', () => {
    const data = {
      ...valid,
      dateFrom: '2025-06-30T00:00:00Z',
      dateTo: '2025-01-01T00:00:00Z',
    };
    expect(GenerateReportBodySchema.safeParse(data).success).toBe(false);
  });

  it('should reject date range exceeding 1 year', () => {
    const data = {
      ...valid,
      dateFrom: '2024-01-01T00:00:00Z',
      dateTo: '2025-01-02T00:00:00Z',
    };
    expect(GenerateReportBodySchema.safeParse(data).success).toBe(false);
  });

  it('should accept date range of exactly 1 year', () => {
    const data = {
      ...valid,
      dateFrom: '2024-01-01T00:00:00Z',
      dateTo: '2025-01-01T00:00:00Z',
    };
    expect(GenerateReportBodySchema.safeParse(data).success).toBe(true);
  });

  it('should reject missing fields', () => {
    expect(GenerateReportBodySchema.safeParse({}).success).toBe(false);
    expect(GenerateReportBodySchema.safeParse({ reportType: 'gdpr' }).success).toBe(false);
  });
});
