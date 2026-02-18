/**
 * TPM Card Duplicate Detection Service
 *
 * Detects potential duplicate maintenance cards before creation.
 * Checks for cards with similar titles in the same or shorter intervals
 * on the same machine — helps prevent redundant maintenance tasks.
 *
 * All methods are read-only (no mutations).
 */
import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { type TpmCardJoinRow, mapCardRowToApi } from './tpm-cards.helpers.js';
import type { TpmCard, TpmIntervalType } from './tpm.types.js';
import { INTERVAL_ORDER_MAP } from './tpm.types.js';

/** Result of a duplicate check */
export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  existingCards: TpmCard[];
}

/** Max results returned by similarity search */
const MAX_SIMILAR_RESULTS = 10;

@Injectable()
export class TpmCardDuplicateService {
  private readonly logger = new Logger(TpmCardDuplicateService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Check if a potential new card would be a duplicate.
   *
   * A card is considered a potential duplicate when:
   *   - Same machine (machineId)
   *   - Similar title (case-insensitive ILIKE match)
   *   - Same or shorter interval (interval_order <= given interval's order)
   *
   * This catches the common mistake of creating a "Sichtprüfung" card
   * as weekly when a daily "Sichtprüfung" already exists.
   */
  async checkDuplicate(
    tenantId: number,
    machineId: number,
    title: string,
    intervalType: TpmIntervalType,
  ): Promise<DuplicateCheckResult> {
    const intervalOrder = INTERVAL_ORDER_MAP[intervalType];
    const searchPattern = `%${escapeLikePattern(title)}%`;

    const rows = await this.db.query<TpmCardJoinRow>(
      `SELECT c.*,
         p.uuid AS plan_uuid,
         m.name AS machine_name
       FROM tpm_cards c
       LEFT JOIN tpm_maintenance_plans p ON c.plan_id = p.id
       LEFT JOIN machines m ON c.machine_id = m.id AND m.tenant_id = c.tenant_id
       WHERE c.machine_id = $1
         AND c.tenant_id = $2
         AND c.title ILIKE $3
         AND c.interval_order <= $4
         AND c.is_active = 1
       ORDER BY c.interval_order ASC
       LIMIT $5`,
      [machineId, tenantId, searchPattern, intervalOrder, MAX_SIMILAR_RESULTS],
    );

    const existingCards = rows.map(mapCardRowToApi);

    if (existingCards.length > 0) {
      this.logger.debug(
        `Duplikat-Warnung: "${title}" (${intervalType}) — ` +
          `${existingCards.length} ähnliche Karten gefunden auf Maschine ${machineId}`,
      );
    }

    return {
      hasDuplicate: existingCards.length > 0,
      existingCards,
    };
  }

  /**
   * Search for cards with similar titles or descriptions on a machine.
   * Uses case-insensitive ILIKE matching across both fields.
   */
  async findSimilarCards(
    tenantId: number,
    machineId: number,
    searchText: string,
  ): Promise<TpmCard[]> {
    const searchPattern = `%${escapeLikePattern(searchText)}%`;

    const rows = await this.db.query<TpmCardJoinRow>(
      `SELECT c.*,
         p.uuid AS plan_uuid,
         m.name AS machine_name
       FROM tpm_cards c
       LEFT JOIN tpm_maintenance_plans p ON c.plan_id = p.id
       LEFT JOIN machines m ON c.machine_id = m.id AND m.tenant_id = c.tenant_id
       WHERE c.machine_id = $1
         AND c.tenant_id = $2
         AND (c.title ILIKE $3 OR c.description ILIKE $3)
         AND c.is_active = 1
       ORDER BY c.interval_order ASC, c.sort_order ASC
       LIMIT $4`,
      [machineId, tenantId, searchPattern, MAX_SIMILAR_RESULTS],
    );

    return rows.map(mapCardRowToApi);
  }
}

/**
 * Escape special LIKE/ILIKE pattern characters.
 * Prevents user input from being interpreted as wildcards.
 */
function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}
