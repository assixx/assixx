/**
 * Simplified API Tests for Users v2
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import app from "../../../../app.js";

describe("Users v2 API - Simple Test", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-key-for-users-v2-tests";
  });

  afterAll(async () => {
    // Clean shutdown
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe("Basic Endpoint Test", () => {
    it("should return 401 without authentication", async () => {
      const response = await request(app).get("/api/v2/users").expect(401);

      expect(response.body).toHaveProperty("success", false);
    });
  });
});
