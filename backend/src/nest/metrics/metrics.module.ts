/**
 * Prometheus Metrics Module
 *
 * Exposes application metrics at /api/v2/metrics for Prometheus scraping.
 * Uses \@willsoto/nestjs-prometheus for NestJS integration.
 *
 * Default metrics include:
 * - process_cpu_user_seconds_total
 * - process_cpu_system_seconds_total
 * - process_cpu_seconds_total
 * - process_start_time_seconds
 * - process_resident_memory_bytes
 * - nodejs_eventloop_lag_seconds
 * - nodejs_active_handles_total
 * - nodejs_active_requests_total
 * - nodejs_heap_size_total_bytes
 * - nodejs_heap_size_used_bytes
 * - nodejs_external_memory_bytes
 * - nodejs_version_info
 * - http_request_duration_seconds (histogram)
 *
 * @see docs/adr/ADR-002-alerting-monitoring.md
 */
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

import { MetricsController } from './metrics.controller.js';

/**
 * Metrics Module
 *
 * Combines Prometheus metrics collection with custom public endpoint.
 * The MetricsController exposes /api/v2/metrics for Prometheus scraping.
 */
@Module({
  imports: [
    PrometheusModule.register({
      // Use our custom MetricsController instead of default PrometheusController
      // This avoids Fastify "Reply already sent" errors with @Res decorator
      controller: MetricsController,
      // Default metrics collection (CPU, memory, event loop, etc.)
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'assixx_',
        },
      },
      // Global metric labels
      defaultLabels: {
        app: 'assixx',
        service: 'backend',
      },
    }),
  ],
  // NOTE: Don't add MetricsController here - it's registered via PrometheusModule.register()
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module pattern requires class
export class MetricsModule {}
