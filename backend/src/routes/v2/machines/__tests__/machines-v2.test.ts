/**
 * API Tests for Machines v2 Management Endpoints
 * Tests machine CRUD operations, maintenance tracking, and API v2 standards
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import { Pool } from "mysql2/promise";
import app from "../../../../app.js";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
} from "../../../mocks/database.js";

describe("Machines v2 API Endpoints", () => {
  let testDb: Pool;
  let tenantId: number;
  let deptId: number;
  let adminToken: string;
  // let managerToken: string;
  let employeeToken: string;
  let adminUser: any;
  // let managerUser: any;
  let employeeUser: any;
  let testMachineId: number | undefined;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-machines-v2-tests";

    // Create test tenant
    tenantId = await createTestTenant(
      testDb,
      "machinesv2test",
      "Machines v2 Test Company",
    );

    // Create test department
    deptId = await createTestDepartment(testDb, tenantId, "Production");

    // Create test users
    adminUser = await createTestUser(testDb, {
      username: "admin.machines@test.com",
      email: "admin.machines@test.com",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenantId,
      first_name: "Admin",
      last_name: "Machines",
      department_id: deptId,
    });

    // Manager role might not exist in all setups
    // managerUser = await createTestUser(testDb, {
    //   username: "manager.machines@test.com",
    //   email: "manager.machines@test.com",
    //   password: "ManagerPass123!",
    //   role: "manager",
    //   tenant_id: tenantId,
    //   first_name: "Manager",
    //   last_name: "Machines",
    //   department_id: deptId,
    // });

    employeeUser = await createTestUser(testDb, {
      username: "employee.machines@test.com",
      email: "employee.machines@test.com",
      password: "EmployeePass123!",
      role: "employee",
      tenant_id: tenantId,
      first_name: "Employee",
      last_name: "Machines",
      department_id: deptId,
    });

    // Get v2 auth tokens
    const adminLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "AdminPass123!",
    });
    adminToken = adminLoginRes.body.data.accessToken;

    // const managerLoginRes = await request(app).post("/api/v2/auth/login").send({
    //   email: managerUser.email,
    //   password: "ManagerPass123!",
    // });
    // managerToken = managerLoginRes.body.data.accessToken;

    const employeeLoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employeeUser.email,
        password: "EmployeePass123!",
      });
    employeeToken = employeeLoginRes.body.data.accessToken;

    // Create test machine category in database (ignore if exists)
    await testDb.execute(
      `INSERT IGNORE INTO machine_categories (name, description, icon, sort_order) 
       VALUES ('Test Category', 'Test Category Description', 'fa-test', 99)`,
    );
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  describe("Response Format Validation", () => {
    it("should return standardized success response format", async () => {
      const response = await request(app)
        .get("/api/v2/machines")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("meta");
      expect(response.body.meta).toHaveProperty("timestamp");
      expect(response.body.meta).toHaveProperty("version", "2.0");
    });

    it("should return standardized error response format", async () => {
      const response = await request(app)
        .get("/api/v2/machines")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code");
      expect(response.body.error).toHaveProperty("message");
      expect(response.body).toHaveProperty("meta");
      expect(response.body.meta).toHaveProperty("timestamp");
      expect(response.body.meta).toHaveProperty("requestId");
    });
  });

  describe("POST /api/v2/machines - Create Machine", () => {
    it("should create machine with admin role", async () => {
      const machineData = {
        name: "Test CNC Machine",
        model: "CNC-2000",
        manufacturer: "TechCorp",
        serialNumber: "SN-12345",
        assetNumber: "ASSET-001",
        departmentId: deptId,
        location: "Building A, Floor 2",
        machineType: "production",
        status: "operational",
        purchaseDate: "2023-01-15",
        installationDate: "2023-02-01",
        warrantyUntil: "2026-01-15",
        operatingHours: 0,
        productionCapacity: "500 units/hour",
        energyConsumption: "50 kW",
        notes: "Test machine for v2 API",
      };

      const response = await request(app)
        .post("/api/v2/machines")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send(machineData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: expect.any(Number),
        tenantId: tenantId,
        name: machineData.name,
        model: machineData.model,
        manufacturer: machineData.manufacturer,
        serialNumber: machineData.serialNumber,
        machineType: machineData.machineType,
        status: machineData.status,
        createdBy: adminUser.id,
        isActive: 1, // MySQL returns boolean as 1/0
      });

      // Save for other tests
      testMachineId = response.body.data.id;
    });

    // Manager role test commented out as role might not exist
    // it("should create machine with manager role", async () => {
    //   const machineData = {
    //     name: "Test Packaging Machine",
    //     machineType: "packaging"
    //   };

    //   const response = await request(app)
    //     .post("/api/v2/machines")
    //     .set("Authorization", `Bearer ${managerToken}`)
    //     .set("Content-Type", "application/json")
    //     .send(machineData);

    //   expect(response.status).toBe(201);
    //   expect(response.body.success).toBe(true);
    // });

    it("should reject creation with employee role", async () => {
      const machineData = {
        name: "Test Machine by Employee",
      };

      const response = await request(app)
        .post("/api/v2/machines")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send(machineData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/v2/machines")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({}); // Missing required name

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({
          field: "name",
          message: expect.stringContaining("required"),
        }),
      );
    });

    it("should reject duplicate serial number", async () => {
      // First create a machine with a unique serial number
      const uniqueSerial = "SN-DUP-TEST-" + Date.now();
      await request(app)
        .post("/api/v2/machines")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          name: "First Machine with Serial",
          serialNumber: uniqueSerial,
        });

      // Try to create another with same serial number
      const response = await request(app)
        .post("/api/v2/machines")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          name: "Duplicate Serial Machine",
          serialNumber: uniqueSerial,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/v2/machines - List Machines", () => {
    it("should list all machines for authenticated user", async () => {
      const response = await request(app)
        .get("/api/v2/machines")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it("should filter machines by status", async () => {
      const response = await request(app)
        .get("/api/v2/machines?status=operational")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((machine: any) => {
        expect(machine.status).toBe("operational");
      });
    });

    it("should filter machines by type", async () => {
      const response = await request(app)
        .get("/api/v2/machines?machineType=production")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((machine: any) => {
        expect(machine.machineType).toBe("production");
      });
    });

    it("should search machines by keyword", async () => {
      const response = await request(app)
        .get("/api/v2/machines?search=CNC")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/v2/machines/:id - Get Machine by ID", () => {
    beforeAll(async () => {
      // Ensure we have a test machine ID
      if (!testMachineId) {
        const createRes = await request(app)
          .post("/api/v2/machines")
          .set("Authorization", `Bearer ${adminToken}`)
          .set("Content-Type", "application/json")
          .send({
            name: "Test Machine for GET tests",
            serialNumber: "SN-GET-TEST-" + Date.now(),
          });
        testMachineId = createRes.body.data?.id;
      }
    });

    it("should get machine details", async () => {
      const response = await request(app)
        .get(`/api/v2/machines/${testMachineId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testMachineId,
        tenantId: tenantId,
        name: "Test CNC Machine",
        isActive: 1, // MySQL returns boolean as 1/0
      });
    });

    it("should return 404 for non-existent machine", async () => {
      const response = await request(app)
        .get("/api/v2/machines/99999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should return camelCase fields", async () => {
      const response = await request(app)
        .get(`/api/v2/machines/${testMachineId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const machine = response.body.data;

      // Check camelCase fields
      expect(machine).toHaveProperty("tenantId");
      expect(machine).toHaveProperty("serialNumber");
      expect(machine).toHaveProperty("assetNumber");
      expect(machine).toHaveProperty("departmentId");
      expect(machine).toHaveProperty("machineType");
      expect(machine).toHaveProperty("purchaseDate");
      expect(machine).toHaveProperty("installationDate");
      expect(machine).toHaveProperty("warrantyUntil");
      expect(machine).toHaveProperty("operatingHours");
      expect(machine).toHaveProperty("productionCapacity");
      expect(machine).toHaveProperty("energyConsumption");
      expect(machine).toHaveProperty("createdAt");
      expect(machine).toHaveProperty("updatedAt");
      expect(machine).toHaveProperty("createdBy");
      expect(machine).toHaveProperty("isActive");

      // Should NOT have snake_case
      expect(machine).not.toHaveProperty("tenant_id");
      expect(machine).not.toHaveProperty("serial_number");
      expect(machine).not.toHaveProperty("created_at");
    });
  });

  describe("PUT /api/v2/machines/:id - Update Machine", () => {
    beforeAll(async () => {
      // Ensure we have a test machine ID
      if (!testMachineId) {
        const createRes = await request(app)
          .post("/api/v2/machines")
          .set("Authorization", `Bearer ${adminToken}`)
          .set("Content-Type", "application/json")
          .send({
            name: "Test Machine for UPDATE tests",
            serialNumber: "SN-UPDATE-TEST-" + Date.now(),
          });
        testMachineId = createRes.body.data?.id;
      }
    });
    it("should update machine with admin role", async () => {
      const updateData = {
        name: "Updated CNC Machine",
        status: "maintenance",
        notes: "Updated via v2 API test",
      };

      const response = await request(app)
        .put(`/api/v2/machines/${testMachineId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testMachineId,
        name: updateData.name,
        status: updateData.status,
        notes: updateData.notes,
      });
    });

    // Manager role test commented out
    // it("should update machine with manager role", async () => {
    //   const updateData = {
    //     operatingHours: 100
    //   };

    //   const response = await request(app)
    //     .put(`/api/v2/machines/${testMachineId}`)
    //     .set("Authorization", `Bearer ${managerToken}`)
    //     .set("Content-Type", "application/json")
    //     .send(updateData);

    //   expect(response.status).toBe(200);
    //   expect(response.body.success).toBe(true);
    // });

    it("should reject update with employee role", async () => {
      const updateData = {
        name: "Trying to update",
      };

      const response = await request(app)
        .put(`/api/v2/machines/${testMachineId}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v2/machines/maintenance - Add Maintenance Record", () => {
    beforeAll(async () => {
      // Ensure we have a test machine ID
      if (!testMachineId) {
        const createRes = await request(app)
          .post("/api/v2/machines")
          .set("Authorization", `Bearer ${adminToken}`)
          .set("Content-Type", "application/json")
          .send({
            name: "Test Machine for MAINTENANCE tests",
            serialNumber: "SN-MAINT-TEST-" + Date.now(),
          });
        testMachineId = createRes.body.data?.id;
      }
    });
    it("should add maintenance record with admin role", async () => {
      const maintenanceData = {
        machineId: testMachineId,
        maintenanceType: "preventive",
        performedDate: new Date().toISOString(),
        description: "Regular maintenance check",
        partsReplaced: "Oil filter, Air filter",
        cost: 250.5,
        durationHours: 2.5,
        statusAfter: "operational",
        nextMaintenanceDate: new Date(
          Date.now() + 90 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      };

      const response = await request(app)
        .post("/api/v2/machines/maintenance")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send(maintenanceData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: expect.any(Number),
        machineId: testMachineId,
        maintenanceType: maintenanceData.maintenanceType,
        description: maintenanceData.description,
        cost: maintenanceData.cost,
        statusAfter: maintenanceData.statusAfter,
      });
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/v2/machines/maintenance")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          machineId: testMachineId,
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject with employee role", async () => {
      const maintenanceData = {
        machineId: testMachineId,
        maintenanceType: "preventive",
        performedDate: new Date().toISOString(),
      };

      const response = await request(app)
        .post("/api/v2/machines/maintenance")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json")
        .send(maintenanceData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v2/machines/:id/maintenance - Get Maintenance History", () => {
    beforeAll(async () => {
      // Ensure we have a test machine ID
      if (!testMachineId) {
        const createRes = await request(app)
          .post("/api/v2/machines")
          .set("Authorization", `Bearer ${adminToken}`)
          .set("Content-Type", "application/json")
          .send({
            name: "Test Machine for HISTORY tests",
            serialNumber: "SN-HIST-TEST-" + Date.now(),
          });
        testMachineId = createRes.body.data?.id;
      }
    });
    it("should get maintenance history for machine", async () => {
      const response = await request(app)
        .get(`/api/v2/machines/${testMachineId}/maintenance`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check camelCase in maintenance records
      const record = response.body.data[0];
      expect(record).toHaveProperty("machineId");
      expect(record).toHaveProperty("maintenanceType");
      expect(record).toHaveProperty("performedDate");
      expect(record).toHaveProperty("performedBy");
      expect(record).toHaveProperty("partsReplaced");
      expect(record).toHaveProperty("durationHours");
      expect(record).toHaveProperty("statusAfter");
      expect(record).toHaveProperty("createdAt");
    });
  });

  describe("GET /api/v2/machines/statistics - Get Statistics", () => {
    it("should get machine statistics", async () => {
      const response = await request(app)
        .get("/api/v2/machines/statistics")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalMachines: expect.any(Number),
        operational: expect.any(Number),
        inMaintenance: expect.any(Number),
        inRepair: expect.any(Number),
        standby: expect.any(Number),
        decommissioned: expect.any(Number),
        needsMaintenanceSoon: expect.any(Number),
      });
    });
  });

  describe("GET /api/v2/machines/categories - Get Categories", () => {
    it("should get machine categories", async () => {
      const response = await request(app)
        .get("/api/v2/machines/categories")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check category structure
      const category = response.body.data[0];
      expect(category).toHaveProperty("id");
      expect(category).toHaveProperty("name");
      expect(category).toHaveProperty("description");
      expect(category).toHaveProperty("icon");
      expect(category).toHaveProperty("sortOrder");
      expect(category).toHaveProperty("isActive");
    });
  });

  describe("GET /api/v2/machines/upcoming-maintenance - Get Upcoming Maintenance", () => {
    it("should get machines needing maintenance soon", async () => {
      const response = await request(app)
        .get("/api/v2/machines/upcoming-maintenance?days=30")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it("should validate days parameter", async () => {
      const response = await request(app)
        .get("/api/v2/machines/upcoming-maintenance?days=400")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("DELETE /api/v2/machines/:id - Delete Machine", () => {
    it("should soft delete machine with admin role", async () => {
      // Create a machine to delete
      const createRes = await request(app)
        .post("/api/v2/machines")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          name: "Machine to Delete",
        });

      const machineId = createRes.body.data.id;

      const response = await request(app)
        .delete(`/api/v2/machines/${machineId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe("Machine deleted successfully");

      // Verify it's soft deleted (isActive = false)
      const getRes = await request(app)
        .get(`/api/v2/machines/${machineId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(getRes.body.data.isActive).toBe(0); // MySQL returns boolean as 0/1
    });

    // Manager role test commented out
    // it("should reject delete with manager role", async () => {
    //   const response = await request(app)
    //     .delete(`/api/v2/machines/${testMachineId}`)
    //     .set("Authorization", `Bearer ${managerToken}`);

    //   expect(response.status).toBe(403);
    //   expect(response.body.success).toBe(false);
    // });

    it("should reject delete with employee role", async () => {
      const response = await request(app)
        .delete(`/api/v2/machines/${testMachineId}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe("Multi-Tenant Isolation", () => {
    let otherTenantId: number;
    let otherTenantToken: string;
    let otherTenantMachineId: number;

    beforeAll(async () => {
      // Create another tenant
      otherTenantId = await createTestTenant(
        testDb,
        "othermachinetest",
        "Other Machine Company",
      );

      // Create user for other tenant
      const otherUser = await createTestUser(testDb, {
        username: "other.admin@test.com",
        email: "other.admin@test.com",
        password: "OtherPass123!",
        role: "admin",
        tenant_id: otherTenantId,
        first_name: "Other",
        last_name: "Admin",
      });

      // Get token
      const loginRes = await request(app).post("/api/v2/auth/login").send({
        email: otherUser.email,
        password: "OtherPass123!",
      });
      otherTenantToken = loginRes.body.data.accessToken;

      // Create machine for other tenant
      const createRes = await request(app)
        .post("/api/v2/machines")
        .set("Authorization", `Bearer ${otherTenantToken}`)
        .set("Content-Type", "application/json")
        .send({
          name: "Other Tenant Machine",
        });
      otherTenantMachineId = createRes.body.data.id;
    });

    it("should not see machines from other tenants", async () => {
      const response = await request(app)
        .get("/api/v2/machines")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const machineIds = response.body.data.map((m: any) => m.id);
      expect(machineIds).not.toContain(otherTenantMachineId);
    });

    it("should not access machine from other tenant", async () => {
      const response = await request(app)
        .get(`/api/v2/machines/${otherTenantMachineId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should not update machine from other tenant", async () => {
      const response = await request(app)
        .put(`/api/v2/machines/${otherTenantMachineId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send({
          name: "Trying to hack",
        });

      expect(response.status).toBe(404);
    });

    it("should not delete machine from other tenant", async () => {
      const response = await request(app)
        .delete(`/api/v2/machines/${otherTenantMachineId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });
});
