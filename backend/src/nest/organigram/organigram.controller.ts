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
import { UpdateHierarchyLabelsDto, UpsertPositionsDto } from './dto/index.js';
import { OrganigramLayoutService } from './organigram-layout.service.js';
import { OrganigramSettingsService } from './organigram-settings.service.js';
import { OrganigramService } from './organigram.service.js';
import type { HierarchyLabels, OrgChartTree } from './organigram.types.js';

@Controller('organigram')
@Roles('root')
export class OrganigramController {
  constructor(
    private readonly organigramService: OrganigramService,
    private readonly settingsService: OrganigramSettingsService,
    private readonly layoutService: OrganigramLayoutService,
  ) {}

  @Get('tree')
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
  async updateHierarchyLabels(
    @TenantId() tenantId: number,
    @Body() dto: UpdateHierarchyLabelsDto,
  ): Promise<HierarchyLabels> {
    return await this.settingsService.updateHierarchyLabels(tenantId, dto);
  }

  @Put('positions')
  @HttpCode(HttpStatus.OK)
  async upsertPositions(
    @TenantId() tenantId: number,
    @Body() dto: UpsertPositionsDto,
  ): Promise<{ message: string }> {
    await this.layoutService.upsertPositions(tenantId, dto);
    return { message: 'Positionen gespeichert' };
  }
}
