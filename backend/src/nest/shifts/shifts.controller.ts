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
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
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
import { QueryShiftPlanDto } from './dto/query-shift-plan.dto.js';
import { QueryShiftsDto } from './dto/query-shifts.dto.js';
import { QuerySwapRequestsDto } from './dto/query-swap-requests.dto.js';
import { CreateShiftPlanDto } from './dto/shift-plan.dto.js';
import { UpdateSwapRequestStatusDto } from './dto/swap-request-status.dto.js';
import { UpdateShiftPlanDto } from './dto/update-shift-plan.dto.js';
import { UpdateShiftDto } from './dto/update-shift.dto.js';
import type {
  CalendarShiftResponse,
  FavoriteResponse,
  ShiftPlanResponse,
  ShiftResponse,
  SwapRequestResponse,
} from './shifts.service.js';
import { ShiftsService } from './shifts.service.js';

/** Header constant to avoid duplicate string */
const USER_AGENT_HEADER = 'user-agent';

// ============================================================
// RESPONSE TYPES
// ============================================================

interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

interface PaginatedResponse<T> extends SuccessResponse<T> {
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

interface MessageOnlyResponse {
  success: true;
  message: string;
}

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  private readonly logger = new Logger(ShiftsController.name);

  constructor(private readonly shiftsService: ShiftsService) {}

  // ============= SHIFTS CRUD =============

  /**
   * GET /api/v2/shifts
   * List all shifts with filters
   */
  @Get()
  async listShifts(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryShiftsDto,
  ): Promise<PaginatedResponse<ShiftResponse[]>> {
    this.logger.debug(`Listing shifts for tenant ${user.tenantId}`);
    const shifts = await this.shiftsService.listShifts(user.tenantId, query);
    return {
      success: true,
      data: shifts,
      pagination: {
        currentPage: query.page,
        pageSize: query.limit,
        totalItems: shifts.length,
        totalPages: Math.ceil(shifts.length / query.limit),
      },
    };
  }

  /**
   * GET /api/v2/shifts/swap-requests
   * List swap requests (must be before /:id)
   */
  @Get('swap-requests')
  async listSwapRequests(
    @CurrentUser() user: JwtPayload,
    @Query() query: QuerySwapRequestsDto,
  ): Promise<SuccessResponse<SwapRequestResponse[]>> {
    this.logger.debug(`Listing swap requests for tenant ${user.tenantId}`);
    const requests = await this.shiftsService.listSwapRequests(
      user.tenantId,
      query,
    );
    return { success: true, data: requests };
  }

  /**
   * POST /api/v2/shifts/swap-requests
   * Create swap request
   */
  @Post('swap-requests')
  @HttpCode(HttpStatus.CREATED)
  async createSwapRequest(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSwapRequestDto,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse<SwapRequestResponse>> {
    this.logger.debug(`Creating swap request for user ${user.id}`);
    const request = await this.shiftsService.createSwapRequest(
      dto,
      user.tenantId,
      user.id,
      ip,
      userAgent,
    );
    return { success: true, data: request };
  }

  /**
   * PUT /api/v2/shifts/swap-requests/:id/status
   * Update swap request status (admin only)
   */
  @Put('swap-requests/:id/status')
  @Roles('admin', 'root')
  async updateSwapRequestStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSwapRequestStatusDto,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse<{ message: string }>> {
    this.logger.debug(`Updating swap request ${id} status`);
    const result = await this.shiftsService.updateSwapRequestStatus(
      id,
      dto,
      user.tenantId,
      user.id,
      ip,
      userAgent,
    );
    return { success: true, data: result };
  }

  /**
   * GET /api/v2/shifts/overtime
   * Get overtime report
   */
  @Get('overtime')
  async getOvertimeReport(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryOvertimeDto,
  ): Promise<SuccessResponse<Record<string, unknown>>> {
    this.logger.debug(`Getting overtime report for tenant ${user.tenantId}`);
    const filters = {
      userId: query.userId ?? user.id,
      startDate: query.startDate,
      endDate: query.endDate,
    };
    const report = await this.shiftsService.getOvertimeReport(
      filters,
      user.tenantId,
    );
    return { success: true, data: report };
  }

  /**
   * GET /api/v2/shifts/favorites
   * List user's favorites
   */
  @Get('favorites')
  async listFavorites(
    @CurrentUser() user: JwtPayload,
  ): Promise<SuccessResponse<FavoriteResponse[]>> {
    this.logger.debug(`Listing favorites for user ${user.id}`);
    const favorites = await this.shiftsService.listFavorites(
      user.tenantId,
      user.id,
    );
    return { success: true, data: favorites };
  }

  /**
   * POST /api/v2/shifts/favorites
   * Create favorite
   */
  @Post('favorites')
  @HttpCode(HttpStatus.CREATED)
  async createFavorite(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateFavoriteDto,
  ): Promise<SuccessResponse<FavoriteResponse>> {
    this.logger.debug(`Creating favorite for user ${user.id}`);
    const favorite = await this.shiftsService.createFavorite(
      dto,
      user.tenantId,
      user.id,
    );
    return {
      success: true,
      data: favorite,
      message: 'Favorite created successfully',
    };
  }

  /**
   * DELETE /api/v2/shifts/favorites/:id
   * Delete favorite
   */
  @Delete('favorites/:id')
  async deleteFavorite(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageOnlyResponse> {
    this.logger.debug(`Deleting favorite ${id}`);
    await this.shiftsService.deleteFavorite(id, user.tenantId, user.id);
    return { success: true, message: 'Favorite deleted successfully' };
  }

  /**
   * GET /api/v2/shifts/my-calendar-shifts
   * Get current user's shifts for calendar
   */
  @Get('my-calendar-shifts')
  async getMyCalendarShifts(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryMyCalendarShiftsDto,
  ): Promise<SuccessResponse<CalendarShiftResponse[]>> {
    this.logger.debug(`Getting calendar shifts for user ${user.id}`);
    const shifts = await this.shiftsService.getUserCalendarShifts(
      user.id,
      user.tenantId,
      query.startDate,
      query.endDate,
    );
    return {
      success: true,
      data: shifts,
      message: 'User shifts retrieved successfully',
    };
  }

  /**
   * GET /api/v2/shifts/export
   * Export shifts to CSV (admin only)
   */
  @Get('export')
  @Roles('admin', 'root')
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

  /**
   * GET /api/v2/shifts/plan
   * Get shift plan with shifts and notes
   */
  @Get('plan')
  async getShiftPlan(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryShiftPlanDto,
  ): Promise<
    SuccessResponse<{ plan?: unknown; shifts: unknown[]; notes: unknown[] }>
  > {
    this.logger.debug(`Getting shift plan for tenant ${user.tenantId}`);
    const result = await this.shiftsService.getShiftPlan(query, user.tenantId);
    return {
      success: true,
      data: result,
      message: 'Shift plan retrieved successfully',
    };
  }

  /**
   * POST /api/v2/shifts/plan
   * Create shift plan (admin only)
   */
  @Post('plan')
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  async createShiftPlan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateShiftPlanDto,
  ): Promise<SuccessResponse<ShiftPlanResponse>> {
    this.logger.debug(`Creating shift plan for tenant ${user.tenantId}`);
    const result = await this.shiftsService.createShiftPlan(
      dto,
      user.tenantId,
      user.id,
    );
    return { success: true, data: result };
  }

  /**
   * PUT /api/v2/shifts/plan/uuid/:uuid
   * Update shift plan by UUID (preferred)
   */
  @Put('plan/uuid/:uuid')
  async updateShiftPlanByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShiftPlanDto,
  ): Promise<SuccessResponse<ShiftPlanResponse>> {
    this.logger.debug(`Updating shift plan ${uuid}`);
    const result = await this.shiftsService.updateShiftPlanByUuid(
      uuid,
      dto,
      user.tenantId,
      user.id,
    );
    return {
      success: true,
      data: result,
      message: 'Shift plan updated successfully',
    };
  }

  /**
   * PUT /api/v2/shifts/plan/:id
   * Update shift plan
   * @deprecated Use PUT /api/v2/shifts/plan/uuid/:uuid instead
   */
  @Put('plan/:id')
  async updateShiftPlan(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShiftPlanDto,
  ): Promise<SuccessResponse<ShiftPlanResponse>> {
    this.logger.debug(`Updating shift plan ${id}`);
    const result = await this.shiftsService.updateShiftPlan(
      id,
      dto,
      user.tenantId,
      user.id,
    );
    return {
      success: true,
      data: result,
      message: 'Shift plan updated successfully',
    };
  }

  /**
   * DELETE /api/v2/shifts/plan/uuid/:uuid
   * Delete shift plan by UUID (admin only, preferred)
   */
  @Delete('plan/uuid/:uuid')
  @Roles('admin', 'root')
  async deleteShiftPlanByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageOnlyResponse> {
    this.logger.debug(`Deleting shift plan ${uuid}`);
    await this.shiftsService.deleteShiftPlanByUuid(uuid, user.tenantId);
    return { success: true, message: 'Shift plan deleted successfully' };
  }

  /**
   * DELETE /api/v2/shifts/plan/:id
   * Delete shift plan (admin only)
   * @deprecated Use DELETE /api/v2/shifts/plan/uuid/:uuid instead
   */
  @Delete('plan/:id')
  @Roles('admin', 'root')
  async deleteShiftPlan(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageOnlyResponse> {
    this.logger.debug(`Deleting shift plan ${id}`);
    await this.shiftsService.deleteShiftPlan(id, user.tenantId);
    return { success: true, message: 'Shift plan deleted successfully' };
  }

  /**
   * GET /api/v2/shifts/:id
   * Get shift by ID
   */
  @Get(':id')
  async getShiftById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<SuccessResponse<ShiftResponse>> {
    this.logger.debug(`Getting shift ${id}`);
    const shift = await this.shiftsService.getShiftById(id, user.tenantId);
    return { success: true, data: shift };
  }

  /**
   * POST /api/v2/shifts
   * Create new shift (admin only)
   */
  @Post()
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  async createShift(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateShiftDto,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse<ShiftResponse>> {
    this.logger.debug(`Creating shift for tenant ${user.tenantId}`);
    const shift = await this.shiftsService.createShift(
      dto,
      user.tenantId,
      user.id,
      ip,
      userAgent,
    );
    return { success: true, data: shift };
  }

  /**
   * PUT /api/v2/shifts/:id
   * Update shift (admin only)
   */
  @Put(':id')
  @Roles('admin', 'root')
  async updateShift(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShiftDto,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse<ShiftResponse>> {
    this.logger.debug(`Updating shift ${id}`);
    const shift = await this.shiftsService.updateShift(
      id,
      dto,
      user.tenantId,
      user.id,
      ip,
      userAgent,
    );
    return { success: true, data: shift };
  }

  /**
   * DELETE /api/v2/shifts/week
   * Delete all shifts for a team in a date range (admin only)
   */
  @Delete('week')
  @Roles('admin', 'root')
  async deleteShiftsByWeek(
    @Query('teamId', ParseIntPipe) teamId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SuccessResponse<{ shiftsDeleted: number }>> {
    this.logger.debug(
      `Deleting shifts for team ${teamId} from ${startDate} to ${endDate}`,
    );
    const result = await this.shiftsService.deleteShiftsByWeek(
      teamId,
      startDate,
      endDate,
      user.tenantId,
    );
    return { success: true, data: result };
  }

  /**
   * DELETE /api/v2/shifts/team
   * Delete ALL shifts for a team (admin only)
   */
  @Delete('team')
  @Roles('admin', 'root')
  async deleteShiftsByTeam(
    @Query('teamId', ParseIntPipe) teamId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<SuccessResponse<{ shiftsDeleted: number }>> {
    this.logger.debug(`Deleting ALL shifts for team ${teamId}`);
    const result = await this.shiftsService.deleteShiftsByTeam(
      teamId,
      user.tenantId,
    );
    return { success: true, data: result };
  }

  /**
   * DELETE /api/v2/shifts/:id
   * Delete shift (admin only)
   */
  @Delete(':id')
  @Roles('admin', 'root')
  async deleteShift(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Headers(USER_AGENT_HEADER) userAgent: string,
  ): Promise<SuccessResponse<{ message: string }>> {
    this.logger.debug(`Deleting shift ${id}`);
    const result = await this.shiftsService.deleteShift(
      id,
      user.tenantId,
      user.id,
      ip,
      userAgent,
    );
    return { success: true, data: result };
  }
}
