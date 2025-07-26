/**
 * API Tests for Calendar v2 Management Endpoints
 * Tests calendar CRUD operations, attendees, and API v2 standards
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
  // createTestDepartment,  // Not used to avoid foreign key issues
  // createTestTeam,       // Not used to avoid foreign key issues
} from "../mocks/database.js";

describe("Calendar v2 API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  // let dept1Id: number;  // Not used to avoid foreign key issues
  // let team1Id: number;  // Not used to avoid foreign key issues
  let adminTokenV2: string;
  let employeeTokenV2: string;
  let employee2TokenV2: string;
  let adminUser: any;
  let employeeUser: any;
  let employee2User: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-calendar-v2-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "calendarv2test1",
      "Calendar v2 Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "calendarv2test2",
      "Calendar v2 Test Company 2",
    );

    // Skip department and team creation to avoid foreign key issues
    // dept1Id = await createTestDepartment(testDb, tenant1Id, "Engineering");
    // team1Id = await createTestTeam(testDb, tenant1Id, dept1Id, "Frontend Team");

    // Create test users WITHOUT department_id to avoid foreign key issues
    adminUser = await createTestUser(testDb, {
      username: "admin.calv2@test.com",
      email: "admin.calv2@test.com",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "CalV2Test",
    });

    employeeUser = await createTestUser(testDb, {
      username: "employee.calv2@test.com",
      email: "employee.calv2@test.com",
      password: "EmployeePass123!",
      role: "employee",
      tenant_id: tenant1Id,
      first_name: "Employee",
      last_name: "CalV2Test",
    });

    // Create second employee for attendee tests
    employee2User = await createTestUser(testDb, {
      username: "employee2.calv2@test.com",
      email: "employee2.calv2@test.com",
      password: "Employee2Pass123!",
      role: "employee",
      tenant_id: tenant1Id,
      first_name: "Employee2",
      last_name: "CalV2Test",
    });

    // Get v2 auth tokens - use actual emails returned by createTestUser
    const adminLoginRes = await request(app).post("/api/v2/auth/login").send({
      email: adminUser.email,
      password: "AdminPass123!",
    });

    if (!adminLoginRes.body.success) {
      console.error("Admin login failed:", adminLoginRes.body);
      console.error("Tried to login with email:", adminUser.email);
      throw new Error("Failed to login admin user");
    }

    adminTokenV2 = adminLoginRes.body.data.accessToken;

    const employeeLoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employeeUser.email,
        password: "EmployeePass123!",
      });

    if (!employeeLoginRes.body.success) {
      console.error("Employee login failed:", employeeLoginRes.body);
      console.error("Tried to login with email:", employeeUser.email);
      throw new Error("Failed to login employee user");
    }

    employeeTokenV2 = employeeLoginRes.body.data.accessToken;

    const employee2LoginRes = await request(app)
      .post("/api/v2/auth/login")
      .send({
        email: employee2User.email,
        password: "Employee2Pass123!",
      });

    if (!employee2LoginRes.body.success) {
      console.error("Employee2 login failed:", employee2LoginRes.body);
      console.error("Tried to login with email:", employee2User.email);
      throw new Error("Failed to login employee2 user");
    }

    employee2TokenV2 = employee2LoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clean up calendar events between tests
    await testDb.execute(
      "DELETE FROM calendar_attendees WHERE event_id IN (SELECT id FROM calendar_events WHERE tenant_id IN (?, ?))",
      [tenant1Id, tenant2Id],
    );
    await testDb.execute(
      "DELETE FROM calendar_events WHERE tenant_id IN (?, ?)",
      [tenant1Id, tenant2Id],
    );
  });

  describe("Response Format Validation", () => {
    it("should return standardized success response format", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/events")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("meta");
      expect(response.body.meta).toHaveProperty("timestamp");
      expect(response.body.data).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("pagination");
    });

    it("should return standardized error response format", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/events")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code");
      expect(response.body.error).toHaveProperty("message");
      expect(response.body).toHaveProperty("meta");
    });
  });

  describe("GET /api/v2/calendar/events", () => {
    beforeEach(async () => {
      // Create test events
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await testDb.execute(
        `INSERT INTO calendar_events 
         (tenant_id, user_id, title, description, start_date, end_date, type, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenant1Id,
          adminUser.id,
          "Team Meeting",
          "Weekly sync",
          now.toISOString().slice(0, 19).replace("T", " "),
          new Date(now.getTime() + 3600000)
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
          "meeting",
          "confirmed",
        ],
      );

      await testDb.execute(
        `INSERT INTO calendar_events 
         (tenant_id, user_id, title, description, start_date, end_date, type, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenant1Id,
          employeeUser.id,
          "Personal Task",
          "Work on project",
          tomorrow.toISOString().slice(0, 19).replace("T", " "),
          new Date(tomorrow.getTime() + 7200000)
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
          "other",
          "confirmed",
        ],
      );
    });

    it("should list all events for admin", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/events")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(2);
      expect(response.body.data.pagination).toMatchObject({
        currentPage: 1,
        pageSize: 50,
        totalItems: 2,
      });
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/events?page=1&limit=1")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.pagination).toMatchObject({
        currentPage: 1,
        pageSize: 1,
        totalItems: 2,
        hasNext: true,
        hasPrev: false,
      });
    });

    it("should support filtering by status", async () => {
      // Create a cancelled event
      await testDb.execute(
        `INSERT INTO calendar_events 
         (tenant_id, user_id, title, start_date, end_date, type, status) 
         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), ?, ?)`,
        [tenant1Id, adminUser.id, "Cancelled Event", "meeting", "cancelled"],
      );

      const response = await request(app)
        .get("/api/v2/calendar/events?status=cancelled")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].title).toBe("Cancelled Event");
    });

    it("should support search", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/events?search=Team")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].title).toContain("Team");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/v2/calendar/events");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("POST /api/v2/calendar/events", () => {
    it("should create a new event", async () => {
      const eventData = {
        title: "New Project Meeting",
        description: "Kickoff meeting for new project",
        location: "Conference Room A",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        allDay: false,
        orgLevel: "company", // Changed from team to company to avoid needing team ID
        // orgId not needed for company level
        reminderMinutes: 15,
        color: "#3498db",
      };

      const response = await request(app)
        .post("/api/v2/calendar/events")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send(eventData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toMatchObject({
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        orgLevel: eventData.orgLevel,
        reminderMinutes: eventData.reminderMinutes,
        color: eventData.color,
      });
      expect(response.body.data.event.id).toBeDefined();
      expect(response.body.data.event.createdBy).toBe(adminUser.id);
    });

    it("should create event with attendees", async () => {
      const eventData = {
        title: "Team Meeting with Attendees",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        orgLevel: "company", // Changed from team to company to avoid needing team ID
        // orgId not needed for company level
        attendeeIds: [employeeUser.id, employee2User.id],
      };

      const response = await request(app)
        .post("/api/v2/calendar/events")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send(eventData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event.attendees).toHaveLength(3); // Creator + 2 attendees
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/v2/calendar/events")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send({
          description: "Missing required fields",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should validate date order", async () => {
      const response = await request(app)
        .post("/api/v2/calendar/events")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send({
          title: "Invalid Date Event",
          startTime: new Date(Date.now() + 3600000).toISOString(),
          endTime: new Date().toISOString(), // End before start
          orgLevel: "personal",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({
          field: "endTime",
          message: expect.stringContaining("after start time"),
        }),
      );
    });

    it("should require orgId for department/team events", async () => {
      const response = await request(app)
        .post("/api/v2/calendar/events")
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send({
          title: "Department Event",
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          orgLevel: "department",
          // Missing orgId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v2/calendar/events/:id", () => {
    let eventId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO calendar_events 
         (tenant_id, user_id, title, description, start_date, end_date, type, status) 
         VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), ?, ?)`,
        [
          tenant1Id,
          adminUser.id,
          "Test Event",
          "Test Description",
          "meeting",
          "confirmed",
        ],
      );
      eventId = (result as any).insertId;

      // Add attendees - creator should be automatically added with 'accepted' status
      await testDb.execute(
        `INSERT INTO calendar_attendees (event_id, user_id, response_status) 
         VALUES (?, ?, ?), (?, ?, ?)`,
        [
          eventId,
          adminUser.id,
          "accepted",
          eventId,
          employeeUser.id,
          "pending",
        ],
      );
    });

    it("should get event by ID", async () => {
      const response = await request(app)
        .get(`/api/v2/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toMatchObject({
        id: eventId,
        title: "Test Event",
        description: "Test Description",
      });
      expect(response.body.data.event.attendees).toHaveLength(2); // Creator + 1 attendee
    });

    it("should return 404 for non-existent event", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/events/99999")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("should respect access control for employees", async () => {
      // Create private event for admin
      const [result] = await testDb.execute(
        `INSERT INTO calendar_events 
         (tenant_id, user_id, title, start_date, end_date, type, status) 
         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), ?, ?)`,
        [tenant1Id, adminUser.id, "Private Event", "other", "confirmed"],
      );
      const privateEventId = (result as any).insertId;

      const response = await request(app)
        .get(`/api/v2/calendar/events/${privateEventId}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      // Employee should not see admin's personal event
      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/v2/calendar/events/:id", () => {
    let eventId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO calendar_events 
         (tenant_id, user_id, title, description, start_date, end_date, type, status) 
         VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), ?, ?)`,
        [
          tenant1Id,
          employeeUser.id,
          "Original Title",
          "Original Description",
          "other",
          "confirmed",
        ],
      );
      eventId = (result as any).insertId;
    });

    it("should update event (owner)", async () => {
      const updateData = {
        title: "Updated Title",
        description: "Updated Description",
        location: "New Location",
        reminderMinutes: 30,
      };

      const response = await request(app)
        .put(`/api/v2/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toMatchObject({
        id: eventId,
        title: "Updated Title",
        description: "Updated Description",
        location: "New Location",
        reminderMinutes: 30,
      });
    });

    it("should update event (admin)", async () => {
      const response = await request(app)
        .put(`/api/v2/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send({ title: "Admin Updated" });

      expect(response.status).toBe(200);
      expect(response.body.data.event.title).toBe("Admin Updated");
    });

    it("should not allow non-owner employee to update", async () => {
      const response = await request(app)
        .put(`/api/v2/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${employee2TokenV2}`)
        .send({ title: "Unauthorized Update" });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should validate date updates", async () => {
      const response = await request(app)
        .put(`/api/v2/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .send({
          startTime: new Date(Date.now() + 3600000).toISOString(),
          endTime: new Date().toISOString(), // End before start
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("DELETE /api/v2/calendar/events/:id", () => {
    let eventId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO calendar_events 
         (tenant_id, user_id, title, start_date, end_date, type, status) 
         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), ?, ?)`,
        [tenant1Id, employeeUser.id, "Event to Delete", "other", "confirmed"],
      );
      eventId = (result as any).insertId;
    });

    it("should delete event (owner)", async () => {
      const response = await request(app)
        .delete(`/api/v2/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion
      const checkResponse = await request(app)
        .get(`/api/v2/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);
      expect(checkResponse.status).toBe(404);
    });

    it("should delete event (admin)", async () => {
      const response = await request(app)
        .delete(`/api/v2/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should not allow non-owner employee to delete", async () => {
      const response = await request(app)
        .delete(`/api/v2/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${employee2TokenV2}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("PUT /api/v2/calendar/events/:id/attendees/response", () => {
    let eventId: number;

    beforeEach(async () => {
      const [result] = await testDb.execute(
        `INSERT INTO calendar_events 
         (tenant_id, user_id, title, start_date, end_date, type, status) 
         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), ?, ?)`,
        [
          tenant1Id,
          adminUser.id,
          "Meeting with Attendees",
          "meeting",
          "confirmed",
        ],
      );
      eventId = (result as any).insertId;

      // Add employees as attendees
      await testDb.execute(
        `INSERT INTO calendar_attendees (event_id, user_id, response_status) 
         VALUES (?, ?, ?), (?, ?, ?)`,
        [
          eventId,
          employeeUser.id,
          "pending",
          eventId,
          employee2User.id,
          "pending",
        ],
      );
    });

    it("should update attendee response", async () => {
      const response = await request(app)
        .put(`/api/v2/calendar/events/${eventId}/attendees/response`)
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .send({ response: "accepted" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify response was updated
      const eventResponse = await request(app)
        .get(`/api/v2/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${employeeTokenV2}`);

      const attendee = eventResponse.body.data.event.attendees.find(
        (a: any) => a.userId === employeeUser.id,
      );
      expect(attendee.responseStatus).toBe("accepted");
    });

    it("should validate response values", async () => {
      const response = await request(app)
        .put(`/api/v2/calendar/events/${eventId}/attendees/response`)
        .set("Authorization", `Bearer ${employeeTokenV2}`)
        .send({ response: "invalid" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should add user as attendee if not already", async () => {
      // Create new user not invited
      const newUser = await createTestUser(testDb, {
        username: "new.calv2@test.com",
        email: "new.calv2@test.com",
        password: "NewPass123!",
        role: "employee",
        tenant_id: tenant1Id,
        first_name: "New",
        last_name: "User",
        // department_id removed to avoid foreign key issues
      });

      const loginRes = await request(app).post("/api/v2/auth/login").send({
        email: newUser.email, // Use the actual email with __AUTOTEST__ prefix
        password: "NewPass123!",
      });
      const newUserToken = loginRes.body.data.accessToken;

      const response = await request(app)
        .put(`/api/v2/calendar/events/${eventId}/attendees/response`)
        .set("Authorization", `Bearer ${newUserToken}`)
        .send({ response: "tentative" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /api/v2/calendar/export", () => {
    beforeEach(async () => {
      // Create test events
      await testDb.execute(
        `INSERT INTO calendar_events 
         (tenant_id, user_id, title, description, location, start_date, end_date, type, status, all_day) 
         VALUES 
         (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), ?, ?, ?),
         (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY), ?, ?, ?)`,
        [
          tenant1Id,
          adminUser.id,
          "Meeting 1",
          "Description 1",
          "Room A",
          "meeting",
          "confirmed",
          0,
          tenant1Id,
          adminUser.id,
          "All Day Event",
          "Full day",
          null,
          "other",
          "confirmed",
          1,
        ],
      );
    });

    it("should export events as ICS", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/export?format=ics")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe(
        "text/calendar; charset=utf-8",
      );
      expect(response.headers["content-disposition"]).toContain("calendar.ics");
      expect(response.text).toContain("BEGIN:VCALENDAR");
      expect(response.text).toContain("BEGIN:VEVENT");
      expect(response.text).toContain("Meeting 1");
    });

    it("should export events as CSV", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/export?format=csv")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(response.headers["content-disposition"]).toContain("calendar.csv");
      expect(response.text).toContain("Title,Description,Location");
      expect(response.text).toContain("Meeting 1");
    });

    it("should validate format parameter", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/export?format=invalid")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should require format parameter", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/export")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("Multi-Tenant Isolation", () => {
    let tenant2EventId: number;

    beforeEach(async () => {
      // Create event in tenant2
      const tenant2Admin = await createTestUser(testDb, {
        username: "admin.tenant2@test.com",
        email: "admin.tenant2@test.com",
        password: "AdminT2Pass123!",
        role: "admin",
        tenant_id: tenant2Id,
        first_name: "Admin",
        last_name: "Tenant2",
      });

      const [result] = await testDb.execute(
        `INSERT INTO calendar_events 
         (tenant_id, user_id, title, start_date, end_date, type, status) 
         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), ?, ?)`,
        [tenant2Id, tenant2Admin.id, "Tenant 2 Event", "meeting", "confirmed"],
      );
      tenant2EventId = (result as any).insertId;
    });

    it("should not show events from other tenants", async () => {
      const response = await request(app)
        .get("/api/v2/calendar/events")
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(200);
      const eventTitles = response.body.data.data.map((e: any) => e.title);
      expect(eventTitles).not.toContain("Tenant 2 Event");
    });

    it("should not access specific event from other tenant", async () => {
      const response = await request(app)
        .get(`/api/v2/calendar/events/${tenant2EventId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(404);
    });

    it("should not update event from other tenant", async () => {
      const response = await request(app)
        .put(`/api/v2/calendar/events/${tenant2EventId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`)
        .send({ title: "Hacked Title" });

      expect(response.status).toBe(404);
    });

    it("should not delete event from other tenant", async () => {
      const response = await request(app)
        .delete(`/api/v2/calendar/events/${tenant2EventId}`)
        .set("Authorization", `Bearer ${adminTokenV2}`);

      expect(response.status).toBe(404);
    });
  });
});
