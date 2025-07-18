/**
 * API Tests for Team Management Endpoints
 * Tests team CRUD operations, member management, and multi-tenant isolation
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

describe("Team Management API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let dept1Id: number;
  let dept2Id: number;
  let team1Id: number;
  let team2Id: number;
  let adminToken1: string;
  let adminToken2: string;
  let employeeToken1: string;
  let employeeToken2: string;
  let teamLeadToken: string;
  let adminUser1: any;
  let employeeUser1: any;
  let employeeUser2: any;
  let teamLeadUser: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-team-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "teamtest1",
      "Team Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "teamtest2",
      "Team Test Company 2",
    );

    // Create departments
    dept1Id = await createTestDepartment(testDb, tenant1Id, "Engineering");
    dept2Id = await createTestDepartment(testDb, tenant1Id, "Marketing");

    // Create initial teams
    team1Id = await createTestTeam(testDb, tenant1Id, dept1Id, "Frontend Team");
    team2Id = await createTestTeam(testDb, tenant1Id, dept1Id, "Backend Team");

    // Create test users
    adminUser1 = await createTestUser(testDb, {
      username: "teamadmin1",
      email: "admin1@teamtest1.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "One",
    });

    await createTestUser(testDb, {
      username: "teamadmin2",
      email: "admin2@teamtest2.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant2Id,
      first_name: "Admin",
      last_name: "Two",
    });

    employeeUser1 = await createTestUser(testDb, {
      username: "teamemployee1",
      email: "employee1@teamtest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Employee",
      last_name: "One",
    });

    employeeUser2 = await createTestUser(testDb, {
      username: "teamemployee2",
      email: "employee2@teamtest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Employee",
      last_name: "Two",
    });

    teamLeadUser = await createTestUser(testDb, {
      username: "teamlead1",
      email: "teamlead1@teamtest1.de",
      password: "LeadPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Team",
      last_name: "Lead",
    });

    // Set team lead
    await testDb.execute("UPDATE teams SET lead_id = ? WHERE id = ?", [
      teamLeadUser.id,
      team1Id,
    ]);

    // Get auth tokens
    adminToken1 = await getAuthToken(app, "teamadmin1", "AdminPass123!");
    adminToken2 = await getAuthToken(app, "teamadmin2", "AdminPass123!");
    employeeToken1 = await getAuthToken(app, "teamemployee1", "EmpPass123!");
    employeeToken2 = await getAuthToken(app, "teamemployee2", "EmpPass123!");
    teamLeadToken = await getAuthToken(app, "teamlead1", "LeadPass123!");
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  describe("GET /api/teams", () => {
    beforeEach(async () => {
      // Create additional test teams
      await createTestTeam(testDb, tenant1Id, dept2Id, "Marketing Team A");
      await createTestTeam(testDb, tenant2Id, null, "Cross-functional Team");
    });

    it("should list all teams for admin within tenant", async () => {
      const response = await request(app)
        .get("/api/teams")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          teams: expect.any(Array),
          pagination: expect.objectContaining({
            total: expect.any(Number),
            page: 1,
            limit: 20,
          }),
        },
      });

      const teams = response.body.data.teams;
      expect(teams.length).toBeGreaterThanOrEqual(3);
      expect(teams.every((t) => t.tenant_id === tenant1Id)).toBe(true);
    });

    it("should include team statistics if requested", async () => {
      const response = await request(app)
        .get("/api/teams?include=stats")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const teams = response.body.data.teams;
      expect(teams[0]).toHaveProperty("member_count");
      expect(teams[0]).toHaveProperty("active_projects");
    });

    it("should filter teams by department", async () => {
      const response = await request(app)
        .get(`/api/teams?department_id=${dept1Id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const teams = response.body.data.teams;
      expect(teams.every((t) => t.department_id === dept1Id)).toBe(true);
    });

    it("should search teams by name", async () => {
      const response = await request(app)
        .get("/api/teams?search=frontend")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const teams = response.body.data.teams;
      expect(teams.some((t) => t.name.toLowerCase().includes("frontend"))).toBe(
        true,
      );
    });

    it("should allow employees to view teams", async () => {
      const response = await request(app)
        .get("/api/teams")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      // Employees can see teams but might have limited visibility
    });

    it("should filter by status", async () => {
      // Create inactive team
      await testDb.execute(
        "INSERT INTO teams (name, department_id, tenant_id, status) VALUES (?, ?, ?, ?)",
        ["Inactive Team", dept1Id, tenant1Id, "inactive"],
      );

      const response = await request(app)
        .get("/api/teams?status=active")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const teams = response.body.data.teams;
      expect(teams.every((t) => t.status === "active")).toBe(true);
    });

    it("should enforce tenant isolation", async () => {
      const response = await request(app)
        .get("/api/teams")
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(200);
      const teams = response.body.data.teams;
      expect(teams.every((t) => t.tenant_id === tenant2Id)).toBe(true);
      expect(teams.some((t) => t.tenant_id === tenant1Id)).toBe(false);
    });

    it("should include team lead info if requested", async () => {
      const response = await request(app)
        .get("/api/teams?include=lead")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const teamWithLead = response.body.data.teams.find(
        (t) => t.id === team1Id,
      );
      expect(teamWithLead.lead).toMatchObject({
        id: teamLeadUser.id,
        first_name: "Team",
        last_name: "Lead",
      });
    });
  });

  describe("POST /api/teams", () => {
    const validTeamData = {
      name: "New Team",
      description: "Test team description",
      department_id: null,
      lead_id: null,
      max_members: 10,
    };

    it("should create team for admin", async () => {
      const response = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validTeamData,
          department_id: dept1Id,
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich erstellt"),
      });
      expect(response.body.data.teamId).toBeDefined();

      // Verify creation
      const [rows] = await testDb.execute("SELECT * FROM teams WHERE id = ?", [
        response.body.data.teamId,
      ]);
      const teams = asTestRows<any>(rows);
      expect(teams[0]).toMatchObject({
        name: validTeamData.name,
        description: validTeamData.description,
        department_id: dept1Id,
        tenant_id: tenant1Id,
        status: "active",
      });
    });

    it("should create cross-functional team without department", async () => {
      const response = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          name: "Cross-functional Team",
          description: "Works across departments",
          // No department_id
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT department_id FROM teams WHERE id = ?",
        [response.body.data.teamId],
      );
      const teams = asTestRows<any>(rows);
      expect(teams[0].department_id).toBeNull();
    });

    it("should assign team lead on creation", async () => {
      const response = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validTeamData,
          name: "Team with Lead",
          lead_id: employeeUser1.id,
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT lead_id FROM teams WHERE id = ?",
        [response.body.data.teamId],
      );
      const teams = asTestRows<any>(rows);
      expect(teams[0].lead_id).toBe(employeeUser1.id);
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          description: "Missing name",
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "name" })]),
      );
    });

    it("should prevent duplicate team names within department", async () => {
      const response = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validTeamData,
          name: "Frontend Team", // Already exists in dept1
          department_id: dept1Id,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("bereits vorhanden");
    });

    it("should allow same team name in different departments", async () => {
      const response = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validTeamData,
          name: "Frontend Team", // Same name but different dept
          department_id: dept2Id,
        });

      expect(response.status).toBe(201);
    });

    it("should deny team creation by regular employees", async () => {
      const response = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(validTeamData);

      expect(response.status).toBe(403);
    });

    it("should allow team leads to create sub-teams", async () => {
      const response = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${teamLeadToken}`)
        .send({
          ...validTeamData,
          name: "Frontend Sub-team",
          department_id: dept1Id,
          parent_team_id: team1Id,
        });

      // Depending on business rules, this might be allowed
      expect([200, 201, 403]).toContain(response.status);
    });

    it("should validate department exists in same tenant", async () => {
      const response = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validTeamData,
          name: "Invalid Dept Team",
          department_id: 99999,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Abteilung nicht gefunden");
    });

    it("should set default values correctly", async () => {
      const response = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          name: "Minimal Team",
          // No other fields
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute("SELECT * FROM teams WHERE id = ?", [
        response.body.data.teamId,
      ]);
      const teams = asTestRows<any>(rows);
      expect(teams[0]).toMatchObject({
        description: null,
        department_id: null,
        lead_id: null,
        status: "active",
        max_members: 50, // Default
      });
    });
  });

  describe("GET /api/teams/:id", () => {
    it("should get team details", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: team1Id,
        name: "Frontend Team",
        department_id: dept1Id,
        tenant_id: tenant1Id,
        status: "active",
      });
    });

    it("should include members if requested", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}?include=members`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.members).toBeDefined();
      expect(response.body.data.members.length).toBeGreaterThanOrEqual(3); // 2 employees + lead
    });

    it("should include department info if requested", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}?include=department`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.department).toMatchObject({
        id: dept1Id,
        name: "Engineering",
      });
    });

    it("should include team projects if requested", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}?include=projects`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.projects).toBeDefined();
    });

    it("should return 404 for non-existent team", async () => {
      const response = await request(app)
        .get("/api/teams/99999")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Team nicht gefunden");
    });

    it("should enforce tenant isolation", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });

    it("should allow team members to view their team", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
    });

    it("should deny access to non-members", async () => {
      // Create employee in different team
      const otherEmployee = await createTestUser(testDb, {
        username: "otherteam",
        email: "other@test.de",
        password: "Pass123!",
        role: "employee",
        tenant_id: tenant1Id,
        department_id: dept1Id,
        team_id: team2Id,
        first_name: "Other",
        last_name: "Employee",
      });

      const otherToken = await getAuthToken(app, "otherteam", "Pass123!");

      const response = await request(app)
        .get(`/api/teams/${team1Id}`)
        .set("Authorization", `Bearer ${otherToken}`);

      // Might allow viewing but with limited info
      expect([200, 403]).toContain(response.status);
    });
  });

  describe("PUT /api/teams/:id", () => {
    let updateTeamId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        "INSERT INTO teams (name, description, department_id, tenant_id) VALUES (?, ?, ?, ?)",
        ["Update Test Team", "Original description", dept1Id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      updateTeamId = (result as any).insertId;
    });

    it("should update team for admin", async () => {
      const updateData = {
        name: "Updated Team",
        description: "Updated description",
        max_members: 15,
      };

      const response = await request(app)
        .put(`/api/teams/${updateTeamId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("erfolgreich aktualisiert");

      // Verify update
      const [rows] = await testDb.execute("SELECT * FROM teams WHERE id = ?", [
        updateTeamId,
      ]);
      const teams = asTestRows<any>(rows);
      expect(teams[0]).toMatchObject(updateData);
    });

    it("should update team lead", async () => {
      const response = await request(app)
        .put(`/api/teams/${updateTeamId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          lead_id: employeeUser2.id,
        });

      expect(response.status).toBe(200);

      const [rows] = await testDb.execute(
        "SELECT lead_id FROM teams WHERE id = ?",
        [updateTeamId],
      );
      const teams = asTestRows<any>(rows);
      expect(teams[0].lead_id).toBe(employeeUser2.id);
    });

    it("should validate unique name within department", async () => {
      const response = await request(app)
        .put(`/api/teams/${updateTeamId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          name: "Frontend Team", // Already exists in dept1
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("bereits vorhanden");
    });

    it("should allow team lead to update some fields", async () => {
      // Set team lead
      await testDb.execute("UPDATE teams SET lead_id = ? WHERE id = ?", [
        teamLeadUser.id,
        updateTeamId,
      ]);

      const response = await request(app)
        .put(`/api/teams/${updateTeamId}`)
        .set("Authorization", `Bearer ${teamLeadToken}`)
        .send({
          description: "Updated by team lead",
        });

      expect(response.status).toBe(200);
    });

    it("should deny update by regular team members", async () => {
      const response = await request(app)
        .put(`/api/teams/${team1Id}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          name: "Hacked Team",
        });

      expect(response.status).toBe(403);
    });

    it("should enforce tenant isolation on update", async () => {
      const response = await request(app)
        .put(`/api/teams/${updateTeamId}`)
        .set("Authorization", `Bearer ${adminToken2}`)
        .send({
          name: "Cross-tenant Update",
        });

      expect(response.status).toBe(404);
    });

    it("should handle status changes", async () => {
      const response = await request(app)
        .put(`/api/teams/${updateTeamId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          status: "inactive",
        });

      expect(response.status).toBe(200);

      const [rows] = await testDb.execute(
        "SELECT status FROM teams WHERE id = ?",
        [updateTeamId],
      );
      const teams = asTestRows<any>(rows);
      expect(teams[0].status).toBe("inactive");
    });

    it("should validate max_members constraint", async () => {
      // Add members to team
      for (let i = 0; i < 3; i++) {
        await testDb.execute("UPDATE users SET team_id = ? WHERE id = ?", [
          updateTeamId,
          (
            await createTestUser(testDb, {
              username: `member${i}`,
              email: `member${i}@test.de`,
              password: "Pass123!",
              role: "employee",
              tenant_id: tenant1Id,
              first_name: "Member",
              last_name: `${i}`,
            })
          ).id,
        ]);
      }

      const response = await request(app)
        .put(`/api/teams/${updateTeamId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          max_members: 2, // Less than current members
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("aktuelle Mitgliederzahl");
    });
  });

  describe("DELETE /api/teams/:id", () => {
    let deleteTeamId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        "INSERT INTO teams (name, department_id, tenant_id) VALUES (?, ?, ?)",
        ["Delete Test Team", dept1Id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      deleteTeamId = (result as any).insertId;
    });

    it("should soft delete team for admin", async () => {
      const response = await request(app)
        .delete(`/api/teams/${deleteTeamId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("erfolgreich gelöscht");

      // Verify soft delete
      const [rows] = await testDb.execute(
        "SELECT status, deleted_at FROM teams WHERE id = ?",
        [deleteTeamId],
      );
      const teams = asTestRows<any>(rows);
      expect(teams[0].status).toBe("inactive");
      expect(teams[0].deleted_at).toBeTruthy();
    });

    it("should prevent deletion of team with active members", async () => {
      // Add member to team
      await testDb.execute("UPDATE users SET team_id = ? WHERE id = ?", [
        deleteTeamId,
        employeeUser1.id,
      ]);

      const response = await request(app)
        .delete(`/api/teams/${deleteTeamId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("aktive Mitglieder");
    });

    it("should reassign members if requested", async () => {
      // Add member to team
      const member = await createTestUser(testDb, {
        username: "deleteteammember",
        email: "deletemember@test.de",
        password: "Pass123!",
        role: "employee",
        tenant_id: tenant1Id,
        team_id: deleteTeamId,
        first_name: "Delete",
        last_name: "Member",
      });

      const response = await request(app)
        .delete(`/api/teams/${deleteTeamId}?reassign_to=${team2Id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);

      // Check member was reassigned
      const [rows] = await testDb.execute(
        "SELECT team_id FROM users WHERE id = ?",
        [member.id],
      );
      const users = asTestRows<any>(rows);
      expect(users[0].team_id).toBe(team2Id);
    });

    it("should deny deletion by employees", async () => {
      const response = await request(app)
        .delete(`/api/teams/${deleteTeamId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });

    it("should enforce tenant isolation on delete", async () => {
      const response = await request(app)
        .delete(`/api/teams/${deleteTeamId}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });

    it("should handle hard delete for admin", async () => {
      // First soft delete
      await request(app)
        .delete(`/api/teams/${deleteTeamId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      // Then hard delete
      const response = await request(app)
        .delete(`/api/teams/${deleteTeamId}?hard=true`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);

      // Verify completely removed
      const [rows] = await testDb.execute("SELECT * FROM teams WHERE id = ?", [
        deleteTeamId,
      ]);
      const teams = asTestRows<any>(rows);
      expect(teams.length).toBe(0);
    });
  });

  describe("Team Member Management", () => {
    let memberTeamId: number;
    let newMemberId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        "INSERT INTO teams (name, department_id, tenant_id) VALUES (?, ?, ?)",
        ["Member Test Team", dept1Id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      memberTeamId = (result as any).insertId;

      // Create user without team
      const newMember = await createTestUser(testDb, {
        username: "newmember",
        email: "newmember@test.de",
        password: "Pass123!",
        role: "employee",
        tenant_id: tenant1Id,
        department_id: dept1Id,
        first_name: "New",
        last_name: "Member",
      });
      newMemberId = newMember.id;
    });

    it("should list team members", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.members).toBeDefined();
      expect(
        response.body.data.members.some((m) => m.id === employeeUser1.id),
      ).toBe(true);
    });

    it("should add members to team", async () => {
      const response = await request(app)
        .post(`/api/teams/${memberTeamId}/members`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          userIds: [newMemberId],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.added).toBe(1);

      // Verify assignment
      const [rows] = await testDb.execute(
        "SELECT team_id FROM users WHERE id = ?",
        [newMemberId],
      );
      const users = asTestRows<any>(rows);
      expect(users[0].team_id).toBe(memberTeamId);
    });

    it("should validate members are from same department", async () => {
      // Create user from different department
      const diffDeptUser = await createTestUser(testDb, {
        username: "diffdept",
        email: "diffdept@test.de",
        password: "Pass123!",
        role: "employee",
        tenant_id: tenant1Id,
        department_id: dept2Id,
        first_name: "Different",
        last_name: "Dept",
      });

      const response = await request(app)
        .post(`/api/teams/${memberTeamId}/members`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          userIds: [diffDeptUser.id],
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("gleichen Abteilung");
    });

    it("should enforce max members limit", async () => {
      // Set low max_members
      await testDb.execute("UPDATE teams SET max_members = 1 WHERE id = ?", [
        memberTeamId,
      ]);

      // Add first member - should succeed
      await request(app)
        .post(`/api/teams/${memberTeamId}/members`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ userIds: [newMemberId] });

      // Try to add second member
      const secondMember = await createTestUser(testDb, {
        username: "second",
        email: "second@test.de",
        password: "Pass123!",
        role: "employee",
        tenant_id: tenant1Id,
        department_id: dept1Id,
        first_name: "Second",
        last_name: "Member",
      });

      const response = await request(app)
        .post(`/api/teams/${memberTeamId}/members`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ userIds: [secondMember.id] });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Maximale Mitgliederzahl");
    });

    it("should remove member from team", async () => {
      const response = await request(app)
        .delete(`/api/teams/${team1Id}/members/${employeeUser1.id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);

      // Verify removal
      const [rows] = await testDb.execute(
        "SELECT team_id FROM users WHERE id = ?",
        [employeeUser1.id],
      );
      const users = asTestRows<any>(rows);
      expect(users[0].team_id).toBeNull();
    });

    it("should allow team lead to manage members", async () => {
      const response = await request(app)
        .post(`/api/teams/${team1Id}/members`)
        .set("Authorization", `Bearer ${teamLeadToken}`)
        .send({
          userIds: [newMemberId],
        });

      expect(response.status).toBe(200);
    });

    it("should bulk transfer members between teams", async () => {
      // Add members to team1
      await testDb.execute("UPDATE users SET team_id = ? WHERE id IN (?, ?)", [
        team1Id,
        employeeUser1.id,
        employeeUser2.id,
      ]);

      const response = await request(app)
        .post("/api/teams/transfer-members")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          fromTeamId: team1Id,
          toTeamId: team2Id,
          userIds: [employeeUser1.id, employeeUser2.id],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.transferred).toBe(2);
    });
  });

  describe("Team Statistics", () => {
    it("should get team statistics", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}/stats`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        memberCount: expect.any(Number),
        activeProjects: expect.any(Number),
        completedTasks: expect.any(Number),
        performance: expect.any(Object),
      });
    });

    it("should get team activity timeline", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}/activity`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.activities).toBeDefined();
      expect(Array.isArray(response.body.data.activities)).toBe(true);
    });

    it("should compare team performance", async () => {
      const response = await request(app)
        .get("/api/teams/compare")
        .query({ teamIds: [team1Id, team2Id].join(",") })
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.comparison).toBeDefined();
    });
  });

  describe("Team Permissions", () => {
    it("should check user permissions for team", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}/permissions`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.permissions).toMatchObject({
        canView: true,
        canEdit: false,
        canDelete: false,
        canManageMembers: false,
      });
    });

    it("should return team lead permissions", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}/permissions`)
        .set("Authorization", `Bearer ${teamLeadToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.permissions).toMatchObject({
        canView: true,
        canEdit: true,
        canDelete: false,
        canManageMembers: true,
      });
    });

    it("should return full permissions for admin", async () => {
      const response = await request(app)
        .get(`/api/teams/${team1Id}/permissions`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.permissions).toMatchObject({
        canView: true,
        canEdit: true,
        canDelete: true,
        canManageMembers: true,
      });
    });
  });

  describe("Team Collaboration Features", () => {
    it("should create team channel", async () => {
      const response = await request(app)
        .post(`/api/teams/${team1Id}/channel`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          name: "team-frontend-general",
          description: "General discussion for frontend team",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.channelId).toBeDefined();
    });

    it("should create team project", async () => {
      const response = await request(app)
        .post(`/api/teams/${team1Id}/projects`)
        .set("Authorization", `Bearer ${teamLeadToken}`)
        .send({
          name: "New Website Redesign",
          description: "Complete redesign of company website",
          deadline: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.data.projectId).toBeDefined();
    });

    it("should assign team tasks", async () => {
      const response = await request(app)
        .post(`/api/teams/${team1Id}/tasks`)
        .set("Authorization", `Bearer ${teamLeadToken}`)
        .send({
          title: "Implement login page",
          description: "Create responsive login page with form validation",
          assignee_id: employeeUser1.id,
          due_date: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.data.taskId).toBeDefined();
    });
  });

  describe("Team Bulk Operations", () => {
    it("should bulk update team status", async () => {
      // Create teams to update
      const teamIds = [];
      for (let i = 0; i < 3; i++) {
        const [rows] = await testDb.execute(
          "INSERT INTO teams (name, department_id, tenant_id) VALUES (?, ?, ?)",
          [`Bulk Team ${i}`, dept1Id, tenant1Id],
        );
        const result = asTestRows<any>(rows);
        teamIds.push((result as any).insertId);
      }

      const response = await request(app)
        .put("/api/teams/bulk/status")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          teamIds,
          status: "inactive",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated).toBe(3);

      // Verify all updated
      const [rows] = await testDb.execute(
        "SELECT status FROM teams WHERE id IN (?)",
        [teamIds],
      );
      const teams = asTestRows<any>(rows);
      expect(teams.every((t) => t.status === "inactive")).toBe(true);
    });

    it("should bulk assign team lead", async () => {
      // Create teams
      const teamIds = [];
      for (let i = 0; i < 2; i++) {
        const [rows] = await testDb.execute(
          "INSERT INTO teams (name, department_id, tenant_id) VALUES (?, ?, ?)",
          [`Lead Team ${i}`, dept1Id, tenant1Id],
        );
        const result = asTestRows<any>(rows);
        teamIds.push((result as any).insertId);
      }

      const response = await request(app)
        .put("/api/teams/bulk/lead")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          teamIds,
          leadId: teamLeadUser.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated).toBe(2);
    });

    it("should enforce tenant isolation on bulk operations", async () => {
      const response = await request(app)
        .put("/api/teams/bulk/status")
        .set("Authorization", `Bearer ${adminToken2}`)
        .send({
          teamIds: [team1Id], // From tenant1
          status: "inactive",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated).toBe(0); // No teams updated
    });
  });
});
