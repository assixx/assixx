/**
 * Vacation Controller
 *
 * REST API endpoints for the vacation request system.
 * 26 endpoints across 8 resource groups:
 *   - Requests (8): CRUD + respond/withdraw/cancel
 *   - Capacity (1): analyzeCapacity
 *   - Entitlements (4): balance, CRUD, addDays
 *   - Blackouts (4): CRUD
 *   - Staffing Rules (4): CRUD
 *   - Holidays (4): CRUD
 *   - Settings (2): get + update
 *   - Overview (2): team calendar + overview (balance)
 *
 * Guards: JwtAuthGuard + RolesGuard (class-level), @RequireAddon('vacation') (tenant addon gate)
 * Permissions: RequirePermission decorator (ADR-020)
 * Response: raw data — ResponseInterceptor wraps (ADR-007)
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import {
  CapacityQueryDto,
  CreateBlackoutDto,
  CreateEntitlementDto,
  CreateHolidayDto,
  CreateStaffingRuleDto,
  CreateVacationRequestDto,
  RespondVacationRequestDto,
  UpdateBlackoutDto,
  UpdateHolidayDto,
  UpdateSettingsDto,
  UpdateStaffingRuleDto,
  UpdateVacationRequestDto,
  VacationQueryDto,
} from './dto/index.js';
import { VacationBlackoutsService } from './vacation-blackouts.service.js';
import type { CapacityAnalysisParams } from './vacation-capacity.service.js';
import { VacationCapacityService } from './vacation-capacity.service.js';
import { VacationEntitlementsService } from './vacation-entitlements.service.js';
import { VacationHolidaysService } from './vacation-holidays.service.js';
import { VacationQueriesService } from './vacation-queries.service.js';
import { VacationSettingsService } from './vacation-settings.service.js';
import { VacationStaffingRulesService } from './vacation-staffing-rules.service.js';
import { VacationService } from './vacation.service.js';
import type {
  CalendarVacationEntry,
  PaginatedResult,
  TeamCalendarData,
  VacationBalance,
  VacationBlackout,
  VacationCapacityAnalysis,
  VacationEntitlement,
  VacationHoliday,
  VacationRequest,
  VacationSettings,
  VacationStaffingRule,
} from './vacation.types.js';

// Permission constants (match vacation.permissions.ts)
const FEAT = 'vacation';
const MOD_REQUESTS = 'vacation-requests';
const MOD_RULES = 'vacation-rules';
const MOD_ENTITLEMENTS = 'vacation-entitlements';
const MOD_HOLIDAYS = 'vacation-holidays';
const MOD_OVERVIEW = 'vacation-overview';

@Controller('vacation')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireAddon('vacation')
export class VacationController {
  constructor(
    private readonly vacationService: VacationService,
    private readonly queriesService: VacationQueriesService,
    private readonly capacityService: VacationCapacityService,
    private readonly entitlementsService: VacationEntitlementsService,
    private readonly blackoutsService: VacationBlackoutsService,
    private readonly staffingRulesService: VacationStaffingRulesService,
    private readonly holidaysService: VacationHolidaysService,
    private readonly settingsService: VacationSettingsService,
  ) {}

  // ==========================================================================
  // Requests (8 endpoints)
  // ==========================================================================

  /** POST /vacation/requests — Create a new vacation request. */
  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(FEAT, MOD_REQUESTS, 'canWrite')
  async createRequest(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateVacationRequestDto,
  ): Promise<VacationRequest> {
    return await this.vacationService.createRequest(user.id, user.tenantId, dto);
  }

  /** GET /vacation/requests — List own vacation requests (paginated). */
  @Get('requests')
  @RequirePermission(FEAT, MOD_REQUESTS, 'canRead')
  async getMyRequests(
    @CurrentUser() user: JwtPayload,
    @Query() query: VacationQueryDto,
  ): Promise<PaginatedResult<VacationRequest>> {
    return await this.queriesService.getMyRequests(user.id, user.tenantId, query);
  }

  /**
   * GET /vacation/requests/incoming — List incoming requests for approval.
   * MUST be before `:id` route to avoid param collision.
   */
  @Get('requests/incoming')
  @RequirePermission(FEAT, MOD_REQUESTS, 'canRead')
  async getIncomingRequests(
    @CurrentUser() user: JwtPayload,
    @Query() query: VacationQueryDto,
  ): Promise<PaginatedResult<VacationRequest>> {
    return await this.queriesService.getIncomingRequests(user.id, user.tenantId, query);
  }

  /**
   * GET /vacation/notifications/unread-ids — Request IDs with unread notifications.
   * Used by the frontend to show "Neu" badges on request cards.
   */
  @Get('notifications/unread-ids')
  @RequirePermission(FEAT, MOD_REQUESTS, 'canRead')
  async getUnreadNotificationRequestIds(@CurrentUser() user: JwtPayload): Promise<string[]> {
    return await this.queriesService.getUnreadNotificationRequestIds(user.tenantId, user.id);
  }

  /** GET /vacation/requests/:id — Get a single vacation request by ID. */
  @Get('requests/:id')
  @RequirePermission(FEAT, MOD_REQUESTS, 'canRead')
  async getRequestById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<VacationRequest> {
    return await this.queriesService.getRequestById(user.tenantId, id);
  }

  /** PATCH /vacation/requests/:id — Edit a pending vacation request (requester only). */
  @Patch('requests/:id')
  @RequirePermission(FEAT, MOD_REQUESTS, 'canWrite')
  async editRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateVacationRequestDto,
  ): Promise<VacationRequest> {
    return await this.vacationService.editRequest(user.id, user.tenantId, id, dto);
  }

  /** PATCH /vacation/requests/:id/respond — Approve or deny a vacation request. */
  @Patch('requests/:id/respond')
  @RequirePermission(FEAT, MOD_REQUESTS, 'canWrite')
  async respondToRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RespondVacationRequestDto,
  ): Promise<VacationRequest> {
    return await this.vacationService.respondToRequest(user.id, user.tenantId, id, dto);
  }

  /** PATCH /vacation/requests/:id/withdraw — Withdraw own request. */
  @Patch('requests/:id/withdraw')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(FEAT, MOD_REQUESTS, 'canWrite')
  async withdrawRequest(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.vacationService.withdrawRequest(user.id, user.tenantId, id);
  }

  /** PATCH /vacation/requests/:id/cancel — Cancel approved request (admin/root/approver). */
  @Patch('requests/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'root', 'employee')
  @RequirePermission(FEAT, MOD_REQUESTS, 'canWrite')
  async cancelRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<void> {
    await this.vacationService.cancelRequest(user.id, user.tenantId, id, reason);
  }

  // ==========================================================================
  // Capacity (1 endpoint)
  // ==========================================================================

  /** GET /vacation/capacity — Analyze team capacity for a date range. */
  @Get('capacity')
  @RequirePermission(FEAT, MOD_REQUESTS, 'canRead')
  async analyzeCapacity(
    @CurrentUser() user: JwtPayload,
    @Query() query: CapacityQueryDto,
  ): Promise<VacationCapacityAnalysis> {
    const params: CapacityAnalysisParams = {
      tenantId: user.tenantId,
      startDate: query.startDate,
      endDate: query.endDate,
      requesterId: query.requesterId ?? user.id,
    };
    return await this.capacityService.analyzeCapacity(params);
  }

  // ==========================================================================
  // Entitlements (4 endpoints)
  // ==========================================================================

  /** GET /vacation/entitlements/me — Get own vacation balance. */
  @Get('entitlements/me')
  @RequirePermission(FEAT, MOD_ENTITLEMENTS, 'canRead')
  async getMyBalance(
    @CurrentUser() user: JwtPayload,
    @Query('year') year?: number,
  ): Promise<VacationBalance> {
    return await this.entitlementsService.getBalance(user.tenantId, user.id, year);
  }

  /** GET /vacation/entitlements/:userId — Get balance for a specific user (admin/root). */
  @Get('entitlements/:userId')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_ENTITLEMENTS, 'canRead')
  async getUserBalance(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseIntPipe) userId: number,
    @Query('year') year?: number,
  ): Promise<VacationBalance> {
    return await this.entitlementsService.getBalance(user.tenantId, userId, year);
  }

  /** PUT /vacation/entitlements/:userId — Create or update entitlement (admin/root). */
  @Put('entitlements/:userId')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_ENTITLEMENTS, 'canWrite')
  async createOrUpdateEntitlement(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateEntitlementDto,
  ): Promise<VacationEntitlement> {
    return await this.entitlementsService.createOrUpdateEntitlement(user.tenantId, userId, dto);
  }

  /** POST /vacation/entitlements/:userId/add-days — Add vacation days (admin/root). */
  @Post('entitlements/:userId/add-days')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_ENTITLEMENTS, 'canWrite')
  async addDays(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseIntPipe) userId: number,
    @Body('year') year: number,
    @Body('days') days: number,
  ): Promise<VacationEntitlement> {
    return await this.entitlementsService.addDays(user.tenantId, user.id, userId, year, days);
  }

  // ==========================================================================
  // Blackouts (4 endpoints)
  // ==========================================================================

  /** GET /vacation/blackouts — List all blackout periods. */
  @Get('blackouts')
  @RequirePermission(FEAT, MOD_RULES, 'canRead')
  async getBlackouts(
    @CurrentUser() user: JwtPayload,
    @Query('year') year?: number,
  ): Promise<VacationBlackout[]> {
    return await this.blackoutsService.getBlackouts(user.tenantId, year);
  }

  /** POST /vacation/blackouts — Create a blackout period (admin/root). */
  @Post('blackouts')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_RULES, 'canWrite')
  async createBlackout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBlackoutDto,
  ): Promise<VacationBlackout> {
    return await this.blackoutsService.createBlackout(user.tenantId, user.id, dto);
  }

  /** PUT /vacation/blackouts/:id — Update a blackout period (admin/root). */
  @Put('blackouts/:id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_RULES, 'canWrite')
  async updateBlackout(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBlackoutDto,
  ): Promise<VacationBlackout> {
    return await this.blackoutsService.updateBlackout(user.tenantId, user.id, id, dto);
  }

  /** DELETE /vacation/blackouts/:id — Delete a blackout period (admin/root). */
  @Delete('blackouts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_RULES, 'canDelete')
  async deleteBlackout(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.blackoutsService.deleteBlackout(user.tenantId, user.id, id);
  }

  // ==========================================================================
  // Staffing Rules (4 endpoints)
  // ==========================================================================

  /** GET /vacation/staffing-rules — List all staffing rules. */
  @Get('staffing-rules')
  @RequirePermission(FEAT, MOD_RULES, 'canRead')
  async getStaffingRules(@CurrentUser() user: JwtPayload): Promise<VacationStaffingRule[]> {
    return await this.staffingRulesService.getStaffingRules(user.tenantId);
  }

  /** POST /vacation/staffing-rules — Create a staffing rule (admin/root). */
  @Post('staffing-rules')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_RULES, 'canWrite')
  async createStaffingRule(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStaffingRuleDto,
  ): Promise<VacationStaffingRule> {
    return await this.staffingRulesService.createStaffingRule(user.tenantId, user.id, dto);
  }

  /** PUT /vacation/staffing-rules/:id — Update a staffing rule (admin/root). */
  @Put('staffing-rules/:id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_RULES, 'canWrite')
  async updateStaffingRule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStaffingRuleDto,
  ): Promise<VacationStaffingRule> {
    return await this.staffingRulesService.updateStaffingRule(user.tenantId, user.id, id, dto);
  }

  /** DELETE /vacation/staffing-rules/:id — Delete a staffing rule (admin/root). */
  @Delete('staffing-rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_RULES, 'canDelete')
  async deleteStaffingRule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.staffingRulesService.deleteStaffingRule(user.tenantId, user.id, id);
  }

  // ==========================================================================
  // Holidays (4 endpoints)
  // ==========================================================================

  /** GET /vacation/holidays — List holidays (optionally filtered by year). */
  @Get('holidays')
  @RequirePermission(FEAT, MOD_HOLIDAYS, 'canRead')
  async getHolidays(
    @CurrentUser() user: JwtPayload,
    @Query('year') year?: number,
  ): Promise<VacationHoliday[]> {
    return await this.holidaysService.getHolidays(user.tenantId, year);
  }

  /** POST /vacation/holidays — Create a holiday (admin/root). */
  @Post('holidays')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_HOLIDAYS, 'canWrite')
  async createHoliday(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateHolidayDto,
  ): Promise<VacationHoliday> {
    return await this.holidaysService.createHoliday(user.tenantId, user.id, dto);
  }

  /** PUT /vacation/holidays/:id — Update a holiday (admin/root). */
  @Put('holidays/:id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_HOLIDAYS, 'canWrite')
  async updateHoliday(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
  ): Promise<VacationHoliday> {
    return await this.holidaysService.updateHoliday(user.tenantId, user.id, id, dto);
  }

  /** DELETE /vacation/holidays/:id — Delete a holiday (admin/root). */
  @Delete('holidays/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_HOLIDAYS, 'canDelete')
  async deleteHoliday(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.holidaysService.deleteHoliday(user.tenantId, user.id, id);
  }

  // ==========================================================================
  // Settings (2 endpoints)
  // ==========================================================================

  /** GET /vacation/settings — Get tenant vacation settings. */
  @Get('settings')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_RULES, 'canRead')
  async getSettings(@CurrentUser() user: JwtPayload): Promise<VacationSettings> {
    return await this.settingsService.getSettings(user.tenantId);
  }

  /** PUT /vacation/settings — Update tenant vacation settings (admin/root). */
  @Put('settings')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_RULES, 'canWrite')
  async updateSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSettingsDto,
  ): Promise<VacationSettings> {
    return await this.settingsService.updateSettings(user.tenantId, user.id, dto);
  }

  // ==========================================================================
  // Calendar Integration (1 endpoint)
  // ==========================================================================

  /**
   * GET /vacation/my-calendar-vacations — Own approved vacations for calendar display.
   * Returns date ranges (not expanded days) for calendar indicator rendering.
   * MUST be before `:id` style routes to avoid param collision.
   */
  @Get('my-calendar-vacations')
  @RequirePermission(FEAT, MOD_REQUESTS, 'canRead')
  async getMyCalendarVacations(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<CalendarVacationEntry[]> {
    return await this.queriesService.getMyCalendarVacations(
      user.id,
      user.tenantId,
      startDate,
      endDate,
    );
  }

  // ==========================================================================
  // Overview (2 endpoints)
  // ==========================================================================

  /** GET /vacation/team-calendar — Team calendar for a given month. */
  @Get('team-calendar')
  @RequirePermission(FEAT, MOD_OVERVIEW, 'canRead')
  async getTeamCalendar(
    @CurrentUser() user: JwtPayload,
    @Query('teamId', ParseIntPipe) teamId: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ): Promise<TeamCalendarData> {
    return await this.queriesService.getTeamCalendar(user.tenantId, teamId, month, year);
  }

  /** GET /vacation/overview — Get own vacation balance (overview page). */
  @Get('overview')
  @RequirePermission(FEAT, MOD_OVERVIEW, 'canRead')
  async getOverview(
    @CurrentUser() user: JwtPayload,
    @Query('year') year?: number,
  ): Promise<VacationBalance> {
    return await this.getMyBalance(user, year);
  }
}
