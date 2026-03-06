/**
 * Shift Times Controller
 *
 * REST API endpoints for tenant-configurable shift time definitions.
 * Root-only access — managed via /account-settings in the frontend.
 */
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import { ShiftKeyParamDto } from './dto/shift-key-param.dto.js';
import type { ShiftTimeResponse } from './dto/shift-time-response.dto.js';
import { UpdateAllShiftTimesDto } from './dto/update-all-shift-times.dto.js';
import { UpdateShiftTimeDto } from './dto/update-shift-time.dto.js';
import { ShiftTimesService } from './shift-times.service.js';

@Controller('shift-times')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftTimesController {
  private readonly logger = new Logger(ShiftTimesController.name);

  constructor(private readonly shiftTimesService: ShiftTimesService) {}

  /** Get all shift times for the current tenant */
  @Get()
  @Roles('root', 'admin', 'employee')
  async getShiftTimes(
    @CurrentUser() user: JwtPayload,
  ): Promise<ShiftTimeResponse[]> {
    return await this.shiftTimesService.getByTenant(user.tenantId);
  }

  /** Update a single shift time definition (root only) */
  @Put(':shiftKey')
  @Roles('root')
  async updateShiftTime(
    @CurrentUser() user: JwtPayload,
    @Param() params: ShiftKeyParamDto,
    @Body() dto: UpdateShiftTimeDto,
  ): Promise<ShiftTimeResponse> {
    this.logger.log(
      `Root user ${user.id} updating shift time '${params.shiftKey}'`,
    );
    return await this.shiftTimesService.update(user.tenantId, params.shiftKey, {
      label: dto.label,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });
  }

  /** Bulk update all shift times (root only) */
  @Put()
  @Roles('root')
  async updateAllShiftTimes(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAllShiftTimesDto,
  ): Promise<ShiftTimeResponse[]> {
    this.logger.log(`Root user ${user.id} bulk-updating shift times`);
    return await this.shiftTimesService.updateAll(
      user.tenantId,
      dto.shiftTimes,
    );
  }

  /** Reset all shift times to system defaults (root only) */
  @Post('reset')
  @Roles('root')
  async resetToDefaults(
    @CurrentUser() user: JwtPayload,
  ): Promise<ShiftTimeResponse[]> {
    this.logger.log(`Root user ${user.id} resetting shift times to defaults`);
    return await this.shiftTimesService.resetToDefaults(user.tenantId);
  }
}
