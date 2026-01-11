/**
 * Areas Controller
 *
 * HTTP endpoints for area/location management:
 * - GET    /areas           - List all areas
 * - GET    /areas/stats     - Get area statistics
 * - GET    /areas/:id       - Get area by ID
 * - POST   /areas           - Create area (admin only)
 * - PUT    /areas/:id       - Update area (admin only)
 * - DELETE /areas/:id       - Delete area (admin only)
 * - POST   /areas/:id/departments - Assign departments (admin only)
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
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import type { AreaResponse, AreaStatsResponse } from './areas.service.js';
import { AreasService } from './areas.service.js';
import {
  AssignDepartmentsDto,
  CreateAreaDto,
  DeleteAreaQueryDto,
  ListAreasQueryDto,
  UpdateAreaDto,
} from './dto/index.js';

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  /**
   * GET /areas
   * List all areas with optional filters
   */
  @Get()
  async listAreas(
    @Query() query: ListAreasQueryDto,
    @TenantId() tenantId: number,
  ): Promise<AreaResponse[]> {
    return await this.areasService.listAreas(tenantId, query);
  }

  /**
   * GET /areas/stats
   * Get area statistics for the tenant
   */
  @Get('stats')
  async getAreaStats(@TenantId() tenantId: number): Promise<AreaStatsResponse> {
    return await this.areasService.getAreaStats(tenantId);
  }

  /**
   * GET /areas/:id
   * Get area by ID
   */
  @Get(':id')
  async getAreaById(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<AreaResponse> {
    return await this.areasService.getAreaById(id, tenantId);
  }

  /**
   * POST /areas
   * Create new area (admin only)
   */
  @Post()
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  async createArea(
    @Body() dto: CreateAreaDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<AreaResponse> {
    return await this.areasService.createArea(dto, tenantId, user.id);
  }

  /**
   * PUT /areas/:id
   * Update area (admin only)
   */
  @Put(':id')
  @Roles('admin', 'root')
  async updateArea(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAreaDto,
    @TenantId() tenantId: number,
  ): Promise<AreaResponse> {
    return await this.areasService.updateArea(id, dto, tenantId);
  }

  /**
   * DELETE /areas/:id
   * Delete area (admin only)
   * Query param ?force=true to remove dependencies and delete
   */
  @Delete(':id')
  @Roles('admin', 'root')
  async deleteArea(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DeleteAreaQueryDto,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.areasService.deleteArea(id, tenantId, query.force);
  }

  /**
   * POST /areas/:id/departments
   * Assign departments to an area (admin only)
   */
  @Post(':id/departments')
  @Roles('admin', 'root')
  async assignDepartments(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignDepartmentsDto,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.areasService.assignDepartmentsToArea(id, dto.departmentIds, tenantId);
  }
}
