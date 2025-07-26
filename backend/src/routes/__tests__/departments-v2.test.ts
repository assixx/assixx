/**
 * API Tests for Departments v2 Management Endpoints
 * Tests department CRUD operations, service layer, and API v2 standards
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import request from "supertest";
import { Pool } from "mysql2/promise";
import app from "../../app.js";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
  createTestTeam,
} from "../mocks/database.js";

describe("Departments v2 API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let adminTokenV2: string;
  let employeeTokenV2: string;
  let rootTokenV2: string;
  let tenant2TokenV2: string;
  let dept1Id: number;
  let dept2Id: number;
  let adminUser: any;
  let employeeUser: any;
  let rootUser: any;
  let tenant2User: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-departments-v2-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "deptsv2test1",
      "Departments v2 Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "deptsv2test2",
      "Departments v2 Test Company 2",
    );

    // Create test users for tenant 1
    adminUser = await createTestUser(testDb, {
      username: "deptv2admin@test.com",
      email: "deptv2admin@test.com",
      password: "TestPass123",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "DeptV2",
    });

    employeeUser = await createTestUser(testDb, {
      username: "deptv2employee@test.com",
      email: "deptv2employee@test.com",
      password: "TestPass123",
      role: "employee",
      tenant_id: tenant1Id,
      first_name: "Employee",
      last_name: "DeptV2",
    });

    rootUser = await createTestUser(testDb, {
      username: "deptv2root@test.com",
      email: "deptv2root@test.com",
      password: "TestPass123",
      role: "root",
      tenant_id: tenant1Id,
      first_name: "Root",
      last_name: "DeptV2",
    });

    // Create user for tenant 2
    tenant2User = await createTestUser(testDb, {
      username: "deptv2tenant2@test.com",
      email: "deptv2tenant2@test.com",
      password: "TestPass123",
      role: "admin",
      tenant_id: tenant2Id,
      first_name: "Tenant2",
      last_name: "Admin",
    });

    // Login with v2 API to get tokens - use actual emails returned by createTestUser
    const adminLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "TestPass123",
    });

    if (adminLoginRes.status !== 200) {
      console.log(
        "Admin login failed:",
        adminLoginRes.status,
        adminLoginRes.body,
      );
      console.log("Tried to login with email:", adminUser.email);
      throw new Error("Admin login failed");
    }
    adminTokenV2 = adminLoginRes.body.data.accessToken;

    const employeeLoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employeeUser.email,
        password: "TestPass123",
      });

    if (employeeLoginRes.status !== 200) {
      console.log(
        "Employee login failed:",
        employeeLoginRes.status,
        employeeLoginRes.body,
      );
      console.log("Tried to login with email:", employeeUser.email);
      throw new Error("Employee login failed");
    }
    employeeTokenV2 = employeeLoginRes.body.data.accessToken;

    const rootLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: rootUser.email,
      password: "TestPass123",
    });

    if (rootLoginRes.status !== 200) {
      console.log("Root login failed:", rootLoginRes.status, rootLoginRes.body);
      console.log("Tried to login with email:", rootUser.email);
      throw new Error("Root login failed");
    }
    rootTokenV2 = rootLoginRes.body.data.accessToken;

    const tenant2LoginRes = await request(app).post("/api/v2/auth/login").send({
      email: tenant2User.email,
      password: "TestPass123",
    });

    if (tenant2LoginRes.status !== 200) {
      console.log(
        "Tenant2 login failed:",
        tenant2LoginRes.status,
        tenant2LoginRes.body,
      );
      console.log("Tried to login with email:", tenant2User.email);
      throw new Error("Tenant2 login failed");
    }
    tenant2TokenV2 = tenant2LoginRes.body.data.accessToken;

    // Create initial test departments
    dept1Id = await createTestDepartment(
      testDb,
      tenant1Id,
      "Engineering",
      undefined,
      adminUser.id,
    );
    dept2Id = await createTestDepartment(testDb, tenant1Id, "Sales");

    // Note: We don't create a department for tenant2 here because of race conditions
    // with cleanupTestData() from other parallel tests. Each test that needs
    // a tenant2 department should create it within the test itself.
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clean up any departments created during tests (except initial ones)
    await testDb.query(
      `DELETE FROM departments WHERE tenant_id IN (?, ?) AND id NOT IN (?, ?)`,
      [tenant1Id, tenant2Id, dept1Id, dept2Id],
    );
  });

  describe("GET /api/v2/departments", () => {
    it("should return all departments for authenticated user", async () => {
      const response = await request(app)
        .get("/api/v2/departments")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      // Check department structure
      const dept = response.body.data[0];
      expect(dept).toHaveProperty("id");
      expect(dept).toHaveProperty("name");
      expect(dept).toHaveProperty("managerId");
      expect(dept).toHaveProperty("managerName");
      expect(dept).toHaveProperty("employeeCount");
      expect(dept).toHaveProperty("teamCount");
      expect(dept).toHaveProperty("createdAt");
      expect(dept).toHaveProperty("updatedAt");
    });

    it("should return departments without extended fields when includeExtended=false", async () => {
      const response = await request(app)
        .get("/api/v2/departments?includeExtended=false")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);

      const dept = response.body.data[0];
      expect(dept).toHaveProperty("id");
      expect(dept).toHaveProperty("name");
      expect(dept).not.toHaveProperty("managerName");
      expect(dept).not.toHaveProperty("employeeCount");
      expect(dept).not.toHaveProperty("teamCount");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/v2/departments");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should not return departments from other tenants", async () => {
      const response = await request(app)
        .get("/api/v2/departments")
        .set("Authorization", `Bearer ${tenant2TokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);

      // Should only see tenant2's departments
      for (const dept of response.body.data) {
        expect(dept.name).not.toMatch(/Engineering|Sales/);
      }
    });
  });

  describe("GET /api/v2/departments/stats", () => {
    it("should return department statistics", async () => {
      // Create a team for testing
      await createTestTeam(testDb, tenant1Id, dept1Id, "Dev Team");

      const response = await request(app)
        .get("/api/v2/departments/stats")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("totalDepartments");
      expect(response.body.data).toHaveProperty("totalTeams");
      expect(response.body.data.totalDepartments).toBeGreaterThanOrEqual(2);
      expect(response.body.data.totalTeams).toBeGreaterThanOrEqual(1);
    });

    it("should return stats only for user's tenant", async () => {
      // Create a department for tenant2 IN THIS TEST to avoid race conditions
      await createTestDepartment(
        testDb,
        tenant2Id,
        `Tenant2 Test Dept ${Date.now()}`,
      );

      const response = await request(app)
        .get("/api/v2/departments/stats")
        .set("Authorization", `Bearer ${tenant2TokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalDepartments).toBeGreaterThanOrEqual(1); // At least the one we just created
    });
  });

  describe("GET /api/v2/departments/:id", () => {
    it("should return a specific department", async () => {
      const response = await request(app)
        .get(`/api/v2/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(dept1Id);
      expect(response.body.data.name).toBe("Engineering");
      expect(response.body.data.managerId).toBe(adminUser.id);
      expect(response.body.data.managerName).toBe(adminUser.username);
    });

    it("should return 404 for non-existent department", async () => {
      const response = await request(app)
        .get("/api/v2/departments/99999")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("DEPT_404");
    });

    it("should return 400 for invalid department ID", async () => {
      const response = await request(app)
        .get("/api/v2/departments/invalid")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("DEPT_400");
    });

    it("should not return department from other tenant", async () => {
      const response = await request(app)
        .get(`/api/v2/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${tenant2TokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("DEPT_404");
    });
  });

  describe("POST /api/v2/departments", () => {
    it("should create a new department as admin", async () => {
      const newDept = {
        name: "Marketing",
        managerId: adminUser.id,
        description: "Marketing department",
      };

      const response = await request(app)
        .post("/api/v2/departments")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send(newDept);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe("Marketing");
      expect(response.body.data.managerId).toBe(adminUser.id);
      expect(response.body.data.description).toBe("Marketing department");
      expect(response.body.data.id).toBeDefined();
    });

    it("should create a department with parent", async () => {
      const newDept = {
        name: "Frontend Team",
        parentId: dept1Id,
      };

      const response = await request(app)
        .post("/api/v2/departments")
        .set("Authorization", `Bearer ${rootTokenV2}`)
        .send(newDept);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe("Frontend Team");
      expect(response.body.data.parentId).toBe(dept1Id);
    });

    it("should require admin or root role", async () => {
      const newDept = {
        name: "HR",
      };

      const response = await request(app)
        .post("/api/v2/departments")
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .send(newDept);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/v2/departments")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should not allow duplicate department names", async () => {
      const response = await request(app)
        .post("/api/v2/departments")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send({ name: "Engineering" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("DEPT_400");
      expect(response.body.error.message).toContain("already exists");
    });
  });

  describe("PUT /api/v2/departments/:id", () => {
    it("should update a department", async () => {
      const updates = {
        name: "Engineering Team",
        description: "Updated description",
        managerId: rootUser.id,
      };

      const response = await request(app)
        .put(`/api/v2/departments/${dept2Id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe("Engineering Team");
      expect(response.body.data.description).toBe("Updated description");
      expect(response.body.data.managerId).toBe(rootUser.id);
    });

    it("should require admin or root role for update", async () => {
      const response = await request(app)
        .put(`/api/v2/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .send({ name: "New Name" });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should not update department from other tenant", async () => {
      const response = await request(app)
        .put(`/api/v2/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${tenant2TokenV2}`)
        .send({ name: "Hacked" });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("DEPT_404");
    });

    it("should validate manager exists in same tenant", async () => {
      const response = await request(app)
        .put(`/api/v2/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send({ managerId: 99999 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("DEPT_400");
      expect(response.body.error.message).toContain("Manager not found");
    });
  });

  describe("DELETE /api/v2/departments/:id", () => {
    it("should delete a department without users", async () => {
      // Create a department to delete
      const createRes = await request(app)
        .post("/api/v2/departments")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send({ name: "ToDelete" });

      const deptId = createRes.body.data.id;

      const response = await request(app)
        .delete(`/api/v2/departments/${deptId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain(
        "Department deleted successfully",
      );
    });

    it("should not delete department with assigned users", async () => {
      // Assign user to department
      await testDb.query("UPDATE users SET department_id = ? WHERE id = ?", [
        dept1Id,
        employeeUser.id,
      ]);

      const response = await request(app)
        .delete(`/api/v2/departments/${dept1Id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("DEPT_400");
      expect(response.body.error.message).toContain(
        "Cannot delete department with assigned users",
      );

      // Clean up
      await testDb.query("UPDATE users SET department_id = NULL WHERE id = ?", [
        employeeUser.id,
      ]);
    });

    it("should require admin or root role for deletion", async () => {
      const response = await request(app)
        .delete(`/api/v2/departments/${dept2Id}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("GET /api/v2/departments/:id/members", () => {
    it("should return department members", async () => {
      // Assign users to department
      await testDb.query(
        "UPDATE users SET department_id = ? WHERE id IN (?, ?)",
        [dept1Id, adminUser.id, employeeUser.id],
      );

      const response = await request(app)
        .get(`/api/v2/departments/${dept1Id}/members`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);

      // Check member structure
      const member = response.body.data[0];
      expect(member).toHaveProperty("id");
      expect(member).toHaveProperty("email");
      expect(member).toHaveProperty("firstName");
      expect(member).toHaveProperty("lastName");
      expect(member).toHaveProperty("role");
      expect(member).toHaveProperty("position");
      expect(member).toHaveProperty("isActive");

      // Clean up
      await testDb.query(
        "UPDATE users SET department_id = NULL WHERE id IN (?, ?)",
        [adminUser.id, employeeUser.id],
      );
    });

    it("should return empty array for department without members", async () => {
      const response = await request(app)
        .get(`/api/v2/departments/${dept2Id}/members`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(0);
    });

    it("should not return members from other tenant's department", async () => {
      const response = await request(app)
        .get(`/api/v2/departments/${dept1Id}/members`)
        .set("Authorization", `Bearer ${tenant2TokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("DEPT_404");
    });
  });

  describe("Multi-tenant isolation", () => {
    it("should completely isolate department data between tenants", async () => {
      // Create a department for tenant2 to test isolation
      const tenant2TestDeptName = `Tenant2 Private Dept ${Date.now()}`;
      await createTestDepartment(testDb, tenant2Id, tenant2TestDeptName);

      // Admin from tenant1 should not see tenant2's departments
      const listResponse = await request(app)
        .get("/api/v2/departments")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      const deptNames = listResponse.body.data.map((d: any) => d.name);
      expect(deptNames).not.toContain(tenant2TestDeptName);
    });

    it("should not allow cross-tenant parent department assignment", async () => {
      // Create a department for tenant2 IN THIS TEST to avoid race conditions
      const tenant2DeptId = await createTestDepartment(
        testDb,
        tenant2Id,
        `Tenant2 Isolation Test ${Date.now()}`,
      );

      // Try to create department in tenant1 with parent from tenant2
      const response = await request(app)
        .post("/api/v2/departments")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send({
          name: "Sneaky Dept",
          parentId: tenant2DeptId,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("DEPT_400");
    });
  });
});
