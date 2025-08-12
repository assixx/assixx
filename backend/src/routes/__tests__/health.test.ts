/**
 * Unit Tests for Health Check Endpoint
 * Simple API endpoint test to verify testing setup
 */

import request from "supertest";
import express from "express";
import { Router } from "express";

// Create a simple test app
const app = express();
const router = Router();

// Health endpoint
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV ?? "test",
  });
});

app.use("/api", router);

describe("Health Check Endpoint", () => {
  describe("GET /api/health", () => {
    it("should return 200 with health status", async () => {
      const response = await request(app).get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("uptime");
      expect(response.body).toHaveProperty("environment", "test");
    });

    it("should return valid timestamp", async () => {
      const response = await request(app).get("/api/health");

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it("should return positive uptime", async () => {
      const response = await request(app).get("/api/health");

      expect(response.body.uptime).toBeGreaterThan(0);
      expect(typeof response.body.uptime).toBe("number");
    });

    it("should handle multiple requests", async () => {
      const responses = await Promise.all([
        request(app).get("/api/health"),
        request(app).get("/api/health"),
        request(app).get("/api/health"),
      ]);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe("ok");
      });
    });

    it("should have correct content-type", async () => {
      const response = await request(app).get("/api/health");

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for non-existent endpoint", async () => {
      const response = await request(app).get("/api/non-existent");

      expect(response.status).toBe(404);
    });

    it("should handle POST request to health endpoint", async () => {
      const response = await request(app).post("/api/health");

      expect(response.status).toBe(404); // No POST handler defined
    });
  });
});
