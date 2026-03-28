/**
 * Shift Times Controller
 *
 * REST API endpoints for tenant-configurable shift time definitions.
 * Admin+Root write access — managed via /account-settings in the frontend.
 */
import { Body, Controller, Get, Logger, Param, Post, Put } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import { ShiftKeyParamDto } from './dto/shift-key-param.dto.js';
import type { ShiftTimeResponse } from './dto/shift-time-response.dto.js';
import { UpdateAllShiftTimesDto } from './dto/update-all-shift-times.dto.js';
import { UpdateShiftTimeDto } from './dto/update-shift-time.dto.js';
import { ShiftTimesService } from './shift-times.service.js';

/** Permission constants */
const FEAT = 'shift_planning';
const MOD = 'shift-times';

@Controller('shift-times')
@RequireAddon('shift_planning')
export class ShiftTimesController {
  private readonly logger = new Logger(ShiftTimesController.name);

  constructor(private readonly shiftTimesService: ShiftTimesService) {}

  /** Get all shift times for the current tenant */
  @Get()
  @Roles('root', 'admin', 'employee')
  @RequirePermission(FEAT, MOD, 'canRead')
  async getShiftTimes(@CurrentUser() user: JwtPayload): Promise<ShiftTimeResponse[]> {
    return await this.shiftTimesService.getByTenant(user.tenantId);
  }

  /** Update a single shift time definition */
  @Put(':shiftKey')
  @Roles('root', 'admin')
  @RequirePermission(FEAT, MOD, 'canWrite')
  async updateShiftTime(
    @CurrentUser() user: JwtPayload,
    @Param() params: ShiftKeyParamDto,
    @Body() dto: UpdateShiftTimeDto,
  ): Promise<ShiftTimeResponse> {
    this.logger.log(`User ${user.id} updating shift time '${params.shiftKey}'`);
    return await this.shiftTimesService.update(user.tenantId, params.shiftKey, {
      label: dto.label,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });
  }

  /** Bulk update all shift times */
  @Put()
  @Roles('root', 'admin')
  @RequirePermission(FEAT, MOD, 'canWrite')
  async updateAllShiftTimes(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAllShiftTimesDto,
  ): Promise<ShiftTimeResponse[]> {
    this.logger.log(`User ${user.id} bulk-updating shift times`);
    return await this.shiftTimesService.updateAll(user.tenantId, dto.shiftTimes);
  }

  /** Reset all shift times to system defaults */
  @Post('reset')
  @Roles('root', 'admin')
  @RequirePermission(FEAT, MOD, 'canWrite')
  async resetToDefaults(@CurrentUser() user: JwtPayload): Promise<ShiftTimeResponse[]> {
    this.logger.log(`User ${user.id} resetting shift times to defaults`);
    return await this.shiftTimesService.resetToDefaults(user.tenantId);
  }
}
