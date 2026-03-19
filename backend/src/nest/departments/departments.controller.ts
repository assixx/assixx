/**
 * Departments Controller
 *
 * HTTP endpoints for department management:
 * - GET  /departments         - List all departments
 * - GET  /departments/stats   - Get department statistics
 * - GET  /departments/:id     - Get department by ID
 * - GET  /departments/:id/members - Get department members
 * - POST /departments         - Create department (admin only)
 * - PUT  /departments/:id     - Update department (admin only)
 * - DELETE /departments/:id   - Delete department (admin only)
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
import type {
  DepartmentMember,
  DepartmentResponse,
  DepartmentStats,
} from './departments.service.js';
import { DepartmentsService } from './departments.service.js';
import {
  AssignHallsToDepartmentDto,
  CreateDepartmentDto,
  DeleteDepartmentQueryDto,
  ListDepartmentsQueryDto,
  UpdateDepartmentDto,
} from './dto/index.js';

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

/** Permission constants — manage_hierarchy (GET/PUT scope-filtered) */
const SCOPE_FEAT = 'manage_hierarchy';
const SCOPE_MOD = 'manage-departments';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  /**
   * GET /departments
   * List all departments with optional extended info
   */
  @Get()
  async listDepartments(
    @Query() query: ListDepartmentsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<DepartmentResponse[]> {
    const includeExtended = query.includeExtended !== false;
    return await this.departmentsService.listDepartments(
      tenantId,
      includeExtended,
    );
  }

  /**
   * GET /departments/stats
   * Get department statistics for the tenant
   */
  @Get('stats')
  async getDepartmentStats(
    @TenantId() tenantId: number,
  ): Promise<DepartmentStats> {
    return await this.departmentsService.getDepartmentStats(tenantId);
  }

  /**
   * GET /departments/:id
   * Get department by ID
   */
  @Get(':id')
  async getDepartmentById(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<DepartmentResponse> {
    return await this.departmentsService.getDepartmentById(id, tenantId);
  }

  /**
   * GET /departments/:id/members
   * Get department members
   */
  @Get(':id/members')
  async getDepartmentMembers(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<DepartmentMember[]> {
    return await this.departmentsService.getDepartmentMembers(id, tenantId);
  }

  /**
   * POST /departments
   * Create new department (admin only)
   */
  @Post()
  @Roles('admin', 'root')
  @HttpCode(HttpStatus.CREATED)
  async createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DepartmentResponse> {
    return await this.departmentsService.createDepartment(
      dto,
      user.id,
      tenantId,
    );
  }

  /**
   * PUT /departments/:id
   * Update department (admin only)
   */
  @Put(':id')
  @Roles('admin', 'root', 'employee')
  @RequirePermission(SCOPE_FEAT, SCOPE_MOD, 'canWrite')
  async updateDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DepartmentResponse> {
    return await this.departmentsService.updateDepartment(
      id,
      dto,
      user.id,
      tenantId,
    );
  }

  /**
   * POST /departments/:id/halls
   * Assign halls to a department (admin only)
   */
  @Post(':id/halls')
  @Roles('admin', 'root')
  async assignHalls(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignHallsToDepartmentDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.departmentsService.assignHallsToDepartment(
      id,
      dto.hallIds,
      tenantId,
      user.id,
    );
  }

  /**
   * DELETE /departments/:id
   * Delete department (admin only)
   * Query param ?force=true to remove dependencies and delete
   */
  @Delete(':id')
  @Roles('admin', 'root')
  async deleteDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DeleteDepartmentQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.departmentsService.deleteDepartment(
      id,
      user.id,
      tenantId,
      query.force ?? false,
    );
  }
}
