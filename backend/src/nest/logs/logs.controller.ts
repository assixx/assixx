/**
 * Logs Controller
 *
 * HTTP endpoints for system audit logs:
 * - GET    /logs        - Get system logs with filters (root only)
 * - GET    /logs/stats  - Get log statistics (root only)
 * - GET    /logs/export - Export unified logs as JSON/CSV/TXT (admin/root)
 * - DELETE /logs        - Delete logs (root only, requires password confirmation)
 *
 * @see ADR-009 Central Audit Logging
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ExportThrottle } from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  DeleteLogsBodyDto,
  ExportLogsQueryDto,
  ExportLogsQuerySchema,
  ListLogsQueryDto,
} from './dto/index.js';
import type {
  DeleteLogsResponseData,
  LogsListResponseData,
  LogsStatsResponseData,
} from './dto/index.js';
import { LogFormattersService } from './log-formatters.service.js';
import { LogsService } from './logs.service.js';
import type { LogFilterParams } from './unified-logs.service.js';
import { UnifiedLogsService } from './unified-logs.service.js';

@Controller('logs')
export class LogsController {
  private readonly logger = new Logger(LogsController.name);

  constructor(
    private readonly logsService: LogsService,
    private readonly unifiedLogsService: UnifiedLogsService,
    private readonly formattersService: LogFormattersService,
  ) {}

  /**
   * GET /logs
   * Get system logs with filters
   * Filtered by the current user's tenant
   */
  @Get()
  @Roles('root')
  @HttpCode(HttpStatus.OK)
  async getLogs(
    @CurrentUser() user: NestAuthUser,
    @Query() query: ListLogsQueryDto,
  ): Promise<LogsListResponseData> {
    return await this.logsService.getLogs(user, query);
  }

  /**
   * GET /logs/stats
   * Get log statistics for the current tenant
   */
  @Get('stats')
  @Roles('root')
  @HttpCode(HttpStatus.OK)
  async getStats(@CurrentUser() user: NestAuthUser): Promise<LogsStatsResponseData> {
    return await this.logsService.getStats(user);
  }

  /**
   * GET /logs/export
   * Export unified audit logs (audit_trail + root_logs)
   *
   * Supports streaming export for large datasets:
   * - JSON: Streaming JSON array
   * - CSV: Standard CSV with headers
   * - TXT: Human-readable format with header/footer
   *
   * SECURITY: Enforces RLS via set_config before cursor queries.
   * RATE LIMIT: 1 export per minute per user (prevents DoS)
   *
   * @see ADR-009 Central Audit Logging
   */
  @Get('export')
  @Roles('admin', 'root')
  @UseGuards(CustomThrottlerGuard)
  @ExportThrottle() // 1 request per minute - prevent DoS via large exports
  async exportLogs(
    @CurrentUser() user: NestAuthUser,
    @Query(new ZodValidationPipe(ExportLogsQuerySchema)) dto: ExportLogsQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    this.logger.log(
      `[exportLogs] User: ${user.id}, Tenant: ${user.tenantId}, ` +
        `Format: ${dto.format}, Source: ${dto.source}`,
    );

    // Build filter params - only include defined optional properties
    // IMPORTANT: dateTo must be end of day to include entries from that day
    const dateFrom = new Date(dto.dateFrom);
    const dateTo = this.toEndOfDay(new Date(dto.dateTo));

    const filter: LogFilterParams = {
      tenantId: user.tenantId,
      dateFrom,
      dateTo,
      source: dto.source,
      ...(dto.action !== undefined && { action: dto.action }),
      ...(dto.userId !== undefined && { userId: dto.userId }),
      ...(dto.entityType !== undefined && { entityType: dto.entityType }),
    };

    // Validate date range (max 1 year)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 365 days in ms
    if (filter.dateTo.getTime() - filter.dateFrom.getTime() > maxRange) {
      await reply.status(HttpStatus.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'DATE_RANGE_TOO_LARGE',
          message: 'Date range cannot exceed 365 days',
        },
      });
      return;
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-').slice(0, 19);
    const filename = `audit-logs-export-${timestamp}.${dto.format}`;

    // Set response headers
    const contentTypeMap: Record<string, string> = {
      json: 'application/json; charset=utf-8',
      csv: 'text/csv; charset=utf-8',
      txt: 'text/plain; charset=utf-8',
    };

    // Build export content first
    const content = await this.buildExportContent(filter, dto.format);

    this.logger.debug(`[exportLogs] Content length: ${content.length}`);

    // Set headers and send response
    void reply.header('Content-Type', contentTypeMap[dto.format]);
    void reply.header('Content-Disposition', `attachment; filename="${filename}"`);

    return await reply.send(content);
  }

  /**
   * Build export content as a string.
   * Collects all data and formats it.
   *
   * Note: For very large exports (\>100k entries), consider implementing
   * proper Fastify streaming with reply.raw in the future.
   */
  private async buildExportContent(
    filter: LogFilterParams,
    format: 'json' | 'csv' | 'txt',
  ): Promise<string> {
    this.logger.debug(`[buildExportContent] Starting for format: ${format}`);

    // For TXT format, we need metadata (count) upfront
    const metadata =
      format === 'txt'
        ? await this.unifiedLogsService.getExportMetadata(filter)
        : undefined;

    this.logger.debug(`[buildExportContent] Metadata: ${JSON.stringify(metadata)}`);

    const parts: string[] = [];

    // Add header
    parts.push(this.formattersService.getHeader(format, metadata));

    // Collect and format entries
    let isFirst = true;
    let count = 0;
    for await (const entry of this.unifiedLogsService.streamLogs(filter)) {
      parts.push(this.formattersService.formatEntry(entry, format, isFirst));
      isFirst = false;
      count++;
    }

    this.logger.debug(`[buildExportContent] Collected ${count} entries`);

    // Add footer
    parts.push(this.formattersService.getFooter(format));

    return parts.join('');
  }

  /**
   * DELETE /logs
   * Delete logs with filters
   * Requires password confirmation for security
   */
  @Delete()
  @Roles('root')
  @HttpCode(HttpStatus.OK)
  async deleteLogs(
    @CurrentUser() user: NestAuthUser,
    @Body() dto: DeleteLogsBodyDto,
  ): Promise<DeleteLogsResponseData> {
    return await this.logsService.deleteLogs(user, dto);
  }

  /**
   * Convert a date to end of day (23:59:59.999).
   * Used to ensure dateTo filter includes the entire day.
   *
   * @example
   * toEndOfDay(new Date('2026-01-19')) → 2026-01-19T23:59:59.999Z
   */
  private toEndOfDay(date: Date): Date {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  }
}
