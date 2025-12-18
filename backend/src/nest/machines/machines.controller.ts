/**
 * Machines Controller
 *
 * HTTP endpoints for machine management:
 * - GET    /machines                    - List all machines
 * - GET    /machines/statistics         - Get machine statistics
 * - GET    /machines/categories         - Get machine categories
 * - GET    /machines/upcoming-maintenance - Get upcoming maintenance
 * - POST   /machines/maintenance        - Add maintenance record (admin)
 * - GET    /machines/:id                - Get machine by ID
 * - GET    /machines/:id/maintenance    - Get maintenance history
 * - POST   /machines                    - Create machine (admin)
 * - PUT    /machines/:id                - Update machine (admin)
 * - DELETE /machines/:id                - Delete machine (admin)
 * - PUT    /machines/:id/deactivate     - Deactivate machine (admin)
 * - PUT    /machines/:id/activate       - Activate machine (admin)
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
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
import {
  AddMaintenanceRecordDto,
  CreateMachineDto,
  ListMachinesQueryDto,
  UpcomingMaintenanceQueryDto,
  UpdateMachineDto,
} from './dto/index.js';
import type {
  MachineCategory,
  MachineCreateRequest,
  MachineResponse,
  MachineStatistics,
  MachineUpdateRequest,
  MaintenanceHistoryResponse,
  MaintenanceRecordRequest,
} from './machines.service.js';
import { MachinesService } from './machines.service.js';

/** HTTP header name for user agent */
const HEADER_USER_AGENT = 'user-agent';

/**
 * Removes undefined values from object (for exactOptionalPropertyTypes compatibility)
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]: [string, unknown]) => v !== undefined),
  ) as Partial<T>;
}

interface MessageResponse {
  message: string;
}

@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Get()
  async listMachines(
    @Query() query: ListMachinesQueryDto,
    @TenantId() tenantId: number,
  ): Promise<MachineResponse[]> {
    // Note: pagination (page, limit, sortBy, sortOrder) not supported by legacy service
    return await this.machinesService.listMachines(tenantId, {
      ...(query.search !== undefined && { search: query.search }),
      ...(query.status !== undefined && { status: query.status }),
      ...(query.machineType !== undefined && { machine_type: query.machineType }),
      ...(query.departmentId !== undefined && { department_id: query.departmentId }),
      ...(query.needsMaintenance !== undefined && { needs_maintenance: query.needsMaintenance }),
    });
  }

  @Get('statistics')
  async getStatistics(@TenantId() tenantId: number): Promise<MachineStatistics> {
    return await this.machinesService.getStatistics(tenantId);
  }

  @Get('categories')
  async getCategories(): Promise<MachineCategory[]> {
    return await this.machinesService.getCategories();
  }

  @Get('upcoming-maintenance')
  async getUpcomingMaintenance(
    @Query() query: UpcomingMaintenanceQueryDto,
    @TenantId() tenantId: number,
  ): Promise<MachineResponse[]> {
    return await this.machinesService.getUpcomingMaintenance(tenantId, query.days);
  }

  @Post('maintenance')
  @Roles('admin', 'root')
  async addMaintenanceRecord(
    @Body() dto: AddMaintenanceRecordDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MaintenanceHistoryResponse> {
    const data: MaintenanceRecordRequest = {
      machineId: dto.machineId,
      maintenanceType: dto.maintenanceType,
      performedDate: dto.performedDate,
      statusAfter: dto.statusAfter, // has default, always defined
      ...(dto.performedBy !== undefined && { performedBy: dto.performedBy }),
      ...(dto.externalCompany !== undefined && { externalCompany: dto.externalCompany }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.partsReplaced !== undefined && { partsReplaced: dto.partsReplaced }),
      ...(dto.cost !== undefined && { cost: dto.cost }),
      ...(dto.durationHours !== undefined && { durationHours: dto.durationHours }),
      ...(dto.nextMaintenanceDate !== undefined && {
        nextMaintenanceDate: dto.nextMaintenanceDate,
      }),
      ...(dto.reportUrl !== undefined && { reportUrl: dto.reportUrl }),
    };
    return await this.machinesService.addMaintenanceRecord(data, tenantId, user.id, ip, userAgent);
  }

  @Get(':id')
  async getMachine(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<MachineResponse> {
    return await this.machinesService.getMachineById(id, tenantId);
  }

  @Get(':id/maintenance')
  async getMaintenanceHistory(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<MaintenanceHistoryResponse[]> {
    return await this.machinesService.getMaintenanceHistory(id, tenantId);
  }

  @Post()
  @Roles('admin', 'root')
  async createMachine(
    @Body() dto: CreateMachineDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MachineResponse> {
    const data = {
      name: dto.name,
      machineType: dto.machineType,
      status: dto.status,
      ...stripUndefined({
        model: dto.model,
        manufacturer: dto.manufacturer,
        serialNumber: dto.serialNumber,
        assetNumber: dto.assetNumber,
        departmentId: dto.departmentId,
        areaId: dto.areaId,
        location: dto.location,
        purchaseDate: dto.purchaseDate,
        installationDate: dto.installationDate,
        warrantyUntil: dto.warrantyUntil,
        lastMaintenance: dto.lastMaintenance,
        nextMaintenance: dto.nextMaintenance,
        operatingHours: dto.operatingHours,
        productionCapacity: dto.productionCapacity,
        energyConsumption: dto.energyConsumption,
        manualUrl: dto.manualUrl,
        qrCode: dto.qrCode,
        notes: dto.notes,
      }),
    } as MachineCreateRequest;
    return await this.machinesService.createMachine(data, tenantId, user.id, ip, userAgent);
  }

  @Put(':id')
  @Roles('admin', 'root')
  async updateMachine(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMachineDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MachineResponse> {
    const data = stripUndefined({
      name: dto.name,
      model: dto.model,
      manufacturer: dto.manufacturer,
      serialNumber: dto.serialNumber,
      assetNumber: dto.assetNumber,
      departmentId: dto.departmentId,
      areaId: dto.areaId,
      location: dto.location,
      machineType: dto.machineType,
      status: dto.status,
      purchaseDate: dto.purchaseDate,
      installationDate: dto.installationDate,
      warrantyUntil: dto.warrantyUntil,
      lastMaintenance: dto.lastMaintenance,
      nextMaintenance: dto.nextMaintenance,
      operatingHours: dto.operatingHours,
      productionCapacity: dto.productionCapacity,
      energyConsumption: dto.energyConsumption,
      manualUrl: dto.manualUrl,
      qrCode: dto.qrCode,
      notes: dto.notes,
      isActive: dto.isActive,
    }) as MachineUpdateRequest;
    return await this.machinesService.updateMachine(id, data, tenantId, user.id, ip, userAgent);
  }

  @Delete(':id')
  @Roles('admin', 'root')
  async deleteMachine(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MessageResponse> {
    await this.machinesService.deleteMachine(id, tenantId, user.id, ip, userAgent);
    return { message: 'Machine deleted successfully' };
  }

  @Put(':id/deactivate')
  @Roles('admin', 'root')
  async deactivateMachine(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MessageResponse> {
    await this.machinesService.deactivateMachine(id, tenantId, user.id, ip, userAgent);
    return { message: 'Machine deactivated successfully' };
  }

  @Put(':id/activate')
  @Roles('admin', 'root')
  async activateMachine(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MessageResponse> {
    await this.machinesService.activateMachine(id, tenantId, user.id, ip, userAgent);
    return { message: 'Machine activated successfully' };
  }
}
