/**
 * TPM Plans Controller
 *
 * REST endpoints for maintenance plan management:
 * - POST   /tpm/plans                       — Create plan
 * - GET    /tpm/plans                       — List plans (paginated)
 * - GET    /tpm/plans/interval-matrix       — Card counts per plan × interval
 * - GET    /tpm/plans/available-slots       — Slot availability by machine UUID
 * - GET    /tpm/plans/schedule-projection  — Projected schedules for all plans
 * - GET    /tpm/plans/shift-assignments    — Employees assigned to TPM shifts
 * - GET    /tpm/plans/:uuid                 — Get single plan
 * - PATCH  /tpm/plans/:uuid                 — Update plan
 * - DELETE /tpm/plans/:uuid                 — Soft-delete plan
 * - GET    /tpm/plans/:uuid/time-estimates  — Time estimates for plan
 * - POST   /tpm/plans/:uuid/time-estimates  — Set time estimate
 * - GET    /tpm/plans/:uuid/available-slots     — Slot availability assistant
 * - GET    /tpm/plans/:uuid/team-availability  — Machine team member availability
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
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { TenantFeature } from '../common/decorators/tenant-feature.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto.js';
import { BoardQueryDto } from './dto/board-query.dto.js';
import { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto.js';
import { CreateTimeEstimateDto } from './dto/create-time-estimate.dto.js';
import { ListPlansQueryDto } from './dto/list-plans-query.dto.js';
import { MachineSlotsQueryDto } from './dto/machine-slots-query.dto.js';
import { ScheduleProjectionQueryDto } from './dto/schedule-projection-query.dto.js';
import { ShiftAssignmentsQueryDto } from './dto/shift-assignments-query.dto.js';
import { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto.js';
import type { CardListFilter, PaginatedCards } from './tpm-cards.service.js';
import { TpmCardsService } from './tpm-cards.service.js';
import type {
  IntervalMatrixEntry,
  PaginatedPlans,
} from './tpm-plans.service.js';
import { TpmPlansService } from './tpm-plans.service.js';
import { TpmScheduleProjectionService } from './tpm-schedule-projection.service.js';
import type { TpmShiftAssignment } from './tpm-shift-assignments.service.js';
import { TpmShiftAssignmentsService } from './tpm-shift-assignments.service.js';
import type {
  MachineTeamAvailabilityResult,
  SlotAvailabilityResult,
} from './tpm-slot-assistant.service.js';
import { TpmSlotAssistantService } from './tpm-slot-assistant.service.js';
import { TpmTimeEstimatesService } from './tpm-time-estimates.service.js';
import type {
  ScheduleProjectionResult,
  TpmCardRole,
  TpmCardStatus,
  TpmIntervalType,
  TpmPlan,
  TpmTimeEstimate,
} from './tpm.types.js';

/** Permission constants */
const FEAT = 'tpm';
const MOD_PLANS = 'tpm-plans';

@Controller('tpm/plans')
@TenantFeature('tpm')
export class TpmPlansController {
  constructor(
    private readonly plansService: TpmPlansService,
    private readonly cardsService: TpmCardsService,
    private readonly timeEstimatesService: TpmTimeEstimatesService,
    private readonly slotAssistantService: TpmSlotAssistantService,
    private readonly scheduleProjectionService: TpmScheduleProjectionService,
    private readonly shiftAssignmentsService: TpmShiftAssignmentsService,
  ) {}

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
    return await this.plansService.createPlan(tenantId, user.id, dto);
  }

  /** GET /tpm/plans — List all plans (paginated) */
  @Get()
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async listPlans(
    @Query() query: ListPlansQueryDto,
    @TenantId() tenantId: number,
  ): Promise<PaginatedPlans> {
    return await this.plansService.listPlans(tenantId, query.page, query.limit);
  }

  /** GET /tpm/plans/interval-matrix — Card counts per plan × interval type */
  @Get('interval-matrix')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getIntervalMatrix(
    @TenantId() tenantId: number,
  ): Promise<IntervalMatrixEntry[]> {
    return await this.plansService.getIntervalMatrix(tenantId);
  }

  /** GET /tpm/plans/available-slots — Slot availability by machine UUID (no plan needed) */
  @Get('available-slots')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getAvailableSlotsByMachine(
    @Query() query: MachineSlotsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<SlotAvailabilityResult> {
    const machineId = await this.slotAssistantService.resolveMachineIdByUuid(
      tenantId,
      query.machineUuid,
    );
    return await this.slotAssistantService.getAvailableSlots(
      tenantId,
      machineId,
      query.startDate,
      query.endDate,
      query.shiftPlanRequired,
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

  /** GET /tpm/plans/:uuid — Get single plan by UUID */
  @Get(':uuid')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getPlan(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<TpmPlan> {
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
    return await this.plansService.updatePlan(tenantId, user.id, uuid, dto);
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
    return await this.timeEstimatesService.getEstimatesForPlan(
      tenantId,
      planUuid,
    );
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
      plan.machineId,
      query.startDate,
      query.endDate,
      plan.shiftPlanRequired,
    );
  }

  // ============================================================================
  // TEAM AVAILABILITY
  // ============================================================================

  /** GET /tpm/plans/:uuid/team-availability — Machine team member availability */
  @Get(':uuid/team-availability')
  @RequirePermission(FEAT, MOD_PLANS, 'canRead')
  async getTeamAvailability(
    @Param('uuid') planUuid: string,
    @TenantId() tenantId: number,
  ): Promise<MachineTeamAvailabilityResult> {
    const plan = await this.plansService.getPlan(tenantId, planUuid);
    const today = new Date().toISOString().slice(0, 10);
    return await this.slotAssistantService.getMachineTeamAvailability(
      tenantId,
      plan.machineId,
      today,
    );
  }

  // ============================================================================
  // BOARD DATA
  // ============================================================================

  /** GET /tpm/plans/:uuid/board — All cards for this plan's machine */
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
  if (source.intervalType !== undefined)
    filters.intervalType = source.intervalType;
  if (source.cardRole !== undefined) filters.cardRole = source.cardRole;
  return filters;
}
