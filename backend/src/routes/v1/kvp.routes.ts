/**
 * KVP Routes
 * Routes for KVP (Kontinuierlicher Verbesserungsprozess) system with department-based visibility
 */
import { Request, Response, Router } from 'express';
import type { Router as ExpressRouter } from 'express';

import kvpController from '../../controllers/kvp.controller';
import { authenticateToken } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rateLimiter';
import { checkRole } from '../../middleware/role.middleware';

const router: ExpressRouter = Router();

// All routes require authentication
// codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.authenticated middleware
router.use(authenticateToken);

// Public endpoints (all authenticated users)
router.get(
  '/',
  rateLimiter.authenticated,
  // codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.authenticated middleware
  async (req, res) => {
    await kvpController.getAll(req, res);
  },
);
router.get('/categories', rateLimiter.authenticated, async (req, res) => {
  await kvpController.getCategories(req, res);
});
router.get('/stats', rateLimiter.admin, checkRole(['admin', 'root']), async (req, res) => {
  await kvpController.getStatistics(req, res);
});
router.get('/:id', rateLimiter.authenticated, async (req, res) => {
  await kvpController.getById(req as unknown as Parameters<typeof kvpController.getById>[0], res);
});

// Creation (employees and admins in employee mode)
router.post('/', rateLimiter.authenticated, async (req, res) => {
  await kvpController.create(req as unknown as Parameters<typeof kvpController.create>[0], res);
});

// Updates (based on permissions)
router.put('/:id', rateLimiter.authenticated, async (req, res) => {
  await kvpController.update(req as unknown as Parameters<typeof kvpController.update>[0], res);
});

// Archive (soft delete)
router.delete('/:id', rateLimiter.authenticated, async (req, res) => {
  await kvpController.delete(req as unknown as Parameters<typeof kvpController.delete>[0], res);
});

// Admin-only share/unshare functions
router.post('/:id/share', rateLimiter.admin, checkRole(['admin', 'root']), async (req, res) => {
  await kvpController.shareSuggestion(
    req as unknown as Parameters<typeof kvpController.shareSuggestion>[0],
    res,
  );
});
router.post('/:id/unshare', rateLimiter.admin, checkRole(['admin', 'root']), async (req, res) => {
  await kvpController.unshareSuggestion(
    req as unknown as Parameters<typeof kvpController.unshareSuggestion>[0],
    res,
  );
});

// Comments
router.get('/:id/comments', rateLimiter.authenticated, async (req, res) => {
  await kvpController.getComments(
    req as unknown as Parameters<typeof kvpController.getComments>[0],
    res,
  );
});
router.post('/:id/comments', rateLimiter.authenticated, async (req, res) => {
  await kvpController.addComment(
    req as unknown as Parameters<typeof kvpController.addComment>[0],
    res,
  );
});

// Attachments
router.get('/:id/attachments', rateLimiter.authenticated, async (req, res) => {
  await kvpController.getAttachments(
    req as unknown as Parameters<typeof kvpController.getAttachments>[0],
    res,
  );
});
router.post('/:id/attachments', rateLimiter.upload, async (req: Request, res: Response) => {
  await kvpController.uploadAttachment(
    req as unknown as Parameters<typeof kvpController.uploadAttachment>[0],
    res,
  );
});

// Download attachment - with explicit rate limiting for file operations
// This route performs expensive file system operations and requires strict rate limiting
router.get(
  '/attachments/:attachmentId/download',
  // Rate limiting middleware to prevent DoS attacks
  rateLimiter.download,
  // codeql[js/missing-rate-limiting] - False positive: Rate limiting is applied via rateLimiter.download middleware
  // Controller handler that performs file system access
  async (req: Request, res: Response) => {
    await kvpController.downloadAttachment(
      req as unknown as Parameters<typeof kvpController.downloadAttachment>[0],
      res,
    );
  },
);

export default router;
