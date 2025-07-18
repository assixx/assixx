/**
 * API Tests for Shift Planning Endpoints
 * Tests shift templates, planning, assignments, and multi-tenant isolation
 */

import request from "supertest";
import { Pool } from "mysql2/promise";
import app from "../../app";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
  createTestTeam,
  getAuthToken,
} from "../mocks/database";
import { asTestRows } from "../../__tests__/mocks/db-types";

describe("Shift Planning API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let dept1Id: number;
  let dept2Id: number;
  let team1Id: number;
  let adminToken1: string;
  let adminToken2: string;
  let employeeToken1: string;
  let employeeToken2: string;
  let employeeToken3: string;
  let adminUser1: any;
  let employeeUser1: any;
  let employeeUser2: any;
  let employeeUser3: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-shift-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "shifttest1",
      "Shift Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "shifttest2",
      "Shift Test Company 2",
    );

    // Create departments and teams
    dept1Id = await createTestDepartment(testDb, tenant1Id, "Production");
    dept2Id = await createTestDepartment(testDb, tenant1Id, "Logistics");
    team1Id = await createTestTeam(
      testDb,
      tenant1Id,
      dept1Id,
      "Production Line A",
    );

    // Create test users
    adminUser1 = await createTestUser(testDb, {
      username: "shiftadmin1",
      email: "admin1@shifttest1.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "One",
    });

    await createTestUser(testDb, {
      username: "shiftadmin2",
      email: "admin2@shifttest2.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant2Id,
      first_name: "Admin",
      last_name: "Two",
    });

    employeeUser1 = await createTestUser(testDb, {
      username: "shiftemployee1",
      email: "employee1@shifttest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Employee",
      last_name: "One",
    });

    employeeUser2 = await createTestUser(testDb, {
      username: "shiftemployee2",
      email: "employee2@shifttest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Employee",
      last_name: "Two",
    });

    employeeUser3 = await createTestUser(testDb, {
      username: "shiftemployee3",
      email: "employee3@shifttest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept2Id,
      first_name: "Employee",
      last_name: "Three",
    });

    // Get auth tokens
    adminToken1 = await getAuthToken(app, "shiftadmin1", "AdminPass123!");
    adminToken2 = await getAuthToken(app, "shiftadmin2", "AdminPass123!");
    employeeToken1 = await getAuthToken(app, "shiftemployee1", "EmpPass123!");
    employeeToken2 = await getAuthToken(app, "shiftemployee2", "EmpPass123!");
    employeeToken3 = await getAuthToken(app, "shiftemployee3", "EmpPass123!");
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear shift tables before each test
    await testDb.execute("DELETE FROM shift_assignments WHERE tenant_id > 1");
    await testDb.execute("DELETE FROM shift_swap_requests WHERE tenant_id > 1");
    await testDb.execute("DELETE FROM shift_plans WHERE tenant_id > 1");
    await testDb.execute("DELETE FROM shift_templates WHERE tenant_id > 1");
  });

  describe("POST /api/shifts/templates", () => {
    const validTemplateData = {
      name: "Frühschicht",
      short_name: "F",
      start_time: "06:00",
      end_time: "14:00",
      break_duration: 30,
      color: "#2196F3",
      department_id: null,
      description: "Reguläre Frühschicht",
      is_active: true,
    };

    it("should create shift template for admin", async () => {
      const response = await request(app)
        .post("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(validTemplateData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich erstellt"),
      });
      expect(response.body.data.templateId).toBeDefined();

      // Verify template was created
      const [rows] = await testDb.execute(
        "SELECT * FROM shift_templates WHERE id = ?",
        [response.body.data.templateId],
      );
      const templates = asTestRows<any>(rows);
      expect(templates[0]).toMatchObject({
        name: validTemplateData.name,
        short_name: validTemplateData.short_name,
        start_time: validTemplateData.start_time,
        end_time: validTemplateData.end_time,
        break_duration: validTemplateData.break_duration,
        tenant_id: tenant1Id,
      });
    });

    it("should create department-specific template", async () => {
      const deptTemplate = {
        ...validTemplateData,
        name: "Produktion Spätschicht",
        short_name: "PS",
        department_id: dept1Id,
        start_time: "14:00",
        end_time: "22:00",
      };

      const response = await request(app)
        .post("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(deptTemplate);

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT department_id FROM shift_templates WHERE id = ?",
        [response.body.data.templateId],
      );
      const templates = asTestRows<any>(rows);
      expect(templates[0].department_id).toBe(dept1Id);
    });

    it("should validate time format", async () => {
      const response = await request(app)
        .post("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validTemplateData,
          start_time: "25:00", // Invalid time
          end_time: "14:60", // Invalid minutes
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "start_time" }),
          expect.objectContaining({ path: "end_time" }),
        ]),
      );
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          name: "",
          short_name: "toolong", // Max 3 chars
          break_duration: -30, // Negative duration
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it("should prevent duplicate template names", async () => {
      // Create first template
      await request(app)
        .post("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(validTemplateData);

      // Try to create duplicate
      const response = await request(app)
        .post("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(validTemplateData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("bereits vorhanden");
    });

    it("should calculate shift duration", async () => {
      const response = await request(app)
        .post("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validTemplateData,
          start_time: "08:00",
          end_time: "16:30",
          break_duration: 45,
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT duration_minutes FROM shift_templates WHERE id = ?",
        [response.body.data.templateId],
      );
      const templates = asTestRows<any>(rows);
      expect(templates[0].duration_minutes).toBe(510); // 8.5 hours * 60
    });

    it("should handle overnight shifts", async () => {
      const response = await request(app)
        .post("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validTemplateData,
          name: "Nachtschicht",
          short_name: "N",
          start_time: "22:00",
          end_time: "06:00",
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT is_overnight FROM shift_templates WHERE id = ?",
        [response.body.data.templateId],
      );
      const templates = asTestRows<any>(rows);
      expect(templates[0].is_overnight).toBe(1);
    });

    it("should deny template creation for non-admin", async () => {
      const response = await request(app)
        .post("/api/shifts/templates")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(validTemplateData);

      expect(response.status).toBe(403);
    });

    it("should set tenant_id from token", async () => {
      const response = await request(app)
        .post("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validTemplateData,
          tenant_id: 999, // Should be ignored
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT tenant_id FROM shift_templates WHERE id = ?",
        [response.body.data.templateId],
      );
      const templates = asTestRows<any>(rows);
      expect(templates[0].tenant_id).toBe(tenant1Id);
    });
  });

  describe("GET /api/shifts/templates", () => {
    let template1Id: number;
    let template2Id: number;
    let template3Id: number;

    beforeEach(async () => {
      // Create test templates
      const [rows] = await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, department_id, tenant_id, is_active) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["Frühschicht", "F", "06:00", "14:00", 30, null, tenant1Id, 1],
      );
      const result1 = asTestRows<any>(rows);
      template1Id = (result1 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, department_id, tenant_id, is_active) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["Spätschicht", "S", "14:00", "22:00", 30, null, tenant1Id, 1],
      );
      const result2 = asTestRows<any>(rows);
      template2Id = (result2 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, department_id, tenant_id, is_active) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["Produktion Nacht", "PN", "22:00", "06:00", 45, dept1Id, tenant1Id, 0],
      );
      const result3 = asTestRows<any>(rows);
      template3Id = (result3 as any).insertId;
    });

    it("should list all templates for admin", async () => {
      const response = await request(app)
        .get("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.templates.length).toBe(3);
    });

    it("should filter by department", async () => {
      const response = await request(app)
        .get(`/api/shifts/templates?department_id=${dept1Id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const templates = response.body.data.templates;
      expect(templates.some((t) => t.id === template3Id)).toBe(true);
      expect(templates.some((t) => t.department_id === null)).toBe(true); // Global templates included
    });

    it("should filter by active status", async () => {
      const response = await request(app)
        .get("/api/shifts/templates?is_active=true")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const templates = response.body.data.templates;
      expect(templates.length).toBe(2);
      expect(templates.every((t) => t.is_active)).toBe(true);
    });

    it("should allow employees to view templates", async () => {
      const response = await request(app)
        .get("/api/shifts/templates")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
    });

    it("should enforce tenant isolation", async () => {
      // Create template in tenant2
      await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        ["Tenant2 Template", "T2", "08:00", "16:00", 30, tenant2Id],
      );

      const response = await request(app)
        .get("/api/shifts/templates")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const templates = response.body.data.templates;
      expect(templates.every((t) => t.tenant_id === tenant1Id)).toBe(true);
    });
  });

  describe("PUT /api/shifts/templates/:id", () => {
    let templateId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        ["Original", "O", "08:00", "16:00", 30, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      templateId = (result as any).insertId;
    });

    it("should update template for admin", async () => {
      const updateData = {
        name: "Updated Template",
        short_name: "U",
        break_duration: 45,
        color: "#FF5722",
      };

      const response = await request(app)
        .put(`/api/shifts/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("aktualisiert");

      // Verify update
      const [rows] = await testDb.execute(
        "SELECT name, short_name, break_duration, color FROM shift_templates WHERE id = ?",
        [templateId],
      );
      const templates = asTestRows<any>(rows);
      expect(templates[0]).toMatchObject(updateData);
    });

    it("should prevent updating templates in use", async () => {
      // Create shift plan using template
      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          dept1Id,
          new Date(),
          new Date(),
          "published",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const planResult = asTestRows<any>(rows);
      const planId = (planResult as any).insertId;

      // Create assignment using template
      await testDb.execute(
        `INSERT INTO shift_assignments 
        (plan_id, template_id, user_id, date, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        [planId, templateId, employeeUser1.id, new Date(), tenant1Id],
      );

      const response = await request(app)
        .put(`/api/shifts/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ start_time: "07:00" }); // Try to change time

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("verwendet wird");
    });

    it("should allow deactivating templates in use", async () => {
      const response = await request(app)
        .put(`/api/shifts/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ is_active: false });

      expect(response.status).toBe(200);
    });

    it("should deny update for non-admin", async () => {
      const response = await request(app)
        .put(`/api/shifts/templates/${templateId}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ name: "Hacked" });

      expect(response.status).toBe(403);
    });

    it("should enforce tenant isolation on update", async () => {
      const response = await request(app)
        .put(`/api/shifts/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminToken2}`)
        .send({ name: "Cross-tenant update" });

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/shifts/plans", () => {
    let templateId: number;

    beforeEach(async () => {
      // Create a template to use
      const [rows] = await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        ["Frühschicht", "F", "06:00", "14:00", 30, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      templateId = (result as any).insertId;
    });

    const validPlanData = {
      department_id: null,
      start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      name: "KW 28 Schichtplan",
      description: "Schichtplan für Kalenderwoche 28",
      required_staff: {
        F: 3, // 3 employees needed for Frühschicht
        S: 2, // 2 employees needed for Spätschicht
      },
    };

    it("should create shift plan for admin", async () => {
      const planData = {
        ...validPlanData,
        department_id: dept1Id,
      };

      const response = await request(app)
        .post("/api/shifts/plans")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(planData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich erstellt"),
      });
      expect(response.body.data.planId).toBeDefined();

      // Verify plan was created
      const [rows] = await testDb.execute(
        "SELECT * FROM shift_plans WHERE id = ?",
        [response.body.data.planId],
      );
      const plans = asTestRows<any>(rows);
      expect(plans[0]).toMatchObject({
        name: planData.name,
        department_id: dept1Id,
        status: "draft",
        tenant_id: tenant1Id,
        created_by: adminUser1.id,
      });
    });

    it("should validate date range", async () => {
      const response = await request(app)
        .post("/api/shifts/plans")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validPlanData,
          end_date: validPlanData.start_date,
          start_date: validPlanData.end_date, // End before start
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Enddatum");
    });

    it("should prevent overlapping plans for same department", async () => {
      // Create first plan
      await request(app)
        .post("/api/shifts/plans")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validPlanData,
          department_id: dept1Id,
        });

      // Try to create overlapping plan
      const response = await request(app)
        .post("/api/shifts/plans")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validPlanData,
          department_id: dept1Id,
          name: "Overlapping Plan",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("überschneidet");
    });

    it("should allow plans for different departments in same period", async () => {
      // Create plan for dept1
      await request(app)
        .post("/api/shifts/plans")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validPlanData,
          department_id: dept1Id,
        });

      // Create plan for dept2
      const response = await request(app)
        .post("/api/shifts/plans")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validPlanData,
          department_id: dept2Id,
          name: "Logistics Plan",
        });

      expect(response.status).toBe(201);
    });

    it("should copy from template plan", async () => {
      // Create template plan
      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (department_id, start_date, end_date, status, is_template, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          dept1Id,
          "2025-01-01",
          "2025-01-07",
          "template",
          1,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const templatePlanResult = asTestRows<any>(rows);
      const templatePlanId = (templatePlanResult as any).insertId;

      // Add assignments to template
      await testDb.execute(
        `INSERT INTO shift_assignments 
        (plan_id, template_id, user_id, date, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        [templatePlanId, templateId, employeeUser1.id, "2025-01-01", tenant1Id],
      );

      const response = await request(app)
        .post("/api/shifts/plans")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validPlanData,
          department_id: dept1Id,
          copy_from_template: templatePlanId,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.copiedAssignments).toBeGreaterThan(0);
    });

    it("should deny plan creation for non-admin", async () => {
      const response = await request(app)
        .post("/api/shifts/plans")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(validPlanData);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/shifts/plans", () => {
    let plan1Id: number;
    let plan2Id: number;

    beforeEach(async () => {
      // Create test plans
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const weekAfter = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (name, department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Production Week Plan",
          dept1Id,
          nextWeek,
          weekAfter,
          "draft",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result1 = asTestRows<any>(rows);
      plan1Id = (result1 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (name, department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Logistics Week Plan",
          dept2Id,
          nextWeek,
          weekAfter,
          "published",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result2 = asTestRows<any>(rows);
      plan2Id = (result2 as any).insertId;
    });

    it("should list plans for admin", async () => {
      const response = await request(app)
        .get("/api/shifts/plans")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.plans.length).toBe(2);
    });

    it("should filter by department", async () => {
      const response = await request(app)
        .get(`/api/shifts/plans?department_id=${dept1Id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const plans = response.body.data.plans;
      expect(plans.length).toBe(1);
      expect(plans[0].department_id).toBe(dept1Id);
    });

    it("should filter by status", async () => {
      const response = await request(app)
        .get("/api/shifts/plans?status=published")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const plans = response.body.data.plans;
      expect(plans.every((p) => p.status === "published")).toBe(true);
    });

    it("should filter by date range", async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const response = await request(app)
        .get(`/api/shifts/plans?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.plans.length).toBe(2);
    });

    it("should show only published plans to employees", async () => {
      const response = await request(app)
        .get("/api/shifts/plans")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const plans = response.body.data.plans;
      expect(plans.every((p) => p.status === "published")).toBe(true);
    });

    it("should enforce department visibility for employees", async () => {
      const response = await request(app)
        .get("/api/shifts/plans")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const plans = response.body.data.plans;
      // Employee1 is in dept1, should only see published dept1 plans
      expect(plans.length).toBe(0); // No published plans for dept1
    });

    it("should enforce tenant isolation", async () => {
      // Create plan in tenant2
      await testDb.execute(
        `INSERT INTO shift_plans 
        (name, department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Tenant2 Plan",
          null,
          new Date(),
          new Date(),
          "published",
          1,
          tenant2Id,
        ],
      );

      const response = await request(app)
        .get("/api/shifts/plans")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const plans = response.body.data.plans;
      expect(plans.every((p) => p.tenant_id === tenant1Id)).toBe(true);
    });
  });

  describe("POST /api/shifts/assignments", () => {
    let planId: number;
    let templateId: number;

    beforeEach(async () => {
      // Create shift template
      const [rows] = await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        ["Frühschicht", "F", "06:00", "14:00", 30, tenant1Id],
      );
      const templateResult = asTestRows<any>(rows);
      templateId = (templateResult as any).insertId;

      // Create shift plan
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (name, department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Test Plan",
          dept1Id,
          nextWeek,
          nextWeek,
          "draft",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const planResult = asTestRows<any>(rows);
      planId = (planResult as any).insertId;
    });

    it("should assign shift to employee", async () => {
      const assignmentData = {
        plan_id: planId,
        template_id: templateId,
        user_id: employeeUser1.id,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      };

      const response = await request(app)
        .post("/api/shifts/assignments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(assignmentData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("zugewiesen"),
      });
      expect(response.body.data.assignmentId).toBeDefined();

      // Verify assignment was created
      const [rows] = await testDb.execute(
        "SELECT * FROM shift_assignments WHERE id = ?",
        [response.body.data.assignmentId],
      );
      const assignments = asTestRows<any>(rows);
      expect(assignments[0]).toMatchObject({
        plan_id: planId,
        template_id: templateId,
        user_id: employeeUser1.id,
        status: "assigned",
      });
    });

    it("should bulk assign shifts", async () => {
      const bulkData = {
        plan_id: planId,
        assignments: [
          {
            template_id: templateId,
            user_id: employeeUser1.id,
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
          },
          {
            template_id: templateId,
            user_id: employeeUser2.id,
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
          },
        ],
      };

      const response = await request(app)
        .post("/api/shifts/assignments/bulk")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(bulkData);

      expect(response.status).toBe(201);
      expect(response.body.data.created).toBe(2);
    });

    it("should prevent double booking", async () => {
      // Create first assignment
      await request(app)
        .post("/api/shifts/assignments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          plan_id: planId,
          template_id: templateId,
          user_id: employeeUser1.id,
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        });

      // Try to assign same user to overlapping shift
      const response = await request(app)
        .post("/api/shifts/assignments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          plan_id: planId,
          template_id: templateId,
          user_id: employeeUser1.id,
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("bereits zugewiesen");
    });

    it("should check overtime limits", async () => {
      // Create multiple assignments to exceed daily/weekly limits
      const assignments = [];
      for (let i = 0; i < 7; i++) {
        assignments.push({
          template_id: templateId,
          user_id: employeeUser1.id,
          date: new Date(Date.now() + (7 + i) * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        });
      }

      const response = await request(app)
        .post("/api/shifts/assignments/bulk")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          plan_id: planId,
          assignments,
          force: false, // Don't force overtime
        });

      expect(response.status).toBe(400);
      expect(response.body.warnings).toBeDefined();
      expect(response.body.warnings.some((w) => w.type === "overtime")).toBe(
        true,
      );
    });

    it("should allow forced overtime with admin permission", async () => {
      const response = await request(app)
        .post("/api/shifts/assignments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          plan_id: planId,
          template_id: templateId,
          user_id: employeeUser1.id,
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          force: true,
          overtime_reason: "Urgent production deadline",
        });

      expect(response.status).toBe(201);
    });

    it("should validate employee department", async () => {
      // Try to assign employee from different department
      const response = await request(app)
        .post("/api/shifts/assignments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          plan_id: planId, // Plan is for dept1
          template_id: templateId,
          user_id: employeeUser3.id, // Employee is in dept2
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("anderen Abteilung");
    });

    it("should deny assignment to published plans for non-admin", async () => {
      // Update plan status to published
      await testDb.execute(
        "UPDATE shift_plans SET status = 'published' WHERE id = ?",
        [planId],
      );

      const response = await request(app)
        .post("/api/shifts/assignments")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          plan_id: planId,
          template_id: templateId,
          user_id: employeeUser1.id,
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        });

      expect(response.status).toBe(403);
    });
  });

  describe("PUT /api/shifts/plans/:id/publish", () => {
    let planId: number;
    let templateId: number;

    beforeEach(async () => {
      // Create template
      const [rows] = await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        ["Test Template", "T", "08:00", "16:00", 30, tenant1Id],
      );
      const templateResult = asTestRows<any>(rows);
      templateId = (templateResult as any).insertId;

      // Create plan
      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (name, department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Test Plan",
          dept1Id,
          new Date(),
          new Date(),
          "draft",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const planResult = asTestRows<any>(rows);
      planId = (planResult as any).insertId;

      // Add some assignments
      await testDb.execute(
        `INSERT INTO shift_assignments 
        (plan_id, template_id, user_id, date, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        [planId, templateId, employeeUser1.id, new Date(), tenant1Id],
      );
    });

    it("should publish shift plan", async () => {
      const response = await request(app)
        .put(`/api/shifts/plans/${planId}/publish`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("veröffentlicht");

      // Verify status change
      const [rows] = await testDb.execute(
        "SELECT status FROM shift_plans WHERE id = ?",
        [planId],
      );
      const plans = asTestRows<any>(rows);
      expect(plans[0].status).toBe("published");
    });

    it("should notify affected employees", async () => {
      const response = await request(app)
        .put(`/api/shifts/plans/${planId}/publish`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ notify: true });

      expect(response.status).toBe(200);

      // Check notifications
      const [rows] = await testDb.execute(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'shift_published'",
        [employeeUser1.id],
      );
      const notifications = asTestRows<any>(rows);
      expect(notifications.length).toBeGreaterThan(0);
    });

    it("should validate minimum coverage before publishing", async () => {
      // Set required staff
      await testDb.execute(
        "UPDATE shift_plans SET required_staff = ? WHERE id = ?",
        [JSON.stringify({ T: 3 }), planId],
      );

      // Only 1 assignment exists, need 3
      const response = await request(app)
        .put(`/api/shifts/plans/${planId}/publish`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Mindestbesetzung");
    });

    it("should allow force publish with warning", async () => {
      // Set required staff
      await testDb.execute(
        "UPDATE shift_plans SET required_staff = ? WHERE id = ?",
        [JSON.stringify({ T: 3 }), planId],
      );

      const response = await request(app)
        .put(`/api/shifts/plans/${planId}/publish`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ force: true });

      expect(response.status).toBe(200);
      expect(response.body.warnings).toBeDefined();
    });

    it("should deny publish for non-admin", async () => {
      const response = await request(app)
        .put(`/api/shifts/plans/${planId}/publish`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/shifts/swap-requests", () => {
    let planId: number;
    let templateId: number;
    let assignment1Id: number;
    let assignment2Id: number;

    beforeEach(async () => {
      // Create template
      const [rows] = await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        ["Morning", "M", "06:00", "14:00", 30, tenant1Id],
      );
      const templateResult = asTestRows<any>(rows);
      templateId = (templateResult as any).insertId;

      // Create published plan
      const shiftDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (name, department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Published Plan",
          dept1Id,
          shiftDate,
          shiftDate,
          "published",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const planResult = asTestRows<any>(rows);
      planId = (planResult as any).insertId;

      // Create assignments
      const [rows] = await testDb.execute(
        `INSERT INTO shift_assignments 
        (plan_id, template_id, user_id, date, status, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          planId,
          templateId,
          employeeUser1.id,
          shiftDate,
          "assigned",
          tenant1Id,
        ],
      );
      const assign1Result = asTestRows<any>(rows);
      assignment1Id = (assign1Result as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO shift_assignments 
        (plan_id, template_id, user_id, date, status, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          planId,
          templateId,
          employeeUser2.id,
          shiftDate,
          "assigned",
          tenant1Id,
        ],
      );
      const assign2Result = asTestRows<any>(rows);
      assignment2Id = (assign2Result as any).insertId;
    });

    it("should create swap request", async () => {
      const swapData = {
        from_assignment_id: assignment1Id,
        to_user_id: employeeUser2.id,
        reason: "Arzttermin",
      };

      const response = await request(app)
        .post("/api/shifts/swap-requests")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(swapData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("Tauschantrag erstellt"),
      });
      expect(response.body.data.requestId).toBeDefined();

      // Verify request was created
      const [rows] = await testDb.execute(
        "SELECT * FROM shift_swap_requests WHERE id = ?",
        [response.body.data.requestId],
      );
      const requests = asTestRows<any>(rows);
      expect(requests[0]).toMatchObject({
        from_assignment_id: assignment1Id,
        to_assignment_id: assignment2Id,
        status: "pending",
        requested_by: employeeUser1.id,
      });
    });

    it("should only allow swapping own shifts", async () => {
      const response = await request(app)
        .post("/api/shifts/swap-requests")
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({
          from_assignment_id: assignment1Id, // Not employee2's shift
          to_user_id: employeeUser2.id,
          reason: "Unauthorized",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("nicht Ihre Schicht");
    });

    it("should validate swap compatibility", async () => {
      // Create different shift template
      const [rows] = await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        ["Night", "N", "22:00", "06:00", 45, tenant1Id],
      );
      const template2Result = asTestRows<any>(rows);
      const template2Id = (template2Result as any).insertId;

      // Create assignment with different template
      const [rows] = await testDb.execute(
        `INSERT INTO shift_assignments 
        (plan_id, template_id, user_id, date, status, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          planId,
          template2Id,
          employeeUser2.id,
          new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          "assigned",
          tenant1Id,
        ],
      );
      const assign3Result = asTestRows<any>(rows);

      const response = await request(app)
        .post("/api/shifts/swap-requests")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          from_assignment_id: assignment1Id,
          to_assignment_id: (assign3Result as any).insertId,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("unterschiedliche Schichttypen");
    });

    it("should check qualifications", async () => {
      // Add qualification requirement to template
      await testDb.execute(
        "UPDATE shift_templates SET required_qualifications = ? WHERE id = ?",
        [JSON.stringify(["forklift_license"]), templateId],
      );

      const response = await request(app)
        .post("/api/shifts/swap-requests")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          from_assignment_id: assignment1Id,
          to_user_id: employeeUser2.id,
          reason: "Need swap",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Qualifikationen");
    });

    it("should notify target employee", async () => {
      const response = await request(app)
        .post("/api/shifts/swap-requests")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          from_assignment_id: assignment1Id,
          to_user_id: employeeUser2.id,
          reason: "Family emergency",
        });

      expect(response.status).toBe(201);

      // Check notification
      const [rows] = await testDb.execute(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'shift_swap_request'",
        [employeeUser2.id],
      );
      const notifications = asTestRows<any>(rows);
      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /api/shifts/swap-requests/:id/respond", () => {
    let swapRequestId: number;

    beforeEach(async () => {
      // Create swap request (using setup from previous test)
      const shiftDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create plan and assignments
      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (name, department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Plan",
          dept1Id,
          shiftDate,
          shiftDate,
          "published",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const planResult = asTestRows<any>(rows);
      const planId = (planResult as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO shift_templates 
        (name, short_name, start_time, end_time, break_duration, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        ["Shift", "S", "08:00", "16:00", 30, tenant1Id],
      );
      const templateResult = asTestRows<any>(rows);
      const templateId = (templateResult as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO shift_assignments 
        (plan_id, template_id, user_id, date, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        [planId, templateId, employeeUser1.id, shiftDate, tenant1Id],
      );
      const assign1 = asTestRows<any>(rows);

      const [rows] = await testDb.execute(
        `INSERT INTO shift_assignments 
        (plan_id, template_id, user_id, date, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        [planId, templateId, employeeUser2.id, shiftDate, tenant1Id],
      );
      const assign2 = asTestRows<any>(rows);

      // Create swap request
      const [rows] = await testDb.execute(
        `INSERT INTO shift_swap_requests 
        (from_assignment_id, to_assignment_id, requested_by, status, reason, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          (assign1 as any).insertId,
          (assign2 as any).insertId,
          employeeUser1.id,
          "pending",
          "Test",
          tenant1Id,
        ],
      );
      const requestResult = asTestRows<any>(rows);
      swapRequestId = (requestResult as any).insertId;
    });

    it("should accept swap request", async () => {
      const response = await request(app)
        .put(`/api/shifts/swap-requests/${swapRequestId}/respond`)
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({
          action: "accept",
          comment: "Kein Problem, ich übernehme die Schicht",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("akzeptiert");

      // Verify assignments were swapped
      const [rows] = await testDb.execute(
        "SELECT status, approved_by FROM shift_swap_requests WHERE id = ?",
        [swapRequestId],
      );
      const requests = asTestRows<any>(rows);
      expect(requests[0].status).toBe("approved");
      expect(requests[0].approved_by).toBe(employeeUser2.id);
    });

    it("should reject swap request", async () => {
      const response = await request(app)
        .put(`/api/shifts/swap-requests/${swapRequestId}/respond`)
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({
          action: "reject",
          comment: "Leider nicht möglich",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("abgelehnt");

      // Verify status
      const [rows] = await testDb.execute(
        "SELECT status FROM shift_swap_requests WHERE id = ?",
        [swapRequestId],
      );
      const requests = asTestRows<any>(rows);
      expect(requests[0].status).toBe("rejected");
    });

    it("should only allow target employee to respond", async () => {
      const response = await request(app)
        .put(`/api/shifts/swap-requests/${swapRequestId}/respond`)
        .set("Authorization", `Bearer ${employeeToken3}`)
        .send({ action: "accept" });

      expect(response.status).toBe(403);
    });

    it("should allow admin to force approve", async () => {
      const response = await request(app)
        .put(`/api/shifts/swap-requests/${swapRequestId}/approve`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          comment: "Approved by management",
        });

      expect(response.status).toBe(200);
    });

    it("should prevent responding to already processed requests", async () => {
      // First accept
      await request(app)
        .put(`/api/shifts/swap-requests/${swapRequestId}/respond`)
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({ action: "accept" });

      // Try to respond again
      const response = await request(app)
        .put(`/api/shifts/swap-requests/${swapRequestId}/respond`)
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({ action: "reject" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("bereits bearbeitet");
    });
  });

  describe("GET /api/shifts/my-shifts", () => {
    beforeEach(async () => {
      // Create various shifts for employee1
      const dates = [
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
        new Date(), // Today
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
      ];

      for (const date of dates) {
        const [rows] = await testDb.execute(
          `INSERT INTO shift_plans 
          (name, department_id, start_date, end_date, status, created_by, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ["Plan", dept1Id, date, date, "published", adminUser1.id, tenant1Id],
        );
        const planResult = asTestRows<any>(rows);
        const planId = (planResult as any).insertId;

        const [rows] = await testDb.execute(
          `INSERT INTO shift_templates 
          (name, short_name, start_time, end_time, break_duration, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          ["Shift", "S", "08:00", "16:00", 30, tenant1Id],
        );
        const templateResult = asTestRows<any>(rows);
        const templateId = (templateResult as any).insertId;

        await testDb.execute(
          `INSERT INTO shift_assignments 
          (plan_id, template_id, user_id, date, status, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [planId, templateId, employeeUser1.id, date, "assigned", tenant1Id],
        );
      }
    });

    it("should get employee's own shifts", async () => {
      const response = await request(app)
        .get("/api/shifts/my-shifts")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.shifts.length).toBeGreaterThan(0);
      expect(
        response.body.data.shifts.every((s) => s.user_id === employeeUser1.id),
      ).toBe(true);
    });

    it("should filter by date range", async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const response = await request(app)
        .get(
          `/api/shifts/my-shifts?start_date=${startDate}&end_date=${endDate}`,
        )
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.shifts.length).toBe(2); // Today and next week
    });

    it("should include shift details", async () => {
      const response = await request(app)
        .get("/api/shifts/my-shifts?include=template,plan")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const shift = response.body.data.shifts[0];
      expect(shift.template).toBeDefined();
      expect(shift.plan).toBeDefined();
    });

    it("should show upcoming shifts by default", async () => {
      const response = await request(app)
        .get("/api/shifts/my-shifts")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      // Should not include past shifts by default
      const shifts = response.body.data.shifts;
      expect(shifts.every((s) => new Date(s.date) >= new Date())).toBe(true);
    });
  });

  describe("GET /api/shifts/statistics", () => {
    beforeEach(async () => {
      // Create various shift data for statistics
      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (name, department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Stats Plan",
          dept1Id,
          new Date(),
          new Date(),
          "published",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const planResult = asTestRows<any>(rows);
      const planId = (planResult as any).insertId;

      // Create multiple shift templates
      const shifts = [
        { name: "Früh", short: "F", start: "06:00", end: "14:00" },
        { name: "Spät", short: "S", start: "14:00", end: "22:00" },
        { name: "Nacht", short: "N", start: "22:00", end: "06:00" },
      ];

      for (const shift of shifts) {
        const [rows] = await testDb.execute(
          `INSERT INTO shift_templates 
          (name, short_name, start_time, end_time, break_duration, tenant_id) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [shift.name, shift.short, shift.start, shift.end, 30, tenant1Id],
        );
        const templateResult = asTestRows<any>(rows);

        // Create assignments
        await testDb.execute(
          `INSERT INTO shift_assignments 
          (plan_id, template_id, user_id, date, tenant_id) 
          VALUES (?, ?, ?, ?, ?)`,
          [
            planId,
            (templateResult as any).insertId,
            employeeUser1.id,
            new Date(),
            tenant1Id,
          ],
        );
      }
    });

    it("should get department statistics for admin", async () => {
      const response = await request(app)
        .get(`/api/shifts/statistics?department_id=${dept1Id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        totalShifts: expect.any(Number),
        byTemplate: expect.any(Object),
        coverage: expect.any(Object),
        employeeStats: expect.any(Array),
      });
    });

    it("should get personal statistics for employee", async () => {
      const response = await request(app)
        .get("/api/shifts/statistics/me")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        totalShifts: 3,
        hoursWorked: expect.any(Number),
        byShiftType: expect.any(Object),
        overtimeHours: expect.any(Number),
      });
    });

    it("should calculate coverage percentages", async () => {
      const response = await request(app)
        .get("/api/shifts/coverage?start_date=" + new Date().toISOString())
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.coverage).toBeDefined();
    });

    it("should enforce department access for employees", async () => {
      const response = await request(app)
        .get(`/api/shifts/statistics?department_id=${dept2Id}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });
  });

  describe("Export functionality", () => {
    it("should export shift plan as PDF", async () => {
      // Create a plan with assignments
      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (name, department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Export Plan",
          dept1Id,
          new Date(),
          new Date(),
          "published",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const planResult = asTestRows<any>(rows);
      const planId = (planResult as any).insertId;

      const response = await request(app)
        .get(`/api/shifts/plans/${planId}/export?format=pdf`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
      expect(response.headers["content-disposition"]).toContain("attachment");
    });

    it("should export shift plan as Excel", async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO shift_plans 
        (name, department_id, start_date, end_date, status, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Excel Plan",
          dept1Id,
          new Date(),
          new Date(),
          "published",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const planResult = asTestRows<any>(rows);
      const planId = (planResult as any).insertId;

      const response = await request(app)
        .get(`/api/shifts/plans/${planId}/export?format=excel`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain(
        "application/vnd.openxmlformats",
      );
    });

    it("should export personal shifts as iCal", async () => {
      const response = await request(app)
        .get("/api/shifts/my-shifts/export?format=ical")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/calendar");
      expect(response.text).toContain("BEGIN:VCALENDAR");
    });

    it("should respect visibility in exports", async () => {
      const response = await request(app)
        .get(`/api/shifts/plans/999/export?format=pdf`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(404);
    });
  });
});
