/**
 * Audit Trail Module (NestJS)
 *
 * Provides audit logging and compliance features.
 */
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/index.js';
import { AuditTrailController } from './audit-trail.controller.js';
import { AuditTrailService } from './audit-trail.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditTrailController],
  providers: [AuditTrailService],
  exports: [AuditTrailService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class AuditTrailModule {}
