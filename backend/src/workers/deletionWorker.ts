#!/usr/bin/env node
/**
 * Tenant Deletion Worker
 * Background process that handles tenant deletion queue
 */
import 'dotenv/config';
import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';

import pool from '../database';
import { tenantDeletionService } from '../services/tenantDeletion.service';
import { logger } from '../utils/logger';

class DeletionWorker {
  private isRunning = true;
  private processingInterval = 30000; // 30 seconds
  private isProcessing = false;

  constructor() {
    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => void this.shutdown('SIGTERM'));
    process.on('SIGINT', () => void this.shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in deletion worker:', error);
      void this.shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection in deletion worker:', {
        reason,
        promise,
      });
      void this.shutdown('unhandledRejection');
    });
  }

  async start(): Promise<void> {
    logger.info('🚀 Tenant Deletion Worker starting...');

    try {
      // Test database connection
      await pool.getConnection();
      logger.info('✅ Database connected');

      // Redis connection would be initialized here if needed
      logger.info('✅ Worker initialized (Redis optional)');

      // Start health check endpoint
      this.startHealthCheck();

      logger.info('✅ Deletion Worker ready and running');
      logger.info(
        `⏰ Checking for queued deletions every ${this.processingInterval / 1000} seconds`,
      );

      // Main processing loop
      while (this.isRunning) {
        try {
          if (!this.isProcessing) {
            await this.checkAndProcessQueue();
          }
          await this.sleep(this.processingInterval);
        } catch (error: unknown) {
          logger.error('Error in worker main loop:', error);
          await this.sleep(60000); // 1 minute wait on error
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to start deletion worker:', error);
      process.exit(1);
    }
  }

  private async checkAndProcessQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      logger.debug('Checking deletion queue...');
      await tenantDeletionService.processQueue();
    } catch (error: unknown) {
      logger.error('Error processing deletion queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private startHealthCheck(): void {
    // Simple HTTP server for health checks
    const healthPort = process.env.DELETION_WORKER_HEALTH_PORT ?? 3001;

    const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            isProcessing: this.isProcessing,
            pid: process.pid,
          }),
        );
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(healthPort, () => {
      logger.info(`📡 Health check endpoint listening on port ${healthPort}`);
    });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async shutdown(signal: string): Promise<void> {
    logger.info(`⚠️  Deletion Worker received ${signal} signal, shutting down gracefully...`);

    this.isRunning = false;

    // Wait for current processing to complete
    let waitTime = 0;
    while (this.isProcessing && waitTime < 60000) {
      // Max 60 seconds wait
      logger.info('Waiting for current deletion to complete...');
      await this.sleep(5000);
      waitTime += 5000;
    }

    try {
      // Close database connections
      // Close database connections if pool has end method
      if ('end' in pool && typeof pool.end === 'function') {
        await pool.end();
      }
      logger.info('✅ Database connections closed');

      // Redis would be disconnected here if used
      logger.info('✅ Cleanup complete');

      logger.info('✅ Deletion Worker shutdown complete');
      process.exit(0);
    } catch (error: unknown) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the worker when run directly
const worker = new DeletionWorker();
worker.start().catch((error: unknown) => {
  logger.error('Fatal error starting deletion worker:', error);
  process.exit(1);
});

export { DeletionWorker };
