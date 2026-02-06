/**
 * Feature Visits Service
 *
 * Tracks when users last visited specific features (calendar, kvp, surveys).
 * Used for notification badge reset logic - badge shows items created since last visit.
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { Feature } from './dto/mark-visited.dto.js';

interface FeatureVisitRow {
  id: number;
  tenant_id: number;
  user_id: number;
  feature: string;
  last_visited_at: Date;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class FeatureVisitsService {
  private readonly logger = new Logger(FeatureVisitsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Mark a feature as visited (upsert: last_visited_at = NOW())
   *
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param feature - Feature name ('calendar', 'kvp', 'surveys')
   */
  async markVisited(
    tenantId: number,
    userId: number,
    feature: Feature,
  ): Promise<void> {
    this.logger.debug(`Marking ${feature} as visited for user ${userId}`);

    await this.db.query(
      `INSERT INTO feature_visits (tenant_id, user_id, feature, last_visited_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, feature, tenant_id)
       DO UPDATE SET last_visited_at = NOW(), updated_at = NOW()`,
      [tenantId, userId, feature],
    );
  }

  /**
   * Get the last visit timestamp for a feature
   *
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param feature - Feature name
   * @returns Last visited timestamp or null if never visited
   */
  async getLastVisited(
    tenantId: number,
    userId: number,
    feature: Feature,
  ): Promise<Date | null> {
    const result = await this.db.queryOne<FeatureVisitRow>(
      `SELECT last_visited_at FROM feature_visits
       WHERE tenant_id = $1 AND user_id = $2 AND feature = $3`,
      [tenantId, userId, feature],
    );

    return result?.last_visited_at ?? null;
  }

  /**
   * Get all feature visits for a user
   *
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @returns Map of feature name to last visited timestamp
   */
  async getAllVisits(
    tenantId: number,
    userId: number,
  ): Promise<Map<Feature, Date>> {
    const rows = await this.db.query<FeatureVisitRow>(
      `SELECT feature, last_visited_at FROM feature_visits
       WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId],
    );

    const visits = new Map<Feature, Date>();
    for (const row of rows) {
      visits.set(row.feature as Feature, row.last_visited_at);
    }

    return visits;
  }
}
