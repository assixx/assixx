import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
} from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import {
  UpdateHierarchyLabelsDto,
  UpdatePositionOptionsDto,
  UpsertPositionsDto,
} from './dto/index.js';
import { OrganigramLayoutService } from './organigram-layout.service.js';
import { OrganigramSettingsService } from './organigram-settings.service.js';
import { OrganigramService } from './organigram.service.js';
import type {
  HierarchyLabels,
  OrgChartTree,
  PositionOptions,
} from './organigram.types.js';

@Controller('organigram')
export class OrganigramController {
  constructor(
    private readonly organigramService: OrganigramService,
    private readonly settingsService: OrganigramSettingsService,
    private readonly layoutService: OrganigramLayoutService,
  ) {}

  @Get('tree')
  @Roles('root')
  async getOrgChartTree(@TenantId() tenantId: number): Promise<OrgChartTree> {
    return await this.organigramService.getOrgChartTree(tenantId);
  }

  @Get('hierarchy-labels')
  async getHierarchyLabels(
    @TenantId() tenantId: number,
  ): Promise<HierarchyLabels> {
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
    return { message: 'Positionen gespeichert' };
  }

  @Get('position-options')
  async getPositionOptions(
    @TenantId() tenantId: number,
  ): Promise<PositionOptions> {
    return await this.settingsService.getPositionOptions(tenantId);
  }

  @Put('position-options')
  @Roles('root')
  @HttpCode(HttpStatus.OK)
  async updatePositionOptions(
    @TenantId() tenantId: number,
    @Body() dto: UpdatePositionOptionsDto,
  ): Promise<PositionOptions> {
    return await this.settingsService.updatePositionOptions(tenantId, dto);
  }
}
