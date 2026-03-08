/**
 * Root Controller
 *
 * HTTP endpoints for root user operations and tenant management:
 *
 * Admin Management:
 * - GET    /root/admins           - Get all admins
 * - GET    /root/admins/:id       - Get admin by ID
 * - POST   /root/admins           - Create admin
 * - PUT    /root/admins/:id       - Update admin
 * - DELETE /root/admins/:id       - Delete admin
 * - GET    /root/admins/:id/logs  - Get admin logs
 *
 * Tenant Management:
 * - GET    /root/tenants          - Get tenants
 *
 * Root User Management:
 * - GET    /root/users            - Get root users
 * - GET    /root/users/:id        - Get root user by ID
 * - POST   /root/users            - Create root user
 * - PUT    /root/users/:id        - Update root user
 * - DELETE /root/users/:id        - Delete root user
 *
 * Dashboard & System Info:
 * - GET    /root/dashboard        - Get dashboard
 * - GET    /root/stats            - Get stats
 * - GET    /root/storage          - Get storage info
 *
 * Tenant Deletion:
 * - DELETE /root/tenants/current        - Delete current tenant
 * - POST   /root/tenant/deletion        - Request tenant deletion
 * - GET    /root/tenant/deletion-status - Get deletion status
 * - POST   /root/tenant/cancel-deletion - Cancel deletion
 * - POST   /root/tenant/deletion-dry-run - Dry run deletion
 *
 * Deletion Approvals:
 * - GET    /root/deletion-approvals          - Get all deletion requests
 * - GET    /root/deletion-approvals/pending  - Get pending approvals
 * - POST   /root/deletion-approvals/:queueId/approve - Approve deletion
 * - POST   /root/deletion-approvals/:queueId/reject  - Reject deletion
 * - POST   /root/deletion-queue/:queueId/emergency-stop - Emergency stop
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import {
  AdminIdParamDto,
  AdminLogsQueryDto,
  CreateAdminDto,
  CreateRootUserDto,
  DeletionApprovalBodyDto,
  DeletionRejectionBodyDto,
  QueueIdParamDto,
  RootApiFiltersDto,
  RootUserIdParamDto,
  TenantDeletionRequestDto,
  UpdateAdminDto,
  UpdateRootUserDto,
} from './dto/index.js';
import type {
  AdminLog,
  AdminUser,
  DashboardStats,
  DeletionApproval,
  DeletionDryRunReport,
  RootUser,
  StorageInfo,
  Tenant,
  TenantDeletionStatus,
} from './root.service.js';
import { RootService } from './root.service.js';

@Controller('root')
@Roles('root')
export class RootController {
  constructor(private readonly rootService: RootService) {}

  // ============================================
  // ADMIN MANAGEMENT
  // ============================================

  @Get('admins')
  async getAdmins(
    @TenantId() tenantId: number,
    @Query() _query: RootApiFiltersDto,
  ): Promise<{ admins: AdminUser[] }> {
    const admins = await this.rootService.getAdmins(tenantId);
    return { admins };
  }

  @Get('admins/:id')
  async getAdminById(
    @Param() params: AdminIdParamDto,
    @TenantId() tenantId: number,
  ): Promise<{ admin: AdminUser }> {
    const admin = await this.rootService.getAdminById(params.id, tenantId);
    if (admin === null) {
      throw new NotFoundException('Admin not found');
    }
    return { admin };
  }

  @Post('admins')
  async createAdmin(
    @Body() dto: CreateAdminDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string; adminId: number }> {
    const adminId = await this.rootService.createAdmin(
      {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        notes: dto.notes,
        employeeNumber: dto.employeeNumber,
        position: dto.position,
      },
      tenantId,
      user.id,
    );
    return { message: 'Admin user created successfully', adminId };
  }

  @Put('admins/:id')
  async updateAdmin(
    @Param() params: AdminIdParamDto,
    @Body() dto: UpdateAdminDto,
    @TenantId() tenantId: number,
  ): Promise<{ message: string }> {
    await this.rootService.updateAdmin(
      params.id,
      {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        notes: dto.notes,
        isActive: dto.isActive,
        employeeNumber: dto.employeeNumber,
        position: dto.position,
        role: dto.role,
      },
      tenantId,
    );
    return { message: 'Admin updated successfully' };
  }

  @Delete('admins/:id')
  async deleteAdmin(
    @Param() params: AdminIdParamDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.rootService.deleteAdmin(params.id, tenantId, user.id);
    return { message: 'Admin deleted successfully' };
  }

  @Get('admins/:id/logs')
  async getAdminLogs(
    @Param() params: AdminIdParamDto,
    @Query() query: AdminLogsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<{ logs: AdminLog[] }> {
    const logs = await this.rootService.getAdminLogs(
      params.id,
      tenantId,
      query.days,
    );
    return { logs };
  }

  // ============================================
  // TENANT MANAGEMENT
  // ============================================

  @Get('tenants')
  async getTenants(
    @TenantId() tenantId: number,
  ): Promise<{ tenants: Tenant[] }> {
    const tenants = await this.rootService.getTenants(tenantId);
    return { tenants };
  }

  // ============================================
  // ROOT USER MANAGEMENT
  // ============================================

  @Get('users')
  async getRootUsers(
    @TenantId() tenantId: number,
  ): Promise<{ users: RootUser[] }> {
    const users = await this.rootService.getRootUsers(tenantId);
    return { users };
  }

  @Get('users/:id')
  async getRootUserById(
    @Param() params: RootUserIdParamDto,
    @TenantId() tenantId: number,
  ): Promise<{ user: RootUser }> {
    const user = await this.rootService.getRootUserById(params.id, tenantId);
    if (user === null) {
      throw new NotFoundException('Root user not found');
    }
    return { user };
  }

  @Post('users')
  async createRootUser(
    @Body() dto: CreateRootUserDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string; userId: number }> {
    const userId = await this.rootService.createRootUser(
      {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        position: dto.position,
        notes: dto.notes,
        employeeNumber: dto.employeeNumber,
        isActive: dto.isActive,
      },
      tenantId,
      user.id,
    );
    return { message: 'Root user created successfully', userId };
  }

  @Put('users/:id')
  async updateRootUser(
    @Param() params: RootUserIdParamDto,
    @Body() dto: UpdateRootUserDto,
    @TenantId() tenantId: number,
  ): Promise<{ message: string }> {
    await this.rootService.updateRootUser(
      params.id,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: dto.password,
        position: dto.position,
        notes: dto.notes,
        employeeNumber: dto.employeeNumber,
        isActive: dto.isActive,
      },
      tenantId,
    );
    return { message: 'Root user updated successfully' };
  }

  @Delete('users/:id')
  async deleteRootUser(
    @Param() params: RootUserIdParamDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.rootService.deleteRootUser(params.id, tenantId, user.id);
    return { message: 'Root user deleted successfully' };
  }

  // ============================================
  // DASHBOARD & SYSTEM INFO
  // ============================================

  @Get('dashboard')
  async getDashboard(@TenantId() tenantId: number): Promise<DashboardStats> {
    return await this.rootService.getDashboardStats(tenantId);
  }

  @Get('stats')
  async getStats(@TenantId() tenantId: number): Promise<DashboardStats> {
    return await this.rootService.getDashboardStats(tenantId);
  }

  @Get('storage')
  async getStorageInfo(
    @TenantId() tenantId: number,
  ): Promise<{ data: StorageInfo }> {
    const data = await this.rootService.getStorageInfo(tenantId);
    return { data };
  }

  // ============================================
  // TENANT DELETION
  // ============================================

  @Delete('tenants/current')
  async deleteCurrentTenant(
    @Body() dto: TenantDeletionRequestDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtPayload,
    @Req() req: FastifyRequest,
  ): Promise<{
    data: {
      queueId: number;
      tenantId: number;
      scheduledDate: Date;
      message: string;
      approvalRequired: boolean;
    };
  }> {
    const queueId = await this.rootService.requestTenantDeletion(
      tenantId,
      user.id,
      dto.reason ?? 'Keine Angabe',
      req.ip,
    );
    return {
      data: {
        queueId,
        tenantId,
        scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        message:
          'Löschung eingeleitet - Genehmigung von zweitem Root-Benutzer erforderlich',
        approvalRequired: true,
      },
    };
  }

  @Post('tenant/deletion')
  async requestTenantDeletion(
    @Body() dto: TenantDeletionRequestDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtPayload,
    @Req() req: FastifyRequest,
  ): Promise<{
    queueId: number;
    tenantId: number;
    scheduledDate: Date;
    message: string;
    approvalRequired: boolean;
  }> {
    const queueId = await this.rootService.requestTenantDeletion(
      tenantId,
      user.id,
      dto.reason,
      req.ip,
    );
    return {
      queueId,
      tenantId,
      scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      message: 'Deletion requested - approval from second root user required',
      approvalRequired: true,
    };
  }

  @Get('tenant/deletion-status')
  async getDeletionStatus(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<TenantDeletionStatus | { data: null; message: string }> {
    const status = await this.rootService.getDeletionStatus(tenantId, user.id);
    if (status === null) {
      return { data: null, message: 'No active deletion' };
    }
    return status;
  }

  @Post('tenant/cancel-deletion')
  async cancelDeletion(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.rootService.cancelDeletion(tenantId, user.id);
    return { message: 'Deletion cancelled successfully' };
  }

  @Post('tenant/deletion-dry-run')
  async deletionDryRun(
    @TenantId() tenantId: number,
  ): Promise<DeletionDryRunReport> {
    return await this.rootService.performDeletionDryRun(tenantId);
  }

  // ============================================
  // DELETION APPROVALS
  // ============================================

  @Get('deletion-approvals')
  async getAllDeletionRequests(): Promise<{ deletions: DeletionApproval[] }> {
    const deletions = await this.rootService.getAllDeletionRequests();
    return { deletions };
  }

  @Get('deletion-approvals/pending')
  async getPendingApprovals(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ approvals: DeletionApproval[] }> {
    const approvals = await this.rootService.getPendingApprovals(user.id);
    return { approvals };
  }

  @Post('deletion-approvals/:queueId/approve')
  async approveDeletion(
    @Param() params: QueueIdParamDto,
    @Body() dto: DeletionApprovalBodyDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    // SECURITY: Pass password for Two-Person-Principle verification
    await this.rootService.approveDeletion(
      params.queueId,
      user.id,
      user.tenantId,
      dto.password,
      dto.comment,
    );
    return { message: 'Deletion approved successfully' };
  }

  @Post('deletion-approvals/:queueId/reject')
  async rejectDeletion(
    @Param() params: QueueIdParamDto,
    @Body() dto: DeletionRejectionBodyDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.rootService.rejectDeletion(params.queueId, user.id, dto.reason);
    return { message: 'Deletion rejected successfully' };
  }

  @Post('deletion-queue/:queueId/emergency-stop')
  async emergencyStop(
    @Param() _params: QueueIdParamDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.rootService.emergencyStop(tenantId, user.id);
    return { message: 'Emergency stop activated' };
  }
}
