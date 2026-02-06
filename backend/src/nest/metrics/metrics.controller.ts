/**
 * Prometheus Metrics Controller
 *
 * Exposes /api/v2/metrics endpoint for Prometheus scraping.
 * Standalone controller (not extending PrometheusController) to avoid
 * Fastify "Reply already sent" errors with the \@Res decorator.
 *
 * @see docs/adr/ADR-002-alerting-monitoring.md
 */
import { Controller, Get, Header } from '@nestjs/common';
import { register } from 'prom-client';

import { Public } from '../common/decorators/public.decorator.js';

/**
 * Metrics Controller
 *
 * Returns Prometheus metrics in text format.
 * This endpoint is public (no auth required) for Prometheus scraping.
 */
@Controller('metrics')
export class MetricsController {
  /**
   * GET /api/v2/metrics
   *
   * Returns all registered Prometheus metrics.
   */
  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async index(): Promise<string> {
    return await register.metrics();
  }
}
