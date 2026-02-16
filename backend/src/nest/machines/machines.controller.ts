/**
 * Machines Controller
 *
 * HTTP endpoints for machine management:
 * - GET    /machines                               - List all machines
 * - GET    /machines/statistics                     - Get machine statistics
 * - GET    /machines/categories                     - Get machine categories
 * - GET    /machines/upcoming-maintenance           - Get upcoming maintenance
 * - POST   /machines/maintenance                    - Add maintenance record (admin)
 * - PUT    /machines/uuid/:uuid/availability        - Create availability entry (admin)
 * - GET    /machines/uuid/:uuid/availability/history - Get availability history
 * - PUT    /machines/availability/:id               - Update availability entry (admin)
 * - DELETE /machines/availability/:id               - Delete availability entry (admin)
 * - GET    /machines/:id/availability               - Get availability entries for date range
 * - GET    /machines/uuid/:uuid                     - Get machine by UUID
 * - GET    /machines/:id                            - Get machine by ID
 * - GET    /machines/:id/maintenance                - Get maintenance history
 * - GET    /machines/:id/teams                      - Get teams assigned to machine
 * - PUT    /machines/:id/teams                      - Set teams for machine (admin)
 * - POST   /machines                                - Create machine (admin)
 * - PUT    /machines/:id                            - Update machine (admin)
 * - DELETE /machines/:id                            - Delete machine (admin)
 * - PUT    /machines/:id/deactivate                 - Deactivate machine (admin)
 * - PUT    /machines/:id/activate                   - Activate machine (admin)
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
  MachineAvailabilityHistoryQueryDto,
  MachineAvailabilityRangeQueryDto,
  SetMachineTeamsDto,
  UpcomingMaintenanceQueryDto,
  UpdateMachineAvailabilityDto,
  UpdateMachineAvailabilityEntryDto,
  UpdateMachineDto,
} from './dto/index.js';
import type {
  MachineAvailabilityHistoryEntry,
  MachineAvailabilityHistoryResponse,
} from './dto/machine-availability-history-query.dto.js';
import { MachineAvailabilityService } from './machine-availability.service.js';
import { MachinesService } from './machines.service.js';
import type {
  MachineCategory,
  MachineCreateRequest,
  MachineResponse,
  MachineStatistics,
  MachineTeamResponse,
  MachineUpdateRequest,
  MaintenanceHistoryResponse,
  MaintenanceRecordRequest,
} from './machines.types.js';

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
  constructor(
    private readonly machinesService: MachinesService,
    private readonly machineAvailabilityService: MachineAvailabilityService,
  ) {}

  @Get()
  async listMachines(
    @Query() query: ListMachinesQueryDto,
    @TenantId() tenantId: number,
  ): Promise<MachineResponse[]> {
    const machines = await this.machinesService.listMachines(tenantId, {
      ...(query.search !== undefined && { search: query.search }),
      ...(query.status !== undefined && { status: query.status }),
      ...(query.machineType !== undefined && {
        machine_type: query.machineType,
      }),
      ...(query.departmentId !== undefined && {
        department_id: query.departmentId,
      }),
      ...(query.needsMaintenance !== undefined && {
        needs_maintenance: query.needsMaintenance,
      }),
    });

    // Enrich with availability data (batch query for efficiency)
    const machineIds = machines.map((m: MachineResponse) => m.id);
    const availabilityMap =
      await this.machineAvailabilityService.getMachineAvailabilityBatch(
        machineIds,
        tenantId,
      );

    for (const machine of machines) {
      this.machineAvailabilityService.addAvailabilityInfo(
        machine,
        availabilityMap.get(machine.id),
      );
    }

    return machines;
  }

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: number,
  ): Promise<MachineStatistics> {
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
    return await this.machinesService.getUpcomingMaintenance(
      tenantId,
      query.days,
    );
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
      ...(dto.externalCompany !== undefined && {
        externalCompany: dto.externalCompany,
      }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.partsReplaced !== undefined && {
        partsReplaced: dto.partsReplaced,
      }),
      ...(dto.cost !== undefined && { cost: dto.cost }),
      ...(dto.durationHours !== undefined && {
        durationHours: dto.durationHours,
      }),
      ...(dto.nextMaintenanceDate !== undefined && {
        nextMaintenanceDate: dto.nextMaintenanceDate,
      }),
      ...(dto.reportUrl !== undefined && { reportUrl: dto.reportUrl }),
    };
    return await this.machinesService.addMaintenanceRecord(
      data,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
  }

  // ============================================
  // Machine Availability Endpoints
  // ============================================

  /**
   * PUT /machines/uuid/:uuid/availability
   * Create a new machine availability entry (maintenance window, repair period, etc.)
   */
  @Put('uuid/:uuid/availability')
  @Roles('admin', 'root')
  async updateMachineAvailabilityByUuid(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateMachineAvailabilityDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.machineAvailabilityService.updateAvailabilityByUuid(
      uuid,
      dto,
      tenantId,
      user.id,
    );
  }

  /**
   * GET /machines/uuid/:uuid/availability/history
   * Get availability history for a machine
   */
  @Get('uuid/:uuid/availability/history')
  async getMachineAvailabilityHistory(
    @Param('uuid') uuid: string,
    @Query() query: MachineAvailabilityHistoryQueryDto,
    @TenantId() tenantId: number,
  ): Promise<MachineAvailabilityHistoryResponse> {
    const year =
      query.year !== undefined ? Number.parseInt(query.year, 10) : undefined;
    const month =
      query.month !== undefined ? Number.parseInt(query.month, 10) : undefined;
    return await this.machineAvailabilityService.getAvailabilityHistoryByUuid(
      uuid,
      tenantId,
      year,
      month,
    );
  }

  /**
   * PUT /machines/availability/:id
   * Update an existing availability entry (only if endDate \>= today)
   */
  @Put('availability/:id')
  @Roles('admin', 'root')
  async updateMachineAvailabilityEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMachineAvailabilityEntryDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.machineAvailabilityService.updateAvailabilityEntry(
      id,
      dto,
      tenantId,
      user.id,
    );
  }

  /**
   * DELETE /machines/availability/:id
   * Delete an availability entry
   */
  @Delete('availability/:id')
  @Roles('admin', 'root')
  async deleteMachineAvailabilityEntry(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.machineAvailabilityService.deleteAvailabilityEntry(
      id,
      tenantId,
      user.id,
    );
  }

  /**
   * GET /machines/:id/availability
   * Get all availability entries overlapping with a date range.
   * Used by shift planning to visually mark cells where a machine is unavailable.
   */
  @Get(':id/availability')
  async getMachineAvailabilityRange(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: MachineAvailabilityRangeQueryDto,
    @TenantId() tenantId: number,
  ): Promise<MachineAvailabilityHistoryEntry[]> {
    return await this.machineAvailabilityService.getMachineAvailabilityForDateRange(
      id,
      tenantId,
      query.startDate,
      query.endDate,
    );
  }

  // ============================================
  // Machine CRUD Endpoints
  // ============================================

  /**
   * GET /machines/uuid/:uuid
   * Get machine by UUID (preferred)
   */
  @Get('uuid/:uuid')
  async getMachineByUuid(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<MachineResponse> {
    return await this.machinesService.getMachineByUuid(uuid, tenantId);
  }

  /**
   * GET /machines/:id
   * @deprecated Use GET /machines/uuid/:uuid instead
   */
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

  @Get(':id/teams')
  async getMachineTeams(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<MachineTeamResponse[]> {
    return await this.machinesService.getMachineTeams(id, tenantId);
  }

  @Put(':id/teams')
  @Roles('admin', 'root')
  async setMachineTeams(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetMachineTeamsDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<MachineTeamResponse[]> {
    return await this.machinesService.setMachineTeams(
      id,
      dto.teamIds,
      tenantId,
      user.id,
    );
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
    return await this.machinesService.createMachine(
      data,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
  }

  /**
   * PUT /machines/uuid/:uuid
   * Update machine by UUID (preferred)
   */
  @Put('uuid/:uuid')
  @Roles('admin', 'root')
  async updateMachineByUuid(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateMachineDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
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
    return await this.machinesService.updateMachineByUuid(
      uuid,
      data,
      tenantId,
      user.id,
    );
  }

  /**
   * PUT /machines/:id
   * @deprecated Use PUT /machines/uuid/:uuid instead
   */
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
    return await this.machinesService.updateMachine(
      id,
      data,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
  }

  /**
   * DELETE /machines/uuid/:uuid
   * Delete machine by UUID (preferred)
   */
  @Delete('uuid/:uuid')
  @Roles('admin', 'root')
  async deleteMachineByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    await this.machinesService.deleteMachineByUuid(uuid, tenantId, user.id);
    return { message: 'Machine deleted successfully' };
  }

  /**
   * DELETE /machines/:id
   * @deprecated Use DELETE /machines/uuid/:uuid instead
   */
  @Delete(':id')
  @Roles('admin', 'root')
  async deleteMachine(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MessageResponse> {
    await this.machinesService.deleteMachine(
      id,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
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
    await this.machinesService.deactivateMachine(
      id,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
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
    await this.machinesService.activateMachine(
      id,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
    return { message: 'Machine activated successfully' };
  }
}
