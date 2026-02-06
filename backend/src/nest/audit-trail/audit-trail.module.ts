/**
 * Audit Trail Module (NestJS)
 *
 * Provides audit logging and compliance features.
 * Includes sub-services used by the global AuditTrailInterceptor.
 */
import { Module } from '@nestjs/common';

import { AuditLoggingService } from '../common/audit/audit-logging.service.js';
import { AuditMetadataService } from '../common/audit/audit-metadata.service.js';
import { AuditRequestFilterService } from '../common/audit/audit-request-filter.service.js';
import { DatabaseModule } from '../database/index.js';
import { AuditTrailController } from './audit-trail.controller.js';
import { AuditTrailService } from './audit-trail.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditTrailController],
  providers: [
    AuditTrailService,
    // Sub-services for AuditTrailInterceptor
    AuditLoggingService,
    AuditMetadataService,
    AuditRequestFilterService,
  ],
  exports: [
    AuditTrailService,
    // Export for global interceptor DI
    AuditLoggingService,
    AuditMetadataService,
    AuditRequestFilterService,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class AuditTrailModule {}
