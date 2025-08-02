/**
 * Tests for Shifts API v2
 * Tests shift planning and management functionality
 */

// Jest globals are available without import
import request from "supertest";
import app from "../../../app";
import { Pool } from "mysql2/promise";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
  createTestTeam,
} from "../../mocks/database";
import type { ResultSetHeader } from "mysql2";

describe("Shifts API v2", () => {
  let testDb: Pool;
  let tenantId: number;
  let adminToken: string;
  let employeeToken: string;
  let adminUserId: number;
  let employeeUserId: number;
  let departmentId: number;
  // Variables removed - not used in current tests

  beforeAll(async () => {
    testDb = await createTestDatabase();

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "shifts-test",
      "Test Shifts Tenant",
    );

    // Create test department
    departmentId = await createTestDepartment(
      testDb,
      tenantId,
      "Test Department",
    );

    // Create test team
    await createTestTeam(testDb, tenantId, departmentId, "Test Team");
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clean up existing test data
    await testDb.execute(
      "DELETE FROM shift_swap_requests WHERE tenant_id = ?",
      [tenantId],
    );
    await testDb.execute("DELETE FROM shift_assignments WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM shifts WHERE tenant_id = ?", [tenantId]);
    await testDb.execute("DELETE FROM shift_templates WHERE tenant_id = ?", [
      tenantId,
    ]);

    // Create test users
    const adminUser = await createTestUser(testDb, {
      username: "shifts_admin_v2",
      email: "shifts_admin_v2@test.com",
      password: "TestPass123!",
      role: "admin",
      tenant_id: tenantId,
      department_id: departmentId,
    });
    adminUserId = adminUser.id;

    const adminLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "TestPass123!",
    });
    adminToken = adminLoginRes.body.data.accessToken;

    const employeeUser = await createTestUser(testDb, {
      username: "shifts_employee_v2",
      email: "shifts_employee_v2@test.com",
      password: "TestPass123!",
      role: "employee",
      tenant_id: tenantId,
      department_id: departmentId,
    });
    employeeUserId = employeeUser.id;

    const employeeLoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employeeUser.email,
        password: "TestPass123!",
      });
    employeeToken = employeeLoginRes.body.data.accessToken;
  });

  afterEach(async () => {
    // Clean up shifts data after each test
    await testDb.execute(
      "DELETE FROM shift_swap_requests WHERE tenant_id = ?",
      [tenantId],
    );
    await testDb.execute("DELETE FROM shift_assignments WHERE tenant_id = ?", [
      tenantId,
    ]);
    await testDb.execute("DELETE FROM shifts WHERE tenant_id = ?", [tenantId]);
    await testDb.execute("DELETE FROM shift_templates WHERE tenant_id = ?", [
      tenantId,
    ]);
  });

  // ============= SHIFTS CRUD TESTS =============

  describe("Shifts CRUD Operations", () => {
    it("should create a new shift", async () => {
      const shiftData = {
        userId: employeeUserId,
        date: new Date().toISOString().split("T")[0],
        startTime: "08:00",
        endTime: "16:00",
        departmentId,
        title: "Morning Shift",
        requiredEmployees: 2,
        breakMinutes: 30,
        status: "planned",
        type: "regular",
        notes: "Test shift",
      };

      const res = await request(app)
        .post("/api/v2/shifts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(shiftData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        userId: employeeUserId,
        date: shiftData.date,
        startTime: shiftData.startTime,
        endTime: shiftData.endTime,
        departmentId,
        title: shiftData.title,
      });
      // testShiftId = res.body.data.id; // Not used in current tests
    });

    it("should fail to create shift without admin role", async () => {
      const shiftData = {
        userId: employeeUserId,
        date: new Date().toISOString().split("T")[0],
        startTime: "08:00",
        endTime: "16:00",
        departmentId,
      };

      const res = await request(app)
        .post("/api/v2/shifts")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send(shiftData);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should list shifts with filtering", async () => {
      // Create test shifts
      const today = new Date().toISOString().split("T")[0];
      await testDb.execute(
        "INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, department_id, status, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          employeeUserId,
          today,
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
          departmentId,
          "planned",
          "regular",
          adminUserId,
        ],
      );

      const res = await request(app)
        .get("/api/v2/shifts")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ date: today });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("should get shift by ID", async () => {
      // Create test shift
      const [result] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, department_id, status, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          employeeUserId,
          "2025-01-30",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
          departmentId,
          "planned",
          "regular",
          adminUserId,
        ],
      );
      const shiftId = result.insertId;

      const res = await request(app)
        .get(`/api/v2/shifts/${shiftId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(shiftId);
    });

    it("should update a shift", async () => {
      // Create test shift
      const [result] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, department_id, status, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          employeeUserId,
          "2025-01-30",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
          departmentId,
          "planned",
          "regular",
          adminUserId,
        ],
      );
      const shiftId = result.insertId;

      const updateData = {
        startTime: "09:00",
        endTime: "17:00",
        status: "confirmed",
      };

      const res = await request(app)
        .put(`/api/v2/shifts/${shiftId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.startTime).toBe(updateData.startTime);
      expect(res.body.data.status).toBe(updateData.status);
    });

    it("should delete a shift", async () => {
      // Create test shift
      const [result] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, department_id, status, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          employeeUserId,
          "2025-01-30",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
          departmentId,
          "planned",
          "regular",
          adminUserId,
        ],
      );
      const shiftId = result.insertId;

      const res = await request(app)
        .delete(`/api/v2/shifts/${shiftId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ============= TEMPLATE TESTS =============

  describe("Shift Templates", () => {
    it("should create a shift template", async () => {
      const templateData = {
        name: "Morning Shift Template",
        startTime: "08:00",
        endTime: "16:00",
        breakMinutes: 30,
        color: "#3498db",
        isNightShift: false,
        isActive: true,
      };

      const res = await request(app)
        .post("/api/v2/shifts/templates")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(templateData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(templateData.name);
      // templateId = res.body.data.id; // Not used in current tests
    });

    it("should list shift templates", async () => {
      // Create test template
      await testDb.execute(
        "INSERT INTO shift_templates (tenant_id, name, start_time, end_time, break_minutes, color) VALUES (?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          "Test Template",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
          30,
          "#3498db",
        ],
      );

      const res = await request(app)
        .get("/api/v2/shifts/templates")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("should update a template", async () => {
      // Create test template
      const [result] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shift_templates (tenant_id, name, start_time, end_time, break_minutes) VALUES (?, ?, ?, ?, ?)",
        [
          tenantId,
          "Test Template",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
          30,
        ],
      );
      const templateId = result.insertId;

      const updateData = {
        name: "Updated Template",
        breakMinutes: 45,
      };

      const res = await request(app)
        .put(`/api/v2/shifts/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(updateData.name);
      expect(res.body.data.breakMinutes).toBe(updateData.breakMinutes);
    });

    it("should delete a template", async () => {
      // Create test template
      const [result] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shift_templates (tenant_id, name, start_time, end_time) VALUES (?, ?, ?, ?)",
        [
          tenantId,
          "Test Template",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
        ],
      );
      const templateId = result.insertId;

      const res = await request(app)
        .delete(`/api/v2/shifts/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ============= SWAP REQUEST TESTS =============

  describe("Shift Swap Requests", () => {
    let shiftId: number;

    beforeEach(async () => {
      // Create a shift for employee to swap
      const [shiftResult] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, department_id, status, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          employeeUserId,
          "2025-02-15",
          "2025-02-15 08:00:00",
          "2025-02-15 16:00:00",
          departmentId,
          "planned",
          "regular",
          adminUserId,
        ],
      );
      shiftId = shiftResult.insertId;

      // Create assignment for the shift
      await testDb.execute<ResultSetHeader>(
        "INSERT INTO shift_assignments (tenant_id, shift_id, user_id, assigned_by) VALUES (?, ?, ?, ?)",
        [tenantId, shiftId, employeeUserId, adminUserId],
      );
    });

    it("should create a swap request", async () => {
      const swapData = {
        shiftId,
        requestedWithUserId: adminUserId,
        reason: "Personal appointment",
      };

      const res = await request(app)
        .post("/api/v2/shifts/swap-requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send(swapData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain("Swap request created");
    });

    it("should not allow swap request for other user's shift", async () => {
      // Create shift for admin user
      const [result] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, department_id, status, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          adminUserId,
          "2025-02-16",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
          departmentId,
          "planned",
          "regular",
          adminUserId,
        ],
      );
      const otherShiftId = result.insertId;

      const swapData = {
        shiftId: otherShiftId,
        reason: "Trying to swap someone else's shift",
      };

      const res = await request(app)
        .post("/api/v2/shifts/swap-requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send(swapData);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should list swap requests", async () => {
      // Check if assignment already exists
      const [existingAssignments] = await testDb.execute<any[]>(
        "SELECT id FROM shift_assignments WHERE shift_id = ? AND user_id = ?",
        [shiftId, employeeUserId],
      );

      let assignmentId;
      if (existingAssignments.length > 0) {
        assignmentId = existingAssignments[0].id;
      } else {
        // Create a shift assignment
        const [assignmentResult] = await testDb.execute<ResultSetHeader>(
          "INSERT INTO shift_assignments (tenant_id, shift_id, user_id, assigned_by) VALUES (?, ?, ?, ?)",
          [tenantId, shiftId, employeeUserId, adminUserId],
        );
        assignmentId = assignmentResult.insertId;
      }

      // Create swap request with assignment_id
      await testDb.execute(
        "INSERT INTO shift_swap_requests (tenant_id, assignment_id, requested_by, status) VALUES (?, ?, ?, ?)",
        [tenantId, assignmentId, employeeUserId, "pending"],
      );

      const res = await request(app)
        .get("/api/v2/shifts/swap-requests")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });

    it("should update swap request status", async () => {
      // Check if assignment already exists
      const [existingAssignments] = await testDb.execute<any[]>(
        "SELECT id FROM shift_assignments WHERE shift_id = ? AND user_id = ?",
        [shiftId, employeeUserId],
      );

      let assignmentId;
      if (existingAssignments.length > 0) {
        assignmentId = existingAssignments[0].id;
      } else {
        // Create a shift assignment
        const [assignmentResult] = await testDb.execute<ResultSetHeader>(
          "INSERT INTO shift_assignments (tenant_id, shift_id, user_id, assigned_by) VALUES (?, ?, ?, ?)",
          [tenantId, shiftId, employeeUserId, adminUserId],
        );
        assignmentId = assignmentResult.insertId;
      }

      // Create swap request with assignment_id
      const [result] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shift_swap_requests (tenant_id, assignment_id, requested_by, status) VALUES (?, ?, ?, ?)",
        [tenantId, assignmentId, employeeUserId, "pending"],
      );
      const requestId = result.insertId;

      const res = await request(app)
        .put(`/api/v2/shifts/swap-requests/${requestId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "approved" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain("approved");
    });
  });

  // ============= OVERTIME TESTS =============

  describe("Overtime Reporting", () => {
    it("should get overtime report for user", async () => {
      // Create shifts with overtime
      await testDb.execute(
        "INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, actual_start, actual_end, department_id, status, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          employeeUserId,
          "2025-01-28",
          "2025-01-28 08:00:00",
          "2025-01-28 16:00:00",
          "2025-01-28 08:00:00",
          "2025-01-28 18:00:00",
          departmentId,
          "completed",
          "regular",
          adminUserId,
        ],
      );

      const res = await request(app)
        .get("/api/v2/shifts/overtime")
        .set("Authorization", `Bearer ${employeeToken}`)
        .query({
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it("should require date range for overtime report", async () => {
      const res = await request(app)
        .get("/api/v2/shifts/overtime")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ============= EXPORT TESTS =============

  describe("Shift Export", () => {
    it("should export shifts as CSV", async () => {
      // Create test shifts
      await testDb.execute(
        "INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, department_id, status, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          employeeUserId,
          "2025-01-30",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
          departmentId,
          "planned",
          "regular",
          adminUserId,
        ],
      );

      const res = await request(app)
        .get("/api/v2/shifts/export")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          format: "csv",
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.text).toContain("Date,Employee,Start Time,End Time");
    });

    it("should return 501 for Excel export", async () => {
      const res = await request(app)
        .get("/api/v2/shifts/export")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          format: "excel",
        });

      expect(res.status).toBe(501);
      expect(res.body.success).toBe(false);
    });

    it("should require admin role for export", async () => {
      const res = await request(app)
        .get("/api/v2/shifts/export")
        .set("Authorization", `Bearer ${employeeToken}`)
        .query({
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ============= VALIDATION TESTS =============

  describe("Input Validation", () => {
    it("should validate time format", async () => {
      const shiftData = {
        userId: employeeUserId,
        date: new Date().toISOString().split("T")[0],
        startTime: "25:00", // Invalid time
        endTime: "16:00",
        departmentId,
      };

      const res = await request(app)
        .post("/api/v2/shifts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(shiftData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details).toBeInstanceOf(Array);
      expect(res.body.error.details[0].message).toContain("HH:MM format");
    });

    it("should validate date format", async () => {
      const shiftData = {
        userId: employeeUserId,
        date: "2025-13-45", // Invalid date
        startTime: "08:00",
        endTime: "16:00",
        departmentId,
      };

      const res = await request(app)
        .post("/api/v2/shifts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(shiftData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should validate required fields", async () => {
      const shiftData = {
        // Missing required fields
        startTime: "08:00",
        endTime: "16:00",
      };

      const res = await request(app)
        .post("/api/v2/shifts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(shiftData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ============= MULTI-TENANT ISOLATION TESTS =============

  describe("Multi-Tenant Isolation", () => {
    let otherTenantId: number;
    let otherTenantToken: string;

    beforeEach(async () => {
      // Create another tenant
      otherTenantId = await createTestTenant(
        testDb,
        "other-shifts",
        "Other Tenant",
      );

      const otherUser = await createTestUser(testDb, {
        username: "other_admin",
        email: "other_admin@test.com",
        password: "TestPass123!",
        role: "admin",
        tenant_id: otherTenantId,
      });

      const loginRes = await request(app).post("/api/v2/auth/login").send({
        email: otherUser.email,
        password: "TestPass123!",
      });
      otherTenantToken = loginRes.body.data.accessToken;
    });

    it("should not access shifts from other tenant", async () => {
      // Create shift in original tenant
      const [result] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, department_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          employeeUserId,
          "2025-01-30",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
          departmentId,
          adminUserId,
        ],
      );
      const shiftId = result.insertId;

      const res = await request(app)
        .get(`/api/v2/shifts/${shiftId}`)
        .set("Authorization", `Bearer ${otherTenantToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should not see templates from other tenant", async () => {
      // Create template in original tenant
      await testDb.execute(
        "INSERT INTO shift_templates (tenant_id, name, start_time, end_time) VALUES (?, ?, ?, ?)",
        [
          tenantId,
          "Original Tenant Template",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
        ],
      );

      const res = await request(app)
        .get("/api/v2/shifts/templates")
        .set("Authorization", `Bearer ${otherTenantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(0);
    });
  });

  // ============= ADMIN LOG TESTS =============

  describe("RootLog Integration", () => {
    it("should log shift creation", async () => {
      const shiftData = {
        userId: employeeUserId,
        date: new Date().toISOString().split("T")[0],
        startTime: "08:00",
        endTime: "16:00",
        departmentId,
      };

      await request(app)
        .post("/api/v2/shifts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(shiftData);

      const [logs] = await testDb.execute<any[]>(
        "SELECT * FROM root_logs WHERE tenant_id = ? AND entity_type = ? ORDER BY created_at DESC LIMIT 1",
        [tenantId, "shift"],
      );

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("create");
      expect(logs[0].user_id).toBe(adminUserId);
    });

    it("should log template updates", async () => {
      // Create template
      const [result] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shift_templates (tenant_id, name, start_time, end_time) VALUES (?, ?, ?, ?)",
        [
          tenantId,
          "Test Template",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
        ],
      );
      const templateId = result.insertId;

      await request(app)
        .put(`/api/v2/shifts/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Updated Template" });

      const [logs] = await testDb.execute<any[]>(
        "SELECT * FROM root_logs WHERE tenant_id = ? AND entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 1",
        [tenantId, "shift_template", templateId],
      );

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("update");
    });

    it("should log swap request actions", async () => {
      // Create shift for employee
      const [shiftResult] = await testDb.execute<ResultSetHeader>(
        "INSERT INTO shifts (tenant_id, user_id, date, start_time, end_time, department_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          employeeUserId,
          "2025-02-20",
          "2025-01-30 08:00:00",
          "2025-01-30 16:00:00",
          departmentId,
          adminUserId,
        ],
      );
      const shiftId = shiftResult.insertId;

      // Create shift assignment
      await testDb.execute(
        "INSERT INTO shift_assignments (tenant_id, shift_id, user_id, assignment_type, status, assigned_by) VALUES (?, ?, ?, ?, ?, ?)",
        [
          tenantId,
          shiftId,
          employeeUserId,
          "assigned",
          "accepted",
          adminUserId,
        ],
      );

      await request(app)
        .post("/api/v2/shifts/swap-requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ shiftId, reason: "Test swap" });

      const [logs] = await testDb.execute<any[]>(
        "SELECT * FROM root_logs WHERE tenant_id = ? AND action = ? ORDER BY created_at DESC LIMIT 1",
        [tenantId, "create_swap_request"],
      );

      expect(logs).toHaveLength(1);
      expect(logs[0].user_id).toBe(employeeUserId);
    });
  });
});
