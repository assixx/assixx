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

/**
 * Helper: mock the 5 parallel queries used by getOverviewReport
 */
function mockOverviewQueries(
  mockDb: { query: ReturnType<typeof vi.fn> },
  overrides?: Partial<{
    employees: Record<string, unknown>;
    departments: Record<string, unknown>;
    shifts: Record<string, unknown>;
    kvp: Record<string, unknown>;
    surveys: Record<string, unknown>;
  }>,
): void {
  mockDb.query
    .mockResolvedValueOnce([
      {
        total: '50',
        active: '45',
        new_this_month: '3',
        department_count: '5',
        avg_per_department: '10',
        ...overrides?.employees,
      },
    ])
    .mockResolvedValueOnce([{ total: '5', avg_employees: '10', ...overrides?.departments }])
    .mockResolvedValueOnce([{ total_scheduled: '120', ...overrides?.shifts }])
    .mockResolvedValueOnce([
      {
        total_suggestions: '15',
        implemented: '5',
        total_savings: '10000',
        avg_roi: '2.5',
        ...overrides?.kvp,
      },
    ])
    .mockResolvedValueOnce([
      {
        active_surveys: '3',
        avg_response_rate: '0.75',
        ...overrides?.surveys,
      },
    ]);
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

    it('handles deeply nested objects with multi-level prefix', () => {
      const data = { level1: { level2: { value: 'deep' } } };
      const result = service['convertToCSV'](data);
      const content = result.toString();

      expect(content).toContain('"level1.level2.value","deep"');
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

    it('adds only departmentId when teamId is absent', () => {
      const filters = {
        tenantId: 1,
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
        departmentId: 7,
      };
      const result = service['buildShiftQueryConditions'](filters);

      expect(result.conditions).toHaveLength(3);
      expect(result.conditions[2]).toContain('department_id');
      expect(result.params).toEqual([1, '2025-01-01', '2025-06-30', 7]);
    });

    it('uses default dates when dateFrom/dateTo are undefined', () => {
      const filters = { tenantId: 1 };
      const result = service['buildShiftQueryConditions'](filters);

      // Default: 30 days ago to today
      expect(result.params).toEqual([1, '2025-05-16', '2025-06-15']);
    });
  });
});

// ============================================================
// Private Metrics Methods (via bracket notation)
// ============================================================

describe('ReportsService – private metrics methods', () => {
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

  describe('getEmployeeMetrics', () => {
    it('parses DB row into EmployeeMetrics', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          total: '50',
          active: '45',
          new_this_month: '3',
          department_count: '5',
          avg_per_department: '10.5',
        },
      ]);

      const result = (await service['getEmployeeMetrics'](1)) as Record<string, unknown>;

      expect(result).toEqual({
        total: 50,
        active: 45,
        newThisMonth: 3,
        departments: 5,
        avgPerDepartment: 10.5,
      });
    });

    it('defaults to zeros when row is empty', async () => {
      mockDb.query.mockResolvedValueOnce([{}]);

      const result = (await service['getEmployeeMetrics'](1)) as Record<string, unknown>;

      expect(result).toEqual({
        total: 0,
        active: 0,
        newThisMonth: 0,
        departments: 0,
        avgPerDepartment: 0,
      });
    });
  });

  describe('getDepartmentMetrics', () => {
    it('parses DB row into DepartmentMetrics', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: '8', avg_employees: '12.5' }]);

      const result = (await service['getDepartmentMetrics'](1)) as Record<string, unknown>;

      expect(result).toEqual({ total: 8, avgEmployees: 12.5 });
    });
  });

  describe('getShiftMetrics', () => {
    it('parses DB row into ShiftMetrics', async () => {
      mockDb.query.mockResolvedValueOnce([{ total_scheduled: '200' }]);

      const result = (await service['getShiftMetrics'](1, '2025-01-01', '2025-06-30')) as Record<
        string,
        unknown
      >;

      expect(result).toEqual({ totalScheduled: 200 });
    });
  });

  describe('getKvpMetrics', () => {
    it('parses DB row into KvpMetrics', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          total_suggestions: '25',
          implemented: '10',
          total_savings: '50000',
          avg_roi: '3.5',
        },
      ]);

      const result = (await service['getKvpMetrics'](1, '2025-01-01', '2025-06-30')) as Record<
        string,
        unknown
      >;

      expect(result).toEqual({
        totalSuggestions: 25,
        implemented: 10,
        totalSavings: 50000,
        avgROI: 3.5,
      });
    });
  });

  describe('getSurveyMetrics', () => {
    it('parses DB row into SurveyMetrics', async () => {
      mockDb.query.mockResolvedValueOnce([{ active_surveys: '5', avg_response_rate: '0.82' }]);

      const result = (await service['getSurveyMetrics'](1, '2025-01-01', '2025-06-30')) as Record<
        string,
        unknown
      >;

      expect(result).toEqual({ totalSurveys: 5, avgParticipation: 0.82 });
    });
  });

  describe('getKvpParticipationMetrics', () => {
    it('calculates participation when employees exist', async () => {
      mockDb.query.mockResolvedValueOnce([{ participants: '8', total_employees: '40' }]);

      const result = (await service['getKvpParticipationMetrics'](
        1,
        '2025-01-01',
        '2025-06-30',
      )) as Record<string, unknown>;

      expect(result).toEqual({ kvpParticipation: 0.2 });
    });

    it('returns 0 participation when total_employees is 0', async () => {
      mockDb.query.mockResolvedValueOnce([{ participants: '0', total_employees: '0' }]);

      const result = (await service['getKvpParticipationMetrics'](
        1,
        '2025-01-01',
        '2025-06-30',
      )) as Record<string, unknown>;

      expect(result).toEqual({ kvpParticipation: 0 });
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

  // ============================================================
  // getOverviewReport
  // ============================================================

  describe('getOverviewReport', () => {
    it('returns aggregated overview with all metric sections', async () => {
      mockOverviewQueries(mockDb);

      const result = (await service.getOverviewReport(1)) as Record<string, unknown>;

      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('employees');
      expect(result).toHaveProperty('departments');
      expect(result).toHaveProperty('shifts');
      expect(result).toHaveProperty('kvp');
      expect(result).toHaveProperty('surveys');
    });

    it('uses explicit dateFrom/dateTo when provided', async () => {
      mockOverviewQueries(mockDb);

      const result = (await service.getOverviewReport(1, '2025-03-01', '2025-04-30')) as Record<
        string,
        unknown
      >;

      const period = result['period'] as Record<string, string>;
      expect(period['from']).toBe('2025-03-01');
      expect(period['to']).toBe('2025-04-30');
    });

    it('parses numeric string values from DB rows correctly', async () => {
      mockOverviewQueries(mockDb, {
        employees: { total: '100', active: '95' },
      });

      const result = (await service.getOverviewReport(1)) as Record<string, unknown>;

      const employees = result['employees'] as Record<string, number>;
      expect(employees['total']).toBe(100);
      expect(employees['active']).toBe(95);
    });
  });

  // ============================================================
  // getEmployeeReport
  // ============================================================

  describe('getEmployeeReport', () => {
    it('returns headcount trend and KVP participation', async () => {
      // Query 1: headcount trend
      mockDb.query.mockResolvedValueOnce([
        { date: '2025-06-01', count: '5' },
        { date: '2025-06-02', count: '3' },
      ]);
      // Query 2: getKvpParticipationMetrics
      mockDb.query.mockResolvedValueOnce([{ participants: '10', total_employees: '50' }]);

      const result = (await service.getEmployeeReport(1)) as Record<string, unknown>;

      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('headcount');
      expect(result).toHaveProperty('performance');
      expect(result).toHaveProperty('filters');
    });

    it('includes filter values in response', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([{ participants: '0', total_employees: '0' }]);

      const result = (await service.getEmployeeReport(
        1,
        '2025-01-01',
        '2025-06-30',
        5,
        10,
      )) as Record<string, unknown>;

      const filters = result['filters'] as Record<string, unknown>;
      expect(filters['departmentId']).toBe(5);
      expect(filters['teamId']).toBe(10);
    });

    it('handles empty headcount trend', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([{ participants: '0', total_employees: '10' }]);

      const result = (await service.getEmployeeReport(1)) as Record<string, unknown>;

      const headcount = result['headcount'] as Record<string, unknown[]>;
      expect(headcount['trend']).toEqual([]);
    });
  });

  // ============================================================
  // getDepartmentReport
  // ============================================================

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

      const result = (await service.getDepartmentReport(1)) as Record<string, unknown>;

      expect(result).toHaveProperty('departments');
    });

    it('parses multiple departments with numeric conversion', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          department_id: 1,
          department_name: 'Engineering',
          employees: '10',
          teams: '3',
          kvp_suggestions: '5',
        },
        {
          department_id: 2,
          department_name: 'Sales',
          employees: '8',
          teams: '2',
          kvp_suggestions: '12',
        },
      ]);

      const result = (await service.getDepartmentReport(1)) as Record<string, unknown>;

      const departments = result['departments'] as Array<Record<string, unknown>>;
      expect(departments).toHaveLength(2);

      expect(departments[0]).toEqual({
        departmentId: 1,
        departmentName: 'Engineering',
        metrics: { employees: 10, teams: 3, kvpSuggestions: 5 },
      });
      expect(departments[1]).toEqual({
        departmentId: 2,
        departmentName: 'Sales',
        metrics: { employees: 8, teams: 2, kvpSuggestions: 12 },
      });
    });

    it('returns empty array when no departments exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = (await service.getDepartmentReport(1)) as Record<string, unknown>;

      const departments = result['departments'] as unknown[];
      expect(departments).toEqual([]);
    });
  });

  // ============================================================
  // getShiftReport
  // ============================================================

  describe('getShiftReport', () => {
    it('returns summary with shift type breakdown', async () => {
      // Query 1: getShiftSummary
      mockDb.query.mockResolvedValueOnce([{ total_shifts: '150', total_required: '200' }]);
      // Query 2: getShiftsByType
      mockDb.query.mockResolvedValueOnce([
        { shift_type: 'early', count: '80' },
        { shift_type: 'late', count: '50' },
        { shift_type: 'night', count: '20' },
      ]);

      const result = (await service.getShiftReport(1)) as Record<string, unknown>;

      expect(result).toHaveProperty('period');
      expect(result['totalShifts']).toBe(150);
      expect(result['totalRequired']).toBe(200);

      const shiftsByType = result['shiftsByType'] as unknown[];
      expect(shiftsByType).toHaveLength(3);
    });

    it('handles empty shift type breakdown', async () => {
      mockDb.query.mockResolvedValueOnce([{ total_shifts: '0', total_required: '0' }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = (await service.getShiftReport(1)) as Record<string, unknown>;

      expect(result['totalShifts']).toBe(0);
      const shiftsByType = result['shiftsByType'] as unknown[];
      expect(shiftsByType).toEqual([]);
    });

    it('passes explicit dates and filters through', async () => {
      mockDb.query.mockResolvedValueOnce([{ total_shifts: '10' }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = (await service.getShiftReport(1, '2025-03-01', '2025-03-31', 5, 10)) as Record<
        string,
        unknown
      >;

      const period = result['period'] as Record<string, string>;
      expect(period['from']).toBe('2025-03-01');
      expect(period['to']).toBe('2025-03-31');
    });
  });

  // ============================================================
  // getKvpReport
  // ============================================================

  describe('getKvpReport', () => {
    it('returns summary, categories, and top performers', async () => {
      // Query 1: getKvpSummary
      mockDb.query.mockResolvedValueOnce([
        {
          total_suggestions: '30',
          implemented: '12',
          total_cost: '5000',
          total_savings: '15000',
        },
      ]);
      // Query 2: getKvpByCategory
      mockDb.query.mockResolvedValueOnce([
        {
          category_id: 1,
          category_name: 'Process',
          suggestions: '15',
          implemented: '8',
          avg_savings: '1200',
        },
      ]);
      // Query 3: getKvpTopPerformers
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 42,
          name: 'John Doe',
          suggestions: '5',
          total_savings: '8000',
        },
      ]);

      const result = (await service.getKvpReport(1)) as Record<string, unknown>;

      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('byCategory');
      expect(result).toHaveProperty('topPerformers');
    });

    it('calculates ROI correctly when totalCost > 0', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          total_suggestions: '10',
          implemented: '5',
          total_cost: '2000',
          total_savings: '8000',
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = (await service.getKvpReport(1)) as Record<string, unknown>;

      const summary = result['summary'] as Record<string, number>;
      // ROI = (8000 - 2000) / 2000 = 3.0
      expect(summary['roi']).toBe(3);
    });

    it('returns ROI = 0 when totalCost is 0 (division-by-zero guard)', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          total_suggestions: '5',
          implemented: '0',
          total_cost: '0',
          total_savings: '0',
        },
      ]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = (await service.getKvpReport(1)) as Record<string, unknown>;

      const summary = result['summary'] as Record<string, number>;
      expect(summary['roi']).toBe(0);
    });

    it('handles empty categories and performers', async () => {
      mockDb.query.mockResolvedValueOnce([
        { total_suggestions: '0', total_cost: '0', total_savings: '0' },
      ]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = (await service.getKvpReport(1)) as Record<string, unknown>;

      const byCategory = result['byCategory'] as unknown[];
      const topPerformers = result['topPerformers'] as unknown[];
      expect(byCategory).toEqual([]);
      expect(topPerformers).toEqual([]);
    });

    it('uses explicit dates in period output', async () => {
      mockDb.query.mockResolvedValueOnce([
        { total_suggestions: '0', total_cost: '0', total_savings: '0' },
      ]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = (await service.getKvpReport(1, '2025-02-01', '2025-04-30')) as Record<
        string,
        unknown
      >;

      const period = result['period'] as Record<string, string>;
      expect(period['from']).toBe('2025-02-01');
      expect(period['to']).toBe('2025-04-30');
    });
  });

  // ============================================================
  // generateCustomReport
  // ============================================================

  describe('generateCustomReport', () => {
    it('generates report with single employees metric', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: '20', active: '18' }]);

      const result = (await service.generateCustomReport({
        tenantId: 1,
        name: 'Test Report',
        metrics: ['employees'],
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
      })) as Record<string, unknown>;

      expect(result['name']).toBe('Test Report');
      expect(result).toHaveProperty('reportId');
      expect(result).toHaveProperty('data');
    });

    it('generates report with shifts metric', async () => {
      // getShiftMetrics → 1 query
      mockDb.query.mockResolvedValueOnce([{ total_scheduled: '120' }]);

      const result = (await service.generateCustomReport({
        tenantId: 1,
        name: 'Shifts Only',
        metrics: ['shifts'],
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
      })) as Record<string, unknown>;

      const data = result['data'] as Record<string, unknown>;
      const shifts = data['shifts'] as Record<string, unknown>;
      expect(shifts['totalScheduled']).toBe(120);
    });

    it('generates report with kvp metric', async () => {
      // getKvpMetrics → 1 query
      mockDb.query.mockResolvedValueOnce([
        {
          total_suggestions: '25',
          implemented: '10',
          total_savings: '50000',
          avg_roi: '2.0',
        },
      ]);

      const result = (await service.generateCustomReport({
        tenantId: 1,
        name: 'KVP Only',
        metrics: ['kvp'],
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
      })) as Record<string, unknown>;

      const data = result['data'] as Record<string, unknown>;
      expect(data).toHaveProperty('kvp');
    });

    it('generates report with multiple metrics (employees + shifts)', async () => {
      // getEmployeeMetrics → 1 query
      mockDb.query.mockResolvedValueOnce([{ total: '30', active: '28' }]);
      // getShiftMetrics → 1 query
      mockDb.query.mockResolvedValueOnce([{ total_scheduled: '200' }]);

      const result = (await service.generateCustomReport({
        tenantId: 1,
        name: 'Multi-metric Report',
        metrics: ['employees', 'shifts'],
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
      })) as Record<string, unknown>;

      const data = result['data'] as Record<string, unknown>;
      expect(data).toHaveProperty('employees');
      expect(data).toHaveProperty('shifts');
      expect(result['metrics']).toEqual(['employees', 'shifts']);
    });

    it('ignores unknown metric names gracefully', async () => {
      const result = (await service.generateCustomReport({
        tenantId: 1,
        name: 'Unknown Metric',
        metrics: ['nonexistent'],
        dateFrom: '2025-01-01',
        dateTo: '2025-06-30',
      })) as Record<string, unknown>;

      const data = result['data'] as Record<string, unknown>;
      expect(Object.keys(data)).toHaveLength(0);
    });

    it('includes description and generatedAt in output', async () => {
      const result = (await service.generateCustomReport({
        tenantId: 1,
        name: 'Described Report',
        description: 'Monthly overview for Q2',
        metrics: [],
        dateFrom: '2025-04-01',
        dateTo: '2025-06-30',
      })) as Record<string, unknown>;

      expect(result['description']).toBe('Monthly overview for Q2');
      expect(result['generatedAt']).toBe('2025-06-15T12:00:00.000Z');

      const period = result['period'] as Record<string, string>;
      expect(period['from']).toBe('2025-04-01');
      expect(period['to']).toBe('2025-06-30');
    });
  });

  // ============================================================
  // exportReport
  // ============================================================

  describe('exportReport', () => {
    it('exports overview report as CSV', async () => {
      mockOverviewQueries(mockDb);

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

    it('exports employees report as CSV', async () => {
      // getEmployeeReport: headcount query + kvpParticipation query
      mockDb.query.mockResolvedValueOnce([{ date: '2025-06-10', count: '3' }]);
      mockDb.query.mockResolvedValueOnce([{ participants: '5', total_employees: '20' }]);

      const result = await service.exportReport({
        tenantId: 1,
        reportType: 'employees',
        format: 'csv',
        filters: { dateFrom: '2025-06-01', dateTo: '2025-06-30' },
      });

      expect(result.filename).toContain('report-employees-');
      expect(result.mimeType).toBe('text/csv');
      expect(result.content).toBeInstanceOf(Buffer);
    });

    it('exports departments report as CSV', async () => {
      // getDepartmentReport: 1 query
      mockDb.query.mockResolvedValueOnce([
        {
          department_id: 1,
          department_name: 'Eng',
          employees: '10',
          teams: '2',
          kvp_suggestions: '3',
        },
      ]);

      const result = await service.exportReport({
        tenantId: 1,
        reportType: 'departments',
        format: 'csv',
        filters: {},
      });

      expect(result.filename).toContain('report-departments-');
      expect(result.content).toBeInstanceOf(Buffer);
    });

    it('exports shifts report as CSV', async () => {
      // getShiftReport: summary + shiftsByType
      mockDb.query.mockResolvedValueOnce([{ total_shifts: '50' }]);
      mockDb.query.mockResolvedValueOnce([{ shift_type: 'early', count: '30' }]);

      const result = await service.exportReport({
        tenantId: 1,
        reportType: 'shifts',
        format: 'csv',
        filters: { dateFrom: '2025-06-01', dateTo: '2025-06-30' },
      });

      expect(result.filename).toContain('report-shifts-');
      expect(result.content).toBeInstanceOf(Buffer);
    });

    it('exports kvp report as CSV', async () => {
      // getKvpReport: summary + byCategory + topPerformers
      mockDb.query.mockResolvedValueOnce([
        { total_suggestions: '10', total_cost: '1000', total_savings: '5000' },
      ]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.exportReport({
        tenantId: 1,
        reportType: 'kvp',
        format: 'csv',
        filters: {},
      });

      expect(result.filename).toContain('report-kvp-');
      expect(result.content).toBeInstanceOf(Buffer);
    });

    it('generates filename with current date timestamp', async () => {
      mockOverviewQueries(mockDb);

      const result = await service.exportReport({
        tenantId: 1,
        reportType: 'overview',
        format: 'csv',
        filters: {},
      });

      expect(result.filename).toBe('report-overview-2025-06-15.csv');
    });
  });
});
