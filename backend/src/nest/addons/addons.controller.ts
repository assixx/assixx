/**
 * Addons Controller (ADR-033)
 *
 * HTTP endpoints for addon management:
 * - GET    /addons                       - Get all addons (public)
 * - GET    /addons/my-addons             - Get tenant addons with status (authenticated)
 * - GET    /addons/status/:code          - Get addon status for tenant (authenticated)
 * - GET    /addons/usage/:code           - Get usage stats (authenticated)
 * - GET    /addons/tenant/:tenantId      - Get tenant addons (admin)
 * - GET    /addons/tenant/:tenantId/summary - Get tenant summary (admin)
 * - POST   /addons/activate              - Activate addon (admin)
 * - POST   /addons/deactivate            - Deactivate addon (admin)
 * - GET    /addons/all-tenants           - Get all tenants with addons (root)
 * - GET    /addons/:code                 - Get addon by code (authenticated)
 */
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import type {
  Addon,
  AddonStatus,
  AddonWithTenantStatus,
  TenantAddonsSummary,
  TenantWithAddons,
  UsageStats,
} from './addons.service.js';
import { AddonsService } from './addons.service.js';
import {
  ActivateAddonDto,
  DeactivateAddonDto,
  GetAllAddonsQueryDto,
  GetUsageStatsQueryDto,
} from './dto/index.js';

interface MessageResponse {
  message: string;
}

interface AddonAccessResponse {
  hasAccess: boolean;
  addonCode: string;
}

@Controller('addons')
export class AddonsController {
  constructor(private readonly addonsService: AddonsService) {}

  @Get()
  @Public()
  async getAllAddons(@Query() query: GetAllAddonsQueryDto): Promise<Addon[]> {
    return await this.addonsService.getAllAddons(query.includeInactive);
  }

  @Get('my-addons')
  async getMyAddons(@TenantId() tenantId: number): Promise<AddonWithTenantStatus[]> {
    return await this.addonsService.getAvailableAddons(tenantId);
  }

  @Get('status/:code')
  async getAddonStatus(
    @Param('code') code: string,
    @TenantId() tenantId: number,
  ): Promise<AddonStatus> {
    return await this.addonsService.getAddonStatus(tenantId, code);
  }

  @Get('test/:addonCode')
  async testAddonAccess(
    @Param('addonCode') addonCode: string,
    @TenantId() tenantId: number,
  ): Promise<AddonAccessResponse> {
    const hasAccess = await this.addonsService.checkTenantAccess(tenantId, addonCode);
    return { hasAccess, addonCode };
  }

  @Get('usage/:code')
  async getUsageStats(
    @Param('code') code: string,
    @Query() query: GetUsageStatsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<UsageStats[]> {
    return await this.addonsService.getUsageStats(tenantId, code, query.startDate, query.endDate);
  }

  @Get('tenant/:tenantId')
  @Roles('admin', 'root')
  async getTenantAddons(
    @Param('tenantId', ParseIntPipe) tenantId: number,
  ): Promise<AddonWithTenantStatus[]> {
    return await this.addonsService.getAvailableAddons(tenantId);
  }

  @Get('tenant/:tenantId/summary')
  @Roles('admin', 'root')
  async getTenantAddonsSummary(
    @Param('tenantId', ParseIntPipe) tenantId: number,
  ): Promise<TenantAddonsSummary> {
    return await this.addonsService.getTenantAddonsSummary(tenantId);
  }

  @Post('activate')
  @Roles('admin', 'root')
  async activateAddon(
    @Body() dto: ActivateAddonDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AddonStatus> {
    return await this.addonsService.activateAddon(dto.tenantId, dto.addonCode, user.id);
  }

  @Post('deactivate')
  @Roles('admin', 'root')
  async deactivateAddon(
    @Body() dto: DeactivateAddonDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponse> {
    await this.addonsService.deactivateAddon(dto.tenantId, dto.addonCode, user.id);
    return { message: `Addon ${dto.addonCode} deactivated successfully` };
  }

  @Get('all-tenants')
  @Roles('root')
  async getAllTenantsWithAddons(): Promise<TenantWithAddons[]> {
    return await this.addonsService.getAllTenantsWithAddons();
  }

  /** Must be last — catches all GET /addons/:code. */
  @Get(':code')
  async getAddonByCode(@Param('code') code: string): Promise<Addon | null> {
    return await this.addonsService.getAddonByCode(code);
  }
}
