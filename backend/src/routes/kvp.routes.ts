/**
 * KVP Routes
 * Routes for KVP (Kontinuierlicher Verbesserungsprozess) system with department-based visibility
 */

import { Router } from "express";
import type { Router as ExpressRouter, RequestHandler } from "express";
import kvpController from "../controllers/kvp.controller";
import { authenticateToken } from "../middleware/auth";
import { checkRole } from "../middleware/role.middleware";
import { rateLimiter } from "../middleware/rateLimiter";

const router: ExpressRouter = Router();

// All routes require authentication and rate limiting
router.use(authenticateToken);
router.use(rateLimiter.authenticated);

// Public endpoints (all authenticated users)
router.get("/", kvpController.getAll);
router.get("/categories", kvpController.getCategories);
router.get("/stats", checkRole(["admin", "root"]), kvpController.getStatistics);
router.get("/:id", kvpController.getById);

// Creation (employees and admins in employee mode)
router.post("/", kvpController.create);

// Updates (based on permissions)
router.put("/:id", kvpController.update);

// Archive (soft delete)
router.delete("/:id", kvpController.delete);

// Admin-only share/unshare functions
router.post(
  "/:id/share",
  checkRole(["admin", "root"]),
  kvpController.shareSuggestion,
);
router.post(
  "/:id/unshare",
  checkRole(["admin", "root"]),
  kvpController.unshareSuggestion,
);

// Comments
router.get("/:id/comments", kvpController.getComments);
router.post("/:id/comments", kvpController.addComment);

// Attachments
router.get("/:id/attachments", kvpController.getAttachments);
router.post(
  "/:id/attachments",
  rateLimiter.upload,
  kvpController.uploadAttachment as unknown as RequestHandler,
);
router.get(
  "/attachments/:attachmentId/download",
  rateLimiter.download, // Use download rate limiter for downloads
  kvpController.downloadAttachment,
);

export default router;
