#!/usr/bin/env node
/**
 * Tenant Deletion Worker
 * Background process that handles tenant deletion queue.
 *
 * Uses NestJS standalone application context for proper DI.
 * Only bootstraps the modules needed for deletion — not the full app.
 */
import { type INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';

import { TenantDeletionService } from '../nest/tenant-deletion/tenant-deletion.service.js';
import { DeletionWorkerModule } from './deletion-worker.module.js';

class DeletionWorker {
  private isRunning = true;
  private processingInterval = 30000; // 30 seconds
  private isProcessing = false;
  private readonly logger = new Logger('DeletionWorker');
  private app: INestApplicationContext | null = null;
  private tenantDeletionService: TenantDeletionService | null = null;

  constructor() {
    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => void this.shutdown('SIGTERM'));
    process.on('SIGINT', () => void this.shutdown('SIGINT'));
    process.on('uncaughtException', (error: Error) => {
      this.logger.error(`Uncaught exception in deletion worker: ${error.message}`);
      void this.shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason: unknown) => {
      this.logger.error(
        `Unhandled rejection in deletion worker: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
      void this.shutdown('unhandledRejection');
    });
  }

  async start(): Promise<void> {
    this.logger.log('Tenant Deletion Worker starting...');

    try {
      // Bootstrap NestJS standalone application context
      this.app = await NestFactory.createApplicationContext(DeletionWorkerModule, {
        logger: ['error', 'warn', 'log'],
      });
      this.tenantDeletionService = this.app.get(TenantDeletionService);
      this.logger.log('NestJS application context created');

      // Start health check endpoint
      this.startHealthCheck();

      this.logger.log('Deletion Worker ready and running');
      this.logger.log(
        `Checking for queued deletions every ${this.processingInterval / 1000} seconds`,
      );

      // Main processing loop
      while (this.isRunning) {
        await this.runLoopIteration();
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to start deletion worker: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      process.exit(1);
    }
  }

  /**
   * Single iteration of the main processing loop.
   */
  private async runLoopIteration(): Promise<void> {
    try {
      if (!this.isProcessing) {
        await this.checkAndProcessQueue();
      }
      await this.sleep(this.processingInterval);
    } catch (error: unknown) {
      this.logger.error(
        `Error in worker main loop: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      await this.sleep(60000); // 1 minute wait on error
    }
  }

  private async checkAndProcessQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      if (this.tenantDeletionService !== null) {
        await this.tenantDeletionService.processQueue();
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error processing deletion queue: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private startHealthCheck(): void {
    // Simple HTTP server for health checks
    const healthPort = process.env['DELETION_WORKER_HEALTH_PORT'] ?? 3001;

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
      this.logger.log(`Health check endpoint listening on port ${String(healthPort)}`);
    });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve: (value: unknown) => void) => setTimeout(resolve, ms));
  }

  private async shutdown(signal: string): Promise<void> {
    this.logger.log(`Deletion Worker received ${signal} signal, shutting down gracefully...`);

    this.isRunning = false;

    // Wait for current processing to complete
    let waitTime = 0;
    while (this.isProcessing && waitTime < 60000) {
      // Max 60 seconds wait
      this.logger.log('Waiting for current deletion to complete...');
      await this.sleep(5000);
      waitTime += 5000;
    }

    try {
      // Close NestJS application context (handles DB pool + Redis cleanup)
      if (this.app !== null) {
        await this.app.close();
        this.logger.log('NestJS application context closed');
      }

      this.logger.log('Deletion Worker shutdown complete');
      process.exit(0);
    } catch (error: unknown) {
      this.logger.error(
        `Error during shutdown: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      process.exit(1);
    }
  }
}

// Start the worker when run directly
const worker = new DeletionWorker();
worker.start().catch((error: unknown) => {
  const logger = new Logger('DeletionWorker');
  logger.error(
    `Fatal error starting deletion worker: ${error instanceof Error ? error.message : 'Unknown'}`,
  );
  process.exit(1);
});

export { DeletionWorker };
