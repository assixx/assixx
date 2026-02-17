/**
 * Dashboard Controller
 *
 * Provides aggregated dashboard data endpoints.
 * Optimized for performance by combining multiple counts into single requests.
 */
import { Controller, Get, Header, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { DashboardService } from './dashboard.service.js';
import type { DashboardCounts } from './dto/dashboard-counts.dto.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/counts
   *
   * Get all notification-related counts in a single request.
   * Replaces 5 separate API calls with one optimized endpoint.
   *
   * Cache-Control: private, max-age=30
   * - private: Response is user-specific, don't cache in CDN
   * - max-age=30: Browser can reuse for 30 seconds
   */
  @Get('counts')
  @Header('Cache-Control', 'private, max-age=30')
  async getCounts(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<DashboardCounts> {
    return await this.dashboardService.getCounts(user, tenantId);
  }
}
