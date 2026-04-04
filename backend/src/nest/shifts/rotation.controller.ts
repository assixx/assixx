/**
 * Rotation Controller
 *
 * REST API endpoints for shift rotation pattern management.
 * Handles CRUD operations, assignments, generation, and history.
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
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import { AssignUsersToPatternDto } from './dto/assign-users-to-pattern.dto.js';
import { CreateRotationPatternDto } from './dto/create-rotation-pattern.dto.js';
import { DeleteRotationHistoryByDateRangeDto } from './dto/delete-rotation-history-by-date-range.dto.js';
import { GenerateRotationShiftsDto } from './dto/generate-rotation-shifts.dto.js';
import { QueryRotationHistoryDto } from './dto/query-rotation-history.dto.js';
import { GenerateRotationFromConfigDto } from './dto/rotation-config.dto.js';
import { DeleteRotationHistoryDto } from './dto/rotation-delete.dto.js';
import { UpdateRotationPatternDto } from './dto/update-rotation-pattern.dto.js';
import type {
  DeleteHistoryCountsResponse,
  GeneratedShiftsResponse,
  RotationAssignmentResponse,
  RotationHistoryResponse,
  RotationPatternResponse,
} from './rotation.service.js';
import { RotationService } from './rotation.service.js';

/** Permission constants for RequirePermission decorator */
const SHIFT_ADDON = 'shift_planning';
const SHIFT_ROTATION = 'shift-rotation';

@Controller('shifts/rotation')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireAddon('shift_planning')
export class RotationController {
  private readonly logger = new Logger(RotationController.name);

  constructor(private readonly rotationService: RotationService) {}

  // ============= PATTERNS CRUD =============

  /** GET /api/v2/shifts/rotation/patterns */
  @Get('patterns')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canRead')
  async getRotationPatterns(
    @CurrentUser() user: JwtPayload,
    @Query('active_only') activeOnly?: string,
  ): Promise<{ patterns: RotationPatternResponse[] }> {
    this.logger.debug(`Getting rotation patterns for tenant ${user.tenantId}`);
    const isActiveOnly = activeOnly !== 'false';
    const patterns = await this.rotationService.getRotationPatterns(user.tenantId, isActiveOnly);
    return { patterns };
  }

  /** GET /api/v2/shifts/rotation/patterns/uuid/:uuid */
  @Get('patterns/uuid/:uuid')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canRead')
  async getRotationPatternByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ pattern: RotationPatternResponse }> {
    this.logger.debug(`Getting rotation pattern by UUID ${uuid}`);
    const pattern = await this.rotationService.getRotationPatternByUuid(uuid, user.tenantId);
    return { pattern };
  }

  /**
   * GET /api/v2/shifts/rotation/patterns/:id
   * @deprecated Use GET /patterns/uuid/:uuid instead
   */
  @Get('patterns/:id')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canRead')
  async getRotationPattern(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ pattern: RotationPatternResponse }> {
    this.logger.debug(`Getting rotation pattern ${id}`);
    const pattern = await this.rotationService.getRotationPattern(id, user.tenantId);
    return { pattern };
  }

  /** POST /api/v2/shifts/rotation/patterns */
  @Post('patterns')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canWrite')
  async createRotationPattern(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRotationPatternDto,
  ): Promise<{ pattern: RotationPatternResponse }> {
    this.logger.debug(`Creating rotation pattern for tenant ${user.tenantId}`);
    const pattern = await this.rotationService.createRotationPattern(dto, user.tenantId, user.id);
    return { pattern };
  }

  /** PUT /api/v2/shifts/rotation/patterns/uuid/:uuid */
  @Put('patterns/uuid/:uuid')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canWrite')
  async updateRotationPatternByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRotationPatternDto,
  ): Promise<{ pattern: RotationPatternResponse }> {
    this.logger.debug(`Updating rotation pattern by UUID ${uuid}`);
    const pattern = await this.rotationService.updateRotationPatternByUuid(
      uuid,
      dto,
      user.tenantId,
      user.id,
    );
    return { pattern };
  }

  /**
   * PUT /api/v2/shifts/rotation/patterns/:id
   * @deprecated Use PUT /patterns/uuid/:uuid instead
   */
  @Put('patterns/:id')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canWrite')
  async updateRotationPattern(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRotationPatternDto,
  ): Promise<{ pattern: RotationPatternResponse }> {
    this.logger.debug(`Updating rotation pattern ${id}`);
    const pattern = await this.rotationService.updateRotationPattern(
      id,
      dto,
      user.tenantId,
      user.id,
    );
    return { pattern };
  }

  /** DELETE /api/v2/shifts/rotation/patterns/uuid/:uuid */
  @Delete('patterns/uuid/:uuid')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canDelete')
  async deleteRotationPatternByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<null> {
    this.logger.debug(`Deleting rotation pattern by UUID ${uuid}`);
    await this.rotationService.deleteRotationPatternByUuid(uuid, user.tenantId, user.id);
    return null;
  }

  /**
   * DELETE /api/v2/shifts/rotation/patterns/:id
   * @deprecated Use DELETE /patterns/uuid/:uuid instead
   */
  @Delete('patterns/:id')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canDelete')
  async deleteRotationPattern(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<null> {
    this.logger.debug(`Deleting rotation pattern ${id}`);
    await this.rotationService.deleteRotationPattern(id, user.tenantId, user.id);
    return null;
  }

  // ============= ASSIGNMENTS =============

  /** POST /api/v2/shifts/rotation/assign */
  @Post('assign')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canWrite')
  async assignUsersToPattern(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AssignUsersToPatternDto,
  ): Promise<{ assignments: RotationAssignmentResponse[] }> {
    this.logger.debug(`Assigning users to pattern for tenant ${user.tenantId}`);
    const assignments = await this.rotationService.assignUsersToPattern(
      dto,
      user.tenantId,
      user.id,
    );
    return { assignments };
  }

  // ============= GENERATION =============

  /** POST /api/v2/shifts/rotation/generate */
  @Post('generate')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canWrite')
  async generateRotationShifts(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateRotationShiftsDto,
  ): Promise<{ generatedShifts: GeneratedShiftsResponse }> {
    this.logger.debug(`Generating rotation shifts for tenant ${user.tenantId}`);
    const generatedShifts = await this.rotationService.generateRotationShifts(
      dto,
      user.tenantId,
      user.id,
    );
    return { generatedShifts };
  }

  /** POST /api/v2/shifts/rotation/generate-from-config */
  @Post('generate-from-config')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canWrite')
  async generateRotationFromConfig(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateRotationFromConfigDto,
  ): Promise<Record<string, unknown>> {
    this.logger.debug(`Generating rotation from config for tenant ${user.tenantId}`);
    // ResponseInterceptor wraps in { success, data, timestamp }
    return await this.rotationService.generateRotationFromConfig(dto, user.tenantId, user.id);
  }

  // ============= HISTORY =============

  /** GET /api/v2/shifts/rotation/history */
  @Get('history')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canRead')
  async getRotationHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryRotationHistoryDto,
  ): Promise<{ history: RotationHistoryResponse[] }> {
    this.logger.debug(`Getting rotation history for tenant ${user.tenantId}`);

    const filters = {
      patternId: query.patternId,
      userId: query.userId,
      teamId: query.teamId,
      startDate: query.startDate,
      endDate: query.endDate,
      status: query.status,
    };

    const history = await this.rotationService.getRotationHistory(user.tenantId, filters);
    return { history };
  }

  /**
   * DELETE /api/v2/shifts/rotation/history
   *
   * If patternId provided: deletes ONLY that pattern.
   * If only teamId: deletes ALL patterns for the team.
   */
  @Delete('history')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canDelete')
  async deleteRotationHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: DeleteRotationHistoryDto,
  ): Promise<{
    message: string;
    deletedCounts: DeleteHistoryCountsResponse;
  }> {
    const { teamId, patternId } = query;
    const hasPatternId = patternId !== undefined;
    this.logger.debug(
      hasPatternId ?
        `Deleting rotation pattern ${patternId} for team ${teamId}`
      : `Deleting ALL rotation data for team ${teamId}`,
    );
    const deletedCounts = await this.rotationService.deleteRotationHistory(
      user.tenantId,
      teamId,
      user.id,
      patternId,
    );
    const message =
      hasPatternId ?
        `Successfully deleted rotation pattern ${patternId} for team ${teamId}`
      : `Successfully deleted all rotation data for team ${teamId}`;
    // ResponseInterceptor wraps in { success, data, timestamp }
    return { message, deletedCounts };
  }

  /** DELETE /api/v2/shifts/rotation/history/week */
  @Delete('history/week')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canDelete')
  async deleteRotationHistoryByDateRange(
    @CurrentUser() user: JwtPayload,
    @Query() query: DeleteRotationHistoryByDateRangeDto,
  ): Promise<{
    message: string;
    deletedCounts: DeleteHistoryCountsResponse;
  }> {
    this.logger.debug(
      `Deleting rotation history for team ${query.teamId} from ${query.startDate} to ${query.endDate}`,
    );
    const deletedCounts = await this.rotationService.deleteRotationHistoryByDateRange(
      user.tenantId,
      query.teamId,
      user.id,
      query.startDate,
      query.endDate,
    );
    return {
      message: `Successfully deleted rotation history for team ${query.teamId} from ${query.startDate} to ${query.endDate}`,
      deletedCounts,
    };
  }

  /** DELETE /api/v2/shifts/rotation/history/:id */
  @Delete('history/:id')
  @RequirePermission(SHIFT_ADDON, SHIFT_ROTATION, 'canDelete')
  async deleteRotationHistoryEntry(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    this.logger.debug(`Deleting rotation history entry ${id}`);
    await this.rotationService.deleteRotationHistoryEntry(id, user.tenantId, user.id);
    return { message: 'Entry deleted successfully' };
  }
}
