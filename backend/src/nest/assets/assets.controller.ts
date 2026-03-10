/**
 * Assets Controller
 *
 * HTTP endpoints for asset management:
 * - GET    /assets                               - List all assets
 * - GET    /assets/statistics                     - Get asset statistics
 * - GET    /assets/categories                     - Get asset categories
 * - GET    /assets/upcoming-maintenance           - Get upcoming maintenance
 * - POST   /assets/maintenance                    - Add maintenance record (admin)
 * - PUT    /assets/uuid/:uuid/availability        - Create availability entry (admin)
 * - GET    /assets/uuid/:uuid/availability/history - Get availability history
 * - PUT    /assets/availability/:id               - Update availability entry (admin)
 * - DELETE /assets/availability/:id               - Delete availability entry (admin)
 * - GET    /assets/:id/availability               - Get availability entries for date range
 * - GET    /assets/uuid/:uuid                     - Get asset by UUID
 * - GET    /assets/:id                            - Get asset by ID
 * - GET    /assets/:id/maintenance                - Get maintenance history
 * - GET    /assets/:id/teams                      - Get teams assigned to asset
 * - PUT    /assets/:id/teams                      - Set teams for asset (admin)
 * - POST   /assets                                - Create asset (admin)
 * - PUT    /assets/:id                            - Update asset (admin)
 * - DELETE /assets/:id                            - Delete asset (admin)
 * - PUT    /assets/:id/deactivate                 - Deactivate asset (admin)
 * - PUT    /assets/:id/activate                   - Activate asset (admin)
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
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import { AssetAvailabilityService } from './asset-availability.service.js';
import { AssetsService } from './assets.service.js';
import type {
  AssetCategory,
  AssetCreateRequest,
  AssetResponse,
  AssetStatistics,
  AssetTeamResponse,
  AssetUpdateRequest,
  MaintenanceHistoryResponse,
  MaintenanceRecordRequest,
} from './assets.types.js';
import type {
  AssetAvailabilityHistoryEntry,
  AssetAvailabilityHistoryResponse,
} from './dto/asset-availability-history-query.dto.js';
import {
  AddMaintenanceRecordDto,
  AssetAvailabilityHistoryQueryDto,
  AssetAvailabilityRangeQueryDto,
  CreateAssetDto,
  ListAssetsQueryDto,
  SetAssetTeamsDto,
  UpcomingMaintenanceQueryDto,
  UpdateAssetAvailabilityDto,
  UpdateAssetAvailabilityEntryDto,
  UpdateAssetDto,
} from './dto/index.js';

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

/** Permission constants */
const FEAT = 'assets';
const MOD_MANAGE = 'assets-manage';
const MOD_AVAIL = 'assets-availability';

@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly assetAvailabilityService: AssetAvailabilityService,
  ) {}

  @Get()
  async listAssets(
    @Query() query: ListAssetsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<AssetResponse[]> {
    const assets = await this.assetsService.listAssets(tenantId, {
      ...(query.search !== undefined && { search: query.search }),
      ...(query.status !== undefined && { status: query.status }),
      ...(query.assetType !== undefined && {
        asset_type: query.assetType,
      }),
      ...(query.departmentId !== undefined && {
        department_id: query.departmentId,
      }),
      ...(query.teamId !== undefined && {
        team_id: query.teamId,
      }),
      ...(query.needsMaintenance !== undefined && {
        needs_maintenance: query.needsMaintenance,
      }),
    });

    // Enrich with availability data (batch query for efficiency)
    const assetIds = assets.map((m: AssetResponse) => m.id);
    const availabilityMap =
      await this.assetAvailabilityService.getAssetAvailabilityBatch(
        assetIds,
        tenantId,
      );

    for (const asset of assets) {
      this.assetAvailabilityService.addAvailabilityInfo(
        asset,
        availabilityMap.get(asset.id),
      );
    }

    return assets;
  }

  @Get('statistics')
  async getStatistics(@TenantId() tenantId: number): Promise<AssetStatistics> {
    return await this.assetsService.getStatistics(tenantId);
  }

  @Get('categories')
  async getCategories(): Promise<AssetCategory[]> {
    return await this.assetsService.getCategories();
  }

  @Get('upcoming-maintenance')
  async getUpcomingMaintenance(
    @Query() query: UpcomingMaintenanceQueryDto,
    @TenantId() tenantId: number,
  ): Promise<AssetResponse[]> {
    return await this.assetsService.getUpcomingMaintenance(
      tenantId,
      query.days,
    );
  }

  @Post('maintenance')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async addMaintenanceRecord(
    @Body() dto: AddMaintenanceRecordDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MaintenanceHistoryResponse> {
    const data: MaintenanceRecordRequest = {
      assetId: dto.assetId,
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
    return await this.assetsService.addMaintenanceRecord(
      data,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
  }

  // ============================================
  // Asset Availability Endpoints
  // ============================================

  /**
   * PUT /assets/uuid/:uuid/availability
   * Create a new asset availability entry (maintenance window, repair period, etc.)
   */
  @Put('uuid/:uuid/availability')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_AVAIL, 'canWrite')
  async updateAssetAvailabilityByUuid(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateAssetAvailabilityDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.assetAvailabilityService.updateAvailabilityByUuid(
      uuid,
      dto,
      tenantId,
      user.id,
    );
  }

  /**
   * GET /assets/uuid/:uuid/availability/history
   * Get availability history for a asset
   */
  @Get('uuid/:uuid/availability/history')
  async getAssetAvailabilityHistory(
    @Param('uuid') uuid: string,
    @Query() query: AssetAvailabilityHistoryQueryDto,
    @TenantId() tenantId: number,
  ): Promise<AssetAvailabilityHistoryResponse> {
    const year =
      query.year !== undefined ? Number.parseInt(query.year, 10) : undefined;
    const month =
      query.month !== undefined ? Number.parseInt(query.month, 10) : undefined;
    return await this.assetAvailabilityService.getAvailabilityHistoryByUuid(
      uuid,
      tenantId,
      year,
      month,
    );
  }

  /**
   * PUT /assets/availability/:id
   * Update an existing availability entry (only if endDate \>= today)
   */
  @Put('availability/:id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_AVAIL, 'canWrite')
  async updateAssetAvailabilityEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssetAvailabilityEntryDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.assetAvailabilityService.updateAvailabilityEntry(
      id,
      dto,
      tenantId,
      user.id,
    );
  }

  /**
   * DELETE /assets/availability/:id
   * Delete an availability entry
   */
  @Delete('availability/:id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_AVAIL, 'canDelete')
  async deleteAssetAvailabilityEntry(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    return await this.assetAvailabilityService.deleteAvailabilityEntry(
      id,
      tenantId,
      user.id,
    );
  }

  /**
   * GET /assets/:id/availability
   * Get all availability entries overlapping with a date range.
   * Used by shift planning to visually mark cells where a asset is unavailable.
   */
  @Get(':id/availability')
  async getAssetAvailabilityRange(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AssetAvailabilityRangeQueryDto,
    @TenantId() tenantId: number,
  ): Promise<AssetAvailabilityHistoryEntry[]> {
    return await this.assetAvailabilityService.getAssetAvailabilityForDateRange(
      id,
      tenantId,
      query.startDate,
      query.endDate,
    );
  }

  // ============================================
  // Asset CRUD Endpoints
  // ============================================

  /**
   * GET /assets/uuid/:uuid
   * Get asset by UUID (preferred)
   */
  @Get('uuid/:uuid')
  async getAssetByUuid(
    @Param('uuid') uuid: string,
    @TenantId() tenantId: number,
  ): Promise<AssetResponse> {
    return await this.assetsService.getAssetByUuid(uuid, tenantId);
  }

  /**
   * GET /assets/:id
   * @deprecated Use GET /assets/uuid/:uuid instead
   */
  @Get(':id')
  async getAsset(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<AssetResponse> {
    return await this.assetsService.getAssetById(id, tenantId);
  }

  @Get(':id/maintenance')
  async getMaintenanceHistory(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<MaintenanceHistoryResponse[]> {
    return await this.assetsService.getMaintenanceHistory(id, tenantId);
  }

  @Get(':id/teams')
  async getAssetTeams(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ): Promise<AssetTeamResponse[]> {
    return await this.assetsService.getAssetTeams(id, tenantId);
  }

  @Put(':id/teams')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async setAssetTeams(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetAssetTeamsDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<AssetTeamResponse[]> {
    return await this.assetsService.setAssetTeams(
      id,
      dto.teamIds,
      tenantId,
      user.id,
    );
  }

  @Post()
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async createAsset(
    @Body() dto: CreateAssetDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<AssetResponse> {
    const data = {
      name: dto.name,
      assetType: dto.assetType,
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
    } as AssetCreateRequest;
    return await this.assetsService.createAsset(
      data,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
  }

  /**
   * PUT /assets/uuid/:uuid
   * Update asset by UUID (preferred)
   */
  @Put('uuid/:uuid')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async updateAssetByUuid(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<AssetResponse> {
    const data = stripUndefined({
      name: dto.name,
      model: dto.model,
      manufacturer: dto.manufacturer,
      serialNumber: dto.serialNumber,
      assetNumber: dto.assetNumber,
      departmentId: dto.departmentId,
      areaId: dto.areaId,
      location: dto.location,
      assetType: dto.assetType,
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
    }) as AssetUpdateRequest;
    return await this.assetsService.updateAssetByUuid(
      uuid,
      data,
      tenantId,
      user.id,
    );
  }

  /**
   * PUT /assets/:id
   * @deprecated Use PUT /assets/uuid/:uuid instead
   */
  @Put(':id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async updateAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<AssetResponse> {
    const data = stripUndefined({
      name: dto.name,
      model: dto.model,
      manufacturer: dto.manufacturer,
      serialNumber: dto.serialNumber,
      assetNumber: dto.assetNumber,
      departmentId: dto.departmentId,
      areaId: dto.areaId,
      location: dto.location,
      assetType: dto.assetType,
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
    }) as AssetUpdateRequest;
    return await this.assetsService.updateAsset(
      id,
      data,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
  }

  /**
   * DELETE /assets/uuid/:uuid
   * Delete asset by UUID (preferred)
   */
  @Delete('uuid/:uuid')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_MANAGE, 'canDelete')
  async deleteAssetByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    await this.assetsService.deleteAssetByUuid(uuid, tenantId, user.id);
    return { message: 'Asset deleted successfully' };
  }

  /**
   * DELETE /assets/:id
   * @deprecated Use DELETE /assets/uuid/:uuid instead
   */
  @Delete(':id')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_MANAGE, 'canDelete')
  async deleteAsset(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MessageResponse> {
    await this.assetsService.deleteAsset(id, tenantId, user.id, ip, userAgent);
    return { message: 'Asset deleted successfully' };
  }

  @Put(':id/deactivate')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async deactivateAsset(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MessageResponse> {
    await this.assetsService.deactivateAsset(
      id,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
    return { message: 'Asset deactivated successfully' };
  }

  @Put(':id/activate')
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
  async activateAsset(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
    @Ip() ip: string,
    @Headers(HEADER_USER_AGENT) userAgent: string,
  ): Promise<MessageResponse> {
    await this.assetsService.activateAsset(
      id,
      tenantId,
      user.id,
      ip,
      userAgent,
    );
    return { message: 'Asset activated successfully' };
  }
}
