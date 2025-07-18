/**
 * API Tests for Calendar Endpoints
 * Tests event CRUD operations, recurring events, and multi-tenant isolation
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

describe("Calendar API Endpoints", () => {
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
  let adminUser1: any;
  let employeeUser1: any;
  let employeeUser2: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    process.env.JWT_SECRET = "test-secret-key-for-calendar-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "caltest1",
      "Calendar Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "caltest2",
      "Calendar Test Company 2",
    );

    // Create departments and teams
    dept1Id = await createTestDepartment(testDb, tenant1Id, "Engineering");
    dept2Id = await createTestDepartment(testDb, tenant1Id, "HR");
    team1Id = await createTestTeam(
      testDb,
      tenant1Id,
      dept1Id,
      "Engineering Team A",
    );

    // Create test users
    adminUser1 = await createTestUser(testDb, {
      username: "caladmin1",
      email: "admin1@caltest1.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "One",
    });

    await createTestUser(testDb, {
      username: "caladmin2",
      email: "admin2@caltest2.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant2Id,
      first_name: "Admin",
      last_name: "Two",
    });

    employeeUser1 = await createTestUser(testDb, {
      username: "calemployee1",
      email: "employee1@caltest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Employee",
      last_name: "One",
    });

    employeeUser2 = await createTestUser(testDb, {
      username: "calemployee2",
      email: "employee2@caltest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept2Id,
      first_name: "Employee",
      last_name: "Two",
    });

    // Get auth tokens
    adminToken1 = await getAuthToken(app, "caladmin1", "AdminPass123!");
    adminToken2 = await getAuthToken(app, "caladmin2", "AdminPass123!");
    employeeToken1 = await getAuthToken(app, "calemployee1", "EmpPass123!");
    employeeToken2 = await getAuthToken(app, "calemployee2", "EmpPass123!");
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear calendar entries before each test
    await testDb.execute("DELETE FROM calendar_events WHERE tenant_id > 1");
    await testDb.execute(
      "DELETE FROM calendar_event_participants WHERE tenant_id > 1",
    );
    await testDb.execute(
      "DELETE FROM calendar_recurring_patterns WHERE tenant_id > 1",
    );
  });

  describe("POST /api/calendar/events", () => {
    const validEventData = {
      title: "Team Meeting",
      description: "Weekly team sync meeting",
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      location: "Conference Room A",
      visibility_scope: "company",
      target_id: null,
      is_all_day: false,
      reminder_minutes: 15,
      color: "#2196F3",
    };

    it("should create calendar event for admin", async () => {
      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(validEventData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich erstellt"),
      });
      expect(response.body.data.eventId).toBeDefined();

      // Verify event was created
      const [rows] = await testDb.execute(
        "SELECT * FROM calendar_events WHERE id = ?",
        [response.body.data.eventId],
      );
      const events = asTestRows<any>(rows);
      expect(events[0]).toMatchObject({
        title: validEventData.title,
        description: validEventData.description,
        visibility_scope: validEventData.visibility_scope,
        tenant_id: tenant1Id,
        created_by: adminUser1.id,
      });
    });

    it("should create all-day event", async () => {
      const allDayEvent = {
        ...validEventData,
        is_all_day: true,
        start_time: new Date("2025-07-20").toISOString(),
        end_time: new Date("2025-07-20").toISOString(),
      };

      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(allDayEvent);

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT is_all_day FROM calendar_events WHERE id = ?",
        [response.body.data.eventId],
      );
      const events = asTestRows<any>(rows);
      expect(events[0].is_all_day).toBe(1);
    });

    it("should create department-specific event", async () => {
      const deptEvent = {
        ...validEventData,
        visibility_scope: "department",
        target_id: dept1Id,
      };

      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(deptEvent);

      expect(response.status).toBe(201);
    });

    it("should create team-specific event", async () => {
      const teamEvent = {
        ...validEventData,
        visibility_scope: "team",
        target_id: team1Id,
      };

      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(teamEvent);

      expect(response.status).toBe(201);
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          title: "",
          start_time: "invalid-date",
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "title" }),
          expect.objectContaining({ path: "start_time" }),
          expect.objectContaining({ path: "end_time" }),
        ]),
      );
    });

    it("should validate date range", async () => {
      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validEventData,
          end_time: validEventData.start_time, // End before start
          start_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Endzeit");
    });

    it("should create recurring event", async () => {
      const recurringEvent = {
        ...validEventData,
        is_recurring: true,
        recurrence_pattern: {
          frequency: "weekly",
          interval: 1,
          days_of_week: ["MO", "WE", "FR"],
          end_date: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      };

      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(recurringEvent);

      expect(response.status).toBe(201);

      // Verify recurring pattern was created
      const [rows] = await testDb.execute(
        "SELECT * FROM calendar_recurring_patterns WHERE event_id = ?",
        [response.body.data.eventId],
      );
      const patterns = asTestRows<any>(rows);
      expect(patterns[0]).toMatchObject({
        frequency: "weekly",
        interval: 1,
        days_of_week: "MO,WE,FR",
      });
    });

    it("should add participants to event", async () => {
      const eventWithParticipants = {
        ...validEventData,
        participants: [employeeUser1.id, employeeUser2.id],
      };

      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(eventWithParticipants);

      expect(response.status).toBe(201);

      // Verify participants were added
      const [rows] = await testDb.execute(
        "SELECT * FROM calendar_event_participants WHERE event_id = ?",
        [response.body.data.eventId],
      );
      const participants = asTestRows<any>(rows);
      expect(participants.length).toBe(2);
    });

    it("should set tenant_id from token", async () => {
      const response = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validEventData,
          tenant_id: 999, // Should be ignored
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT tenant_id FROM calendar_events WHERE id = ?",
        [response.body.data.eventId],
      );
      const events = asTestRows<any>(rows);
      expect(events[0].tenant_id).toBe(tenant1Id);
    });
  });

  describe("GET /api/calendar/events", () => {
    let companyEventId: number;
    let dept1EventId: number;
    let dept2EventId: number;
    let team1EventId: number;

    beforeEach(async () => {
      // Create test events with different visibility scopes
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, description, start_time, end_time, visibility_scope, target_id, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Company Event",
          "All hands meeting",
          tomorrow,
          dayAfter,
          "company",
          null,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result1 = asTestRows<any>(rows);
      companyEventId = (result1 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, target_id, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Engineering Sprint",
          tomorrow,
          dayAfter,
          "department",
          dept1Id,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result2 = asTestRows<any>(rows);
      dept1EventId = (result2 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, target_id, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "HR Training",
          tomorrow,
          dayAfter,
          "department",
          dept2Id,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result3 = asTestRows<any>(rows);
      dept2EventId = (result3 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, target_id, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Team Standup",
          tomorrow,
          dayAfter,
          "team",
          team1Id,
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result4 = asTestRows<any>(rows);
      team1EventId = (result4 as any).insertId;
    });

    it("should list events based on user visibility", async () => {
      // Admin should see all events
      const adminResponse = await request(app)
        .get("/api/calendar/events")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.data.events.length).toBe(4);

      // Employee1 (dept1, team1) should see company + dept1 + team1
      const emp1Response = await request(app)
        .get("/api/calendar/events")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(emp1Response.status).toBe(200);
      expect(emp1Response.body.data.events.length).toBe(3);
      const emp1Ids = emp1Response.body.data.events.map((e) => e.id);
      expect(emp1Ids).toContain(companyEventId);
      expect(emp1Ids).toContain(dept1EventId);
      expect(emp1Ids).toContain(team1EventId);
      expect(emp1Ids).not.toContain(dept2EventId);

      // Employee2 (dept2) should see company + dept2
      const emp2Response = await request(app)
        .get("/api/calendar/events")
        .set("Authorization", `Bearer ${employeeToken2}`);

      expect(emp2Response.status).toBe(200);
      expect(emp2Response.body.data.events.length).toBe(2);
      const emp2Ids = emp2Response.body.data.events.map((e) => e.id);
      expect(emp2Ids).toContain(companyEventId);
      expect(emp2Ids).toContain(dept2EventId);
    });

    it("should filter by date range", async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const response = await request(app)
        .get(`/api/calendar/events?start=${startDate}&end=${endDate}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.events.length).toBe(4);
    });

    it("should filter by view type", async () => {
      // Month view
      const response = await request(app)
        .get("/api/calendar/events?view=month")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.events).toBeDefined();
    });

    it("should include participant info", async () => {
      // Add participant
      await testDb.execute(
        "INSERT INTO calendar_event_participants (event_id, user_id, status, tenant_id) VALUES (?, ?, ?, ?)",
        [companyEventId, employeeUser1.id, "accepted", tenant1Id],
      );

      const response = await request(app)
        .get(`/api/calendar/events?include=participants`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const companyEvent = response.body.data.events.find(
        (e) => e.id === companyEventId,
      );
      expect(companyEvent.participants).toBeDefined();
      expect(companyEvent.participants.length).toBeGreaterThan(0);
    });

    it("should enforce tenant isolation", async () => {
      // Create event in tenant2
      await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        ["Tenant2 Event", new Date(), new Date(), "company", 1, tenant2Id],
      );

      const response = await request(app)
        .get("/api/calendar/events")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      const events = response.body.data.events;
      expect(events.every((e) => e.tenant_id === tenant1Id)).toBe(true);
    });

    it("should handle recurring events", async () => {
      // Create recurring event
      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, created_by, tenant_id, is_recurring) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Daily Standup",
          new Date(),
          new Date(),
          "company",
          adminUser1.id,
          tenant1Id,
          1,
        ],
      );
      const result = asTestRows<any>(rows);
      const recurringId = (result as any).insertId;

      await testDb.execute(
        `INSERT INTO calendar_recurring_patterns 
        (event_id, frequency, interval, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [recurringId, "daily", 1, tenant1Id],
      );

      const response = await request(app)
        .get("/api/calendar/events?expand_recurring=true")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      // Should include expanded recurring instances
    });
  });

  describe("GET /api/calendar/events/:id", () => {
    let eventId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, description, start_time, end_time, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Test Event",
          "Test description",
          new Date(),
          new Date(),
          "company",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<any>(rows);
      eventId = (result as any).insertId;
    });

    it("should get event details", async () => {
      const response = await request(app)
        .get(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: eventId,
        title: "Test Event",
        description: "Test description",
        visibility_scope: "company",
        creator: expect.objectContaining({
          id: adminUser1.id,
          first_name: "Admin",
          last_name: "One",
        }),
      });
    });

    it("should include participants if requested", async () => {
      // Add participants
      await testDb.execute(
        "INSERT INTO calendar_event_participants (event_id, user_id, status, tenant_id) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
        [
          eventId,
          employeeUser1.id,
          "accepted",
          tenant1Id,
          eventId,
          employeeUser2.id,
          "pending",
          tenant1Id,
        ],
      );

      const response = await request(app)
        .get(`/api/calendar/events/${eventId}?include=participants`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.participants).toHaveLength(2);
      expect(response.body.data.participants[0]).toMatchObject({
        user_id: employeeUser1.id,
        status: "accepted",
      });
    });

    it("should return 404 for non-existent event", async () => {
      const response = await request(app)
        .get("/api/calendar/events/99999")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(404);
    });

    it("should enforce visibility rules", async () => {
      // Create department-specific event
      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, target_id, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Dept2 Only",
          new Date(),
          new Date(),
          "department",
          dept2Id,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<any>(rows);
      const deptEventId = (result as any).insertId;

      // Employee1 (dept1) should not see dept2 event
      const response = await request(app)
        .get(`/api/calendar/events/${deptEventId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(404);
    });

    it("should enforce tenant isolation", async () => {
      const response = await request(app)
        .get(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });
  });

  describe("PUT /api/calendar/events/:id", () => {
    let eventId: number;

    beforeEach(async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, description, start_time, end_time, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Original Event",
          "Original description",
          tomorrow,
          tomorrow,
          "company",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<any>(rows);
      eventId = (result as any).insertId;
    });

    it("should update event for creator", async () => {
      const updateData = {
        title: "Updated Event",
        description: "Updated description",
        location: "New Location",
      };

      const response = await request(app)
        .put(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("aktualisiert");

      // Verify update
      const [rows] = await testDb.execute(
        "SELECT title, description, location FROM calendar_events WHERE id = ?",
        [eventId],
      );
      const events = asTestRows<any>(rows);
      expect(events[0]).toMatchObject(updateData);
    });

    it("should update event time", async () => {
      const newStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const newEnd = new Date(Date.now() + 49 * 60 * 60 * 1000);

      const response = await request(app)
        .put(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        });

      expect(response.status).toBe(200);
    });

    it("should prevent non-creator from updating", async () => {
      const response = await request(app)
        .put(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ title: "Hacked" });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Nur der Ersteller");
    });

    it("should allow admin to update any event", async () => {
      // Create event by employee
      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Employee Event",
          new Date(),
          new Date(),
          "company",
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<any>(rows);
      const empEventId = (result as any).insertId;

      const response = await request(app)
        .put(`/api/calendar/events/${empEventId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ title: "Admin Updated" });

      expect(response.status).toBe(200);
    });

    it("should validate update data", async () => {
      const response = await request(app)
        .put(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          title: "", // Empty title
          start_time: "invalid-date",
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it("should update recurring pattern", async () => {
      // Create recurring event
      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, created_by, tenant_id, is_recurring) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Recurring Event",
          new Date(),
          new Date(),
          "company",
          adminUser1.id,
          tenant1Id,
          1,
        ],
      );
      const result = asTestRows<any>(rows);
      const recurringId = (result as any).insertId;

      await testDb.execute(
        `INSERT INTO calendar_recurring_patterns 
        (event_id, frequency, interval, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [recurringId, "weekly", 1, tenant1Id],
      );

      const response = await request(app)
        .put(`/api/calendar/events/${recurringId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          recurrence_pattern: {
            frequency: "daily",
            interval: 2,
          },
        });

      expect(response.status).toBe(200);
    });

    it("should enforce tenant isolation on update", async () => {
      const response = await request(app)
        .put(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken2}`)
        .send({ title: "Cross-tenant update" });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/calendar/events/:id", () => {
    let eventId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "To Delete",
          new Date(),
          new Date(),
          "company",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<any>(rows);
      eventId = (result as any).insertId;
    });

    it("should delete event for creator", async () => {
      const response = await request(app)
        .delete(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("gelöscht");

      // Verify deletion
      const [rows] = await testDb.execute(
        "SELECT * FROM calendar_events WHERE id = ?",
        [eventId],
      );
      const events = asTestRows<any>(rows);
      expect(events.length).toBe(0);
    });

    it("should delete associated participants", async () => {
      // Add participants
      await testDb.execute(
        "INSERT INTO calendar_event_participants (event_id, user_id, tenant_id) VALUES (?, ?, ?)",
        [eventId, employeeUser1.id, tenant1Id],
      );

      await request(app)
        .delete(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      // Verify participants were deleted
      const [rows] = await testDb.execute(
        "SELECT * FROM calendar_event_participants WHERE event_id = ?",
        [eventId],
      );
      const participants = asTestRows<any>(rows);
      expect(participants.length).toBe(0);
    });

    it("should delete recurring pattern", async () => {
      // Create recurring event
      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, created_by, tenant_id, is_recurring) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Recurring",
          new Date(),
          new Date(),
          "company",
          adminUser1.id,
          tenant1Id,
          1,
        ],
      );
      const result = asTestRows<any>(rows);
      const recurringId = (result as any).insertId;

      await testDb.execute(
        `INSERT INTO calendar_recurring_patterns 
        (event_id, frequency, interval, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [recurringId, "daily", 1, tenant1Id],
      );

      await request(app)
        .delete(`/api/calendar/events/${recurringId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      // Verify pattern was deleted
      const [rows] = await testDb.execute(
        "SELECT * FROM calendar_recurring_patterns WHERE event_id = ?",
        [recurringId],
      );
      const patterns = asTestRows<any>(rows);
      expect(patterns.length).toBe(0);
    });

    it("should prevent non-creator from deleting", async () => {
      const response = await request(app)
        .delete(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(403);
    });

    it("should allow admin to delete any event", async () => {
      // Create event by employee
      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Employee Event",
          new Date(),
          new Date(),
          "company",
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<any>(rows);
      const empEventId = (result as any).insertId;

      const response = await request(app)
        .delete(`/api/calendar/events/${empEventId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
    });

    it("should enforce tenant isolation on delete", async () => {
      const response = await request(app)
        .delete(`/api/calendar/events/${eventId}`)
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Event Participation", () => {
    let eventId: number;

    beforeEach(async () => {
      const [rows] = await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Meeting",
          new Date(),
          new Date(),
          "company",
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result = asTestRows<any>(rows);
      eventId = (result as any).insertId;

      // Add employees as participants
      await testDb.execute(
        "INSERT INTO calendar_event_participants (event_id, user_id, status, tenant_id) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
        [
          eventId,
          employeeUser1.id,
          "pending",
          tenant1Id,
          eventId,
          employeeUser2.id,
          "pending",
          tenant1Id,
        ],
      );
    });

    it("should update participation status", async () => {
      const response = await request(app)
        .put(`/api/calendar/events/${eventId}/participation`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ status: "accepted" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("aktualisiert");

      // Verify status update
      const [rows] = await testDb.execute(
        "SELECT status FROM calendar_event_participants WHERE event_id = ? AND user_id = ?",
        [eventId, employeeUser1.id],
      );
      const participants = asTestRows<any>(rows);
      expect(participants[0].status).toBe("accepted");
    });

    it("should handle decline with reason", async () => {
      const response = await request(app)
        .put(`/api/calendar/events/${eventId}/participation`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          status: "declined",
          reason: "Conflict with another meeting",
        });

      expect(response.status).toBe(200);
    });

    it("should only allow participants to update their own status", async () => {
      // Admin not a participant
      const response = await request(app)
        .put(`/api/calendar/events/${eventId}/participation`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({ status: "accepted" });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("kein Teilnehmer");
    });
  });

  describe("GET /api/calendar/availability", () => {
    it("should check user availability", async () => {
      // Create existing events
      const busyTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Existing Meeting",
          busyTime,
          busyTime,
          "company",
          employeeUser1.id,
          tenant1Id,
        ],
      );

      const response = await request(app)
        .get(
          `/api/calendar/availability?users=${employeeUser1.id}&date=${busyTime.toISOString()}`,
        )
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.conflicts).toBeDefined();
    });

    it("should find free slots", async () => {
      const response = await request(app)
        .get(
          `/api/calendar/availability/free-slots?users=${employeeUser1.id},${employeeUser2.id}&duration=60`,
        )
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.freeSlots).toBeDefined();
      expect(Array.isArray(response.body.data.freeSlots)).toBe(true);
    });
  });

  describe("Calendar Export", () => {
    it("should export calendar in iCal format", async () => {
      // Create some events
      await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "Export Test",
          new Date(),
          new Date(),
          "company",
          adminUser1.id,
          tenant1Id,
        ],
      );

      const response = await request(app)
        .get("/api/calendar/export?format=ical")
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/calendar");
      expect(response.text).toContain("BEGIN:VCALENDAR");
      expect(response.text).toContain("Export Test");
    });

    it("should respect visibility rules in export", async () => {
      // Create department-specific event
      await testDb.execute(
        `INSERT INTO calendar_events 
        (title, start_time, end_time, visibility_scope, target_id, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "Secret Meeting",
          new Date(),
          new Date(),
          "department",
          dept2Id,
          adminUser1.id,
          tenant1Id,
        ],
      );

      const response = await request(app)
        .get("/api/calendar/export?format=ical")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.text).not.toContain("Secret Meeting");
    });
  });
});
