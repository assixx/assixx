/**
 * Reports Controller
 *
 * HTTP endpoints for reporting and analytics:
 * - GET    /reports/overview      - Get company overview report
 * - GET    /reports/employees     - Get employee analytics
 * - GET    /reports/departments   - Get department analytics
 * - GET    /reports/shifts        - Get shift analytics
 * - GET    /reports/kvp           - Get KVP ROI report
 * - POST   /reports/custom        - Generate custom report
 * - GET    /reports/export/:type  - Export report (CSV)
 */
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import {
  CustomReportDto,
  DateRangeQueryDto,
  EmployeeReportQueryDto,
  ExportReportQueryDto,
  KvpReportQueryDto,
  ReportTypeParamDto,
  ShiftReportQueryDto,
} from './dto/index.js';
import { ReportsService } from './reports.service.js';

/** Permission constants */
const FEAT = 'reports';
const MOD_VIEW = 'reports-view';
const MOD_EXPORT = 'reports-export';

@Roles('admin', 'root')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @RequirePermission(FEAT, MOD_VIEW, 'canRead')
  async getOverviewReport(
    @TenantId() tenantId: number,
    @Query() query: DateRangeQueryDto,
  ): Promise<unknown> {
    return await this.reportsService.getOverviewReport(
      tenantId,
      query.dateFrom,
      query.dateTo,
    );
  }

  @Get('employees')
  @RequirePermission(FEAT, MOD_VIEW, 'canRead')
  async getEmployeeReport(
    @TenantId() tenantId: number,
    @Query() query: EmployeeReportQueryDto,
  ): Promise<unknown> {
    return await this.reportsService.getEmployeeReport(
      tenantId,
      query.dateFrom,
      query.dateTo,
      query.departmentId,
      query.teamId,
    );
  }

  @Get('departments')
  @RequirePermission(FEAT, MOD_VIEW, 'canRead')
  async getDepartmentReport(
    @TenantId() tenantId: number,
    @Query() query: DateRangeQueryDto,
  ): Promise<unknown> {
    return await this.reportsService.getDepartmentReport(
      tenantId,
      query.dateFrom,
      query.dateTo,
    );
  }

  @Get('shifts')
  @RequirePermission(FEAT, MOD_VIEW, 'canRead')
  async getShiftReport(
    @TenantId() tenantId: number,
    @Query() query: ShiftReportQueryDto,
  ): Promise<unknown> {
    return await this.reportsService.getShiftReport(
      tenantId,
      query.dateFrom,
      query.dateTo,
      query.departmentId,
      query.teamId,
    );
  }

  @Get('kvp')
  @RequirePermission(FEAT, MOD_VIEW, 'canRead')
  async getKvpReport(
    @TenantId() tenantId: number,
    @Query() query: KvpReportQueryDto,
  ): Promise<unknown> {
    return await this.reportsService.getKvpReport(
      tenantId,
      query.dateFrom,
      query.dateTo,
      query.categoryId,
    );
  }

  @Post('custom')
  @RequirePermission(FEAT, MOD_EXPORT, 'canWrite')
  async generateCustomReport(
    @TenantId() tenantId: number,
    @Body() dto: CustomReportDto,
  ): Promise<unknown> {
    return await this.reportsService.generateCustomReport({
      tenantId,
      name: dto.name,
      description: dto.description,
      metrics: dto.metrics,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      filters: dto.filters,
      groupBy: dto.groupBy,
    });
  }

  @Get('export/:type')
  @RequirePermission(FEAT, MOD_EXPORT, 'canRead')
  async exportReport(
    @TenantId() tenantId: number,
    @Param() params: ReportTypeParamDto,
    @Query() query: ExportReportQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.reportsService.exportReport({
      tenantId,
      reportType: params.type,
      format: query.format,
      filters: {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        departmentId: query.departmentId,
        teamId: query.teamId,
      },
    });

    await reply
      .header('Content-Type', result.mimeType)
      .header(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`,
      )
      .send(result.content);
  }
}
