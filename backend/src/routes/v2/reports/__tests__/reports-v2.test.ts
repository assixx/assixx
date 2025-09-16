/**
 * Tests for Reports/Analytics API v2
 * Tests reporting and analytics functionality
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { log } from 'console';
import type { ResultSetHeader } from 'mysql2';
import { Pool } from 'mysql2/promise';
import request from 'supertest';

import app from '../../../../app.js';
import {
  cleanupTestData,
  createTestDatabase,
  createTestDepartment,
  createTestTenant,
  createTestUser,
} from '../../../mocks/database.js';

// For debugging in Jest

describe('Reports API v2', () => {
  let testDb: Pool;
  let tenantId: number;
  let adminToken: string;
  let employeeToken: string;
  let adminUserId: number;
  let employeeUserId: number;
  let departmentId: number;
  let teamId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();

    // Create test tenant
    tenantId = await createTestTenant(testDb, 'reports-test', 'Test Reports Tenant');

    // Create test department
    departmentId = await createTestDepartment(testDb, tenantId, 'Engineering');

    // Create test team
    const [teamResult] = await testDb.execute<ResultSetHeader>(
      `INSERT INTO teams (name, department_id, tenant_id) VALUES (?, ?, ?)`,
      ['Development Team', departmentId, tenantId],
    );
    teamId = teamResult.insertId;
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Create test users
    const adminUser = await createTestUser(testDb, {
      username: 'reports_admin_v2',
      email: 'reports_admin_v2@test.com',
      password: 'TestPass123!',
      role: 'admin',
      tenant_id: tenantId,
    });
    adminUserId = adminUser.id;

    const adminLoginRes = await request(app).post('/api/v2/auth/login').send({
      email: adminUser.email,
      password: 'TestPass123!',
    });
    adminToken = adminLoginRes.body.data.accessToken;

    const employeeUser = await createTestUser(testDb, {
      username: 'reports_employee_v2',
      email: 'reports_employee_v2@test.com',
      password: 'TestPass123!',
      role: 'employee',
      tenant_id: tenantId,
      department_id: departmentId,
    });
    employeeUserId = employeeUser.id;

    const employeeLoginRes = await request(app).post('/api/v2/auth/login').send({
      email: employeeUser.email,
      password: 'TestPass123!',
    });
    employeeToken = employeeLoginRes.body.data.accessToken;

    // Create some test data for reports
    await createTestData();
  });

  afterEach(async () => {
    // Clean up test data
    await testDb.execute('DELETE FROM kvp_suggestions WHERE tenant_id = ?', [tenantId]);
    await testDb.execute('DELETE FROM shifts WHERE tenant_id = ?', [tenantId]);
    await testDb.execute('DELETE FROM surveys WHERE tenant_id = ?', [tenantId]);
    // Clean up test categories
    await testDb.execute("DELETE FROM kvp_categories WHERE name LIKE '%AUTOTEST%'");
  });

  async function createTestData() {
    // First check if KVP category exists
    const [existingCategories] = await testDb.execute<any[]>(
      "SELECT id FROM kvp_categories WHERE name LIKE '%AUTOTEST%' LIMIT 1",
    );

    let categoryId: number;
    if (existingCategories.length === 0) {
      // Create test category (global - no tenant_id)
      const [categoryResult] = await testDb.execute<ResultSetHeader>(
        'INSERT INTO kvp_categories (name, description, color, icon) VALUES (?, ?, ?, ?)',
        ['__AUTOTEST__Reports_Category', 'Test category for reports', '#27ae60', '📊'],
      );
      categoryId = categoryResult.insertId;
    } else {
      categoryId = existingCategories[0].id;
    }

    // Create some KVP suggestions
    await testDb.execute(
      `INSERT INTO kvp_suggestions 
       (title, description, category_id, org_level, org_id, status, priority, submitted_by, tenant_id, actual_savings, estimated_cost)
       VALUES 
       (?, ?, ?, 'department', ?, 'implemented', 'high', ?, ?, 5000, 1000),
       (?, ?, ?, 'department', ?, 'new', 'normal', ?, ?, 0, 500)`,
      [
        'Improve Process A',
        'Description A',
        categoryId,
        departmentId,
        adminUserId,
        tenantId,
        'Improve Process B',
        'Description B',
        categoryId,
        departmentId,
        employeeUserId,
        tenantId,
      ],
    );

    // Create some shifts (using correct schema)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Create shifts for each user
    const shiftData = [
      { user: adminUserId, startHour: 6, endHour: 14, type: 'regular' }, // Morning
      { user: employeeUserId, startHour: 14, endHour: 22, type: 'regular' }, // Afternoon
      { user: adminUserId, startHour: 22, endHour: 30, type: 'overtime' }, // Night with overtime
    ];

    for (const shift of shiftData) {
      const startTime = `${todayStr} ${String(String(shift.startHour % 24).padStart(2, '0'))}:00:00`;
      const endTime =
        shift.endHour > 24 ?
          `${todayStr} ${String(String(shift.endHour - 24).padStart(2, '0'))}:00:00`
        : `${todayStr} ${String(String(shift.endHour).padStart(2, '0'))}:00:00`;

      await testDb.execute(
        `INSERT INTO shifts 
         (tenant_id, user_id, date, start_time, end_time, department_id, team_id, 
          required_employees, status, type, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          shift.user,
          todayStr,
          startTime,
          endTime,
          departmentId,
          teamId,
          5, // required_employees
          'completed', // status
          shift.type, // type
          adminUserId, // created_by
        ],
      );
    }

    // Create an active survey
    await testDb.execute(
      `INSERT INTO surveys 
       (title, description, status, created_by, tenant_id)
       VALUES (?, ?, 'active', ?, ?)`,
      ['Employee Satisfaction Survey', 'Q3 2025 Survey', adminUserId, tenantId],
    );
  }

  describe('GET /api/v2/reports/overview', () => {
    it('should get company overview report as admin', async () => {
      const res = await request(app)
        .get('/api/v2/reports/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('employees');
      expect(res.body.data).toHaveProperty('departments');
      expect(res.body.data).toHaveProperty('shifts');
      expect(res.body.data).toHaveProperty('kvp');
      expect(res.body.data).toHaveProperty('surveys');
      expect(res.body.data).toHaveProperty('period');
    });

    it('should get overview report as employee', async () => {
      const res = await request(app)
        .get('/api/v2/reports/overview')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should accept date range parameters', async () => {
      const dateFrom = '2025-01-01';
      const dateTo = '2025-01-31';

      const res = await request(app)
        .get('/api/v2/reports/overview')
        .query({ dateFrom, dateTo })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.period.from).toBe(dateFrom);
      expect(res.body.data.period.to).toBe(dateTo);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/v2/reports/overview');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v2/reports/employees', () => {
    it('should get employee analytics report', async () => {
      const res = await request(app)
        .get('/api/v2/reports/employees')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('headcount');
      expect(res.body.data).toHaveProperty('attendance');
      expect(res.body.data).toHaveProperty('performance');
    });

    it('should filter by department', async () => {
      const res = await request(app)
        .get('/api/v2/reports/employees')
        .query({ departmentId })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.filters.departmentId).toBe(departmentId);
    });

    it('should filter by team', async () => {
      const res = await request(app)
        .get('/api/v2/reports/employees')
        .query({ teamId })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.filters.teamId).toBe(teamId);
    });
  });

  describe('GET /api/v2/reports/departments', () => {
    it('should get department performance report', async () => {
      const res = await request(app)
        .get('/api/v2/reports/departments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);

      // Debug output
      log('Department report data:', JSON.stringify(res.body.data, null, 2));
      log('Department ID:', departmentId);
      log('Tenant ID:', tenantId);

      if (res.body.data.length > 0) {
        const dept = res.body.data[0];
        expect(dept).toHaveProperty('departmentId');
        expect(dept).toHaveProperty('departmentName');
        expect(dept).toHaveProperty('metrics');
        expect(dept.metrics).toHaveProperty('employees');
        expect(dept.metrics).toHaveProperty('teams');
        expect(dept.metrics).toHaveProperty('kvpSuggestions');
        expect(dept.metrics).toHaveProperty('shiftCoverage');
        expect(dept.metrics).toHaveProperty('avgOvertime');
      }
    });
  });

  describe('GET /api/v2/reports/shifts', () => {
    it('should get shift analytics report', async () => {
      const res = await request(app)
        .get('/api/v2/reports/shifts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalShifts');
      expect(res.body.data).toHaveProperty('coverage');
      expect(res.body.data).toHaveProperty('overtime');
      expect(res.body.data).toHaveProperty('patterns');
    });

    it('should include overtime breakdown', async () => {
      const res = await request(app)
        .get('/api/v2/reports/shifts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.overtime).toHaveProperty('totalHours');
      expect(res.body.data.overtime).toHaveProperty('totalCost');
      expect(res.body.data.overtime).toHaveProperty('byDepartment');
    });
  });

  describe('GET /api/v2/reports/kvp', () => {
    it('should get KVP ROI report', async () => {
      const res = await request(app)
        .get('/api/v2/reports/kvp')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data).toHaveProperty('byCategory');
      expect(res.body.data).toHaveProperty('topPerformers');
    });

    it('should calculate ROI correctly', async () => {
      const res = await request(app)
        .get('/api/v2/reports/kvp')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const summary = res.body.data.summary;
      expect(summary).toHaveProperty('totalSuggestions');
      expect(summary).toHaveProperty('implemented');
      expect(summary).toHaveProperty('totalCost');
      expect(summary).toHaveProperty('totalSavings');
      expect(summary).toHaveProperty('roi');
    });
  });

  describe('GET /api/v2/reports/attendance', () => {
    it('should get attendance report with required dates', async () => {
      const dateFrom = '2025-01-01';
      const dateTo = '2025-01-31';

      const res = await request(app)
        .get('/api/v2/reports/attendance')
        .query({ dateFrom, dateTo })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data).toHaveProperty('byEmployee');
      expect(res.body.data).toHaveProperty('trends');
    });

    it('should require date parameters', async () => {
      const res = await request(app)
        .get('/api/v2/reports/attendance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should validate date range (max 90 days)', async () => {
      const dateFrom = '2025-01-01';
      const dateTo = '2025-05-01'; // More than 90 days

      const res = await request(app)
        .get('/api/v2/reports/attendance')
        .query({ dateFrom, dateTo })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v2/reports/compliance', () => {
    it('should get compliance report', async () => {
      const dateFrom = '2025-01-01';
      const dateTo = '2025-01-31';

      const res = await request(app)
        .get('/api/v2/reports/compliance')
        .query({ dateFrom, dateTo })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('violations');
      expect(res.body.data).toHaveProperty('riskEmployees');
    });

    it('should include violation breakdown', async () => {
      const dateFrom = '2025-01-01';
      const dateTo = '2025-01-31';

      const res = await request(app)
        .get('/api/v2/reports/compliance')
        .query({ dateFrom, dateTo })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const violations = res.body.data.violations;
      expect(violations).toHaveProperty('total');
      expect(violations).toHaveProperty('byType');
      expect(violations.byType).toHaveProperty('maxWorkingHours');
      expect(violations.byType).toHaveProperty('missingBreaks');
      expect(violations.byType).toHaveProperty('insufficientRest');
    });
  });

  describe('POST /api/v2/reports/custom', () => {
    it('should generate custom report', async () => {
      const reportData = {
        name: 'Monthly Performance Report',
        description: 'Custom report for January 2025',
        metrics: ['employees', 'shifts', 'kvp'],
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        filters: {
          departmentIds: [departmentId],
        },
        groupBy: 'department',
      };

      const res = await request(app)
        .post('/api/v2/reports/custom')
        .send(reportData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('reportId');
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('generatedAt');
      expect(res.body.data).toHaveProperty('data');
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/v2/reports/custom')
        .send({
          // Missing required fields
          name: 'Test Report',
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should validate metrics array', async () => {
      const res = await request(app)
        .post('/api/v2/reports/custom')
        .send({
          name: 'Test Report',
          metrics: ['invalid_metric'],
          dateFrom: '2025-01-01',
          dateTo: '2025-01-31',
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v2/reports/export/:type', () => {
    it('should export overview report as PDF', async () => {
      const res = await request(app)
        .get('/api/v2/reports/export/overview')
        .query({ format: 'pdf' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });

    it('should export shifts report as Excel', async () => {
      const res = await request(app)
        .get('/api/v2/reports/export/shifts')
        .query({
          format: 'excel',
          dateFrom: '2025-01-01',
          dateTo: '2025-01-31',
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    it('should export kvp report as CSV', async () => {
      const res = await request(app)
        .get('/api/v2/reports/export/kvp')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv');
    });

    it('should validate report type', async () => {
      const res = await request(app)
        .get('/api/v2/reports/export/invalid_type')
        .query({ format: 'pdf' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should validate export format', async () => {
      const res = await request(app)
        .get('/api/v2/reports/export/overview')
        .query({ format: 'invalid_format' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should require format parameter', async () => {
      const res = await request(app)
        .get('/api/v2/reports/export/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('Authorization Tests', () => {
    it('should allow employees to access reports', async () => {
      const res = await request(app)
        .get('/api/v2/reports/overview')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
    });

    it('should isolate data by tenant', async () => {
      // Create another tenant
      const otherTenantId = await createTestTenant(testDb, 'other-reports-tenant', 'Other Tenant');

      // Create admin for other tenant
      const otherAdmin = await createTestUser(testDb, {
        username: 'other_reports_admin',
        email: 'other_reports_admin@test.com',
        password: 'TestPass123!',
        role: 'admin',
        tenant_id: otherTenantId,
      });

      const otherLoginRes = await request(app).post('/api/v2/auth/login').send({
        email: otherAdmin.email,
        password: 'TestPass123!',
      });
      const otherToken = otherLoginRes.body.data.accessToken;

      // Get overview report for other tenant
      const res = await request(app)
        .get('/api/v2/reports/overview')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      // Should not see data from our test tenant
      expect(res.body.data.kvp.totalSuggestions).toBe(0);
    });
  });
});
