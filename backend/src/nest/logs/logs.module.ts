/**
 * Logs Module
 *
 * Handles system audit logs access and management:
 * - LogsService: Query and manage root_logs table
 * - UnifiedLogsService: Cursor-based streaming export with RLS
 * - LogFormattersService: TXT/CSV/JSON formatting
 * - PartitionManagerService: Auto-create monthly partitions
 * - LogRetentionService: Auto-cleanup old logs based on retention policy
 *
 * @see ADR-009 Central Audit Logging
 */
import { Module } from '@nestjs/common';

import { LogFormattersService } from './log-formatters.service.js';
import { LogRetentionService } from './log-retention.service.js';
import { LogsController } from './logs.controller.js';
import { LogsService } from './logs.service.js';
import { PartitionManagerService } from './partition-manager.service.js';
import { UnifiedLogsService } from './unified-logs.service.js';

@Module({
  controllers: [LogsController],
  providers: [
    LogsService,
    UnifiedLogsService,
    LogFormattersService,
    PartitionManagerService,
    LogRetentionService,
  ],
  exports: [LogsService, UnifiedLogsService, PartitionManagerService, LogRetentionService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class LogsModule {}
