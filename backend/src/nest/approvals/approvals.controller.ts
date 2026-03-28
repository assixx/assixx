/**
 * Approvals Controller — REST endpoints for Freigabe-System
 * @module approvals/approvals.controller
 *
 * Core addon (is_core=true) — no @RequireAddon needed.
 * 10 endpoints: config CRUD + approval lifecycle.
 * Static routes before parameterized routes.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { ReadTrackingConfig } from '../common/services/read-tracking.service.js';
import { ReadTrackingService } from '../common/services/read-tracking.service.js';
import { ApprovalsConfigService } from './approvals-config.service.js';
import { ApprovalsService } from './approvals.service.js';
import type { Approval, ApprovalConfig, ApprovalStats, ApprovalStatus } from './approvals.types.js';
import {
  ApproveApprovalDto,
  CreateApprovalDto,
  RejectApprovalDto,
  UpsertApprovalConfigDto,
} from './dto/index.js';

/** Permission constants */
const FEAT = 'approvals';
const MOD_MANAGE = 'approvals-manage';
const MOD_REQUEST = 'approvals-request';

/** Read-tracking config for approvals (ADR-031 pattern) */
const APPROVAL_READ_CONFIG: ReadTrackingConfig = {
  tableName: 'approval_read_status',
  entityColumn: 'approval_id',
  entityTable: 'approvals',
  entityUuidColumn: 'uuid',
};

/** Query DTO for list endpoints */
interface ListApprovalsQuery {
  status?: ApprovalStatus;
  addonCode?: string;
  priority?: string;
  page?: string;
  limit?: string;
}

@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly configService: ApprovalsConfigService,
    private readonly approvalsService: ApprovalsService,
    private readonly readTracking: ReadTrackingService,
  ) {}

  // ==========================================================================
  // Config endpoints (static routes first)
  // ==========================================================================

  @Get('configs')
  @RequirePermission(FEAT, MOD_MANAGE, 'canRead')
  async getConfigs(): Promise<ApprovalConfig[]> {
    return await this.configService.getConfigs();
  }

  @Put('configs')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async upsertConfig(
    @Body() dto: UpsertApprovalConfigDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<ApprovalConfig> {
    return await this.configService.createConfig(dto, tenantId, user.id);
  }

  // ==========================================================================
  // Approval list endpoints (static routes)
  // ==========================================================================

  @Get('my')
  @RequirePermission(FEAT, MOD_REQUEST, 'canRead')
  async getMyApprovals(@CurrentUser() user: NestAuthUser): Promise<Approval[]> {
    return await this.approvalsService.findByRequester(user.id);
  }

  @Get('assigned')
  @RequirePermission(FEAT, MOD_MANAGE, 'canRead')
  async getAssigned(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Query() query: ListApprovalsQuery,
  ): Promise<ReturnType<ApprovalsService['findByAssignee']>> {
    return await this.approvalsService.findByAssignee(user.id, tenantId, {
      status: query.status,
      page: query.page !== undefined ? Number(query.page) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
    });
  }

  @Get('stats')
  @RequirePermission(FEAT, MOD_MANAGE, 'canRead')
  async getStats(@Query('userId') userId?: string): Promise<ApprovalStats> {
    return await this.approvalsService.getStats(userId !== undefined ? Number(userId) : undefined);
  }

  // ==========================================================================
  // Approval CRUD (parameterized routes after static)
  // ==========================================================================

  @Get()
  @RequirePermission(FEAT, MOD_MANAGE, 'canRead')
  async listAll(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Query() query: ListApprovalsQuery,
  ): Promise<ReturnType<ApprovalsService['findAll']>> {
    return await this.approvalsService.findAll(
      {
        status: query.status,
        addonCode: query.addonCode,
        priority: query.priority,
        page: query.page !== undefined ? Number(query.page) : undefined,
        limit: query.limit !== undefined ? Number(query.limit) : undefined,
      },
      user.id,
      tenantId,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_REQUEST, 'canWrite')
  async create(
    @Body() dto: CreateApprovalDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<Approval> {
    return await this.approvalsService.create(dto, tenantId, user.id);
  }

  @Get(':uuid')
  @RequirePermission(FEAT, MOD_MANAGE, 'canRead')
  async getById(@Param('uuid') uuid: string): Promise<Approval> {
    return await this.approvalsService.findById(uuid);
  }

  @Post(':uuid/approve')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async approve(
    @Param('uuid') uuid: string,
    @Body() dto: ApproveApprovalDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<Approval> {
    return await this.approvalsService.approve(
      uuid,
      tenantId,
      user.id,
      dto.decisionNote ?? null,
      dto.rewardAmount ?? null,
    );
  }

  @Post(':uuid/reject')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async reject(
    @Param('uuid') uuid: string,
    @Body() dto: RejectApprovalDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<Approval> {
    return await this.approvalsService.reject(uuid, tenantId, user.id, dto.decisionNote);
  }

  // ==========================================================================
  // Read-tracking (ADR-031)
  // ==========================================================================

  @Post(':uuid/read')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_MANAGE, 'canRead')
  async markAsRead(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ success: boolean }> {
    await this.readTracking.markAsReadByUuid(APPROVAL_READ_CONFIG, uuid, user.id, tenantId);
    return { success: true };
  }

  // ==========================================================================
  // Config delete (parameterized)
  // ==========================================================================

  @Delete('configs/:uuid')
  @RequirePermission(FEAT, MOD_MANAGE, 'canDelete')
  async deleteConfig(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<void> {
    await this.configService.deleteConfig(uuid, tenantId, user.id);
  }
}
