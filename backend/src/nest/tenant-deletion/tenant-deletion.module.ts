/**
 * Tenant Deletion Module
 *
 * Wires up the tenant deletion domain: facade, executor, exporter, analyzer, audit.
 * Exports only the facade (TenantDeletionService) — sub-services are internal.
 */
import { Module } from '@nestjs/common';

import { TenantDeletionAnalyzer } from './tenant-deletion-analyzer.service.js';
import { TenantDeletionAudit } from './tenant-deletion-audit.service.js';
import { TenantDeletionExecutor } from './tenant-deletion-executor.service.js';
import { TenantDeletionExporter } from './tenant-deletion-exporter.service.js';
import { TenantDeletionService } from './tenant-deletion.service.js';

@Module({
  providers: [
    TenantDeletionService,
    TenantDeletionExecutor,
    TenantDeletionExporter,
    TenantDeletionAnalyzer,
    TenantDeletionAudit,
  ],
  exports: [TenantDeletionService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class TenantDeletionModule {}
