/**
 * Addon Visits Controller
 *
 * HTTP endpoints for tracking user visits to addons:
 * - POST /addon-visits/mark - Mark an addon as visited
 */
import { Body, Controller, Post } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { AddonVisitsService } from './addon-visits.service.js';
import { MarkVisitedDto } from './dto/mark-visited.dto.js';

@Controller('addon-visits')
export class AddonVisitsController {
  constructor(private readonly addonVisitsService: AddonVisitsService) {}

  /**
   * Mark an addon as visited
   * Updates last_visited_at to NOW() for the current user and addon
   *
   * POST /api/v2/addon-visits/mark
   */
  @Post('mark')
  async markVisited(
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
    @Body() dto: MarkVisitedDto,
  ): Promise<{ success: true }> {
    await this.addonVisitsService.markVisited(tenantId, user.id, dto.addon);
    return { success: true };
  }
}
