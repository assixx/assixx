import { describe, expect, it } from 'vitest';

import { DeleteLogsBodySchema } from './delete-logs.dto.js';
import { ExportFormatSchema, ExportLogsQuerySchema, LogSourceSchema } from './export-logs.dto.js';
import { ListLogsQuerySchema } from './list-logs.dto.js';

// =============================================================
// ExportFormatSchema
// =============================================================

describe('ExportFormatSchema', () => {
  it('should accept json', () => {
    expect(ExportFormatSchema.safeParse('json').success).toBe(true);
  });

  it('should accept csv', () => {
    expect(ExportFormatSchema.safeParse('csv').success).toBe(true);
  });

  it('should accept txt', () => {
    expect(ExportFormatSchema.safeParse('txt').success).toBe(true);
  });

  it('should reject invalid format', () => {
    expect(ExportFormatSchema.safeParse('xml').success).toBe(false);
    expect(ExportFormatSchema.safeParse('pdf').success).toBe(false);
  });
});

// =============================================================
// LogSourceSchema
// =============================================================

describe('LogSourceSchema', () => {
  it('should accept audit_trail', () => {
    expect(LogSourceSchema.safeParse('audit_trail').success).toBe(true);
  });

  it('should accept root_logs', () => {
    expect(LogSourceSchema.safeParse('root_logs').success).toBe(true);
  });

  it('should accept all', () => {
    expect(LogSourceSchema.safeParse('all').success).toBe(true);
  });

  it('should reject invalid source', () => {
    expect(LogSourceSchema.safeParse('system').success).toBe(false);
  });
});

// =============================================================
// ExportLogsQuerySchema
// =============================================================

describe('ExportLogsQuerySchema', () => {
  const valid = { dateFrom: '2025-01-01', dateTo: '2025-06-30' };

  it('should accept valid export query', () => {
    expect(ExportLogsQuerySchema.safeParse(valid).success).toBe(true);
  });

  it('should default format to json', () => {
    const result = ExportLogsQuerySchema.safeParse(valid);
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> }).data;
    expect(data.format).toBe('json');
  });

  it('should default source to all', () => {
    const result = ExportLogsQuerySchema.safeParse(valid);
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> }).data;
    expect(data.source).toBe('all');
  });

  it('should accept explicit format and source', () => {
    const data = { ...valid, format: 'csv', source: 'audit_trail' };
    expect(ExportLogsQuerySchema.safeParse(data).success).toBe(true);
  });

  it('should reject missing dateFrom', () => {
    expect(ExportLogsQuerySchema.safeParse({ dateTo: '2025-06-30' }).success).toBe(false);
  });

  it('should reject missing dateTo', () => {
    expect(ExportLogsQuerySchema.safeParse({ dateFrom: '2025-01-01' }).success).toBe(false);
  });

  it('should accept optional filters', () => {
    const data = { ...valid, action: 'login', entityType: 'user' };
    expect(ExportLogsQuerySchema.safeParse(data).success).toBe(true);
  });
});

// =============================================================
// ListLogsQuerySchema
// =============================================================

describe('ListLogsQuerySchema', () => {
  it('should accept empty query with pagination defaults', () => {
    const result = ListLogsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept all filter fields', () => {
    const data = {
      page: 1,
      limit: 20,
      action: 'login',
      entityType: 'user',
      search: 'admin',
    };
    expect(ListLogsQuerySchema.safeParse(data).success).toBe(true);
  });

  it('should reject empty action string', () => {
    expect(ListLogsQuerySchema.safeParse({ action: '' }).success).toBe(false);
  });

  it('should reject empty entityType string', () => {
    expect(ListLogsQuerySchema.safeParse({ entityType: '' }).success).toBe(false);
  });
});

// =============================================================
// DeleteLogsBodySchema
// =============================================================

describe('DeleteLogsBodySchema', () => {
  const valid = { confirmPassword: 'mypassword123' };

  it('should accept with required confirmPassword', () => {
    expect(DeleteLogsBodySchema.safeParse(valid).success).toBe(true);
  });

  it('should accept with optional filters', () => {
    const data = { ...valid, action: 'login', olderThanDays: 30 };
    expect(DeleteLogsBodySchema.safeParse(data).success).toBe(true);
  });

  it('should reject missing confirmPassword', () => {
    expect(DeleteLogsBodySchema.safeParse({}).success).toBe(false);
  });

  it('should reject empty confirmPassword', () => {
    expect(DeleteLogsBodySchema.safeParse({ confirmPassword: '' }).success).toBe(false);
  });

  it('should reject negative olderThanDays', () => {
    expect(DeleteLogsBodySchema.safeParse({ ...valid, olderThanDays: -1 }).success).toBe(false);
  });
});
