/**
 * API Tests for Chat Endpoints
 * Tests messaging, channels, WebSocket events, and file attachments
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

describe("Chat API Endpoints", () => {
  let testDb: Pool;
  let tenant1Id: number;
  let tenant2Id: number;
  let dept1Id: number;
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
    process.env.JWT_SECRET = "test-secret-key-for-chat-tests";

    // Create test tenants
    tenant1Id = await createTestTenant(
      testDb,
      "chattest1",
      "Chat Test Company 1",
    );
    tenant2Id = await createTestTenant(
      testDb,
      "chattest2",
      "Chat Test Company 2",
    );

    // Create department and team
    dept1Id = await createTestDepartment(testDb, tenant1Id, "Engineering");
    team1Id = await createTestTeam(testDb, tenant1Id, dept1Id, "Frontend Team");

    // Create test users
    adminUser1 = await createTestUser(testDb, {
      username: "chatadmin1",
      email: "admin1@chattest1.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant1Id,
      first_name: "Admin",
      last_name: "One",
    });

    await createTestUser(testDb, {
      username: "chatadmin2",
      email: "admin2@chattest2.de",
      password: "AdminPass123!",
      role: "admin",
      tenant_id: tenant2Id,
      first_name: "Admin",
      last_name: "Two",
    });

    employeeUser1 = await createTestUser(testDb, {
      username: "chatemployee1",
      email: "employee1@chattest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Employee",
      last_name: "One",
    });

    employeeUser2 = await createTestUser(testDb, {
      username: "chatemployee2",
      email: "employee2@chattest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      team_id: team1Id,
      first_name: "Employee",
      last_name: "Two",
    });

    employeeUser3 = await createTestUser(testDb, {
      username: "chatemployee3",
      email: "employee3@chattest1.de",
      password: "EmpPass123!",
      role: "employee",
      tenant_id: tenant1Id,
      department_id: dept1Id,
      first_name: "Employee",
      last_name: "Three",
    });

    // Get auth tokens
    adminToken1 = await getAuthToken(app, "chatadmin1", "AdminPass123!");
    adminToken2 = await getAuthToken(app, "chatadmin2", "AdminPass123!");
    employeeToken1 = await getAuthToken(app, "chatemployee1", "EmpPass123!");
    employeeToken2 = await getAuthToken(app, "chatemployee2", "EmpPass123!");
    employeeToken3 = await getAuthToken(app, "chatemployee3", "EmpPass123!");
  });

  afterAll(async () => {
    await cleanupTestData();
    await testDb.end();
  });

  beforeEach(async () => {
    // Clear chat data before each test
    await testDb.execute("DELETE FROM chat_messages WHERE tenant_id > 1");
    await testDb.execute("DELETE FROM chat_channels WHERE tenant_id > 1");
    await testDb.execute(
      "DELETE FROM chat_channel_members WHERE tenant_id > 1",
    );
  });

  describe("POST /api/chat/channels", () => {
    const validChannelData = {
      name: "general",
      description: "General discussion channel",
      type: "public",
      visibility_scope: "company",
    };

    it("should create public channel for admin", async () => {
      const response = await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(validChannelData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("erfolgreich erstellt"),
      });
      expect(response.body.data.channelId).toBeDefined();

      // Verify creation
      const [rows] = await testDb.execute(
        "SELECT * FROM chat_channels WHERE id = ?",
        [response.body.data.channelId],
      );
      const channels = asTestRows<any>(rows);
      expect(channels[0]).toMatchObject({
        name: validChannelData.name,
        description: validChannelData.description,
        type: validChannelData.type,
        visibility_scope: validChannelData.visibility_scope,
        tenant_id: tenant1Id,
        created_by: adminUser1.id,
      });
    });

    it("should create private channel with members", async () => {
      const response = await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          name: "project-alpha",
          description: "Private project discussion",
          type: "private",
          members: [employeeUser2.id, employeeUser3.id],
        });

      expect(response.status).toBe(201);

      // Verify members were added
      const [rows] = await testDb.execute(
        "SELECT user_id FROM chat_channel_members WHERE channel_id = ?",
        [response.body.data.channelId],
      );
      const members = asTestRows<any>(rows);
      expect(members.length).toBe(3); // Creator + 2 members
    });

    it("should create direct message channel", async () => {
      const response = await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          type: "direct",
          members: [employeeUser2.id],
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT * FROM chat_channels WHERE id = ?",
        [response.body.data.channelId],
      );
      const channels = asTestRows<any>(rows);
      expect(channels[0].type).toBe("direct");
      expect(channels[0].name).toContain("DM-"); // Auto-generated name
    });

    it("should create department channel", async () => {
      const response = await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          name: "engineering-updates",
          type: "public",
          visibility_scope: "department",
          target_id: dept1Id,
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT * FROM chat_channels WHERE id = ?",
        [response.body.data.channelId],
      );
      const channels = asTestRows<any>(rows);
      expect(channels[0].visibility_scope).toBe("department");
      expect(channels[0].target_id).toBe(dept1Id);
    });

    it("should create team channel", async () => {
      const response = await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          name: "frontend-daily",
          type: "public",
          visibility_scope: "team",
          target_id: team1Id,
        });

      expect(response.status).toBe(201);
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          // Missing name for non-direct channel
          type: "public",
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "name" })]),
      );
    });

    it("should prevent duplicate channel names", async () => {
      // Create first channel
      await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(validChannelData);

      // Try to create duplicate
      const response = await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send(validChannelData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("bereits vorhanden");
    });

    it("should prevent duplicate direct message channels", async () => {
      // Create first DM
      await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          type: "direct",
          members: [employeeUser2.id],
        });

      // Try to create duplicate (same users)
      const response = await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          type: "direct",
          members: [employeeUser2.id],
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("bereits existiert");
    });

    it("should enforce tenant isolation for members", async () => {
      const response = await request(app)
        .post("/api/chat/channels")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          ...validChannelData,
          name: "cross-tenant",
          members: [99999], // User from different tenant
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Ungültige Mitglieder");
    });
  });

  describe("GET /api/chat/channels", () => {
    let publicChannelId: number;
    let privateChannelId: number;
    let dmChannelId: number;
    let deptChannelId: number;

    beforeEach(async () => {
      // Create test channels
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["general", "public", "company", adminUser1.id, tenant1Id],
      );
      const result1 = asTestRows<any>(rows);
      publicChannelId = (result1 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["secret-project", "private", "company", employeeUser1.id, tenant1Id],
      );
      const result2 = asTestRows<any>(rows);
      privateChannelId = (result2 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        [
          `DM-${employeeUser1.id}-${employeeUser2.id}`,
          "direct",
          "company",
          employeeUser1.id,
          tenant1Id,
        ],
      );
      const result3 = asTestRows<any>(rows);
      dmChannelId = (result3 as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, target_id, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "eng-updates",
          "public",
          "department",
          dept1Id,
          adminUser1.id,
          tenant1Id,
        ],
      );
      const result4 = asTestRows<any>(rows);
      deptChannelId = (result4 as any).insertId;

      // Add members to channels
      await testDb.execute(
        "INSERT INTO chat_channel_members (channel_id, user_id, role, tenant_id) VALUES (?, ?, ?, ?)",
        [privateChannelId, employeeUser1.id, "member", tenant1Id],
      );

      await testDb.execute(
        "INSERT INTO chat_channel_members (channel_id, user_id, role, tenant_id) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
        [
          dmChannelId,
          employeeUser1.id,
          "member",
          tenant1Id,
          dmChannelId,
          employeeUser2.id,
          "member",
          tenant1Id,
        ],
      );
    });

    it("should list channels user has access to", async () => {
      const response = await request(app)
        .get("/api/chat/channels")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.channels).toBeDefined();

      const channels = response.body.data.channels;
      // Should see: public channel, private channel (member), DM channel, dept channel
      expect(channels.some((c) => c.id === publicChannelId)).toBe(true);
      expect(channels.some((c) => c.id === privateChannelId)).toBe(true);
      expect(channels.some((c) => c.id === dmChannelId)).toBe(true);
      expect(channels.some((c) => c.id === deptChannelId)).toBe(true);
    });

    it("should filter by channel type", async () => {
      const response = await request(app)
        .get("/api/chat/channels?type=direct")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const channels = response.body.data.channels;
      expect(channels.every((c) => c.type === "direct")).toBe(true);
    });

    it("should include unread counts", async () => {
      // Add unread message
      await testDb.execute(
        `INSERT INTO chat_messages 
        (channel_id, sender_id, content, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [publicChannelId, employeeUser2.id, "Test message", tenant1Id],
      );

      const response = await request(app)
        .get("/api/chat/channels?include=unread")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const publicChannel = response.body.data.channels.find(
        (c) => c.id === publicChannelId,
      );
      expect(publicChannel.unread_count).toBeGreaterThan(0);
    });

    it("should include last message", async () => {
      // Add message
      await testDb.execute(
        `INSERT INTO chat_messages 
        (channel_id, sender_id, content, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [publicChannelId, employeeUser1.id, "Last message", tenant1Id],
      );

      const response = await request(app)
        .get("/api/chat/channels?include=last_message")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      const publicChannel = response.body.data.channels.find(
        (c) => c.id === publicChannelId,
      );
      expect(publicChannel.last_message).toMatchObject({
        content: "Last message",
        sender_id: employeeUser1.id,
      });
    });

    it("should not show private channels user is not member of", async () => {
      const response = await request(app)
        .get("/api/chat/channels")
        .set("Authorization", `Bearer ${employeeToken2}`);

      expect(response.status).toBe(200);
      const channels = response.body.data.channels;
      // Employee2 should not see the private channel
      expect(channels.some((c) => c.id === privateChannelId)).toBe(false);
    });

    it("should enforce visibility scopes", async () => {
      // Employee3 is not in team1
      const response = await request(app)
        .get("/api/chat/channels")
        .set("Authorization", `Bearer ${employeeToken3}`);

      expect(response.status).toBe(200);
      const channels = response.body.data.channels;
      // Should see company and department channels, but not team-specific if created
    });

    it("should enforce tenant isolation", async () => {
      const response = await request(app)
        .get("/api/chat/channels")
        .set("Authorization", `Bearer ${adminToken2}`);

      expect(response.status).toBe(200);
      const channels = response.body.data.channels;
      // Should not see any channels from tenant1
      expect(channels.every((c) => c.tenant_id !== tenant1Id)).toBe(true);
    });
  });

  describe("POST /api/chat/messages", () => {
    let channelId: number;

    beforeEach(async () => {
      // Create a channel
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["test-channel", "public", "company", adminUser1.id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      channelId = (result as any).insertId;
    });

    it("should send message to channel", async () => {
      const messageData = {
        channel_id: channelId,
        content: "Hello, this is a test message!",
        type: "text",
      };

      const response = await request(app)
        .post("/api/chat/messages")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send(messageData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining("gesendet"),
      });
      expect(response.body.data.messageId).toBeDefined();

      // Verify message was saved
      const [rows] = await testDb.execute(
        "SELECT * FROM chat_messages WHERE id = ?",
        [response.body.data.messageId],
      );
      const messages = asTestRows<any>(rows);
      expect(messages[0]).toMatchObject({
        channel_id: channelId,
        sender_id: employeeUser1.id,
        content: messageData.content,
        type: "text",
        tenant_id: tenant1Id,
      });
    });

    it("should send message with mentions", async () => {
      const response = await request(app)
        .post("/api/chat/messages")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          channel_id: channelId,
          content: `Hey @${employeeUser2.username}, check this out!`,
          mentions: [employeeUser2.id],
        });

      expect(response.status).toBe(201);

      // Could check if notifications were created for mentioned users
    });

    it("should send message with attachments", async () => {
      const response = await request(app)
        .post("/api/chat/messages")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          channel_id: channelId,
          content: "Here's the document",
          type: "file",
          attachments: [
            {
              filename: "report.pdf",
              size: 1024000,
              mime_type: "application/pdf",
              url: "/uploads/chat/report.pdf",
            },
          ],
        });

      expect(response.status).toBe(201);
    });

    it("should validate message content", async () => {
      const response = await request(app)
        .post("/api/chat/messages")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          channel_id: channelId,
          content: "", // Empty content
          type: "text",
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "content" })]),
      );
    });

    it("should validate channel access", async () => {
      // Create private channel without employee2
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["private-channel", "private", "company", employeeUser1.id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      const privateChannelId = (result as any).insertId;

      // Add only employee1 as member
      await testDb.execute(
        "INSERT INTO chat_channel_members (channel_id, user_id, role, tenant_id) VALUES (?, ?, ?, ?)",
        [privateChannelId, employeeUser1.id, "member", tenant1Id],
      );

      const response = await request(app)
        .post("/api/chat/messages")
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({
          channel_id: privateChannelId,
          content: "I shouldn't be able to send this",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Zugriff verweigert");
    });

    it("should handle reply to message", async () => {
      // Create original message
      const [rows] = await testDb.execute(
        `INSERT INTO chat_messages 
        (channel_id, sender_id, content, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [channelId, employeeUser1.id, "Original message", tenant1Id],
      );
      const result = asTestRows<any>(rows);
      const originalMessageId = (result as any).insertId;

      const response = await request(app)
        .post("/api/chat/messages")
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({
          channel_id: channelId,
          content: "This is a reply",
          reply_to_id: originalMessageId,
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT reply_to_id FROM chat_messages WHERE id = ?",
        [response.body.data.messageId],
      );
      const messages = asTestRows<any>(rows);
      expect(messages[0].reply_to_id).toBe(originalMessageId);
    });

    it("should enforce message length limit", async () => {
      const longMessage = "A".repeat(5001); // Assuming 5000 char limit

      const response = await request(app)
        .post("/api/chat/messages")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          channel_id: channelId,
          content: longMessage,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Nachricht zu lang");
    });

    it("should send system message", async () => {
      const response = await request(app)
        .post("/api/chat/messages")
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          channel_id: channelId,
          content: "Channel rules have been updated",
          type: "system",
        });

      expect(response.status).toBe(201);

      const [rows] = await testDb.execute(
        "SELECT type FROM chat_messages WHERE id = ?",
        [response.body.data.messageId],
      );
      const messages = asTestRows<any>(rows);
      expect(messages[0].type).toBe("system");
    });

    it("should enforce tenant isolation", async () => {
      const response = await request(app)
        .post("/api/chat/messages")
        .set("Authorization", `Bearer ${adminToken2}`)
        .send({
          channel_id: channelId, // Channel from tenant1
          content: "Cross-tenant message",
        });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/chat/messages", () => {
    let channelId: number;
    let messageIds: number[] = [];

    beforeEach(async () => {
      // Create channel
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["message-test", "public", "company", adminUser1.id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      channelId = (result as any).insertId;

      // Create test messages
      for (let i = 0; i < 25; i++) {
        const [rows] = await testDb.execute(
          `INSERT INTO chat_messages 
          (channel_id, sender_id, content, tenant_id, created_at) 
          VALUES (?, ?, ?, ?, ?)`,
          [
            channelId,
            i % 2 === 0 ? employeeUser1.id : employeeUser2.id,
            `Test message ${i}`,
            tenant1Id,
            new Date(Date.now() - (25 - i) * 60000), // Messages spaced 1 minute apart
          ],
        );
        const msgResult = asTestRows<any>(rows);
        messageIds.push((msgResult as any).insertId);
      }
    });

    it("should get messages from channel", async () => {
      const response = await request(app)
        .get(`/api/chat/messages?channel_id=${channelId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.messages).toBeDefined();
      expect(response.body.data.messages.length).toBe(20); // Default limit
      expect(response.body.data.pagination).toMatchObject({
        total: 25,
        page: 1,
        limit: 20,
        hasMore: true,
      });
    });

    it("should paginate messages", async () => {
      const response1 = await request(app)
        .get(`/api/chat/messages?channel_id=${channelId}&page=1&limit=10`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response1.body.data.messages.length).toBe(10);

      const response2 = await request(app)
        .get(`/api/chat/messages?channel_id=${channelId}&page=2&limit=10`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response2.body.data.messages.length).toBe(10);

      // Messages should be different
      expect(response1.body.data.messages[0].id).not.toBe(
        response2.body.data.messages[0].id,
      );
    });

    it("should get messages after specific timestamp", async () => {
      const after = new Date(Date.now() - 15 * 60000); // 15 minutes ago

      const response = await request(app)
        .get(
          `/api/chat/messages?channel_id=${channelId}&after=${after.toISOString()}`,
        )
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.messages.length).toBeLessThan(25);
      expect(
        response.body.data.messages.every(
          (m) => new Date(m.created_at) > after,
        ),
      ).toBe(true);
    });

    it("should get messages before specific timestamp", async () => {
      const before = new Date(Date.now() - 10 * 60000); // 10 minutes ago

      const response = await request(app)
        .get(
          `/api/chat/messages?channel_id=${channelId}&before=${before.toISOString()}`,
        )
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(
        response.body.data.messages.every(
          (m) => new Date(m.created_at) < before,
        ),
      ).toBe(true);
    });

    it("should search messages", async () => {
      // Add searchable message
      await testDb.execute(
        `INSERT INTO chat_messages 
        (channel_id, sender_id, content, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [
          channelId,
          employeeUser1.id,
          "Important project deadline tomorrow",
          tenant1Id,
        ],
      );

      const response = await request(app)
        .get(`/api/chat/messages?channel_id=${channelId}&search=deadline`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(
        response.body.data.messages.some((m) => m.content.includes("deadline")),
      ).toBe(true);
    });

    it("should include sender info", async () => {
      const response = await request(app)
        .get(`/api/chat/messages?channel_id=${channelId}&include=sender`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.messages[0].sender).toMatchObject({
        id: expect.any(Number),
        first_name: expect.any(String),
        last_name: expect.any(String),
        avatar_url: expect.any(String),
      });
    });

    it("should mark messages as read", async () => {
      const response = await request(app)
        .get(`/api/chat/messages?channel_id=${channelId}&mark_read=true`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);

      // Check read receipt was created
      const [rows] = await testDb.execute(
        `SELECT * FROM chat_message_read_receipts 
        WHERE user_id = ? AND channel_id = ?`,
        [employeeUser1.id, channelId],
      );
      const receipts = asTestRows<any>(rows);
      expect(receipts.length).toBeGreaterThan(0);
    });

    it("should enforce channel access", async () => {
      // Create private channel
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["private-messages", "private", "company", employeeUser1.id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      const privateChannelId = (result as any).insertId;

      const response = await request(app)
        .get(`/api/chat/messages?channel_id=${privateChannelId}`)
        .set("Authorization", `Bearer ${employeeToken2}`);

      expect(response.status).toBe(403);
    });

    it("should get pinned messages", async () => {
      // Pin a message
      await testDb.execute(
        "UPDATE chat_messages SET is_pinned = 1 WHERE id = ?",
        [messageIds[0]],
      );

      const response = await request(app)
        .get(`/api/chat/messages?channel_id=${channelId}&pinned=true`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.messages.every((m) => m.is_pinned)).toBe(true);
    });
  });

  describe("PUT /api/chat/messages/:id", () => {
    let channelId: number;
    let messageId: number;

    beforeEach(async () => {
      // Create channel
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["edit-test", "public", "company", adminUser1.id, tenant1Id],
      );
      const channelResult = asTestRows<any>(rows);
      channelId = (channelResult as any).insertId;

      // Create message
      const [rows] = await testDb.execute(
        `INSERT INTO chat_messages 
        (channel_id, sender_id, content, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [channelId, employeeUser1.id, "Original message", tenant1Id],
      );
      const msgResult = asTestRows<any>(rows);
      messageId = (msgResult as any).insertId;
    });

    it("should edit own message", async () => {
      const response = await request(app)
        .put(`/api/chat/messages/${messageId}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          content: "Edited message",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("aktualisiert");

      // Verify edit
      const [rows] = await testDb.execute(
        "SELECT content, is_edited, edited_at FROM chat_messages WHERE id = ?",
        [messageId],
      );
      const messages = asTestRows<any>(rows);
      expect(messages[0].content).toBe("Edited message");
      expect(messages[0].is_edited).toBe(1);
      expect(messages[0].edited_at).toBeTruthy();
    });

    it("should store edit history", async () => {
      await request(app)
        .put(`/api/chat/messages/${messageId}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ content: "First edit" });

      await request(app)
        .put(`/api/chat/messages/${messageId}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ content: "Second edit" });

      // Check edit history
      const [rows] = await testDb.execute(
        "SELECT * FROM chat_message_edits WHERE message_id = ? ORDER BY edited_at",
        [messageId],
      );
      const history = asTestRows<any>(rows);
      expect(history.length).toBe(2);
    });

    it("should prevent editing others messages", async () => {
      const response = await request(app)
        .put(`/api/chat/messages/${messageId}`)
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({
          content: "Trying to edit someone else's message",
        });

      expect(response.status).toBe(403);
    });

    it("should allow admin to edit any message", async () => {
      const response = await request(app)
        .put(`/api/chat/messages/${messageId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          content: "[Edited by Admin] Original message",
        });

      expect(response.status).toBe(200);
    });

    it("should prevent editing after time limit", async () => {
      // Set message created_at to 1 hour ago
      await testDb.execute(
        "UPDATE chat_messages SET created_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?",
        [messageId],
      );

      const response = await request(app)
        .put(`/api/chat/messages/${messageId}`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          content: "Too late to edit",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Bearbeitungszeit abgelaufen");
    });
  });

  describe("DELETE /api/chat/messages/:id", () => {
    let channelId: number;
    let messageId: number;

    beforeEach(async () => {
      // Create channel
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["delete-test", "public", "company", adminUser1.id, tenant1Id],
      );
      const channelResult = asTestRows<any>(rows);
      channelId = (channelResult as any).insertId;

      // Create message
      const [rows] = await testDb.execute(
        `INSERT INTO chat_messages 
        (channel_id, sender_id, content, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [channelId, employeeUser1.id, "Message to delete", tenant1Id],
      );
      const msgResult = asTestRows<any>(rows);
      messageId = (msgResult as any).insertId;
    });

    it("should soft delete own message", async () => {
      const response = await request(app)
        .delete(`/api/chat/messages/${messageId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("gelöscht");

      // Verify soft delete
      const [rows] = await testDb.execute(
        "SELECT is_deleted, deleted_at, content FROM chat_messages WHERE id = ?",
        [messageId],
      );
      const messages = asTestRows<any>(rows);
      expect(messages[0].is_deleted).toBe(1);
      expect(messages[0].deleted_at).toBeTruthy();
      expect(messages[0].content).toBe("[Nachricht gelöscht]");
    });

    it("should prevent deleting others messages", async () => {
      const response = await request(app)
        .delete(`/api/chat/messages/${messageId}`)
        .set("Authorization", `Bearer ${employeeToken2}`);

      expect(response.status).toBe(403);
    });

    it("should allow admin to delete any message", async () => {
      const response = await request(app)
        .delete(`/api/chat/messages/${messageId}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
    });

    it("should hard delete for admin with flag", async () => {
      const response = await request(app)
        .delete(`/api/chat/messages/${messageId}?hard=true`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);

      // Verify hard delete
      const [rows] = await testDb.execute(
        "SELECT * FROM chat_messages WHERE id = ?",
        [messageId],
      );
      const messages = asTestRows<any>(rows);
      expect(messages.length).toBe(0);
    });
  });

  describe("Channel Member Management", () => {
    let channelId: number;

    beforeEach(async () => {
      // Create private channel
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["member-test", "private", "company", adminUser1.id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      channelId = (result as any).insertId;

      // Add initial member
      await testDb.execute(
        "INSERT INTO chat_channel_members (channel_id, user_id, role, tenant_id) VALUES (?, ?, ?, ?)",
        [channelId, adminUser1.id, "admin", tenant1Id],
      );
    });

    it("should add members to channel", async () => {
      const response = await request(app)
        .post(`/api/chat/channels/${channelId}/members`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          userIds: [employeeUser1.id, employeeUser2.id],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.added).toBe(2);

      // Verify members added
      const [rows] = await testDb.execute(
        "SELECT COUNT(*) as count FROM chat_channel_members WHERE channel_id = ?",
        [channelId],
      );
      const members = asTestRows<any>(rows);
      expect(members[0].count).toBe(3); // Admin + 2 new
    });

    it("should remove member from channel", async () => {
      // Add member first
      await testDb.execute(
        "INSERT INTO chat_channel_members (channel_id, user_id, role, tenant_id) VALUES (?, ?, ?, ?)",
        [channelId, employeeUser1.id, "member", tenant1Id],
      );

      const response = await request(app)
        .delete(`/api/chat/channels/${channelId}/members/${employeeUser1.id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
    });

    it("should allow members to leave channel", async () => {
      // Add as member
      await testDb.execute(
        "INSERT INTO chat_channel_members (channel_id, user_id, role, tenant_id) VALUES (?, ?, ?, ?)",
        [channelId, employeeUser1.id, "member", tenant1Id],
      );

      const response = await request(app)
        .delete(`/api/chat/channels/${channelId}/members/${employeeUser1.id}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
    });

    it("should update member role", async () => {
      // Add member
      await testDb.execute(
        "INSERT INTO chat_channel_members (channel_id, user_id, role, tenant_id) VALUES (?, ?, ?, ?)",
        [channelId, employeeUser1.id, "member", tenant1Id],
      );

      const response = await request(app)
        .put(`/api/chat/channels/${channelId}/members/${employeeUser1.id}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          role: "moderator",
        });

      expect(response.status).toBe(200);

      // Verify role update
      const [rows] = await testDb.execute(
        "SELECT role FROM chat_channel_members WHERE channel_id = ? AND user_id = ?",
        [channelId, employeeUser1.id],
      );
      const members = asTestRows<any>(rows);
      expect(members[0].role).toBe("moderator");
    });
  });

  describe("Channel Settings", () => {
    let channelId: number;

    beforeEach(async () => {
      // Create channel
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["settings-test", "public", "company", adminUser1.id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      channelId = (result as any).insertId;
    });

    it("should update channel settings", async () => {
      const response = await request(app)
        .put(`/api/chat/channels/${channelId}`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          name: "Updated Channel Name",
          description: "Updated description",
          settings: {
            allow_threads: true,
            allow_reactions: true,
            slow_mode_seconds: 10,
          },
        });

      expect(response.status).toBe(200);
    });

    it("should archive channel", async () => {
      const response = await request(app)
        .put(`/api/chat/channels/${channelId}/archive`)
        .set("Authorization", `Bearer ${adminToken1}`)
        .send({
          reason: "Project completed",
        });

      expect(response.status).toBe(200);

      // Verify archived
      const [rows] = await testDb.execute(
        "SELECT is_archived, archived_at FROM chat_channels WHERE id = ?",
        [channelId],
      );
      const channels = asTestRows<any>(rows);
      expect(channels[0].is_archived).toBe(1);
      expect(channels[0].archived_at).toBeTruthy();
    });

    it("should mute/unmute channel notifications", async () => {
      const response = await request(app)
        .put(`/api/chat/channels/${channelId}/mute`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          duration: 3600, // 1 hour
        });

      expect(response.status).toBe(200);
    });
  });

  describe("Message Reactions", () => {
    let channelId: number;
    let messageId: number;

    beforeEach(async () => {
      // Create channel and message
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["reaction-test", "public", "company", adminUser1.id, tenant1Id],
      );
      const channelResult = asTestRows<any>(rows);
      channelId = (channelResult as any).insertId;

      const [rows] = await testDb.execute(
        `INSERT INTO chat_messages 
        (channel_id, sender_id, content, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [channelId, employeeUser1.id, "React to this!", tenant1Id],
      );
      const msgResult = asTestRows<any>(rows);
      messageId = (msgResult as any).insertId;
    });

    it("should add reaction to message", async () => {
      const response = await request(app)
        .post(`/api/chat/messages/${messageId}/reactions`)
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({
          emoji: "👍",
        });

      expect(response.status).toBe(201);

      // Verify reaction added
      const [rows] = await testDb.execute(
        "SELECT * FROM chat_message_reactions WHERE message_id = ? AND user_id = ?",
        [messageId, employeeUser2.id],
      );
      const reactions = asTestRows<any>(rows);
      expect(reactions[0].emoji).toBe("👍");
    });

    it("should remove reaction", async () => {
      // Add reaction first
      await testDb.execute(
        "INSERT INTO chat_message_reactions (message_id, user_id, emoji, tenant_id) VALUES (?, ?, ?, ?)",
        [messageId, employeeUser1.id, "❤️", tenant1Id],
      );

      const response = await request(app)
        .delete(`/api/chat/messages/${messageId}/reactions/❤️`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
    });

    it("should prevent duplicate reactions", async () => {
      // Add reaction
      await request(app)
        .post(`/api/chat/messages/${messageId}/reactions`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ emoji: "😀" });

      // Try to add same reaction
      const response = await request(app)
        .post(`/api/chat/messages/${messageId}/reactions`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ emoji: "😀" });

      expect(response.status).toBe(400);
    });
  });

  describe("File Uploads", () => {
    let channelId: number;

    beforeEach(async () => {
      // Create channel
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["file-test", "public", "company", adminUser1.id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      channelId = (result as any).insertId;
    });

    it("should upload file attachment", async () => {
      const response = await request(app)
        .post(`/api/chat/channels/${channelId}/upload`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .attach("file", Buffer.from("test file content"), "test.txt");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        filename: "test.txt",
        mime_type: "text/plain",
        size: expect.any(Number),
        url: expect.any(String),
      });
    });

    it("should validate file type", async () => {
      const response = await request(app)
        .post(`/api/chat/channels/${channelId}/upload`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .attach("file", Buffer.from("malicious"), "virus.exe");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Dateityp nicht erlaubt");
    });

    it("should enforce file size limit", async () => {
      const largeFile = Buffer.alloc(11 * 1024 * 1024); // 11MB

      const response = await request(app)
        .post(`/api/chat/channels/${channelId}/upload`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .attach("file", largeFile, "large.pdf");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Datei zu groß");
    });
  });

  describe("Search", () => {
    beforeEach(async () => {
      // Create channels and messages for search
      const channels = [
        { name: "general", type: "public" },
        { name: "project-alpha", type: "public" },
        { name: "team-frontend", type: "public" },
      ];

      for (const channel of channels) {
        const [rows] = await testDb.execute(
          `INSERT INTO chat_channels 
          (name, type, visibility_scope, created_by, tenant_id) 
          VALUES (?, ?, ?, ?, ?)`,
          [channel.name, channel.type, "company", adminUser1.id, tenant1Id],
        );
        const result = asTestRows<any>(rows);

        const channelId = (result as any).insertId;

        // Add messages
        await testDb.execute(
          `INSERT INTO chat_messages 
          (channel_id, sender_id, content, tenant_id) 
          VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
          [
            channelId,
            employeeUser1.id,
            "Important deadline tomorrow",
            tenant1Id,
            channelId,
            employeeUser2.id,
            "Working on the frontend",
            tenant1Id,
            channelId,
            employeeUser1.id,
            "Meeting at 3pm",
            tenant1Id,
          ],
        );
      }
    });

    it("should search messages globally", async () => {
      const response = await request(app)
        .get("/api/chat/search?q=deadline")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.results).toBeDefined();
      expect(
        response.body.data.results.some((r) => r.content.includes("deadline")),
      ).toBe(true);
    });

    it("should search within specific channel", async () => {
      const channels = await testDb.execute(
        "SELECT id FROM chat_channels WHERE name = 'project-alpha' AND tenant_id = ?",
        [tenant1Id],
      );
      const channelId = channels[0][0].id;

      const response = await request(app)
        .get(`/api/chat/search?q=frontend&channel_id=${channelId}`)
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(response.status).toBe(200);
      expect(
        response.body.data.results.every((r) => r.channel_id === channelId),
      ).toBe(true);
    });

    it("should search by sender", async () => {
      const response = await request(app)
        .get(`/api/chat/search?sender_id=${employeeUser1.id}`)
        .set("Authorization", `Bearer ${adminToken1}`);

      expect(response.status).toBe(200);
      expect(
        response.body.data.results.every(
          (r) => r.sender_id === employeeUser1.id,
        ),
      ).toBe(true);
    });

    it("should respect channel access in search", async () => {
      // Create private channel with message
      const [rows] = await testDb.execute(
        `INSERT INTO chat_channels 
        (name, type, visibility_scope, created_by, tenant_id) 
        VALUES (?, ?, ?, ?, ?)`,
        ["secret-project", "private", "company", employeeUser1.id, tenant1Id],
      );
      const result = asTestRows<any>(rows);
      const privateChannelId = (result as any).insertId;

      await testDb.execute(
        `INSERT INTO chat_messages 
        (channel_id, sender_id, content, tenant_id) 
        VALUES (?, ?, ?, ?)`,
        [privateChannelId, employeeUser1.id, "Secret deadline info", tenant1Id],
      );

      const response = await request(app)
        .get("/api/chat/search?q=deadline")
        .set("Authorization", `Bearer ${employeeToken2}`);

      expect(response.status).toBe(200);
      // Should not see the secret message
      expect(
        response.body.data.results.every(
          (r) => r.channel_id !== privateChannelId,
        ),
      ).toBe(true);
    });
  });
});
