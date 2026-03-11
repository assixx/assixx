/**
 * Shifts Controller
 *
 * REST API endpoints for shift management.
 * Handles CRUD operations, swap requests, overtime, exports, and favorites.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import { QueryMyCalendarShiftsDto } from './dto/calendar-shift.dto.js';
import { CreateShiftDto } from './dto/create-shift.dto.js';
import { CreateSwapRequestDto } from './dto/create-swap-request.dto.js';
import { ExportShiftsDto } from './dto/export-shift.dto.js';
import { CreateFavoriteDto } from './dto/favorite.dto.js';
import { QueryOvertimeDto } from './dto/overtime.dto.js';
import { QueryAssignmentCountsDto } from './dto/query-assignment-counts.dto.js';
import { QueryShiftPlanDto } from './dto/query-shift-plan.dto.js';
import { QueryShiftsDto } from './dto/query-shifts.dto.js';
import { QuerySwapRequestsDto } from './dto/query-swap-requests.dto.js';
import { CreateShiftPlanDto } from './dto/shift-plan.dto.js';
import { UpdateSwapRequestStatusDto } from './dto/swap-request-status.dto.js';
import { UpdateShiftPlanDto } from './dto/update-shift-plan.dto.js';
import { UpdateShiftDto } from './dto/update-shift.dto.js';
import type {
  AssignmentCountResponse,
  CalendarShiftResponse,
  FavoriteResponse,
  ShiftPlanResponse,
  ShiftResponse,
  SwapRequestResponse,
} from './shifts.service.js';
import { ShiftsService } from './shifts.service.js';

// ResponseInterceptor wraps ALL responses in { success, data, timestamp } (ADR-007).
// Controllers return raw data only — NO manual { success, data } wrapping.

/** Permission constants for RequirePermission decorator */
const SHIFT_FEATURE = 'shift_planning';
const SHIFT_PLAN = 'shift-plan';
const SHIFT_SWAP = 'shift-swap';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireAddon('shift_planning')
export class ShiftsController {
  private readonly logger = new Logger(ShiftsController.name);

  constructor(private readonly shiftsService: ShiftsService) {}

  // ============= SHIFTS CRUD =============

  /** GET /api/v2/shifts */
  @Get()
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canRead')
  async listShifts(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryShiftsDto,
  ): Promise<{
    items: ShiftResponse[];
    pagination: {
      currentPage: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    this.logger.debug(`Listing shifts for tenant ${user.tenantId}`);
    const shifts = await this.shiftsService.listShifts(user.tenantId, query);
    return {
      items: shifts,
      pagination: {
        currentPage: query.page,
        pageSize: query.limit,
        totalItems: shifts.length,
        totalPages: Math.ceil(shifts.length / query.limit),
      },
    };
  }

  /** GET /api/v2/shifts/swap-requests (must be before /:id) */
  @Get('swap-requests')
  @RequirePermission(SHIFT_FEATURE, SHIFT_SWAP, 'canRead')
  async listSwapRequests(
    @CurrentUser() user: JwtPayload,
    @Query() query: QuerySwapRequestsDto,
  ): Promise<SwapRequestResponse[]> {
    this.logger.debug(`Listing swap requests for tenant ${user.tenantId}`);
    return await this.shiftsService.listSwapRequests(user.tenantId, query);
  }

  /** POST /api/v2/shifts/swap-requests */
  @Post('swap-requests')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(SHIFT_FEATURE, SHIFT_SWAP, 'canWrite')
  async createSwapRequest(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSwapRequestDto,
  ): Promise<SwapRequestResponse> {
    this.logger.debug(`Creating swap request for user ${user.id}`);
    return await this.shiftsService.createSwapRequest(
      dto,
      user.tenantId,
      user.id,
    );
  }

  /** PUT /api/v2/shifts/swap-requests/:id/status */
  @Put('swap-requests/:id/status')
  @Roles('admin', 'root')
  @RequirePermission(SHIFT_FEATURE, SHIFT_SWAP, 'canWrite')
  async updateSwapRequestStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSwapRequestStatusDto,
  ): Promise<{ message: string }> {
    this.logger.debug(`Updating swap request ${id} status`);
    return await this.shiftsService.updateSwapRequestStatus(
      id,
      dto,
      user.tenantId,
      user.id,
    );
  }

  /** GET /api/v2/shifts/overtime */
  @Get('overtime')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canRead')
  async getOvertimeReport(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryOvertimeDto,
  ): Promise<Record<string, unknown>> {
    this.logger.debug(`Getting overtime report for tenant ${user.tenantId}`);
    const filters = {
      userId: query.userId ?? user.id,
      startDate: query.startDate,
      endDate: query.endDate,
    };
    return await this.shiftsService.getOvertimeReport(filters, user.tenantId);
  }

  /** GET /api/v2/shifts/favorites */
  @Get('favorites')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canRead')
  async listFavorites(
    @CurrentUser() user: JwtPayload,
  ): Promise<FavoriteResponse[]> {
    this.logger.debug(`Listing favorites for user ${user.id}`);
    return await this.shiftsService.listFavorites(user.tenantId, user.id);
  }

  /** POST /api/v2/shifts/favorites */
  @Post('favorites')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canWrite')
  async createFavorite(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateFavoriteDto,
  ): Promise<FavoriteResponse> {
    this.logger.debug(`Creating favorite for user ${user.id}`);
    return await this.shiftsService.createFavorite(dto, user.tenantId, user.id);
  }

  /** DELETE /api/v2/shifts/favorites/:id */
  @Delete('favorites/:id')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canDelete')
  async deleteFavorite(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    this.logger.debug(`Deleting favorite ${id}`);
    await this.shiftsService.deleteFavorite(id, user.tenantId, user.id);
    return { message: 'Favorite deleted successfully' };
  }

  /** GET /api/v2/shifts/assignment-counts */
  @Get('assignment-counts')
  @Roles('admin', 'root')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canRead')
  async getAssignmentCounts(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryAssignmentCountsDto,
  ): Promise<AssignmentCountResponse[]> {
    this.logger.debug(`Getting assignment counts for team ${query.teamId}`);
    return await this.shiftsService.getAssignmentCounts(
      user.tenantId,
      query.teamId,
      query.referenceDate,
    );
  }

  /** GET /api/v2/shifts/my-calendar-shifts */
  @Get('my-calendar-shifts')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canRead')
  async getMyCalendarShifts(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryMyCalendarShiftsDto,
  ): Promise<CalendarShiftResponse[]> {
    this.logger.debug(`Getting calendar shifts for user ${user.id}`);
    return await this.shiftsService.getUserCalendarShifts(
      user.id,
      user.tenantId,
      query.startDate,
      query.endDate,
    );
  }

  /** GET /api/v2/shifts/export */
  @Get('export')
  @Roles('admin', 'root')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canRead')
  async exportShifts(
    @CurrentUser() user: JwtPayload,
    @Query() query: ExportShiftsDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    this.logger.debug(`Exporting shifts for tenant ${user.tenantId}`);

    const csvData = await this.shiftsService.exportShifts(
      {
        startDate: query.startDate,
        endDate: query.endDate,
        departmentId: query.departmentId,
        teamId: query.teamId,
        userId: query.userId,
      },
      user.tenantId,
      query.format,
    );

    await reply
      .header('Content-Type', 'text/csv')
      .header(
        'Content-Disposition',
        `attachment; filename="shifts_${query.startDate}_${query.endDate}.csv"`,
      )
      .send(csvData);
  }

  /** GET /api/v2/shifts/plan */
  @Get('plan')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canRead')
  async getShiftPlan(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryShiftPlanDto,
  ): Promise<{ plan?: unknown; shifts: unknown[]; notes: unknown[] }> {
    this.logger.debug(`Getting shift plan for tenant ${user.tenantId}`);
    return await this.shiftsService.getShiftPlan(query, user.tenantId);
  }

  /** POST /api/v2/shifts/plan */
  @Post('plan')
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canWrite')
  async createShiftPlan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateShiftPlanDto,
  ): Promise<ShiftPlanResponse> {
    this.logger.debug(`Creating shift plan for tenant ${user.tenantId}`);
    return await this.shiftsService.createShiftPlan(
      dto,
      user.tenantId,
      user.id,
    );
  }

  /** PUT /api/v2/shifts/plan/uuid/:uuid */
  @Put('plan/uuid/:uuid')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canWrite')
  async updateShiftPlanByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShiftPlanDto,
  ): Promise<ShiftPlanResponse> {
    this.logger.debug(`Updating shift plan ${uuid}`);
    return await this.shiftsService.updateShiftPlanByUuid(
      uuid,
      dto,
      user.tenantId,
      user.id,
    );
  }

  /**
   * PUT /api/v2/shifts/plan/:id
   * @deprecated Use PUT /api/v2/shifts/plan/uuid/:uuid instead
   */
  @Put('plan/:id')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canWrite')
  async updateShiftPlan(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShiftPlanDto,
  ): Promise<ShiftPlanResponse> {
    this.logger.debug(`Updating shift plan ${id}`);
    return await this.shiftsService.updateShiftPlan(
      id,
      dto,
      user.tenantId,
      user.id,
    );
  }

  /** DELETE /api/v2/shifts/plan/uuid/:uuid */
  @Delete('plan/uuid/:uuid')
  @Roles('admin', 'root')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canDelete')
  async deleteShiftPlanByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    this.logger.debug(`Deleting shift plan ${uuid}`);
    await this.shiftsService.deleteShiftPlanByUuid(
      uuid,
      user.tenantId,
      user.id,
    );
    return { message: 'Shift plan deleted successfully' };
  }

  /**
   * DELETE /api/v2/shifts/plan/:id
   * @deprecated Use DELETE /api/v2/shifts/plan/uuid/:uuid instead
   */
  @Delete('plan/:id')
  @Roles('admin', 'root')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canDelete')
  async deleteShiftPlan(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    this.logger.debug(`Deleting shift plan ${id}`);
    await this.shiftsService.deleteShiftPlan(id, user.tenantId, user.id);
    return { message: 'Shift plan deleted successfully' };
  }

  /** GET /api/v2/shifts/:id */
  @Get(':id')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canRead')
  async getShiftById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<ShiftResponse> {
    this.logger.debug(`Getting shift ${id}`);
    return await this.shiftsService.getShiftById(id, user.tenantId);
  }

  /** POST /api/v2/shifts */
  @Post()
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canWrite')
  async createShift(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateShiftDto,
  ): Promise<ShiftResponse> {
    this.logger.debug(`Creating shift for tenant ${user.tenantId}`);
    return await this.shiftsService.createShift(dto, user.tenantId, user.id);
  }

  /** PUT /api/v2/shifts/:id */
  @Put(':id')
  @Roles('admin', 'root')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canWrite')
  async updateShift(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShiftDto,
  ): Promise<ShiftResponse> {
    this.logger.debug(`Updating shift ${id}`);
    return await this.shiftsService.updateShift(
      id,
      dto,
      user.tenantId,
      user.id,
    );
  }

  /** DELETE /api/v2/shifts/week */
  @Delete('week')
  @Roles('admin', 'root')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canDelete')
  async deleteShiftsByWeek(
    @Query('teamId', ParseIntPipe) teamId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ shiftsDeleted: number }> {
    this.logger.debug(
      `Deleting shifts for team ${teamId} from ${startDate} to ${endDate}`,
    );
    return await this.shiftsService.deleteShiftsByWeek(
      teamId,
      startDate,
      endDate,
      user.tenantId,
    );
  }

  /** DELETE /api/v2/shifts/team */
  @Delete('team')
  @Roles('admin', 'root')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canDelete')
  async deleteShiftsByTeam(
    @Query('teamId', ParseIntPipe) teamId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ shiftsDeleted: number }> {
    this.logger.debug(`Deleting ALL shifts for team ${teamId}`);
    return await this.shiftsService.deleteShiftsByTeam(teamId, user.tenantId);
  }

  /** DELETE /api/v2/shifts/:id */
  @Delete(':id')
  @Roles('admin', 'root')
  @RequirePermission(SHIFT_FEATURE, SHIFT_PLAN, 'canDelete')
  async deleteShift(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    this.logger.debug(`Deleting shift ${id}`);
    return await this.shiftsService.deleteShift(id, user.tenantId, user.id);
  }
}
