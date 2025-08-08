/**
 * API Tests for Teams v2 Management Endpoints
 * Tests team CRUD operations, member management, and API v2 standards
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
import app from "../../../../app.js";
import {
  createTestDatabase,
  cleanupTestData,
  createTestTenant,
  createTestUser,
  createTestDepartment,
  createTestTeam,
} from "../../../mocks/database.js";

describe("Teams v2 API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let adminTokenV2: string;
  let employeeTokenV2: string;
  let rootTokenV2: string;
  let tenant2TokenV2: string;
  let dept1Id: number;
  let team1Id: number;
  let team2Id: number;
  let adminUser: any;
  let employeeUser: any;
  let rootUser: any;
  let tenant2User: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-teams-v2-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "teamsv2test1",
      "Teams v2 Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "teamsv2test2",
      "Teams v2 Test Company 2",
    );

    // Create test users
    adminUser = await createTestUser(testDb, {
      username: "teamsv2_admin",
      email: "teamsv2_admin@test.com",
      password: "Test1234!",
      role: "admin",
      tenant_id: tenant1Id,
    });

    employeeUser = await createTestUser(testDb, {
      username: "teamsv2_employee",
      email: "teamsv2_employee@test.com",
      password: "Test1234!",
      role: "employee",
      tenant_id: tenant1Id,
    });

    rootUser = await createTestUser(testDb, {
      username: "teamsv2_root",
      email: "teamsv2_root@test.com",
      password: "Test1234!",
      role: "root",
      tenant_id: tenant1Id,
    });

    tenant2User = await createTestUser(testDb, {
      username: "teamsv2_tenant2_admin",
      email: "teamsv2_tenant2_admin@test.com",
      password: "Test1234!",
      role: "admin",
      tenant_id: tenant2Id,
    });

    // Create test department
    dept1Id = await createTestDepartment(
      testDb,
      tenant1Id,
      "Teams v2 Test Department",
    );

    // Create test teams
    team1Id = await createTestTeam(
      testDb,
      tenant1Id,
      dept1Id,
      "Teams v2 Test Team 1",
    );

    team2Id = await createTestTeam(
      testDb,
      tenant1Id,
      dept1Id,
      "Teams v2 Test Team 2",
    );

    // Debug: Check if users were created
    console.info("Created users:", {
      adminUser: adminUser,
      employeeUser: employeeUser,
      rootUser: rootUser,
      tenant2User: tenant2User,
    });

    // Get v2 tokens
    const adminLoginV2 = await request(app)
      .post("/api/v2/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: adminUser.email, password: "Test1234!" });

    if (!adminLoginV2.body.success) {
      console.error(
        "Admin login failed:",
        adminLoginV2.status,
        adminLoginV2.body,
      );
      throw new Error(
        `Admin login failed: ${JSON.stringify(adminLoginV2.body)}`,
      );
    }
    console.info("Admin login response:", adminLoginV2.body);
    adminTokenV2 =
      adminLoginV2.body.data.accessToken || adminLoginV2.body.data.token;

    const employeeLoginV2 = await request(app)
      .post("/api/v2/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: employeeUser.email, password: "Test1234!" });

    if (!employeeLoginV2.body.success) {
      throw new Error(
        `Employee login failed: ${JSON.stringify(employeeLoginV2.body)}`,
      );
    }
    employeeTokenV2 =
      employeeLoginV2.body.data.accessToken || employeeLoginV2.body.data.token;

    const rootLoginV2 = await request(app)
      .post("/api/v2/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: rootUser.email, password: "Test1234!" });

    if (!rootLoginV2.body.success) {
      throw new Error(`Root login failed: ${JSON.stringify(rootLoginV2.body)}`);
    }
    rootTokenV2 =
      rootLoginV2.body.data.accessToken || rootLoginV2.body.data.token;

    const tenant2LoginV2 = await request(app)
      .post("/api/v2/auth/login")
      .set("Content-Type", "application/json")
      .send({ email: tenant2User.email, password: "Test1234!" });

    if (!tenant2LoginV2.body.success) {
      throw new Error(
        `Tenant2 login failed: ${JSON.stringify(tenant2LoginV2.body)}`,
      );
    }
    tenant2TokenV2 =
      tenant2LoginV2.body.data.accessToken || tenant2LoginV2.body.data.token;
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear team members before each test
    await testDb.execute("DELETE FROM user_teams WHERE team_id IN (?, ?)", [
      team1Id,
      team2Id,
    ]);
  });

  describe("GET /api/v2/teams", () => {
    it("should list all teams for the tenant", async () => {
      const response = await request(app)
        .get("/api/v2/teams")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      const teamNames = response.body.data.map((t: any) => t.name);
      expect(teamNames).toContain("Teams v2 Test Team 1");
      expect(teamNames).toContain("Teams v2 Test Team 2");
    });

    it("should filter teams by department", async () => {
      const response = await request(app)
        .get(`/api/v2/teams?departmentId=${dept1Id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);

      response.body.data.forEach((team: any) => {
        expect(team.departmentId).toBe(dept1Id);
      });
    });

    it("should search teams by name", async () => {
      const response = await request(app)
        .get("/api/v2/teams?search=Team 1")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe("Teams v2 Test Team 1");
    });

    it("should include member count when requested", async () => {
      // Add a member to team1
      await testDb.execute(
        "INSERT INTO user_teams (user_id, team_id, tenant_id) VALUES (?, ?, ?)",
        [employeeUser.id, team1Id, tenant1Id],
      );

      const response = await request(app)
        .get("/api/v2/teams?includeMembers=true")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);

      const team1 = response.body.data.find((t: any) => t.id === team1Id);
      expect(team1).toBeDefined();
      expect(team1).toHaveProperty("memberCount");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/v2/teams");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should isolate teams by tenant", async () => {
      const response = await request(app)
        .get("/api/v2/teams")
        .set("Authorization", `Bearer ${tenant2TokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);

      // Should not see tenant1's teams
      const teamNames = response.body.data.map((t: any) => t.name);
      expect(teamNames).not.toContain("Teams v2 Test Team 1");
      expect(teamNames).not.toContain("Teams v2 Test Team 2");
    });
  });

  describe("GET /api/v2/teams/:id", () => {
    it("should get team by ID with members", async () => {
      // Add members to the team
      await testDb.execute(
        "INSERT INTO user_teams (user_id, team_id, tenant_id) VALUES (?, ?, ?), (?, ?, ?)",
        [employeeUser.id, team1Id, tenant1Id, adminUser.id, team1Id, tenant1Id],
      );

      const response = await request(app)
        .get(`/api/v2/teams/${team1Id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: team1Id,
        name: "Teams v2 Test Team 1",
        departmentId: dept1Id,
      });
      expect(response.body.data.members).toBeInstanceOf(Array);
      expect(response.body.data.members.length).toBe(2);
    });

    it("should return 404 for non-existent team", async () => {
      const response = await request(app)
        .get("/api/v2/teams/99999")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should prevent access to other tenant's teams", async () => {
      const response = await request(app)
        .get(`/api/v2/teams/${team1Id}`)
        .set("Authorization", `Bearer ${tenant2TokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should allow employee access to view teams", async () => {
      const response = await request(app)
        .get(`/api/v2/teams/${team1Id}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(team1Id);
    });
  });

  describe("POST /api/v2/teams", () => {
    it("should create a new team", async () => {
      const newTeam = {
        name: "New Team v2",
        description: "A new team for testing",
        departmentId: dept1Id,
        leaderId: adminUser.id,
      };

      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send(newTeam);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      // In v2 API, message is not included in the response body
      expect(response.body.data).toMatchObject({
        name: newTeam.name,
        description: newTeam.description,
        departmentId: newTeam.departmentId,
        leaderId: newTeam.leaderId,
      });
      expect(response.body.data.id).toBeDefined();
    });

    it("should prevent duplicate team names", async () => {
      const duplicateTeam = {
        name: "Teams v2 Test Team 1", // Already exists
        description: "Duplicate team",
      };

      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send(duplicateTeam);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("CONFLICT");
    });

    it("should validate required fields", async () => {
      const invalidTeam = {
        description: "Missing name",
      };

      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send(invalidTeam);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should validate department ID", async () => {
      const invalidTeam = {
        name: "Invalid Department Team",
        departmentId: 99999, // Non-existent
      };

      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send(invalidTeam);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("BAD_REQUEST");
    });

    it("should validate leader ID", async () => {
      const invalidTeam = {
        name: "Invalid Leader Team",
        leaderId: 99999, // Non-existent
      };

      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send(invalidTeam);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("BAD_REQUEST");
    });

    it("should require admin or root role", async () => {
      const newTeam = {
        name: "Employee Team",
        description: "Should fail",
      };

      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .set("Content-Type", "application/json")
        .send(newTeam);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should allow root role to create teams", async () => {
      const newTeam = {
        name: "Root Created Team",
        description: "Created by root user",
      };

      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${rootTokenV2}`)
        .set("Content-Type", "application/json")
        .send(newTeam);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newTeam.name);
    });
  });

  describe("PUT /api/v2/teams/:id", () => {
    it("should update team details", async () => {
      const updates = {
        name: "Updated Team Name",
        description: "Updated description",
        leaderId: employeeUser.id,
      };

      const response = await request(app)
        .put(`/api/v2/teams/${team1Id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // In v2 API, message is not included in the response body
      expect(response.body.data).toMatchObject({
        id: team1Id,
        name: updates.name,
        description: updates.description,
        leaderId: updates.leaderId,
      });
    });

    it("should allow clearing optional fields", async () => {
      const updates = {
        description: null,
        leaderId: null,
      };

      const response = await request(app)
        .put(`/api/v2/teams/${team1Id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBeNull();
      expect(response.body.data.leaderId).toBeNull();
    });

    it("should prevent duplicate names on update", async () => {
      const updates = {
        name: "Teams v2 Test Team 2", // Already exists
      };

      const response = await request(app)
        .put(`/api/v2/teams/${team1Id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send(updates);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("CONFLICT");
    });

    it("should return 404 for non-existent team", async () => {
      const response = await request(app)
        .put("/api/v2/teams/99999")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({ name: "Updated" });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should prevent access to other tenant's teams", async () => {
      const response = await request(app)
        .put(`/api/v2/teams/${team1Id}`)
        .set("Authorization", `Bearer ${tenant2TokenV2}`)
        .set("Content-Type", "application/json")
        .send({ name: "Hacked Team" });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should require admin or root role", async () => {
      const response = await request(app)
        .put(`/api/v2/teams/${team1Id}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .set("Content-Type", "application/json")
        .send({ name: "Employee Update" });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("DELETE /api/v2/teams/:id", () => {
    let teamToDeleteId: number;

    beforeEach(async () => {
      // Create a team to delete in each test
      teamToDeleteId = await createTestTeam(
        testDb,
        tenant1Id,
        null, // No department
        "Team to Delete",
      );
    });

    it("should delete an empty team", async () => {
      const response = await request(app)
        .delete(`/api/v2/teams/${teamToDeleteId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe("Team deleted successfully");

      // Verify team is deleted
      const checkResponse = await request(app)
        .get(`/api/v2/teams/${teamToDeleteId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(checkResponse.status).toBe(404);
    });

    it("should prevent deletion of team with members", async () => {
      // Add a member to the team
      await testDb.execute(
        "INSERT INTO user_teams (user_id, team_id, tenant_id) VALUES (?, ?, ?)",
        [employeeUser.id, teamToDeleteId, tenant1Id],
      );

      const response = await request(app)
        .delete(`/api/v2/teams/${teamToDeleteId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("BAD_REQUEST");
      expect(response.body.error.message).toContain(
        "Cannot delete team with members",
      );
    });

    it("should return 404 for non-existent team", async () => {
      const response = await request(app)
        .delete("/api/v2/teams/99999")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should prevent access to other tenant's teams", async () => {
      const response = await request(app)
        .delete(`/api/v2/teams/${teamToDeleteId}`)
        .set("Authorization", `Bearer ${tenant2TokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should require admin or root role", async () => {
      const response = await request(app)
        .delete(`/api/v2/teams/${teamToDeleteId}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("GET /api/v2/teams/:id/members", () => {
    it("should list team members", async () => {
      // Add members to the team
      await testDb.execute(
        "INSERT INTO user_teams (user_id, team_id, tenant_id) VALUES (?, ?, ?), (?, ?, ?)",
        [employeeUser.id, team1Id, tenant1Id, adminUser.id, team1Id, tenant1Id],
      );

      const response = await request(app)
        .get(`/api/v2/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);

      const memberIds = response.body.data.map((m: any) => m.id);
      expect(memberIds).toContain(employeeUser.id);
      expect(memberIds).toContain(adminUser.id);
    });

    it("should return empty array for team without members", async () => {
      const response = await request(app)
        .get(`/api/v2/teams/${team2Id}/members`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(0);
    });

    it("should allow employees to view team members", async () => {
      const response = await request(app)
        .get(`/api/v2/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should prevent access to other tenant's teams", async () => {
      const response = await request(app)
        .get(`/api/v2/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${tenant2TokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/v2/teams/:id/members", () => {
    it("should add a member to the team", async () => {
      const response = await request(app)
        .post(`/api/v2/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({ userId: employeeUser.id });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe("Team member added successfully");

      // Verify member was added
      const membersResponse = await request(app)
        .get(`/api/v2/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      const memberIds = membersResponse.body.data.map((m: any) => m.id);
      expect(memberIds).toContain(employeeUser.id);
    });

    it("should prevent adding duplicate members", async () => {
      // Add member first time
      await testDb.execute(
        "INSERT INTO user_teams (user_id, team_id, tenant_id) VALUES (?, ?, ?)",
        [employeeUser.id, team1Id, tenant1Id],
      );

      // Try to add again
      const response = await request(app)
        .post(`/api/v2/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({ userId: employeeUser.id });

      expect(response.status).toBe(409); // Conflict - already a member
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("CONFLICT");
    });

    it("should validate user ID", async () => {
      const response = await request(app)
        .post(`/api/v2/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({ userId: 99999 }); // Non-existent user

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("BAD_REQUEST");
    });

    it("should prevent adding users from other tenants", async () => {
      const response = await request(app)
        .post(`/api/v2/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({ userId: tenant2User.id });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("BAD_REQUEST");
    });

    it("should require admin or root role", async () => {
      const response = await request(app)
        .post(`/api/v2/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .set("Content-Type", "application/json")
        .send({ userId: rootUser.id });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("DELETE /api/v2/teams/:id/members/:userId", () => {
    beforeEach(async () => {
      // Add a member to team1 before each test
      await testDb.execute(
        "INSERT INTO user_teams (user_id, team_id, tenant_id) VALUES (?, ?, ?)",
        [employeeUser.id, team1Id, tenant1Id],
      );
    });

    it("should remove a member from the team", async () => {
      const response = await request(app)
        .delete(`/api/v2/teams/${team1Id}/members/${employeeUser.id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe(
        "Team member removed successfully",
      );

      // Verify member was removed
      const membersResponse = await request(app)
        .get(`/api/v2/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      const memberIds = membersResponse.body.data.map((m: any) => m.id);
      expect(memberIds).not.toContain(employeeUser.id);
    });

    it("should handle removing non-member gracefully", async () => {
      const response = await request(app)
        .delete(`/api/v2/teams/${team1Id}/members/${rootUser.id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("BAD_REQUEST");
      expect(response.body.error.message).toContain("not a member");
    });

    it("should return 404 for non-existent team", async () => {
      const response = await request(app)
        .delete(`/api/v2/teams/99999/members/${employeeUser.id}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should prevent access to other tenant's teams", async () => {
      const response = await request(app)
        .delete(`/api/v2/teams/${team1Id}/members/${employeeUser.id}`)
        .set("Authorization", `Bearer ${tenant2TokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should require admin or root role", async () => {
      const response = await request(app)
        .delete(`/api/v2/teams/${team1Id}/members/${employeeUser.id}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("Input Validation", () => {
    it("should validate team name length", async () => {
      const longName = "a".repeat(101); // Max is 100
      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({ name: longName });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should validate description length", async () => {
      const longDescription = "a".repeat(501); // Max is 500
      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({
          name: "Valid Name",
          description: longDescription,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should validate search parameter", async () => {
      const longSearch = "a".repeat(101); // Max is 100
      const response = await request(app)
        .get(`/api/v2/teams?search=${longSearch}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should validate numeric IDs", async () => {
      const response = await request(app)
        .get("/api/v2/teams/not-a-number")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Content-Type validation", () => {
    it("should reject non-JSON content type for POST", async () => {
      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "text/plain")
        .send("name=Test Team");

      expect(response.status).toBe(400);
      // The response might not have the standard v2 format when Content-Type is invalid
      expect(response.body).toBeDefined();
      // Should have an error message about Content-Type
      expect(JSON.stringify(response.body)).toMatch(/content-type/i);
    });

    it("should accept application/json content type", async () => {
      const response = await request(app)
        .post("/api/v2/teams")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .set("Content-Type", "application/json")
        .send({ name: "JSON Team" });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });
});
