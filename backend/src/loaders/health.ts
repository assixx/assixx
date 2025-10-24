/**
 * Health Check Loader
 * Provides health endpoint for monitoring
 */
import { Application, Request, Response } from 'express';

/**
 * Load health check endpoint
 * @param app - Express application instance
 */
export function loadHealthCheck(app: Application): void {
  // Health check endpoint - MUST be before rate limiting
  app.get('/health', (_req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
    });
  });

  console.log('✅ Health check endpoint configured');
}
