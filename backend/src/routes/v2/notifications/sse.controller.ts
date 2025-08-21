import { Response } from 'express';

import { AuthenticatedRequest } from '../../../types/request.types.js';
import { eventBus } from '../../../utils/eventBus.js';
import { logger } from '../../../utils/logger.js';

/**
 *
 */
export class SSENotificationController {
  /**
   * SSE Stream endpoint for real-time notifications
   * GET /api/v2/notifications/stream
   * @param req - The request object
   * @param res - The response object
   */
  async stream(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { tenant_id: tenantId, role, id: userId } = req.user;

    logger.info(`[SSE] Establishing connection for user ${userId} (${role}) in tenant ${tenantId}`);

    // Setup SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection event
    res.write(
      `data: ${JSON.stringify({
        type: 'CONNECTED',
        timestamp: new Date().toISOString(),
        user: { id: userId, role, tenantId },
      })}\n\n`,
    );

    // Heartbeat to keep connection alive (every 30 seconds)
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    // Event handlers based on role
    const handlers: Record<string, (data: any) => void> = {};

    // Survey notifications for employees
    if (role === 'employee') {
      handlers['survey.created'] = (data) => {
        if (data.tenantId === tenantId) {
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
        if (data.tenantId === tenantId) {
          logger.info(`[SSE] Sending SURVEY_UPDATED to user ${userId}`);
          res.write(
            `data: ${JSON.stringify({
              type: 'SURVEY_UPDATED',
              survey: {
                id: data.survey.id,
                title: data.survey.title,
              },
              timestamp: new Date().toISOString(),
            })}\n\n`,
          );
        }
      };
    }

    // Document notifications for all users
    handlers['document.uploaded'] = (data) => {
      if (data.tenantId === tenantId) {
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

    // KVP notifications for admins
    if (role === 'admin' || role === 'root') {
      handlers['kvp.submitted'] = (data) => {
        if (data.tenantId === tenantId) {
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

      // Admins also get notified about new surveys (to see what employees will get)
      handlers['survey.created'] = (data) => {
        if (data.tenantId === tenantId) {
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

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      eventBus.on(event, handler);
    });

    // Log connection stats
    const activeListeners = Object.keys(handlers).length;
    logger.info(`[SSE] User ${userId} listening to ${activeListeners} event types`);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);

      // Remove all handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        eventBus.off(event, handler);
      });

      logger.info(`[SSE] Connection closed for user ${userId}`);
    });

    // Handle connection errors
    req.on('error', (error: Error) => {
      logger.error(`[SSE] Connection error for user ${userId}:`, error);
      clearInterval(heartbeat);

      Object.entries(handlers).forEach(([event, handler]) => {
        eventBus.off(event, handler);
      });
    });
  }

  /**
   * Get SSE connection statistics
   * GET /api/v2/notifications/stats
   * @param _req - The _req parameter
   * @param res - The response object
   */
  async getStats(_req: AuthenticatedRequest, res: Response): Promise<void> {
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
}
