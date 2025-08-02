/**
 * Chat API v2 Integration Tests
 * Tests real-time messaging endpoints with database
 */

import request from "supertest";
import { Pool, ResultSetHeader } from "mysql2/promise";
import { log, error as logError } from "console";
import app from "../../../../app.js";
import {
  createTestDatabase,
  cleanupTestData,
  closeTestDatabase,
  createTestTenant,
  createTestUser,
} from "../../../mocks/database.js";

describe("Chat API v2", () => {
  let testDb: Pool;
  let tenantId: number;
  let testUser1: any;
  let testUser2: any;
  let testUser3: any;
  let authToken1: string;
  let authToken2: string;
  let conversationId: number;
  let groupConversationId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await cleanupTestData();

    // Create test tenant
    tenantId = await createTestTenant(testDb, "chattest", "Chat Test Company");

    // Create test users for chat
    testUser1 = await createTestUser(testDb, {
      username: "chat_admin_test",
      email: "chat_admin@test.com",
      password: "password123",
      role: "admin",
      tenant_id: tenantId,
      first_name: "Chat",
      last_name: "Admin",
    });

    testUser2 = await createTestUser(testDb, {
      username: "chat_employee_test",
      email: "chat_employee@test.com",
      password: "password123",
      role: "employee",
      tenant_id: tenantId,
      first_name: "Chat",
      last_name: "Employee",
    });

    testUser3 = await createTestUser(testDb, {
      username: "chat_employee2_test",
      email: "chat_employee2@test.com",
      password: "password123",
      role: "employee",
      tenant_id: tenantId,
      first_name: "Chat",
      last_name: "Employee2",
    });

    // Get auth tokens
    let response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email: testUser1.email, password: "password123" });

    if (response.status !== 200) {
      logError("Login failed for testUser1:", response.status, response.body);
      throw new Error(`Login failed: ${response.status}`);
    }
    authToken1 = response.body.data.accessToken;

    response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email: testUser2.email, password: "password123" });

    if (response.status !== 200) {
      logError("Login failed for testUser2:", response.status, response.body);
      throw new Error(`Login failed: ${response.status}`);
    }
    authToken2 = response.body.data.accessToken;

    // Create conversations in the old tables that v1 service uses
    // Create 1:1 conversation
    try {
      const [conv1Result] = await testDb.execute<ResultSetHeader>(
        `INSERT INTO conversations (name, is_group, tenant_id, created_at, updated_at) 
         VALUES (?, ?, ?, NOW(), NOW())`,
        ["Test 1:1 Conversation", 0, tenantId],
      );
      conversationId = conv1Result.insertId;
      log("Created conversation 1 with ID:", conversationId);
    } catch (error) {
      logError("Failed to create conversation 1:", error);
      throw error;
    }

    // Add participants to 1:1 conversation
    await testDb.execute(
      `INSERT INTO conversation_participants (conversation_id, user_id, is_admin, joined_at) 
       VALUES (?, ?, ?, NOW()), (?, ?, ?, NOW())`,
      [conversationId, testUser1.id, 1, conversationId, testUser2.id, 0],
    );

    // Create group conversation
    const [conv2Result] = await testDb.execute<ResultSetHeader>(
      `INSERT INTO conversations (name, is_group, tenant_id, created_at, updated_at) 
       VALUES (?, ?, ?, NOW(), NOW())`,
      ["Test Group Conversation", 1, tenantId],
    );
    groupConversationId = conv2Result.insertId;

    // Add participants to group conversation
    await testDb.execute(
      `INSERT INTO conversation_participants (conversation_id, user_id, is_admin, joined_at) 
       VALUES (?, ?, ?, NOW()), (?, ?, ?, NOW()), (?, ?, ?, NOW())`,
      [
        groupConversationId,
        testUser1.id,
        1,
        groupConversationId,
        testUser2.id,
        0,
        groupConversationId,
        testUser3.id,
        0,
      ],
    );

    // Add some messages to conversations for testing
    await testDb.execute(
      `INSERT INTO messages (conversation_id, sender_id, content, tenant_id, created_at) 
       VALUES (?, ?, ?, ?, NOW()), (?, ?, ?, ?, NOW())`,
      [
        conversationId,
        testUser1.id,
        "Hello from user 1",
        tenantId,
        groupConversationId,
        testUser2.id,
        "Group message",
        tenantId,
      ],
    );
  });

  afterAll(async () => {
    // Clean up chat data from old tables
    if (testDb && conversationId && groupConversationId) {
      await testDb.execute(
        `DELETE FROM message_read_receipts WHERE message_id IN (
          SELECT id FROM messages WHERE conversation_id IN (?, ?)
        )`,
        [conversationId, groupConversationId],
      );
      await testDb.execute(
        `DELETE FROM messages WHERE conversation_id IN (?, ?)`,
        [conversationId, groupConversationId],
      );
      await testDb.execute(
        `DELETE FROM conversation_participants WHERE conversation_id IN (?, ?)`,
        [conversationId, groupConversationId],
      );
      await testDb.execute(`DELETE FROM conversations WHERE id IN (?, ?)`, [
        conversationId,
        groupConversationId,
      ]);
    }

    // Clean up all test conversation data created during tests
    if (testDb && tenantId) {
      await testDb.execute(`DELETE FROM conversations WHERE tenant_id = ?`, [
        tenantId,
      ]);
    }

    await cleanupTestData();
    await closeTestDatabase();
  });

  describe("GET /api/v2/chat/users", () => {
    it("should get available chat users", async () => {
      const response = await request(app)
        .get("/api/v2/chat/users")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.users).toBeInstanceOf(Array);
      expect(response.body.data.users.length).toBeGreaterThanOrEqual(2);

      // Should include basic user info
      const user = response.body.data.users[0];
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("firstName");
      expect(user).toHaveProperty("lastName");
      expect(user).toHaveProperty("isOnline");
      expect(user).toHaveProperty("profilePicture");
    });

    it("should filter users by search term", async () => {
      const response = await request(app)
        .get("/api/v2/chat/users")
        .query({ search: "chat_employee_test" })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThanOrEqual(1);
    });

    it("should return 401 without auth", async () => {
      await request(app).get("/api/v2/chat/users").expect(401);
    });
  });

  describe("POST /api/v2/chat/conversations", () => {
    it("should create a new conversation", async () => {
      // Create a new conversation with different users to avoid conflict
      const response = await request(app)
        .post("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          participantIds: [testUser3.id],
          name: "New Test 1:1 Chat",
        });

      if (response.status !== 201) {
        logError("Create conversation error:", response.body);
      }

      expect(response.status).toBe(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.conversation).toBeDefined();
      expect(response.body.data.conversation.id).toBeDefined();

      // API v2 returns isGroup (boolean) instead of type (string)
      expect(response.body.data.conversation.isGroup).toBe(false); // 1:1 chat

      expect(response.body.data.conversation.participants).toHaveLength(2);
    });

    it("should create a group conversation", async () => {
      const response = await request(app)
        .post("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          participantIds: [testUser2.id, testUser3.id],
          name: "Test Group Chat",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conversation).toBeDefined();
      expect(response.body.data.conversation.isGroup).toBe(true); // Changed from type to isGroup
      expect(response.body.data.conversation.participants).toHaveLength(3);
    });

    it("should return existing conversation for 1:1 chats", async () => {
      // Try to create the same conversation again - should return existing
      const response = await request(app)
        .post("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          participantIds: [testUser2.id],
          name: "Another attempt",
        })
        .expect(201);

      // Should return the conversation created in beforeAll
      expect(response.body.data.conversation.id).toBe(conversationId);
    });

    it("should validate participant IDs", async () => {
      const response = await request(app)
        .post("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          participantIds: [],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v2/chat/conversations", () => {
    it("should get user conversations", async () => {
      const response = await request(app)
        .get("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.data).toBeInstanceOf(Array);
      expect(response.body.data.data.length).toBeGreaterThanOrEqual(2);

      const conversation = response.body.data.data[0];
      expect(conversation).toHaveProperty("id");
      expect(conversation).toHaveProperty("name");
      expect(conversation).toHaveProperty("isGroup"); // Changed from type to isGroup
      expect(conversation).toHaveProperty("lastMessage");
      expect(conversation).toHaveProperty("unreadCount");
      expect(conversation).toHaveProperty("participants");
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/v2/chat/conversations")
        .query({ page: 1, limit: 5 })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.data.pagination).toBeDefined();
    });

    it("should filter by search", async () => {
      const response = await request(app)
        .get("/api/v2/chat/conversations")
        .query({ search: "Test Group" })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.data.data.length).toBeGreaterThanOrEqual(1);
      const found = response.body.data.data.find(
        (c: any) => c.id === groupConversationId,
      );
      expect(found).toBeDefined();
      expect(found.name).toContain("Test Group");
    });
  });

  describe("POST /api/v2/chat/conversations/:id/messages", () => {
    it("should send a message", async () => {
      const response = await request(app)
        .post(`/api/v2/chat/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          message: "Hello from test!",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.message).toBeDefined();
      expect(response.body.data.message.id).toBeDefined();
      expect(response.body.data.message.content).toBe("Hello from test!");
      expect(response.body.data.message.conversationId).toBe(conversationId);
      expect(response.body.data.message.senderId).toBe(testUser1.id);
      expect(response.body.data.message.senderName).toBeDefined();
      expect(response.body.data.message.createdAt).toBeDefined();
    });

    it("should validate message content", async () => {
      const response = await request(app)
        .post(`/api/v2/chat/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          message: "",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should prevent access to conversations user is not part of", async () => {
      // Create a conversation without user2 directly in DB
      const [convResult] = await testDb.execute<ResultSetHeader>(
        `INSERT INTO conversations (name, is_group, tenant_id, created_at, updated_at) 
         VALUES (?, ?, ?, NOW(), NOW())`,
        ["Private Conversation", 0, tenantId],
      );
      const privateConvId = convResult.insertId;

      // Add only user1 and user3 as participants (not user2)
      await testDb.execute(
        `INSERT INTO conversation_participants (conversation_id, user_id, is_admin, joined_at) 
         VALUES (?, ?, ?, NOW()), (?, ?, ?, NOW())`,
        [privateConvId, testUser1.id, 1, privateConvId, testUser3.id, 0],
      );

      // User2 should not be able to send message to this conversation
      await request(app)
        .post(`/api/v2/chat/conversations/${privateConvId}/messages`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          message: "Should not work",
        })
        .expect(403);
    });
  });

  describe("GET /api/v2/chat/conversations/:id/messages", () => {
    beforeEach(async () => {
      // Send some test messages
      await request(app)
        .post(`/api/v2/chat/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ message: "Message 1" });

      await request(app)
        .post(`/api/v2/chat/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ message: "Message 2" });
    });

    it("should get conversation messages", async () => {
      const response = await request(app)
        .get(`/api/v2/chat/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${authToken1}`);

      if (response.status !== 200) {
        logError("GET messages error:", response.body);
      }

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.data).toBeInstanceOf(Array); // Changed from messages to data
      expect(response.body.data.data.length).toBeGreaterThanOrEqual(3);

      const message = response.body.data.data[0];
      expect(message).toHaveProperty("id");
      expect(message).toHaveProperty("content"); // Changed from message to content
      expect(message).toHaveProperty("senderId");
      expect(message).toHaveProperty("senderName");
      expect(message).toHaveProperty("createdAt"); // Changed from timestamp to createdAt
      expect(message).toHaveProperty("isRead");
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get(`/api/v2/chat/conversations/${conversationId}/messages`)
        .query({ page: 1, limit: 1 })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.data.data).toHaveLength(1); // Changed from messages to data
    });
  });

  describe("POST /api/v2/chat/conversations/:id/read", () => {
    it("should mark conversation as read", async () => {
      log("Test conversationId:", conversationId);
      log("Test authToken2:", authToken2 ? "exists" : "missing");

      const response = await request(app)
        .post(`/api/v2/chat/conversations/${conversationId}/read`)
        .set("Authorization", `Bearer ${authToken2}`)
        .set("Content-Type", "application/json")
        .send({});

      // Force output to stderr which Jest doesn't suppress
      if (response.status !== 200) {
        process.stderr.write(`\nMark as read failed: ${response.status}\n`);
        process.stderr.write(
          `Response body: ${JSON.stringify(response.body)}\n`,
        );
        process.stderr.write(`conversationId: ${conversationId}\n`);
        process.stderr.write(
          `URL: /api/v2/chat/conversations/${conversationId}/read\n`,
        );
      }

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined(); // API returns markedCount, not message
    });
  });

  describe("GET /api/v2/chat/unread-count", () => {
    it("should get unread message count", async () => {
      // Send a message as user1
      await request(app)
        .post(`/api/v2/chat/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ message: "Unread message" });

      // Get unread count as user2
      const response = await request(app)
        .get("/api/v2/chat/unread-count")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalUnread).toBeGreaterThanOrEqual(1); // Changed from unreadCount to totalUnread
      expect(response.body.data.conversations).toBeInstanceOf(Array);

      const unreadConv = response.body.data.conversations.find(
        (c: any) => c.conversationId === conversationId,
      );
      expect(unreadConv).toBeDefined();
      expect(unreadConv.unreadCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("DELETE /api/v2/chat/conversations/:id", () => {
    it("should delete a conversation", async () => {
      // Create a conversation to delete
      const createResponse = await request(app)
        .post("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          participantIds: [testUser3.id],
          name: "To be deleted",
        });

      const deleteConvId = createResponse.body.data.conversation.id;

      // Delete it
      const response = await request(app)
        .delete(`/api/v2/chat/conversations/${deleteConvId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe(
        "Conversation deleted successfully",
      );

      // Verify it's gone
      const listResponse = await request(app)
        .get("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      const found = listResponse.body.data.data.find(
        (c: any) => c.id === deleteConvId,
      );
      expect(found).toBeUndefined();
    });
  });

  describe("GET /api/v2/chat/conversations/:id", () => {
    it("should get conversation details", async () => {
      const response = await request(app)
        .get(`/api/v2/chat/conversations/${conversationId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.conversation).toBeDefined();
      expect(response.body.data.conversation.id).toBe(conversationId);
      expect(response.body.data.conversation.name).toBeDefined();
      expect(response.body.data.conversation.isGroup).toBeDefined(); // Changed from type to isGroup
      expect(response.body.data.conversation.participants).toBeInstanceOf(
        Array,
      );
    });

    it("should return 404 for non-existent conversation", async () => {
      const response = await request(app)
        .get("/api/v2/chat/conversations/99999")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Not Implemented Endpoints", () => {
    it("PUT /api/v2/chat/conversations/:id should return 501", async () => {
      const response = await request(app)
        .put(`/api/v2/chat/conversations/${conversationId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ name: "Updated Name" })
        .expect(501);

      expect(response.body.success).toBe(false);
    });

    it("PUT /api/v2/chat/messages/:id should return 501", async () => {
      await request(app)
        .put("/api/v2/chat/messages/1")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ message: "Updated" })
        .expect(501);
    });

    it("DELETE /api/v2/chat/messages/:id should return 501", async () => {
      await request(app)
        .delete("/api/v2/chat/messages/1")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(501);
    });

    it("GET /api/v2/chat/search should return 501", async () => {
      await request(app)
        .get("/api/v2/chat/search")
        .query({ q: "test" })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(501);
    });
  });
});
