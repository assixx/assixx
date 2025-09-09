/**
 * Notifications v2 Routes
 * Defines all notification-related endpoints
 */
import { Router } from 'express';

import { authenticateV2 } from '../../../middleware/v2/auth.middleware.js';
import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { typed } from '../../../utils/routeHandlers.js';
import * as notificationsController from './notifications.controller.js';
import * as notificationsValidation from './notifications.validation.js';
import { SSENotificationController } from './sse.controller.js';

const router = Router();

// Get notifications for authenticated user
router.get(
  '/',
  authenticateV2,
  notificationsValidation.listNotifications,
  typed.auth(notificationsController.listNotifications),
);

// Create notification (admin only)
router.post(
  '/',
  authenticateV2,
  notificationsValidation.createNotification,
  typed.auth(notificationsController.createNotification),
);

// Get notification preferences
router.get('/preferences', authenticateV2, typed.auth(notificationsController.getPreferences));

// Update notification preferences
router.put(
  '/preferences',
  authenticateV2,
  notificationsValidation.updatePreferences,
  typed.auth(notificationsController.updatePreferences),
);

// Get notification statistics (admin only)
router.get('/stats', authenticateV2, typed.auth(notificationsController.getStatistics));

// Get personal notification statistics
router.get('/stats/me', authenticateV2, typed.auth(notificationsController.getPersonalStats));

// Subscribe to push notifications
router.post(
  '/subscribe',
  authenticateV2,
  notificationsValidation.subscribe,
  typed.auth(notificationsController.subscribe),
);

// Get notification templates (admin only)
router.get('/templates', authenticateV2, typed.auth(notificationsController.getTemplates));

// Create notification from template (admin only)
router.post(
  '/from-template',
  authenticateV2,
  notificationsValidation.createFromTemplate,
  typed.auth(notificationsController.createFromTemplate),
);

// Mark all notifications as read
router.put('/mark-all-read', authenticateV2, typed.auth(notificationsController.markAllAsRead));

// Unsubscribe from push notifications
router.delete(
  '/subscribe/:id',
  authenticateV2,
  notificationsValidation.unsubscribe,
  typed.auth(notificationsController.unsubscribe),
);

// Mark notification as read
router.put(
  '/:id/read',
  authenticateV2,
  notificationsValidation.markAsRead,
  typed.auth(notificationsController.markAsRead),
);

// Delete notification
router.delete(
  '/:id',
  authenticateV2,
  notificationsValidation.deleteNotification,
  typed.auth(notificationsController.deleteNotification),
);

// SSE Stream endpoint for real-time notifications
const sseController = new SSENotificationController();
router.get('/stream', authenticateV2, (req, res) => {
  void sseController.stream(req as AuthenticatedRequest, res);
});

// SSE Statistics endpoint for monitoring
router.get('/stream/stats', authenticateV2, (req, res) => {
  void sseController.getStats(req as AuthenticatedRequest, res);
});

export default router;
