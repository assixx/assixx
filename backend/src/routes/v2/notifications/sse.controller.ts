import { Response } from 'express';

import { AuthenticatedRequest } from '../../../types/request.types.js';
import { eventBus } from '../../../utils/eventBus.js';
import { logger } from '../../../utils/logger.js';

interface NotificationData {
  tenantId: number;
  survey?: {
    id: number;
    title: string;
    deadline?: string;
  };
  document?: {
    id: number;
    filename: string;
    category: string;
  };
  kvp?: {
    id: number;
    title: string;
    submitted_by: string;
  };
}

/**
 * SSE Stream endpoint for real-time notifications
 * GET /api/v2/notifications/stream
 * @param req - The request object
 * @param res - The response object
 */
/**
 * Setup SSE headers and send initial connection
 */
function setupSSEConnection(res: Response, userId: number, role: string, tenantId: number): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(
    `data: ${JSON.stringify({
      type: 'CONNECTED',
      timestamp: new Date().toISOString(),
      user: { id: userId, role, tenantId },
    })}\n\n`,
  );
}

/**
 * Create notification handlers based on user role
 */
function createNotificationHandlers(
  res: Response,
  tenantId: number,
  userId: number,
  role: string,
): Record<string, (data: NotificationData) => void> {
  const handlers: Record<string, (data: NotificationData) => void> = {};

  // Survey notifications for employees
  if (role === 'employee') {
    handlers['survey.created'] = (data) => {
      if (data.tenantId === tenantId && data.survey) {
        logger.info(`[SSE] Sending NEW_SURVEY to user ${userId}`);
        res.write(
          `data: ${JSON.stringify({
            type: 'NEW_SURVEY',
            survey: {
              id: data.survey.id,
              title: data.survey.title,
              deadline: data.survey.deadline,
            },
            timestamp: new Date().toISOString(),
          })}\n\n`,
        );
      }
    };

    handlers['survey.updated'] = (data) => {
      if (data.tenantId === tenantId && data.survey) {
        logger.info(`[SSE] Sending SURVEY_UPDATED to user ${userId}`);
        res.write(
          `data: ${JSON.stringify({
            type: 'SURVEY_UPDATED',
            survey: { id: data.survey.id, title: data.survey.title },
            timestamp: new Date().toISOString(),
          })}\n\n`,
        );
      }
    };
  }

  // Document notifications for all users
  handlers['document.uploaded'] = (data) => {
    if (data.tenantId === tenantId && data.document) {
      logger.info(`[SSE] Sending NEW_DOCUMENT to user ${userId}`);
      res.write(
        `data: ${JSON.stringify({
          type: 'NEW_DOCUMENT',
          document: {
            id: data.document.id,
            filename: data.document.filename,
            category: data.document.category,
          },
          timestamp: new Date().toISOString(),
        })}\n\n`,
      );
    }
  };

  // KVP and admin notifications
  if (role === 'admin' || role === 'root') {
    handlers['kvp.submitted'] = (data) => {
      if (data.tenantId === tenantId && data.kvp) {
        logger.info(`[SSE] Sending NEW_KVP to user ${userId}`);
        res.write(
          `data: ${JSON.stringify({
            type: 'NEW_KVP',
            kvp: {
              id: data.kvp.id,
              title: data.kvp.title,
              submittedBy: data.kvp.submitted_by,
            },
            timestamp: new Date().toISOString(),
          })}\n\n`,
        );
      }
    };

    handlers['survey.created'] = (data) => {
      if (data.tenantId === tenantId && data.survey) {
        logger.info(`[SSE] Sending NEW_SURVEY_CREATED to admin ${userId}`);
        res.write(
          `data: ${JSON.stringify({
            type: 'NEW_SURVEY_CREATED',
            survey: {
              id: data.survey.id,
              title: data.survey.title,
              deadline: data.survey.deadline,
            },
            timestamp: new Date().toISOString(),
          })}\n\n`,
        );
      }
    };
  }

  return handlers;
}

/**
 * Setup cleanup handlers for connection
 */
function setupCleanupHandlers(
  req: AuthenticatedRequest,
  heartbeat: ReturnType<typeof setInterval>,
  handlers: Record<string, (data: NotificationData) => void>,
  userId: number,
): void {
  const cleanup = (): void => {
    clearInterval(heartbeat);
    Object.entries(handlers).forEach(([event, handler]) => {
      eventBus.off(event, handler);
    });
  };

  req.on('close', () => {
    cleanup();
    logger.info(`[SSE] Connection closed for user ${userId}`);
  });

  req.on('error', (error: Error) => {
    logger.error(`[SSE] Connection error for user ${userId}:`, error);
    cleanup();
  });
}

export function stream(req: AuthenticatedRequest, res: Response): void {
  const { tenant_id: tenantId, role, id: userId } = req.user;

  logger.info(`[SSE] Establishing connection for user ${userId} (${role}) in tenant ${tenantId}`);

  // Setup connection
  setupSSEConnection(res, userId, role, tenantId);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Create handlers
  const handlers = createNotificationHandlers(res, tenantId, userId, role);

  // Register handlers
  Object.entries(handlers).forEach(([event, handler]) => {
    eventBus.on(event, handler);
  });

  // Log connection stats
  const activeListeners = Object.keys(handlers).length;
  logger.info(`[SSE] User ${userId} listening to ${activeListeners} event types`);

  // Setup cleanup
  setupCleanupHandlers(req, heartbeat, handlers, userId);
}

/**
 * Get SSE connection statistics
 * GET /api/v2/notifications/stats
 * @param _req - The _req parameter
 * @param res - The response object
 */
export function getStats(_req: AuthenticatedRequest, res: Response): void {
  const stats = {
    activeEvents: eventBus.getActiveEvents(),
    listenerCounts: {
      'survey.created': eventBus.getListenerCount('survey.created'),
      'survey.updated': eventBus.getListenerCount('survey.updated'),
      'document.uploaded': eventBus.getListenerCount('document.uploaded'),
      'kvp.submitted': eventBus.getListenerCount('kvp.submitted'),
    },
    timestamp: new Date().toISOString(),
  };

  res.json(stats);
}
