/**
 * Halls Controller
 *
 * HTTP endpoints for hall management:
 * - GET  /halls         - List all halls
 * - GET  /halls/stats   - Get hall statistics
 * - GET  /halls/:id     - Get hall by ID
 * - POST /halls         - Create hall (admin only)
 * - PUT  /halls/:id     - Update hall (admin only)
 * - DELETE /halls/:id   - Delete hall (admin only)
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
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import {
  CreateHallDto,
  DeleteHallQueryDto,
  ListHallsQueryDto,
  UpdateHallDto,
} from './dto/index.js';
import type { HallResponse, HallStats } from './halls.service.js';
import { HallsService } from './halls.service.js';

interface MessageResponse {
  message: string;
}

const FEAT = 'halls';
const MOD = 'halls-manage';

@Controller('halls')
export class HallsController {
  constructor(private readonly hallsService: HallsService) {}

  @Get()
  async listHalls(
    @Query() query: ListHallsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<HallResponse[]> {
    const includeExtended = query.includeExtended !== false;
    return await this.hallsService.listHalls(tenantId, includeExtended);
  }

  @Get('stats')
  async getHallStats(@TenantId() tenantId: number): Promise<HallStats> {
    return await this.hallsService.getHallStats(tenantId);
  }

  @Get(':id')
  async getHallById(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<HallResponse> {
    return await this.hallsService.getHallById(id, tenantId);
  }

  @Post()
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD, 'canWrite')
  @HttpCode(HttpStatus.CREATED)
  async createHall(
    @Body() dto: CreateHallDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<HallResponse> {
    return await this.hallsService.createHall(dto, user.id, tenantId);
  }

  @Put(':id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD, 'canWrite')
  async updateHall(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHallDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<HallResponse> {
    return await this.hallsService.updateHall(id, dto, user.id, tenantId);
  }

  @Delete(':id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD, 'canDelete')
  async deleteHall(
    @Param('id', ParseIntPipe) id: number,
    @Query() _query: DeleteHallQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.hallsService.deleteHall(id, user.id, tenantId);
  }
}
