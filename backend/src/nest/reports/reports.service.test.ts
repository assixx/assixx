/**
 * Reports Service – Unit Tests
 *
 * Tests for pure helper methods + DB-mocked public methods.
 * Private methods tested via bracket notation.
 */
import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { ReportsService } from './reports.service.js';

// ============================================================
// Setup: Mock DatabaseService via constructor injection
// ============================================================

function createServiceWithMock(): {
  service: ReportsService;
  mockDb: { query: ReturnType<typeof vi.fn> };
} {
  const mockDb = { query: vi.fn() };
  const service = new ReportsService(mockDb as unknown as DatabaseService);
  return { service, mockDb };
}

// ============================================================
// Pure Helper Methods (private, via bracket notation)
// ============================================================

describe('ReportsService – pure helpers', () => {
  let service: ReportsService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('parseIntOrZero', () => {
    it('parses valid integer strings', () => {
      expect(service['parseIntOrZero']('42')).toBe(42);
      expect(service['parseIntOrZero'](100)).toBe(100);
    });

    it('returns 0 for NaN values', () => {
      expect(service['parseIntOrZero'](undefined)).toBe(0);
      expect(service['parseIntOrZero']('abc')).toBe(0);
      expect(service['parseIntOrZero'](null)).toBe(0);
    });
  });

  describe('parseFloatOrZero', () => {
    it('parses valid float strings', () => {
      expect(service['parseFloatOrZero']('3.14')).toBeCloseTo(3.14);
      expect(service['parseFloatOrZero'](2.5)).toBe(2.5);
    });

    it('returns 0 for NaN values', () => {
      expect(service['parseFloatOrZero'](undefined)).toBe(0);
      expect(service['parseFloatOrZero']('abc')).toBe(0);
    });
  });

  describe('getDefaultDateFrom', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns date 30 days ago in YYYY-MM-DD format', () => {
      const result = service['getDefaultDateFrom']();
      expect(result).toBe('2025-05-16');
    });
  });

  describe('getDefaultDateTo', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns today in YYYY-MM-DD format', () => {
      const result = service['getDefaultDateTo']();
      expect(result).toBe('2025-06-15');
    });
  });

  describe('convertToCSV', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('converts flat data to CSV buffer', () => {
      const data = { name: 'Test', value: 42 };
      const result = service['convertToCSV'](data);

      expect(result).toBeInstanceOf(Buffer);
      const content = result.toString();
      expect(content).toContain('Assixx Report Export');
      expect(content).toContain('"name","Test"');
      expect(content).toContain('"value","42"');
    });

    it('handles nested objects', () => {
      const data = { metrics: { total: 10 } };
      const result = service['convertToCSV'](data);
      const content = result.toString();

      expect(content).toContain('"metrics.total","10"');
    });

    it('handles arrays with item count', () => {
      const data = { items: [1, 2, 3] };
      const result = service['convertToCSV'](data);
      const content = result.toString();

      expect(content).toContain('"items","3 items"');
    });
  });

  describe('buildShiftQueryConditions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('builds base conditions with tenant_id and date range', () => {
      const filters = {
        tenantId: 1,
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
      };
      const result = service['buildShiftQueryConditions'](filters);

      expect(result.conditions).toContain('s.tenant_id = $1');
      expect(result.conditions[1]).toContain('BETWEEN');
      expect(result.params).toEqual([1, '2025-01-01', '2025-06-30']);
    });

    it('adds department and team filters when provided', () => {
      const filters = {
        tenantId: 1,
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
        departmentId: 5,
        teamId: 10,
      };
      const result = service['buildShiftQueryConditions'](filters);

      expect(result.conditions).toContain('s.department_id = $4');
      expect(result.conditions).toContain('s.team_id = $5');
      expect(result.params).toEqual([1, '2025-01-01', '2025-06-30', 5, 10]);
    });
  });
});

// ============================================================
// DB-Mocked Public Methods
// ============================================================

describe('ReportsService – DB-mocked methods', () => {
  let service: ReportsService;
  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getOverviewReport', () => {
    it('returns aggregated overview with all metric sections', async () => {
      // Mock responses for the 5 parallel queries
      mockDb.query
        .mockResolvedValueOnce([
          {
            total: '50',
            active: '45',
            new_this_month: '3',
            department_count: '5',
            avg_per_department: '10',
          },
        ]) // employees
        .mockResolvedValueOnce([{ total: '5', avg_employees: '10' }]) // departments
        .mockResolvedValueOnce([{ total_scheduled: '120' }]) // shifts
        .mockResolvedValueOnce([
          {
            total_suggestions: '15',
            implemented: '5',
            total_savings: '10000',
            avg_roi: '2.5',
          },
        ]) // kvp
        .mockResolvedValueOnce([
          { active_surveys: '3', avg_response_rate: '0.75' },
        ]); // surveys

      const result = (await service.getOverviewReport(1)) as Record<
        string,
        unknown
      >;

      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('employees');
      expect(result).toHaveProperty('departments');
      expect(result).toHaveProperty('shifts');
      expect(result).toHaveProperty('kvp');
      expect(result).toHaveProperty('surveys');
    });
  });

  describe('exportReport', () => {
    it('exports overview report as CSV', async () => {
      // Mock for getOverviewReport (5 queries)
      mockDb.query
        .mockResolvedValueOnce([{ total: '10', active: '8' }])
        .mockResolvedValueOnce([{ total: '3', avg_employees: '5' }])
        .mockResolvedValueOnce([{ total_scheduled: '20' }])
        .mockResolvedValueOnce([{ total_suggestions: '5' }])
        .mockResolvedValueOnce([{ active_surveys: '1' }]);

      const result = await service.exportReport({
        tenantId: 1,
        reportType: 'overview',
        format: 'csv',
        filters: {},
      });

      expect(result.filename).toContain('report-overview-');
      expect(result.filename).toContain('.csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.content).toBeInstanceOf(Buffer);
    });

    it('throws for invalid report type', async () => {
      await expect(
        service.exportReport({
          tenantId: 1,
          reportType: 'invalid',
          format: 'csv',
          filters: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateCustomReport', () => {
    it('generates report with selected metrics', async () => {
      // Mock for employee metrics query
      mockDb.query.mockResolvedValueOnce([{ total: '20', active: '18' }]);

      const result = (await service.generateCustomReport({
        tenantId: 1,
        name: 'Test Report',
        metrics: ['employees'],
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
      })) as Record<string, unknown>;

      expect(result.name).toBe('Test Report');
      expect(result).toHaveProperty('reportId');
      expect(result).toHaveProperty('data');
    });
  });

  describe('getDepartmentReport', () => {
    it('returns department performance data', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          department_id: 1,
          department_name: 'Engineering',
          employees: '10',
          teams: '3',
          kvp_suggestions: '5',
        },
      ]);

      const result = (await service.getDepartmentReport(1)) as Record<
        string,
        unknown
      >;

      expect(result).toHaveProperty('departments');
    });
  });
});
