/**
 * Feature Visits Controller
 *
 * HTTP endpoints for tracking user visits to features:
 * - POST /feature-visits/mark - Mark a feature as visited
 */
import { Body, Controller, Post } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { MarkVisitedDto } from './dto/mark-visited.dto.js';
import { FeatureVisitsService } from './feature-visits.service.js';

@Controller('feature-visits')
export class FeatureVisitsController {
  constructor(private readonly featureVisitsService: FeatureVisitsService) {}

  /**
   * Mark a feature as visited
   * Updates last_visited_at to NOW() for the current user and feature
   *
   * POST /api/v2/feature-visits/mark
   */
  @Post('mark')
  async markVisited(
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
    @Body() dto: MarkVisitedDto,
  ): Promise<{ success: true }> {
    await this.featureVisitsService.markVisited(tenantId, user.id, dto.feature);
    return { success: true };
  }
}
