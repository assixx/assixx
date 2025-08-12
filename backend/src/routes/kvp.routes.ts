/**
 * KVP Routes
 * Routes for KVP (Kontinuierlicher Verbesserungsprozess) system with department-based visibility
 */

import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";

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
  async (req, res, next) => kvpController.getAll(req, res, next),
);
router.get("/categories", rateLimiter.authenticated, async (req, res, next) =>
  kvpController.getCategories(req, res, next),
);
router.get(
  "/stats",
  rateLimiter.admin,
  checkRole(["admin", "root"]),
  async (req, res, next) => kvpController.getStatistics(req, res, next),
);
router.get("/:id", rateLimiter.authenticated, async (req, res, next) =>
  kvpController.getById(req, res, next),
);

// Creation (employees and admins in employee mode)
router.post("/", rateLimiter.authenticated, async (req, res, next) =>
  kvpController.create(req, res, next),
);

// Updates (based on permissions)
router.put("/:id", rateLimiter.authenticated, async (req, res, next) =>
  kvpController.update(req, res, next),
);

// Archive (soft delete)
router.delete("/:id", rateLimiter.authenticated, async (req, res, next) =>
  kvpController.delete(req, res, next),
);

// Admin-only share/unshare functions
router.post(
  "/:id/share",
  rateLimiter.admin,
  checkRole(["admin", "root"]),
  async (req, res, next) => kvpController.shareSuggestion(req, res, next),
);
router.post(
  "/:id/unshare",
  rateLimiter.admin,
  checkRole(["admin", "root"]),
  async (req, res, next) => kvpController.unshareSuggestion(req, res, next),
);

// Comments
router.get("/:id/comments", rateLimiter.authenticated, async (req, res, next) =>
  kvpController.getComments(req, res, next),
);
router.post(
  "/:id/comments",
  rateLimiter.authenticated,
  async (req, res, next) => kvpController.addComment(req, res, next),
);

// Attachments
router.get(
  "/:id/attachments",
  rateLimiter.authenticated,
  async (req, res, next) => kvpController.getAttachments(req, res, next),
);
router.post(
  "/:id/attachments",
  rateLimiter.upload,
  async (req: Request, res: Response, next: NextFunction) =>
    kvpController.uploadAttachment(req, res, next),
);

// Download attachment - with explicit rate limiting for file operations
// This route performs expensive file system operations and requires strict rate limiting
router.get(
  "/attachments/:attachmentId/download",
  // Rate limiting middleware to prevent DoS attacks
  rateLimiter.download,
  // codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.download middleware
  // Controller handler that performs file system access
  async (req: Request, res: Response, next: NextFunction) =>
    kvpController.downloadAttachment(req, res, next),
);

export default router;
