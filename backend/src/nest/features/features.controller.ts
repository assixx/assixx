/**
 * Features Controller
 *
 * HTTP endpoints for feature management:
 * - GET    /features                      - Get all features (public)
 * - GET    /features/categories           - Get features by category (public)
 * - GET    /features/my-features          - Get my features (authenticated)
 * - GET    /features/test/:featureCode    - Test feature access (authenticated)
 * - GET    /features/usage/:featureCode   - Get usage stats (authenticated)
 * - GET    /features/tenant/:tenantId     - Get tenant features (admin)
 * - GET    /features/tenant/:tenantId/summary - Get tenant features summary (admin)
 * - POST   /features/activate             - Activate feature (admin)
 * - POST   /features/deactivate           - Deactivate feature (admin)
 * - GET    /features/all-tenants          - Get all tenants with features (root)
 * - GET    /features/:code                - Get feature by code (authenticated)
 */
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import {
  ActivateFeatureDto,
  DeactivateFeatureDto,
  GetAllFeaturesQueryDto,
  GetUsageStatsQueryDto,
} from './dto/index.js';
import type {
  Feature,
  FeatureCategory,
  FeatureUsageStats,
  FeatureWithTenantInfo,
  TenantFeaturesSummary,
  TenantWithFeatures,
} from './features.service.js';
import { FeaturesService } from './features.service.js';

interface MessageResponse {
  message: string;
}

interface FeatureAccessResponse {
  hasAccess: boolean;
  featureCode: string;
}

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get()
  @Public()
  async getAllFeatures(@Query() query: GetAllFeaturesQueryDto): Promise<Feature[]> {
    return await this.featuresService.getAllFeatures(query.includeInactive);
  }

  @Get('categories')
  @Public()
  async getFeaturesByCategory(@Query() query: GetAllFeaturesQueryDto): Promise<FeatureCategory[]> {
    return await this.featuresService.getFeaturesByCategory(query.includeInactive);
  }

  @Get('my-features')
  async getMyFeatures(@TenantId() tenantId: number): Promise<FeatureWithTenantInfo[]> {
    return await this.featuresService.getFeaturesWithTenantInfo(tenantId);
  }

  @Get('test/:featureCode')
  async testFeatureAccess(
    @Param('featureCode') featureCode: string,
    @TenantId() tenantId: number,
  ): Promise<FeatureAccessResponse> {
    const hasAccess = await this.featuresService.checkTenantAccess(tenantId, featureCode);
    return { hasAccess, featureCode };
  }

  @Get('usage/:featureCode')
  async getUsageStats(
    @Param('featureCode') featureCode: string,
    @Query() query: GetUsageStatsQueryDto,
    @TenantId() tenantId: number,
  ): Promise<FeatureUsageStats[]> {
    return await this.featuresService.getUsageStats(
      tenantId,
      featureCode,
      query.startDate,
      query.endDate,
    );
  }

  @Get('tenant/:tenantId')
  @Roles('admin', 'root')
  async getTenantFeatures(
    @Param('tenantId', ParseIntPipe) tenantId: number,
  ): Promise<FeatureWithTenantInfo[]> {
    return await this.featuresService.getFeaturesWithTenantInfo(tenantId);
  }

  @Get('tenant/:tenantId/summary')
  @Roles('admin', 'root')
  async getTenantFeaturesSummary(
    @Param('tenantId', ParseIntPipe) tenantId: number,
  ): Promise<TenantFeaturesSummary> {
    return await this.featuresService.getTenantFeaturesSummary(tenantId);
  }

  @Post('activate')
  @Roles('admin', 'root')
  async activateFeature(
    @Body() dto: ActivateFeatureDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponse> {
    await this.featuresService.activateFeature(
      {
        tenantId: dto.tenantId,
        featureCode: dto.featureCode,
        options: dto.options,
      },
      user.id,
    );
    return { message: `Feature ${dto.featureCode} activated successfully` };
  }

  @Post('deactivate')
  @Roles('admin', 'root')
  async deactivateFeature(
    @Body() dto: DeactivateFeatureDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MessageResponse> {
    await this.featuresService.deactivateFeature(dto.tenantId, dto.featureCode, user.id);
    return { message: `Feature ${dto.featureCode} deactivated successfully` };
  }

  @Get('all-tenants')
  @Roles('root')
  async getAllTenantsWithFeatures(): Promise<TenantWithFeatures[]> {
    return await this.featuresService.getAllTenantsWithFeatures();
  }

  // This route must be last as it catches all GET requests with :code
  @Get(':code')
  async getFeatureByCode(@Param('code') code: string): Promise<Feature | null> {
    return await this.featuresService.getFeatureByCode(code);
  }
}
