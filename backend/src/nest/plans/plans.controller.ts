/**
 * Plans Controller
 *
 * HTTP endpoints for subscription plans:
 * - GET    /plans               - Get all plans (public)
 * - GET    /plans/current       - Get current tenant plan
 * - GET    /plans/addons        - Get tenant addons
 * - PUT    /plans/addons        - Update tenant addons (admin)
 * - GET    /plans/costs         - Calculate tenant costs
 * - GET    /plans/:id           - Get plan by ID (public)
 * - GET    /plans/:id/features  - Get plan features (public)
 * - PUT    /plans/:id/upgrade   - Upgrade/downgrade plan (admin)
 */
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import {
  GetAllPlansQueryDto,
  UpdateAddonsDto,
  UpgradePlanDto,
} from './dto/index.js';
import type {
  CostCalculation,
  CurrentPlanResponse,
  PlanFeature,
  PlanWithFeatures,
  TenantAddons,
} from './plans.service.js';
import { PlansService } from './plans.service.js';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @Public()
  async getAllPlans(
    @Query() query: GetAllPlansQueryDto,
  ): Promise<PlanWithFeatures[]> {
    return await this.plansService.getAllPlans(query.includeInactive);
  }

  @Get('current')
  async getCurrentPlan(
    @TenantId() tenantId: number,
  ): Promise<CurrentPlanResponse> {
    const currentPlan = await this.plansService.getCurrentPlan(tenantId);
    if (currentPlan === null) {
      throw new NotFoundException('No active plan found');
    }
    return currentPlan;
  }

  @Get('addons')
  async getTenantAddons(@TenantId() tenantId: number): Promise<TenantAddons> {
    return await this.plansService.getTenantAddons(tenantId);
  }

  @Put('addons')
  @Roles('admin', 'root')
  async updateAddons(
    @Body() dto: UpdateAddonsDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<TenantAddons> {
    return await this.plansService.updateAddons(
      tenantId,
      {
        employees: dto.employees,
        admins: dto.admins,
        storageGb: dto.storageGb,
      },
      user.id,
    );
  }

  @Get('costs')
  async calculateCosts(@TenantId() tenantId: number): Promise<CostCalculation> {
    return await this.plansService.calculateCosts(tenantId);
  }

  @Get(':id')
  @Public()
  async getPlanById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PlanWithFeatures> {
    const plan = await this.plansService.getPlanById(id);
    if (plan === null) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  @Get(':id/features')
  @Public()
  async getPlanFeatures(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PlanFeature[]> {
    return await this.plansService.getPlanFeatures(id);
  }

  @Put(':id/upgrade')
  @Roles('admin', 'root')
  async upgradePlan(
    @Param('id', ParseIntPipe) _id: number,
    @Body() dto: UpgradePlanDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: number,
  ): Promise<CurrentPlanResponse> {
    const effectiveDate =
      dto.effectiveDate !== undefined ? new Date(dto.effectiveDate) : undefined;
    return await this.plansService.upgradePlan(
      tenantId,
      dto.newPlanCode,
      effectiveDate,
      user.id,
    );
  }
}
