/**
 * TPM Plans Controller
 *
 * REST endpoints for maintenance plan management:
 * - POST   /tpm/plans                       — Create plan
 * - GET    /tpm/plans                       — List plans (paginated)
 * - GET    /tpm/plans/interval-matrix       — Card counts per plan × interval
 * - GET    /tpm/plans/available-slots       — Slot availability by asset UUID
 * - GET    /tpm/plans/schedule-projection  — Projected schedules for all plans
 * - GET    /tpm/plans/shift-assignments           — Employees assigned to TPM shifts
 * - GET    /tpm/plans/shift-assignments/calendar — Lightweight calendar view of TPM assignments
 * - GET    /tpm/plans/:uuid                 — Get single plan
 * - PATCH  /tpm/plans/:uuid                 — Update plan
 * - DELETE /tpm/plans/:uuid                 — Soft-delete plan
 * - GET    /tpm/plans/:uuid/time-estimates  — Time estimates for plan
 * - POST   /tpm/plans/:uuid/time-estimates  — Set time estimate
 * - GET    /tpm/plans/:uuid/available-slots     — Slot availability assistant
 * - GET    /tpm/plans/:uuid/team-availability  — Asset team member availability
 * - POST   /tpm/plans/:uuid/assignments         — Set assignments for a date
 * - GET    /tpm/plans/:uuid/assignments         — Get assignments for date range
 * - GET    /tpm/plans/:uuid/board               — Board data (cards for plan)
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { AssetSlotsQueryDto } from './dto/asset-slots-query.dto.js';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto.js';
import { BoardQueryDto } from './dto/board-query.dto.js';
import { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto.js';
import { CreateTimeEstimateDto } from './dto/create-time-estimate.dto.js';
import { ListPlansQueryDto } from './dto/list-plans-query.dto.js';
import { ListRevisionsQueryDto } from './dto/list-revisions-query.dto.js';
import { ScheduleProjectionQueryDto } from './dto/schedule-projection-query.dto.js';
import { SetPlanAssignmentsDto } from './dto/set-plan-assignments.dto.js';
import { ShiftAssignmentsQueryDto } from './dto/shift-assignments-query.dto.js';
import { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto.js';
import type { CardListFilter, PaginatedCards } from './tpm-cards.service.js';
import { TpmCardsService } from './tpm-cards.service.js';
import { TpmPlanApprovalService } from './tpm-plan-approval.service.js';
import { TpmPlanRevisionsService } from './tpm-plan-revisions.service.js';
import type { IntervalMatrixEntry, PaginatedPlans } from './tpm-plans.service.js';
import { TpmPlansService } from './tpm-plans.service.js';
import { TpmScheduleProjectionService } from './tpm-schedule-projection.service.js';
import type {
  CalendarTpmAssignment,
  TpmPlanAssignment,
  TpmShiftAssignment,
} from './tpm-shift-assignments.service.js';
import { TpmShiftAssignmentsService } from './tpm-shift-assignments.service.js';
import type {
  AssetTeamAvailabilityResult,
  SlotAvailabilityResult,
} from './tpm-slot-assistant.service.js';
import { TpmSlotAssistantService } from './tpm-slot-assistant.service.js';
import { TpmTimeEstimatesService } from './tpm-time-estimates.service.js';
import type {
  ScheduleProjectionResult,
  TpmCardRole,
  TpmCardStatus,
  TpmIntervalType,
  TpmMyPermissions,
  TpmPlan,
  TpmPlanRevision,
  TpmPlanRevisionList,
  TpmScopedOrgData,
  TpmTimeEstimate,
} from './tpm.types.js';

/** Permission constants */
const FEAT = 'tpm';
const MOD_PLANS = 'tpm-plans';

@Controller('tpm/plans')
@RequireAddon('tpm')
export class TpmPlansController {
  constructor(
    private readonly plansService: TpmPlansService,
    private readonly cardsService: TpmCardsService,
    private readonly timeEstimatesService: TpmTimeEstimatesService,
    private readonly slotAssistantService: TpmSlotAssistantService,
    private readonly scheduleProjectionService: TpmScheduleProjectionService,
    private readonly shiftAssignmentsService: TpmShiftAssignmentsService,
    private readonly revisionsService: TpmPlanRevisionsService,
    private readonly planApprovalService: TpmPlanApprovalService,
  ) {}

  // ============================================================================
  // SCOPE + PERMISSIONS
  // ============================================================================

  /** GET /tpm/plans/my-permissions — User's effective TPM permissions */
  @Get('my-permissions')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getMyPermissions(@CurrentUser() user: NestAuthUser): Promise<TpmMyPermissions> {
    return await this.plansService.getMyPermissions(user.id, user.hasFullAccess);
  }

  /** GET /tpm/plans/my-assets — Scoped org data for plan creation */
  @Get('my-assets')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getMyAssets(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmScopedOrgData> {
    return await this.plansService.getScopedOrgData(tenantId, user);
  }

  // ============================================================================
  // PLAN CRUD
  // ============================================================================

  /** POST /tpm/plans — Create a maintenance plan */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_PLANS, 'canWrite')
  async createPlan(
    @Body() dto: CreateMaintenancePlanDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmPlan> {
    const plan = await this.plansService.createPlan(tenantId, user.id, dto);

    // Fire-and-forget: approval failure must not block plan creation (D6)
    void this.planApprovalService.requestApproval(
      tenantId,
      user.id,
      plan.uuid,
      plan.name,
      plan.assetName ?? '',
    );

    return plan;
  }

  /** GET /tpm/plans — List all plans (paginated, scoped by user) */
  @Get()
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async listPlans(
    @Query() query: ListPlansQueryDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<PaginatedPlans> {
    return await this.plansService.listPlans(tenantId, query.page, query.limit, user);
  }

  /** GET /tpm/plans/interval-matrix — Card counts per plan × interval type (scoped) */
  @Get('interval-matrix')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getIntervalMatrix(
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<IntervalMatrixEntry[]> {
    return await this.plansService.getIntervalMatrix(tenantId, user);
  }

  /** GET /tpm/plans/available-slots — Slot availability by asset UUID (no plan needed) */
  @Get('available-slots')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getAvailableSlotsByAsset(
    @Query() query: AssetSlotsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<SlotAvailabilityResult> {
    const assetId = await this.slotAssistantService.resolveAssetIdByUuid(tenantId, query.assetUuid);
    return await this.slotAssistantService.getAvailableSlots(
      tenantId,
      assetId,
      query.startDate,
      query.endDate,
    );
  }

  /** GET /tpm/plans/schedule-projection — Projected schedules for all active plans */
  @Get('schedule-projection')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getScheduleProjection(
    @Query() query: ScheduleProjectionQueryDto,
    @TenantId() tenantId: number,
  ): Promise<ScheduleProjectionResult> {
    return await this.scheduleProjectionService.projectSchedules(
      tenantId,
      query.startDate,
      query.endDate,
      query.excludePlanUuid,
    );
  }

  /** GET /tpm/plans/shift-assignments — Employees assigned to TPM maintenance shifts */
  @Get('shift-assignments')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getShiftAssignments(
    @Query() query: ShiftAssignmentsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<TpmShiftAssignment[]> {
    return await this.shiftAssignmentsService.getShiftAssignments(
      tenantId,
      query.startDate,
      query.endDate,
    );
  }

  /** GET /tpm/plans/shift-assignments/calendar — Lightweight calendar view of TPM assignments */
  @Get('shift-assignments/calendar')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getCalendarAssignments(
    @Query() query: ShiftAssignmentsQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<CalendarTpmAssignment[]> {
    const isAdmin = user.role === 'admin' || user.role === 'root';
    return await this.shiftAssignmentsService.getCalendarAssignments(
      tenantId,
      user.id,
      isAdmin,
      query.startDate,
      query.endDate,
    );
  }

  /** POST /tpm/plans/:uuid/archive — Archive plan (is_active=3) */
  @Post(':uuid/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_PLANS, 'canWrite')
  async archivePlan(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ message: string; plan: TpmPlan }> {
    const plan = await this.plansService.archivePlan(tenantId, user.id, uuid);
    return { message: 'Wartungsplan archiviert', plan };
  }

  /** POST /tpm/plans/:uuid/unarchive — Restore archived plan (is_active=1) */
  @Post(':uuid/unarchive')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_PLANS, 'canWrite')
  async unarchivePlan(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ message: string; plan: TpmPlan }> {
    const plan = await this.plansService.unarchivePlan(tenantId, user.id, uuid);
    return { message: 'Wartungsplan wiederhergestellt', plan };
  }

  /** GET /tpm/plans/:uuid — Get single plan by UUID */
  @Get(':uuid')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getPlan(@Param('uuid') uuid: string, @TenantId() tenantId: number): Promise<TpmPlan> {
    return await this.plansService.getPlan(tenantId, uuid);
  }

  /** PATCH /tpm/plans/:uuid — Update plan */
  @Patch(':uuid')
  @RequirePermission(FEAT, MOD_PLANS, 'canWrite')
  async updatePlan(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateMaintenancePlanDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmPlan> {
    const plan = await this.plansService.updatePlan(tenantId, user.id, uuid, dto);

    // D3: Only request approval if no pending approval exists for this plan
    void (async (): Promise<void> => {
      const hasPending = await this.planApprovalService.hasPendingApproval(tenantId, uuid);
      if (!hasPending) {
        await this.planApprovalService.requestApproval(
          tenantId,
          user.id,
          plan.uuid,
          plan.name,
          plan.assetName ?? '',
        );
      }
    })();

    return plan;
  }

  /** DELETE /tpm/plans/:uuid — Soft-delete plan (is_active=4) */
  @Delete(':uuid')
  @RequirePermission(FEAT, MOD_PLANS, 'canDelete')
  async deletePlan(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ message: string }> {
    await this.plansService.deletePlan(tenantId, user.id, uuid);
    return { message: 'Wartungsplan gelöscht' };
  }

  // ============================================================================
  // TIME ESTIMATES (nested under plan)
  // ============================================================================

  /** GET /tpm/plans/:uuid/time-estimates — Get all estimates for a plan */
  @Get(':uuid/time-estimates')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getTimeEstimates(
    @Param('uuid') planUuid: string,
    @TenantId() tenantId: number,
  ): Promise<TpmTimeEstimate[]> {
    return await this.timeEstimatesService.getEstimatesForPlan(tenantId, planUuid);
  }

  /** POST /tpm/plans/:uuid/time-estimates — Set (upsert) a time estimate */
  @Post(':uuid/time-estimates')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_PLANS, 'canWrite')
  async setTimeEstimate(
    @Body() dto: CreateTimeEstimateDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmTimeEstimate> {
    return await this.timeEstimatesService.setEstimate(tenantId, user.id, dto);
  }

  // ============================================================================
  // SLOT ASSISTANT
  // ============================================================================

  /** GET /tpm/plans/:uuid/available-slots — Check slot availability */
  @Get(':uuid/available-slots')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getAvailableSlots(
    @Param('uuid') planUuid: string,
    @Query() query: AvailableSlotsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<SlotAvailabilityResult> {
    const plan = await this.plansService.getPlan(tenantId, planUuid);
    return await this.slotAssistantService.getAvailableSlots(
      tenantId,
      plan.assetId,
      query.startDate,
      query.endDate,
    );
  }

  // ============================================================================
  // TEAM AVAILABILITY
  // ============================================================================

  /** GET /tpm/plans/:uuid/team-availability — Asset team member availability */
  @Get(':uuid/team-availability')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getTeamAvailability(
    @Param('uuid') planUuid: string,
    @TenantId() tenantId: number,
  ): Promise<AssetTeamAvailabilityResult> {
    const plan = await this.plansService.getPlan(tenantId, planUuid);
    const today = new Date().toISOString().slice(0, 10);
    return await this.slotAssistantService.getAssetTeamAvailability(tenantId, plan.assetId, today);
  }

  // ============================================================================
  // PLAN ASSIGNMENTS (direct employee-to-date)
  // ============================================================================

  /** POST /tpm/plans/:uuid/assignments — Set assignments for a specific date */
  @Post(':uuid/assignments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(FEAT, MOD_PLANS, 'canWrite')
  async setAssignments(
    @Param('uuid') planUuid: string,
    @Body() dto: SetPlanAssignmentsDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<TpmPlanAssignment[]> {
    return await this.shiftAssignmentsService.setAssignments(
      tenantId,
      user.id,
      planUuid,
      dto.userIds,
      dto.scheduledDate,
    );
  }

  /** GET /tpm/plans/:uuid/assignments — Get assignments for a date range */
  @Get(':uuid/assignments')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getAssignmentsForPlan(
    @Param('uuid') planUuid: string,
    @Query() query: ShiftAssignmentsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<TpmPlanAssignment[]> {
    return await this.shiftAssignmentsService.getAssignmentsForPlan(
      tenantId,
      planUuid,
      query.startDate,
      query.endDate,
    );
  }

  // ============================================================================
  // BOARD DATA
  // ============================================================================

  /** GET /tpm/plans/:uuid/board — All cards for this plan's asset */
  @Get(':uuid/board')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getBoardData(
    @Param('uuid') planUuid: string,
    @Query() query: BoardQueryDto,
    @TenantId() tenantId: number,
  ): Promise<PaginatedCards> {
    const filters = buildFilters(query);
    return await this.cardsService.listCardsForPlan(
      tenantId,
      planUuid,
      query.page,
      query.limit,
      filters,
    );
  }

  // ============================================================================
  // REVISIONS (ISO 9001 plan version history)
  // ============================================================================

  /** GET /tpm/plans/:uuid/revisions — List all revisions for a plan */
  @Get(':uuid/revisions')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async listRevisions(
    @Param('uuid') planUuid: string,
    @Query() query: ListRevisionsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<TpmPlanRevisionList> {
    return await this.revisionsService.listRevisions(tenantId, planUuid, query.page, query.limit);
  }

  /** GET /tpm/plans/:uuid/revisions/:revisionUuid — Get single revision */
  @Get(':uuid/revisions/:revisionUuid')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getRevision(
    @Param('revisionUuid') revisionUuid: string,
    @TenantId() tenantId: number,
  ): Promise<TpmPlanRevision> {
    return await this.revisionsService.getRevision(tenantId, revisionUuid);
  }
}

// ============================================================================
// Helpers (module-level pure functions)
// ============================================================================

/** Extract defined filter properties (avoids undefined with exactOptionalPropertyTypes) */
function buildFilters(source: {
  status?: TpmCardStatus | undefined;
  intervalType?: TpmIntervalType | undefined;
  cardRole?: TpmCardRole | undefined;
}): CardListFilter {
  const filters: CardListFilter = {};
  if (source.status !== undefined) filters.status = source.status;
  if (source.intervalType !== undefined) filters.intervalType = source.intervalType;
  if (source.cardRole !== undefined) filters.cardRole = source.cardRole;
  return filters;
}
