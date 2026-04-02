/**
 * Audit Trail Controller (NestJS)
 *
 * Handles HTTP requests for audit logging and compliance.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { attachmentHeader } from '../../utils/content-disposition.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { CurrentUser, Roles } from '../common/index.js';
import type { NestAuthUser } from '../common/index.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AuditTrailService } from './audit-trail.service.js';
import {
  DeleteOldEntriesBodyDto,
  DeleteOldEntriesBodySchema,
  EntryIdParamDto,
  EntryIdParamSchema,
  ExportEntriesQueryDto,
  ExportEntriesQuerySchema,
  GenerateReportBodyDto,
  GenerateReportBodySchema,
  GetEntriesQueryDto,
  GetEntriesQuerySchema,
  GetStatsQueryDto,
  GetStatsQuerySchema,
} from './dto/index.js';
import type {
  AuditEntryResponse,
  AuditStatsResponseData,
  ComplianceReportResponseData,
  DeleteOldEntriesResponseData,
  GetEntriesResponseData,
} from './dto/index.js';

/**
 * Response type for get entries endpoint
 */
interface GetEntriesApiResponse {
  success: true;
  data: GetEntriesResponseData;
  message: string;
}

/**
 * Response type for get entry endpoint
 */
interface GetEntryApiResponse {
  success: true;
  data: AuditEntryResponse;
  message: string;
}

/**
 * Response type for get stats endpoint
 */
interface GetStatsApiResponse {
  success: true;
  data: AuditStatsResponseData;
  message: string;
}

/**
 * Response type for generate report endpoint
 */
interface GenerateReportApiResponse {
  success: true;
  data: ComplianceReportResponseData;
  message: string;
}

/**
 * Response type for delete old entries endpoint
 */
interface DeleteOldEntriesApiResponse {
  success: true;
  data: DeleteOldEntriesResponseData;
  message: string;
}

/**
 * Audit Trail Controller
 *
 * Endpoints:
 * - GET /api/v2/audit-trail - Get audit entries (all users)
 * - GET /api/v2/audit-trail/stats - Get statistics (admin/root)
 * - POST /api/v2/audit-trail/reports - Generate report (admin/root)
 * - GET /api/v2/audit-trail/export - Export entries (admin/root)
 * - DELETE /api/v2/audit-trail/retention - Delete old entries (root)
 * - GET /api/v2/audit-trail/:id - Get specific entry (all users)
 */
/** Permission constants */
const FEAT = 'audit_trail';
const MOD_VIEW = 'audit-view';
const MOD_EXPORT = 'audit-export';
const MOD_RETENTION = 'audit-retention';

@RequireAddon('audit_trail')
@Controller('audit-trail')
export class AuditTrailController {
  private readonly logger = new Logger(AuditTrailController.name);

  constructor(private readonly auditTrailService: AuditTrailService) {}

  /**
   * Get audit entries with filters and pagination
   */
  @Get()
  async getEntries(
    @CurrentUser() currentUser: NestAuthUser,
    @Query(new ZodValidationPipe(GetEntriesQuerySchema))
    dto: GetEntriesQueryDto,
  ): Promise<GetEntriesApiResponse> {
    this.logger.log(`[getEntries] User: ${currentUser.id}`);

    const result = await this.auditTrailService.getEntries(currentUser, dto);

    return {
      success: true,
      data: result,
      message: 'Audit entries retrieved successfully',
    };
  }

  /**
   * Get audit statistics
   */
  @Get('stats')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_VIEW, 'canRead')
  async getStats(
    @CurrentUser() currentUser: NestAuthUser,
    @Query(new ZodValidationPipe(GetStatsQuerySchema)) dto: GetStatsQueryDto,
  ): Promise<GetStatsApiResponse> {
    this.logger.log(`[getStats] User: ${currentUser.id}`);

    const stats = await this.auditTrailService.getStats(currentUser, dto);

    return {
      success: true,
      data: stats,
      message: 'Audit statistics retrieved successfully',
    };
  }

  /**
   * Generate compliance report
   */
  @Post('reports')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_EXPORT, 'canWrite')
  async generateReport(
    @CurrentUser() currentUser: NestAuthUser,
    @Body(new ZodValidationPipe(GenerateReportBodySchema))
    dto: GenerateReportBodyDto,
  ): Promise<GenerateReportApiResponse> {
    this.logger.log(`[generateReport] User: ${currentUser.id}, Type: ${dto.reportType}`);

    const report = await this.auditTrailService.generateReport(currentUser, dto);

    return {
      success: true,
      data: report,
      message: 'Compliance report generated successfully',
    };
  }

  /**
   * Export audit entries (JSON or CSV)
   */
  @Get('export')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_EXPORT, 'canRead')
  async exportEntries(
    @CurrentUser() currentUser: NestAuthUser,
    @Query(new ZodValidationPipe(ExportEntriesQuerySchema))
    dto: ExportEntriesQueryDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    this.logger.log(`[exportEntries] User: ${currentUser.id}, Format: ${dto.format ?? 'json'}`);

    const result = await this.auditTrailService.exportEntries(
      currentUser,
      dto,
      req.ip,
      req.headers['user-agent'],
    );

    if (result.format === 'csv') {
      const csv = this.auditTrailService.generateCSV(result.entries);
      await reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', attachmentHeader('audit-trail-export.csv'))
        .send(csv);
    } else {
      await reply.send({
        success: true,
        data: result.entries,
        message: 'Audit entries exported successfully',
      });
    }
  }

  /**
   * Delete old audit entries (data retention)
   */
  @Delete('retention')
  @Roles('root')
  @RequirePermission(FEAT, MOD_RETENTION, 'canDelete')
  async deleteOldEntries(
    @CurrentUser() currentUser: NestAuthUser,
    @Body(new ZodValidationPipe(DeleteOldEntriesBodySchema))
    dto: DeleteOldEntriesBodyDto,
    @Req() req: FastifyRequest,
  ): Promise<DeleteOldEntriesApiResponse> {
    this.logger.log(`[deleteOldEntries] User: ${currentUser.id}, Days: ${dto.olderThanDays}`);

    const result = await this.auditTrailService.deleteOldEntries(
      currentUser,
      dto,
      req.ip,
      req.headers['user-agent'],
    );

    return {
      success: true,
      data: result,
      message: `Deleted ${result.deletedCount} audit entries`,
    };
  }

  /**
   * Get audit entry by ID
   */
  @Get(':id')
  async getEntry(
    @CurrentUser() currentUser: NestAuthUser,
    @Param(new ZodValidationPipe(EntryIdParamSchema)) params: EntryIdParamDto,
  ): Promise<GetEntryApiResponse> {
    this.logger.log(`[getEntry] User: ${currentUser.id}, Entry: ${params.id}`);

    const entry = await this.auditTrailService.getEntryById(currentUser, params.id);

    return {
      success: true,
      data: entry,
      message: 'Audit entry retrieved successfully',
    };
  }
}
