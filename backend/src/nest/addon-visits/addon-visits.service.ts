/**
 * Addon Visits Service
 *
 * Tracks when users last visited specific addons (calendar, kvp, surveys).
 * Used for notification badge reset logic - badge shows items created since last visit.
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { VisitableAddon } from './dto/mark-visited.dto.js';

interface AddonVisitRow {
  id: number;
  tenant_id: number;
  user_id: number;
  addon: string;
  last_visited_at: Date;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AddonVisitsService {
  private readonly logger = new Logger(AddonVisitsService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Mark an addon as visited (upsert: last_visited_at = NOW()) */
  async markVisited(
    tenantId: number,
    userId: number,
    addon: VisitableAddon,
  ): Promise<void> {
    this.logger.debug(`Marking ${addon} as visited for user ${userId}`);

    await this.db.query(
      `INSERT INTO addon_visits (tenant_id, user_id, addon, last_visited_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, addon, tenant_id)
       DO UPDATE SET last_visited_at = NOW(), updated_at = NOW()`,
      [tenantId, userId, addon],
    );
  }

  /** Get the last visit timestamp for an addon (null if never visited). */
  async getLastVisited(
    tenantId: number,
    userId: number,
    addon: VisitableAddon,
  ): Promise<Date | null> {
    const result = await this.db.queryOne<AddonVisitRow>(
      `SELECT last_visited_at FROM addon_visits
       WHERE tenant_id = $1 AND user_id = $2 AND addon = $3`,
      [tenantId, userId, addon],
    );

    return result?.last_visited_at ?? null;
  }

  /** Get all addon visits for a user. */
  async getAllVisits(
    tenantId: number,
    userId: number,
  ): Promise<Map<VisitableAddon, Date>> {
    const rows = await this.db.query<AddonVisitRow>(
      `SELECT addon, last_visited_at FROM addon_visits
       WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId],
    );

    const visits = new Map<VisitableAddon, Date>();
    for (const row of rows) {
      visits.set(row.addon as VisitableAddon, row.last_visited_at);
    }

    return visits;
  }
}
