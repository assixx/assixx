/**
 * API Tests for Department Management Endpoints
 * Tests department CRUD operations, hierarchy, and multi-tenant isolation
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
  getAuthToken,
} from "../mocks/database";
import { asTestRows } from "../../__tests__/mocks/db-types";

describe("Department Management API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let adminToken1: string;
  let adminToken2: string;
  let employeeToken1: string;
  let adminUser1: any;
  let adminUser2: any;
  let employeeUser1: any;
  let dept1Id: number;
  let dept2Id: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-dept-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "depttest1",
      "Department Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "depttest2",
      "Department Test Company 2",
    );

    // Create initial departments
    dept1Id = await createTestDepartment(testDb, tenant1Id, "Engineering");
    dept2Id = await createTestDepartment(testDb, tenant1Id, "Sales");

    // Create test users - WICHTIG: username und email müssen gleich sein!
    adminUser1 = await createTestUser(testDb, {
      username: "admin1@depttest1.de",
      email: "admin1@depttest1.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "One",
    });

    adminUser2 = await createTestUser(testDb, {
      username: "admin2@depttest2.de",
      email: "admin2@depttest2.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant2Id,
      first_name: "Admin",
      last_name: "Two",
    });

    try {
      employeeUser1 = await createTestUser(testDb, {
        username: "employee1@depttest1.de",
        email: "employee1@depttest1.de",
        password: "EmpPass123!",
        role: "employee",
        tenant_id: tenant1Id,
        // department_id: dept1Id,  // Temporarily removed to test
        first_name: "Employee",
        last_name: "One",
      });
    } catch (err) {
      console.error("Failed to create employee user:", err);
      throw err;
    }

    // Debug: Log created users
    console.info("Created users:", {
      admin1: adminUser1,
      admin2: adminUser2,
      employee1: employeeUser1,
    });

    // Get auth tokens - Use the actual generated usernames
    adminToken1 = await getAuthToken(app, adminUser1.username, "AdminPass123!");
    adminToken2 = await getAuthToken(app, adminUser2.username, "AdminPass123!");
    employeeToken1 = await getAuthToken(
      app,
      employeeUser1.username,
      "EmpPass123!",
    );
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  describe("GET /api/departments", () => {
    beforeEach(async () => {
      // Create additional test departments
      await createTestDepartment(testDb, tenant1Id, "Marketing");
      await createTestDepartment(testDb, tenant1Id, "HR");
      await createTestDepartment(testDb, tenant2Id, "Operations");
    });

    it("should list all departments for admin within tenant", async () => {
      const response = await request(app)
        .get("/api/departments")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      // Response is an array, not wrapped in success/data
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2); // At least Engineering and Sales

      const departments = response.body;
      expect(departments.length).toBeGreaterThanOrEqual(4); // Engineering, Sales, Marketing, HR
      expect(departments.every((d: any) => d.tenant_id === tenant1Id)).toBe(
        true,
      );
    });

    it("should include department statistics if requested", async () => {
      const response = await request(app)
        .get("/api/departments?include=stats")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const departments = response.body.data.departments;
      expect(departments[0]).toHaveProperty("employee_count");
      expect(departments[0]).toHaveProperty("team_count");
    });

    it("should filter by status", async () => {
      // Create an inactive department
      await testDb.execute(
        "INSERT INTO departments (name, description, tenant_id, status) VALUES (?, ?, ?, ?)",
        ["Inactive Dept", "Test", tenant1Id, "inactive"],
      );

      const response = await request(app)
        .get("/api/departments?status=active")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const departments = response.body.data.departments;
      expect(departments.every((d) => d.status === "active")).toBe(true);
    });

    it("should search departments by name", async () => {
      const response = await request(app)
        .get("/api/departments?search=engineering")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const departments = response.body.data.departments;
      expect(
        departments.some((d) => d.name.toLowerCase().includes("engineering")),
      ).toBe(true);
    });

    it("should allow employees to view departments", async () => {
      const response = await request(app)
        .get("/api/departments")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      // Employees can see departments but may have limited info
    });

    it("should enforce tenant isolation", async () => {
      const response = await request(app)
        .get("/api/departments")
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(200);
      const departments = response.body.data.departments;
      expect(departments.every((d) => d.tenant_id === tenant2Id)).toBe(true);
      expect(departments.some((d) => d.tenant_id === tenant1Id)).toBe(false);
    });

    it("should sort departments", async () => {
      const response = await request(app)
        .get("/api/departments?sortBy=name&sortOrder=asc")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const departments = response.body.data.departments;

      // Check if sorted alphabetically
      for (let i = 1; i < departments.length; i++) {
        expect(
          departments[i].name.localeCompare(departments[i - 1].name),
        ).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("POST /api/departments", () => {
    const validDepartmentData = {
      name: "New Department",
      description: "Test department description",
      parent_id: null,
      manager_id: null,
    };

    it("should create department for admin", async () => {
      const response = await request(app)
        .post("/api/departments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(validDepartmentData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich erstellt"),
      });
      expect(response.body.data.departmentId).toBeDefined();

      // Verify creation
      const [rows] = await testDb.execute(
        "SELECT * FROM departments WHERE id = ?",
        [response.body.data.departmentId],
      );
      const departments = asTestRows<any>(rows);
      expect(departments[0]).toMatchObject({
        name: validDepartmentData.name,
        description: validDepartmentData.description,
        tenant_id: tenant1Id,
        status: "active",
      });
    });

    it("should create sub-department with parent", async () => {
      const response = await request(app)
        .post("/api/departments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validDepartmentData,
          name: "Frontend Team",
          parent_id: dept1Id, // Engineering as parent
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT * FROM departments WHERE id = ?",
        [response.body.data.departmentId],
      );
      const departments = asTestRows<any>(rows);
      expect(departments[0].parent_id).toBe(dept1Id);
    });

    it("should assign manager to department", async () => {
      const response = await request(app)
        .post("/api/departments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validDepartmentData,
          name: "Managed Department",
          manager_id: adminUser1.id,
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT * FROM departments WHERE id = ?",
        [response.body.data.departmentId],
      );
      const departments = asTestRows<any>(rows);
      expect(departments[0].manager_id).toBe(adminUser1.id);
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/departments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          description: "Missing name",
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "name" })]),
      );
    });

    it("should prevent duplicate department names within tenant", async () => {
      const response = await request(app)
        .post("/api/departments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validDepartmentData,
          name: "Engineering", // Already exists
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("bereits vorhanden");
    });

    it("should allow same name in different tenant", async () => {
      const response = await request(app)
        .post("/api/departments")
        .set("Authorization", `Bearer ${adminToken2}`)
        .send({
          ...validDepartmentData,
          name: "Engineering", // Same as tenant1
        });

      expect(response.status).toBe(201);
    });

    it("should deny department creation by employees", async () => {
      const response = await request(app)
        .post("/api/departments")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(validDepartmentData);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Keine Berechtigung");
    });

    it("should validate parent department exists in same tenant", async () => {
      const response = await request(app)
        .post("/api/departments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validDepartmentData,
          name: "Invalid Parent",
          parent_id: 99999,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(
        "Übergeordnete Abteilung nicht gefunden",
      );
    });

    it("should prevent circular hierarchy", async () => {
      // This would require existing department to set itself as parent
      // Typically caught by business logic
      const response = await request(app)
        .put(`/api/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          parent_id: dept1Id, // Self as parent
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Zirkuläre Hierarchie");
    });

    it("should set default values correctly", async () => {
      const response = await request(app)
        .post("/api/departments")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          name: "Minimal Department",
          // No description, parent_id, or manager_id
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT * FROM departments WHERE id = ?",
        [response.body.data.departmentId],
      );
      const departments = asTestRows<any>(rows);
      expect(departments[0]).toMatchObject({
        description: null,
        parent_id: null,
        manager_id: null,
        status: "active",
      });
    });
  });

  describe("GET /api/departments/:id", () => {
    it("should get department details", async () => {
      const response = await request(app)
        .get(`/api/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: dept1Id,
        name: "Engineering",
        tenant_id: tenant1Id,
        status: "active",
      });
    });

    it("should include related data if requested", async () => {
      const response = await request(app)
        .get(`/api/departments/${dept1Id}?include=teams,employees,manager`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("teams");
      expect(response.body.data).toHaveProperty("employees");
      expect(response.body.data).toHaveProperty("manager");
    });

    it("should include hierarchy info", async () => {
      // Create sub-department
      const [rows] = await testDb.execute(
        "INSERT INTO departments (name, tenant_id, parent_id) VALUES (?, ?, ?)",
        ["Sub Engineering", tenant1Id, dept1Id],
      );
      const result = asTestRows<any>(rows);
      const subDeptId = (result as any).insertId;

      const response = await request(app)
        .get(`/api/departments/${subDeptId}?include=hierarchy`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.parent).toMatchObject({
        id: dept1Id,
        name: "Engineering",
      });
    });

    it("should return 404 for non-existent department", async () => {
      const response = await request(app)
        .get("/api/departments/99999")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Abteilung nicht gefunden");
    });

    it("should enforce tenant isolation", async () => {
      const response = await request(app)
        .get(`/api/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });

    it("should allow employees to view their own department", async () => {
      const response = await request(app)
        .get(`/api/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
    });
  });

  describe("PUT /api/departments/:id", () => {
    let updateDeptId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        "INSERT INTO departments (name, description, tenant_id) VALUES (?, ?, ?)",
        ["Update Test Dept", "Original description", tenant1Id],
      );
      const result = asTestRows<any>(rows);
      updateDeptId = (result as any).insertId;
    });

    it("should update department for admin", async () => {
      const updateData = {
        name: "Updated Department",
        description: "Updated description",
        manager_id: adminUser1.id,
      };

      const response = await request(app)
        .put(`/api/departments/${updateDeptId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("erfolgreich aktualisiert");

      // Verify update
      const [rows] = await testDb.execute(
        "SELECT * FROM departments WHERE id = ?",
        [updateDeptId],
      );
      const departments = asTestRows<any>(rows);
      expect(departments[0]).toMatchObject(updateData);
    });

    it("should update department hierarchy", async () => {
      const response = await request(app)
        .put(`/api/departments/${updateDeptId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          parent_id: dept1Id,
        });

      expect(response.status).toBe(200);

      const [rows] = await testDb.execute(
        "SELECT parent_id FROM departments WHERE id = ?",
        [updateDeptId],
      );
      const departments = asTestRows<any>(rows);
      expect(departments[0].parent_id).toBe(dept1Id);
    });

    it("should validate unique name on update", async () => {
      const response = await request(app)
        .put(`/api/departments/${updateDeptId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          name: "Engineering", // Already exists
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("bereits vorhanden");
    });

    it("should prevent circular parent reference", async () => {
      // Create child department
      const [rows] = await testDb.execute(
        "INSERT INTO departments (name, tenant_id, parent_id) VALUES (?, ?, ?)",
        ["Child Dept", tenant1Id, updateDeptId],
      );
      const result = asTestRows<any>(rows);
      const childDeptId = (result as any).insertId;

      // Try to set child as parent of parent
      const response = await request(app)
        .put(`/api/departments/${updateDeptId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          parent_id: childDeptId,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Zirkuläre Hierarchie");
    });

    it("should deny update by employees", async () => {
      const response = await request(app)
        .put(`/api/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          name: "Hacked Department",
        });

      expect(response.status).toBe(403);
    });

    it("should enforce tenant isolation on update", async () => {
      const response = await request(app)
        .put(`/api/departments/${updateDeptId}`)
        .set("Authorization", `Bearer ${adminToken2}`)
        .send({
          name: "Cross-tenant Update",
        });

      expect(response.status).toBe(404);
    });

    it("should handle status changes", async () => {
      const response = await request(app)
        .put(`/api/departments/${updateDeptId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          status: "inactive",
        });

      expect(response.status).toBe(200);

      // Should also check for employees in department
      const [rows] = await testDb.execute(
        "SELECT status FROM departments WHERE id = ?",
        [updateDeptId],
      );
      const departments = asTestRows<any>(rows);
      expect(departments[0].status).toBe("inactive");
    });
  });

  describe("DELETE /api/departments/:id", () => {
    let deleteDeptId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        "INSERT INTO departments (name, tenant_id) VALUES (?, ?)",
        ["Delete Test Dept", tenant1Id],
      );
      const result = asTestRows<any>(rows);
      deleteDeptId = (result as any).insertId;
    });

    it("should soft delete department for admin", async () => {
      const response = await request(app)
        .delete(`/api/departments/${deleteDeptId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("erfolgreich gelöscht");

      // Verify soft delete
      const [rows] = await testDb.execute(
        "SELECT status, deleted_at FROM departments WHERE id = ?",
        [deleteDeptId],
      );
      const departments = asTestRows<any>(rows);
      expect(departments[0].status).toBe("inactive");
      expect(departments[0].deleted_at).toBeTruthy();
    });

    it("should prevent deletion of department with active employees", async () => {
      // Add employee to department
      await testDb.execute("UPDATE users SET department_id = ? WHERE id = ?", [
        deleteDeptId,
        employeeUser1.id,
      ]);

      const response = await request(app)
        .delete(`/api/departments/${deleteDeptId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("aktive Mitarbeiter");
    });

    it("should handle cascade for sub-departments", async () => {
      // Create sub-department
      const [rows] = await testDb.execute(
        "INSERT INTO departments (name, tenant_id, parent_id) VALUES (?, ?, ?)",
        ["Sub Department", tenant1Id, deleteDeptId],
      );
      const result = asTestRows<any>(rows);
      const subDeptId = (result as any).insertId;

      const response = await request(app)
        .delete(`/api/departments/${deleteDeptId}?cascade=true`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);

      // Check both are inactive
      const [cascadeRows] = await testDb.execute(
        "SELECT status FROM departments WHERE id IN (?, ?)",
        [deleteDeptId, subDeptId],
      );
      const departments = asTestRows<any>(cascadeRows);
      expect(departments.every((d) => d.status === "inactive")).toBe(true);
    });

    it("should deny deletion by employees", async () => {
      const response = await request(app)
        .delete(`/api/departments/${deleteDeptId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });

    it("should enforce tenant isolation on delete", async () => {
      const response = await request(app)
        .delete(`/api/departments/${deleteDeptId}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });

    it("should handle hard delete for admin", async () => {
      // First soft delete
      await request(app)
        .delete(`/api/departments/${deleteDeptId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      // Then hard delete
      const response = await request(app)
        .delete(`/api/departments/${deleteDeptId}?hard=true`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);

      // Verify completely removed
      const [rows] = await testDb.execute(
        "SELECT * FROM departments WHERE id = ?",
        [deleteDeptId],
      );
      const departments = asTestRows<any>(rows);
      expect(departments.length).toBe(0);
    });
  });

  describe("Department Employee Management", () => {
    it("should list employees in department", async () => {
      const response = await request(app)
        .get(`/api/departments/${dept1Id}/employees`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.employees).toBeDefined();
      expect(
        response.body.data.employees.some((e) => e.id === employeeUser1.id),
      ).toBe(true);
    });

    it("should assign employees to department", async () => {
      // Create unassigned employee
      const newEmployee = await createTestUser(testDb, {
        username: "unassigned",
        email: "unassigned@test.de",
        password: "Pass123!",
        role: "employee",
        tenant_id: tenant1Id,
        first_name: "Unassigned",
        last_name: "User",
      });

      const response = await request(app)
        .post(`/api/departments/${dept2Id}/employees`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          employeeIds: [newEmployee.id],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.assigned).toBe(1);

      // Verify assignment
      const [rows] = await testDb.execute(
        "SELECT department_id FROM users WHERE id = ?",
        [newEmployee.id],
      );
      const users = asTestRows<any>(rows);
      expect(users[0].department_id).toBe(dept2Id);
    });

    it("should remove employees from department", async () => {
      const response = await request(app)
        .delete(`/api/departments/${dept1Id}/employees/${employeeUser1.id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);

      // Verify removal
      const [rows] = await testDb.execute(
        "SELECT department_id FROM users WHERE id = ?",
        [employeeUser1.id],
      );
      const users = asTestRows<any>(rows);
      expect(users[0].department_id).toBeNull();
    });

    it("should bulk transfer employees between departments", async () => {
      // Re-assign employee to dept1
      await testDb.execute("UPDATE users SET department_id = ? WHERE id = ?", [
        dept1Id,
        employeeUser1.id,
      ]);

      const response = await request(app)
        .post("/api/departments/transfer-employees")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          fromDepartmentId: dept1Id,
          toDepartmentId: dept2Id,
          employeeIds: [employeeUser1.id],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.transferred).toBe(1);
    });
  });

  describe("Department Teams", () => {
    let teamId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        "INSERT INTO teams (name, department_id, tenant_id) VALUES (?, ?, ?)",
        ["Engineering Team A", dept1Id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      teamId = (result as any).insertId;
    });

    it("should list teams in department", async () => {
      const response = await request(app)
        .get(`/api/departments/${dept1Id}/teams`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.teams).toBeDefined();
      expect(response.body.data.teams.some((t) => t.id === teamId)).toBe(true);
    });

    it("should create team within department", async () => {
      const response = await request(app)
        .post(`/api/departments/${dept1Id}/teams`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          name: "New Engineering Team",
          description: "Frontend specialists",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.teamId).toBeDefined();
    });
  });

  describe("Department Statistics", () => {
    it("should get department statistics", async () => {
      const response = await request(app)
        .get(`/api/departments/${dept1Id}/stats`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        employeeCount: expect.any(Number),
        teamCount: expect.any(Number),
        activeProjects: expect.any(Number),
        subDepartments: expect.any(Number),
      });
    });

    it("should get organization chart data", async () => {
      const response = await request(app)
        .get("/api/departments/org-chart")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.chart).toBeDefined();
      expect(Array.isArray(response.body.data.chart)).toBe(true);
    });
  });

  describe("Department Permissions", () => {
    it("should check user permissions for department", async () => {
      const response = await request(app)
        .get(`/api/departments/${dept1Id}/permissions`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.permissions).toMatchObject({
        canView: true,
        canEdit: false,
        canDelete: false,
        canManageEmployees: false,
      });
    });

    it("should return full permissions for admin", async () => {
      const response = await request(app)
        .get(`/api/departments/${dept1Id}/permissions`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.permissions).toMatchObject({
        canView: true,
        canEdit: true,
        canDelete: true,
        canManageEmployees: true,
      });
    });
  });

  describe("Department Bulk Operations", () => {
    it("should bulk update department status", async () => {
      // Create departments to update
      const deptIds = [];
      for (let i = 0; i < 3; i++) {
        const [rows] = await testDb.execute(
          "INSERT INTO departments (name, tenant_id) VALUES (?, ?)",
          [`Bulk Dept ${i}`, tenant1Id],
        );
        const result = asTestRows<any>(rows);
        deptIds.push((result as any).insertId);
      }

      const response = await request(app)
        .put("/api/departments/bulk/status")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          departmentIds: deptIds,
          status: "inactive",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated).toBe(3);

      // Verify all updated
      const [rows] = await testDb.execute(
        "SELECT status FROM departments WHERE id IN (?)",
        [deptIds],
      );
      const departments = asTestRows<any>(rows);
      expect(departments.every((d) => d.status === "inactive")).toBe(true);
    });

    it("should enforce tenant isolation on bulk operations", async () => {
      const response = await request(app)
        .put("/api/departments/bulk/status")
        .set("Authorization", `Bearer ${adminToken2}`)
        .send({
          departmentIds: [dept1Id], // From tenant1
          status: "inactive",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated).toBe(0); // No departments updated
    });
  });
});
