/**
 * Chat API v2 Integration Tests
 * Tests real-time messaging endpoints with database
 */

import request from "supertest";
import { app } from "../../app.js";
import {
  createTestUser,
  generateAuthToken,
  cleanupTestData,
  TestUser,
} from "../mocks/testHelpers.js";

describe("Chat API v2", () => {
  let testUser1: TestUser;
  let testUser2: TestUser;
  let testUser3: TestUser;
  let authToken1: string;
  let authToken2: string;
  let authToken3: string;
  let conversationId: number;

  beforeAll(async () => {
    // Create test users for chat
    testUser1 = await createTestUser({
      role: "admin",
      username: "chat_admin_test",
      email: "chat_admin@test.com",
    });
    authToken1 = generateAuthToken(testUser1);

    testUser2 = await createTestUser({
      role: "employee",
      username: "chat_employee_test",
      email: "chat_employee@test.com",
      department_id: testUser1.department_id,
    });
    authToken2 = generateAuthToken(testUser2);

    testUser3 = await createTestUser({
      role: "employee",
      username: "chat_employee2_test",
      email: "chat_employee2@test.com",
      department_id: testUser1.department_id,
    });
    authToken3 = generateAuthToken(testUser3);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("GET /api/v2/chat/users", () => {
    it("should get available chat users", async () => {
      const response = await request(app)
        .get("/api/v2/chat/users")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          users: expect.any(Array),
          total: expect.any(Number),
        },
      });

      // Should see other users but not self
      const userIds = response.body.data.users.map((u: any) => u.id);
      expect(userIds).not.toContain(testUser1.id);
      expect(userIds).toContain(testUser2.id);
      expect(userIds).toContain(testUser3.id);
    });

    it("should filter users by search term", async () => {
      const response = await request(app)
        .get("/api/v2/chat/users")
        .query({ search: "chat_employee_test" })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0].username).toBe("chat_employee_test");
    });

    it("should return 401 without auth", async () => {
      await request(app).get("/api/v2/chat/users").expect(401);
    });
  });

  describe("POST /api/v2/chat/conversations", () => {
    it("should create a new conversation", async () => {
      const response = await request(app)
        .post("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          participantIds: [testUser2.id],
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          conversation: {
            id: expect.any(Number),
            isGroup: false,
            participants: expect.any(Array),
          },
        },
      });

      conversationId = response.body.data.conversation.id;
      expect(response.body.data.conversation.participants).toHaveLength(2);
    });

    it("should create a group conversation", async () => {
      const response = await request(app)
        .post("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          participantIds: [testUser2.id, testUser3.id],
          name: "Test Group Chat",
          isGroup: true,
        })
        .expect(201);

      expect(response.body.data.conversation).toMatchObject({
        isGroup: true,
        name: "Test Group Chat",
      });
      expect(response.body.data.conversation.participants).toHaveLength(3);
    });

    it("should return existing conversation for 1:1 chats", async () => {
      const response = await request(app)
        .post("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          participantIds: [testUser2.id],
        })
        .expect(201);

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
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/v2/chat/conversations", () => {
    it("should get user conversations", async () => {
      const response = await request(app)
        .get("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          data: expect.any(Array),
          pagination: {
            currentPage: 1,
            pageSize: 20,
            totalItems: expect.any(Number),
          },
        },
      });

      const conversation = response.body.data.data.find(
        (c: any) => c.id === conversationId,
      );
      expect(conversation).toBeDefined();
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/v2/chat/conversations")
        .query({ page: 1, limit: 5 })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.data.pagination.pageSize).toBe(5);
    });

    it("should filter by search", async () => {
      const response = await request(app)
        .get("/api/v2/chat/conversations")
        .query({ search: "Test Group" })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      const groupChats = response.body.data.data.filter(
        (c: any) => c.name && c.name.includes("Test Group"),
      );
      expect(groupChats.length).toBeGreaterThan(0);
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

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: {
            id: expect.any(Number),
            conversationId,
            senderId: testUser1.id,
            content: "Hello from test!",
            isRead: false,
          },
        },
      });
    });

    it("should validate message content", async () => {
      const response = await request(app)
        .post(`/api/v2/chat/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          message: "",
        })
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should only allow participants to send messages", async () => {
      // Create a user not in the conversation
      const outsideUser = await createTestUser({
        username: "outside_user",
        email: "outside@test.com",
      });
      const outsideToken = generateAuthToken(outsideUser);

      await request(app)
        .post(`/api/v2/chat/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${outsideToken}`)
        .send({
          message: "I should not be able to send this",
        })
        .expect(500); // v1 service throws generic error
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
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          data: expect.any(Array),
          pagination: expect.any(Object),
        },
      });

      const messages = response.body.data.data;
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toMatchObject({
        conversationId,
        content: expect.any(String),
        senderId: expect.any(Number),
      });
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get(`/api/v2/chat/conversations/${conversationId}/messages`)
        .query({ page: 1, limit: 1 })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.pagination.pageSize).toBe(1);
    });
  });

  describe("POST /api/v2/chat/conversations/:id/read", () => {
    it("should mark conversation as read", async () => {
      const response = await request(app)
        .post(`/api/v2/chat/conversations/${conversationId}/read`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          markedCount: expect.any(Number),
        },
      });
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

      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalUnread: expect.any(Number),
          conversations: expect.any(Array),
        },
      });

      // Should have at least one unread conversation
      expect(response.body.data.totalUnread).toBeGreaterThan(0);
      const unreadConv = response.body.data.conversations.find(
        (c: any) => c.conversationId === conversationId,
      );
      expect(unreadConv).toBeDefined();
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
        })
        .expect(201);

      const deleteConvId = createResponse.body.data.conversation.id;

      // Delete it
      const response = await request(app)
        .delete(`/api/v2/chat/conversations/${deleteConvId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: "Conversation deleted successfully",
        },
      });

      // Verify it's gone
      const listResponse = await request(app)
        .get("/api/v2/chat/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      const deletedConv = listResponse.body.data.data.find(
        (c: any) => c.id === deleteConvId,
      );
      expect(deletedConv).toBeUndefined();
    });
  });

  describe("GET /api/v2/chat/conversations/:id", () => {
    it("should get conversation details", async () => {
      const response = await request(app)
        .get(`/api/v2/chat/conversations/${conversationId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          conversation: {
            id: conversationId,
            participants: expect.any(Array),
          },
        },
      });
    });

    it("should return 404 for non-existent conversation", async () => {
      const response = await request(app)
        .get("/api/v2/chat/conversations/99999")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(404);

      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Not Implemented Endpoints", () => {
    it("PUT /api/v2/chat/conversations/:id should return 501", async () => {
      const response = await request(app)
        .put(`/api/v2/chat/conversations/${conversationId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ name: "Updated Name" })
        .expect(501);

      expect(response.body.error.code).toBe("NOT_IMPLEMENTED");
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
