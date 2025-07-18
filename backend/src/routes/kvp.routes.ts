/**
 * KVP Routes
 * Routes for KVP (Kontinuierlicher Verbesserungsprozess) system with department-based visibility
 */

import { Router } from "express";
import type { Router as ExpressRouter, RequestHandler } from "express";

import kvpController from "../controllers/kvp.controller";
import { authenticateToken } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimiter";
import { checkRole } from "../middleware/role.middleware";

const router: ExpressRouter = Router();

// All routes require authentication
// codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.authenticated middleware
router.use(authenticateToken);

// Public endpoints (all authenticated users)
router.get(
  "/",
  rateLimiter.authenticated,
  // codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.authenticated middleware
  kvpController.getAll,
);
router.get(
  "/categories",
  rateLimiter.authenticated,
  kvpController.getCategories,
);
router.get(
  "/stats",
  rateLimiter.admin,
  checkRole(["admin", "root"]),
  kvpController.getStatistics,
);
router.get("/:id", rateLimiter.authenticated, kvpController.getById);

// Creation (employees and admins in employee mode)
router.post("/", rateLimiter.authenticated, kvpController.create);

// Updates (based on permissions)
router.put("/:id", rateLimiter.authenticated, kvpController.update);

// Archive (soft delete)
router.delete("/:id", rateLimiter.authenticated, kvpController.delete);

// Admin-only share/unshare functions
router.post(
  "/:id/share",
  rateLimiter.admin,
  checkRole(["admin", "root"]),
  kvpController.shareSuggestion,
);
router.post(
  "/:id/unshare",
  rateLimiter.admin,
  checkRole(["admin", "root"]),
  kvpController.unshareSuggestion,
);

// Comments
router.get(
  "/:id/comments",
  rateLimiter.authenticated,
  kvpController.getComments,
);
router.post(
  "/:id/comments",
  rateLimiter.authenticated,
  kvpController.addComment,
);

// Attachments
router.get(
  "/:id/attachments",
  rateLimiter.authenticated,
  kvpController.getAttachments,
);
router.post(
  "/:id/attachments",
  rateLimiter.upload,
  kvpController.uploadAttachment as unknown as RequestHandler,
);

// Download attachment - with explicit rate limiting for file operations
// This route performs expensive file system operations and requires strict rate limiting
router.get(
  "/attachments/:attachmentId/download",
  // Rate limiting middleware to prevent DoS attacks
  rateLimiter.download,
  // codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.download middleware
  // Controller handler that performs file system access
  kvpController.downloadAttachment as unknown as RequestHandler,
);

export default router;
