/**
 * Role Switch API v1 Tests
 * Tests for the existing role switch functionality
 */

import request from "supertest";
import app from "../../app.js";
import { execute } from "../../utils/db.js";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

describe("Role Switch API v1 Tests", () => {
  let adminToken: string;
  let rootToken: string;
  let employeeToken: string;
  let adminUser: any;
  let rootUser: any;
  let employeeUser: any;
  let tenantId: number;

  beforeAll(async () => {
    // Create test tenant
    const [tenantResult] = await execute<ResultSetHeader>(
      `INSERT INTO tenants (name, email, status) VALUES (?, ?, ?)`,
      [
        "__AUTOTEST__RoleSwitchV1",
        "__AUTOTEST__roleswitchv1@test.com",
        "active",
      ],
    );
    tenantId = tenantResult.insertId;

    // Create test users
    const [adminResult] = await execute<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, role, tenant_id, employee_number) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "__AUTOTEST__admin_v1",
        "__AUTOTEST__admin_v1@test.com",
        "$2a$10$YourHashHere",
        "admin",
        tenantId,
        "ADM001",
      ],
    );
    adminUser = { id: adminResult.insertId, tenant_id: tenantId };

    const [rootResult] = await execute<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, role, tenant_id, employee_number) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "__AUTOTEST__root_v1",
        "__AUTOTEST__root_v1@test.com",
        "$2a$10$YourHashHere",
        "root",
        tenantId,
        "ROOT001",
      ],
    );
    rootUser = { id: rootResult.insertId, tenant_id: tenantId };

    const [employeeResult] = await execute<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, role, tenant_id, employee_number, position) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "__AUTOTEST__employee_v1",
        "__AUTOTEST__employee_v1@test.com",
        "$2a$10$YourHashHere",
        "employee",
        tenantId,
        "EMP001",
        "Worker",
      ],
    );
    employeeUser = { id: employeeResult.insertId, tenant_id: tenantId };

    // Login to get tokens
    const adminLogin = await request(app).post("/api/auth/login").send({
      username: "__AUTOTEST__admin_v1@test.com",
      password: "Test123!",
    });
    adminToken = adminLogin.body.token;

    const rootLogin = await request(app).post("/api/auth/login").send({
      username: "__AUTOTEST__root_v1@test.com",
      password: "Test123!",
    });
    rootToken = rootLogin.body.token;

    const employeeLogin = await request(app).post("/api/auth/login").send({
      username: "__AUTOTEST__employee_v1@test.com",
      password: "Test123!",
    });
    employeeToken = employeeLogin.body.token;
  });

  afterAll(async () => {
    // Clean up test data
    await execute("DELETE FROM admin_logs WHERE user_id IN (?, ?, ?)", [
      adminUser.id,
      rootUser.id,
      employeeUser.id,
    ]);
    await execute("DELETE FROM users WHERE username LIKE ?", ["__AUTOTEST__%"]);
    await execute("DELETE FROM tenants WHERE name LIKE ?", ["__AUTOTEST__%"]);
  });

  describe("POST /api/role-switch/to-employee", () => {
    test("Admin can switch to employee view", async () => {
      const response = await request(app)
        .post("/api/role-switch/to-employee")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toMatchObject({
        activeRole: "employee",
        isRoleSwitched: true,
      });
      expect(response.body.token).toBeTruthy();
    });

    test("Root can switch to employee view", async () => {
      const response = await request(app)
        .post("/api/role-switch/to-employee")
        .set("Authorization", `Bearer ${rootToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.activeRole).toBe("employee");
    });

    test("Employee cannot switch roles", async () => {
      const response = await request(app)
        .post("/api/role-switch/to-employee")
        .set("Authorization", `Bearer ${employeeToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Nur Admins und Root");
    });

    test("Creates employee profile if missing position", async () => {
      // Admin without position
      const response = await request(app)
        .post("/api/role-switch/to-employee")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);

      // Check if position was set
      const [user] = await execute<RowDataPacket[]>(
        "SELECT position FROM users WHERE id = ?",
        [adminUser.id],
      );
      expect(user[0].position).toBe("Mitarbeiter");
    });
  });

  describe("POST /api/role-switch/to-admin", () => {
    test("Can switch back to admin from employee view", async () => {
      // First switch to employee
      const switchRes = await request(app)
        .post("/api/role-switch/to-employee")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json");

      const employeeViewToken = switchRes.body.token;

      // Switch back
      const response = await request(app)
        .post("/api/role-switch/to-admin")
        .set("Authorization", `Bearer ${employeeViewToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.user.activeRole).toBe("admin");
      expect(response.body.user.isRoleSwitched).toBe(false);
    });
  });

  describe("POST /api/role-switch/to-root", () => {
    test("Root can switch back from employee view", async () => {
      // First switch to employee
      const switchRes = await request(app)
        .post("/api/role-switch/to-employee")
        .set("Authorization", `Bearer ${rootToken}`)
        .set("Content-Type", "application/json");

      const employeeViewToken = switchRes.body.token;

      // Switch back to root
      const response = await request(app)
        .post("/api/role-switch/to-root")
        .set("Authorization", `Bearer ${employeeViewToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.user.activeRole).toBe("root");
      expect(response.body.message).toContain("Root");
    });

    test("Admin cannot use to-root endpoint", async () => {
      const response = await request(app)
        .post("/api/role-switch/to-root")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/role-switch/root-to-admin", () => {
    test("Root can switch to admin view", async () => {
      const response = await request(app)
        .post("/api/role-switch/root-to-admin")
        .set("Authorization", `Bearer ${rootToken}`)
        .set("Content-Type", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.user.activeRole).toBe("admin");
      expect(response.body.user.isRoleSwitched).toBe(true);
      // Original role should still be root
      expect(response.body.token).toBeTruthy();
    });
  });

  describe("Multi-Tenant Security", () => {
    test("Admin logs have correct tenant_id", async () => {
      // Perform a switch
      await request(app)
        .post("/api/role-switch/to-employee")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json");

      // Check logs
      const [logs] = await execute<RowDataPacket[]>(
        `SELECT * FROM admin_logs WHERE user_id = ? AND action = 'role_switch_to_employee' ORDER BY created_at DESC LIMIT 1`,
        [adminUser.id],
      );

      expect(logs[0].tenant_id).toBe(tenantId);
      expect(logs[0].was_role_switched).toBe(1);
    });
  });
});
