/**
 * Logs Module
 *
 * Handles system audit logs access and management:
 * - LogsService: Query and manage root_logs table
 * - UnifiedLogsService: Cursor-based streaming export with RLS
 * - LogFormattersService: TXT/CSV/JSON formatting
 * - LogRetentionService: Auto-cleanup old logs based on retention policy
 *
 * Partition management: pg_partman (DB-level, ADR-029)
 *
 * @see ADR-009 Central Audit Logging
 */
import { Module } from '@nestjs/common';

import { LogFormattersService } from './log-formatters.service.js';
import { LogRetentionService } from './log-retention.service.js';
import { LogsController } from './logs.controller.js';
import { LogsService } from './logs.service.js';
import { UnifiedLogsService } from './unified-logs.service.js';

@Module({
  controllers: [LogsController],
  providers: [
    LogsService,
    UnifiedLogsService,
    LogFormattersService,
    LogRetentionService,
  ],
  exports: [LogsService, UnifiedLogsService, LogRetentionService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class LogsModule {}
