import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import {
  CreatePositionDto,
  NodeDetailParamDto,
  PositionIdParamDto,
  UpdateHierarchyLabelsDto,
  UpdatePositionDto,
  UpsertPositionsDto,
} from './dto/index.js';
import { OrganigramLayoutService } from './organigram-layout.service.js';
import { OrganigramSettingsService } from './organigram-settings.service.js';
import { OrganigramService } from './organigram.service.js';
import {
  DEFAULT_VIEWPORT,
  type HierarchyLabels,
  type OrgChartTree,
  type OrgNodeDetail,
} from './organigram.types.js';
import { PositionCatalogService } from './position-catalog.service.js';
import type { PositionCatalogEntry } from './position-catalog.types.js';

@Controller('organigram')
export class OrganigramController {
  constructor(
    private readonly organigramService: OrganigramService,
    private readonly settingsService: OrganigramSettingsService,
    private readonly layoutService: OrganigramLayoutService,
    private readonly positionCatalogService: PositionCatalogService,
  ) {}

  @Get('tree')
  @Roles('root')
  async getOrgChartTree(@TenantId() tenantId: number): Promise<OrgChartTree> {
    return await this.organigramService.getOrgChartTree(tenantId);
  }

  @Get('node-details/:entityType/:entityUuid')
  @Roles('root')
  async getNodeDetails(
    @TenantId() tenantId: number,
    @Param() params: NodeDetailParamDto,
  ): Promise<OrgNodeDetail> {
    return await this.organigramService.getNodeDetails(
      tenantId,
      params.entityType,
      params.entityUuid,
    );
  }

  @Get('hierarchy-labels')
  async getHierarchyLabels(@TenantId() tenantId: number): Promise<HierarchyLabels> {
    return await this.settingsService.getHierarchyLabels(tenantId);
  }

  @Patch('hierarchy-labels')
  @Roles('root')
  async updateHierarchyLabels(
    @TenantId() tenantId: number,
    @Body() dto: UpdateHierarchyLabelsDto,
  ): Promise<HierarchyLabels> {
    return await this.settingsService.updateHierarchyLabels(tenantId, dto);
  }

  @Put('positions')
  @Roles('root')
  @HttpCode(HttpStatus.OK)
  async upsertPositions(
    @TenantId() tenantId: number,
    @Body() dto: UpsertPositionsDto,
  ): Promise<{ message: string }> {
    await this.layoutService.upsertPositions(tenantId, dto);
    if (dto.viewport !== undefined) {
      const viewport: {
        zoom: number;
        panX: number;
        panY: number;
        fontSize: number;
        nodeWidth: number;
        nodeHeight: number;
      } = {
        zoom: dto.viewport.zoom,
        panX: dto.viewport.panX,
        panY: dto.viewport.panY,
        fontSize: dto.viewport.fontSize ?? DEFAULT_VIEWPORT.fontSize,
        nodeWidth: dto.viewport.nodeWidth ?? 200,
        nodeHeight: dto.viewport.nodeHeight ?? 80,
      };
      await this.settingsService.saveViewport(tenantId, viewport);
    }
    if (dto.hallOverrides !== undefined) {
      await this.settingsService.saveHallOverrides(tenantId, dto.hallOverrides);
    }
    if (dto.hallConnectionAnchors !== undefined) {
      await this.settingsService.saveHallConnectionAnchors(tenantId, dto.hallConnectionAnchors);
    }
    if (dto.canvasBg !== undefined) {
      await this.settingsService.saveCanvasBg(tenantId, dto.canvasBg);
    }
    return { message: 'Positionen gespeichert' };
  }

  // ── Position Catalog CRUD ──────────────────────────────────

  @Get('positions')
  @Roles('root', 'admin')
  async listPositions(
    @TenantId() tenantId: number,
    @Query('roleCategory') roleCategory?: 'employee' | 'admin' | 'root',
  ): Promise<PositionCatalogEntry[]> {
    return await this.positionCatalogService.getAll(tenantId, roleCategory);
  }

  @Post('positions')
  @Roles('root')
  async createPosition(
    @TenantId() tenantId: number,
    @Body() dto: CreatePositionDto,
  ): Promise<PositionCatalogEntry> {
    return await this.positionCatalogService.create(tenantId, dto);
  }

  @Put('positions/:id')
  @Roles('root')
  @HttpCode(HttpStatus.OK)
  async updatePosition(
    @TenantId() tenantId: number,
    @Param() params: PositionIdParamDto,
    @Body() dto: UpdatePositionDto,
  ): Promise<PositionCatalogEntry> {
    return await this.positionCatalogService.update(tenantId, params.id, dto);
  }

  @Delete('positions/:id')
  @Roles('root')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePosition(
    @TenantId() tenantId: number,
    @Param() params: PositionIdParamDto,
  ): Promise<void> {
    await this.positionCatalogService.delete(tenantId, params.id);
  }
}
