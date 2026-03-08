/**
 * TPM Escalation Service
 *
 * Cron-based service that detects overdue TPM cards and escalates them.
 * When a red card exceeds the tenant's escalation_after_hours threshold,
 * the card transitions to 'overdue' and the team lead is notified.
 *
 * Concurrency safety:
 *   - isProcessing guard prevents parallel runs within the same process
 *   - FOR UPDATE SKIP LOCKED prevents duplicate processing across instances
 *
 * Startup recovery via OnModuleInit catches cards that expired while offline.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PoolClient } from 'pg';

import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { UpdateEscalationConfigDto } from './dto/update-escalation-config.dto.js';
import { TpmCardStatusService } from './tpm-card-status.service.js';
import type { TpmNotificationCard } from './tpm-notification.service.js';
import { TpmNotificationService } from './tpm-notification.service.js';
import type {
  TpmEscalationConfig,
  TpmEscalationConfigRow,
} from './tpm.types.js';

/** Row shape returned by the overdue candidates query */
interface OverdueCandidate {
  id: number;
  uuid: string;
  tenant_id: number;
  card_code: string;
  title: string;
  asset_id: number;
  asset_name: string | null;
  interval_type: string;
  status: string;
}

/** Default escalation threshold when no config row exists for a tenant */
const DEFAULT_ESCALATION_HOURS = 48;

@Injectable()
export class TpmEscalationService implements OnModuleInit {
  private readonly logger = new Logger(TpmEscalationService.name);
  private isProcessing = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly cardStatusService: TpmCardStatusService,
    private readonly notificationService: TpmNotificationService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  /** Startup recovery — catch cards that expired while server was down */
  async onModuleInit(): Promise<void> {
    this.logger.log('Startup recovery: checking for overdue TPM cards...');
    await this.processOverdueCards();
  }

  // ============================================================================
  // CONFIG READ / WRITE
  // ============================================================================

  /** Get escalation config for a tenant (returns defaults if no row exists) */
  async getConfig(tenantId: number): Promise<TpmEscalationConfig> {
    const row = await this.db.queryOne<TpmEscalationConfigRow>(
      `SELECT * FROM tpm_escalation_config WHERE tenant_id = $1`,
      [tenantId],
    );

    if (row === null) {
      return buildDefaultConfig();
    }

    return mapConfigRowToApi(row);
  }

  /** Update (upsert) escalation config for a tenant */
  async updateConfig(
    tenantId: number,
    userId: number,
    dto: UpdateEscalationConfigDto,
  ): Promise<TpmEscalationConfig> {
    return await this.db.tenantTransaction(
      async (client: PoolClient): Promise<TpmEscalationConfig> => {
        const result = await client.query<TpmEscalationConfigRow>(
          `INSERT INTO tpm_escalation_config
             (tenant_id, escalation_after_hours, notify_team_lead, notify_department_lead)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id)
           DO UPDATE SET
             escalation_after_hours = EXCLUDED.escalation_after_hours,
             notify_team_lead = EXCLUDED.notify_team_lead,
             notify_department_lead = EXCLUDED.notify_department_lead,
             updated_at = NOW()
           RETURNING *`,
          [
            tenantId,
            dto.escalationAfterHours,
            dto.notifyTeamLead ?? true,
            dto.notifyDepartmentLead ?? false,
          ],
        );

        const row = result.rows[0];
        if (row === undefined) {
          throw new Error('UPSERT tpm_escalation_config returned no rows');
        }
        void this.activityLogger.logUpdate(
          tenantId,
          userId,
          'tpm_escalation_config',
          0,
          `TPM-Eskalationskonfiguration aktualisiert`,
          undefined,
          { escalationAfterHours: dto.escalationAfterHours },
        );

        return mapConfigRowToApi(row);
      },
    );
  }

  /** Cron: check every 5 minutes for cards past escalation threshold */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'tpm-escalation',
    timeZone: 'Europe/Berlin',
  })
  async handleEscalation(): Promise<void> {
    await this.processOverdueCards();
  }

  // ============================================================================
  // CORE PROCESSING
  // ============================================================================

  /** Find and escalate all overdue cards across all tenants */
  private async processOverdueCards(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('Escalation already in progress, skipping');
      return;
    }

    this.isProcessing = true;
    try {
      const candidates = await this.findOverdueCandidates();

      if (candidates.length === 0) return;

      this.logger.log(
        `Found ${String(candidates.length)} overdue TPM card(s) to escalate`,
      );

      for (const candidate of candidates) {
        await this.escalateCard(candidate);
      }
    } catch (error: unknown) {
      this.logger.error(`Escalation processing failed: ${String(error)}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Find red cards that exceeded their tenant's escalation threshold.
   *
   * System-level query (no RLS context) — sees all tenants.
   * Uses COALESCE for tenants without explicit escalation config.
   */
  private async findOverdueCandidates(): Promise<OverdueCandidate[]> {
    return await this.db.query<OverdueCandidate>(
      `SELECT c.id, c.uuid, c.tenant_id, c.card_code, c.title,
              c.asset_id, c.interval_type, c.status,
              m.name AS asset_name
       FROM tpm_cards c
       LEFT JOIN tpm_escalation_config ec
         ON c.tenant_id = ec.tenant_id
       LEFT JOIN assets m
         ON c.asset_id = m.id AND c.tenant_id = m.tenant_id
       WHERE c.status = 'red'
         AND c.is_active = ${IS_ACTIVE.ACTIVE}
         AND c.current_due_date IS NOT NULL
         AND c.current_due_date < NOW() - make_interval(
           hours => COALESCE(ec.escalation_after_hours, $1)
         )
       ORDER BY c.current_due_date ASC`,
      [DEFAULT_ESCALATION_HOURS],
    );
  }

  /**
   * Escalate a single card: transition red → overdue + notify team lead.
   *
   * Uses FOR UPDATE SKIP LOCKED to handle concurrent instances safely.
   * Post-transaction: resolve team lead and send notification.
   */
  private async escalateCard(candidate: OverdueCandidate): Promise<void> {
    try {
      const escalated = await this.db.transaction(
        async (client: PoolClient) => {
          const result = await client.query<{ id: number }>(
            `SELECT id FROM tpm_cards
             WHERE id = $1 AND tenant_id = $2
               AND status = 'red' AND is_active = ${IS_ACTIVE.ACTIVE}
             FOR UPDATE SKIP LOCKED`,
            [candidate.id, candidate.tenant_id],
          );

          if (result.rows[0] === undefined) return false;

          await this.cardStatusService.markCardOverdue(
            client,
            candidate.tenant_id,
            candidate.id,
          );
          return true;
        },
        { tenantId: candidate.tenant_id },
      );

      if (!escalated) return;

      await this.notifyTeamLead(candidate);

      this.logger.log(
        `Escalated card ${candidate.card_code} (${candidate.uuid}) to overdue`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to escalate card ${candidate.card_code}: ${String(error)}`,
      );
    }
  }

  // ============================================================================
  // NOTIFICATION + LOOKUP HELPERS
  // ============================================================================

  /** Resolve team lead for the card's asset and send notification */
  private async notifyTeamLead(candidate: OverdueCandidate): Promise<void> {
    const teamLeadId = await this.resolveTeamLead(
      candidate.tenant_id,
      candidate.asset_id,
    );

    if (teamLeadId === null) {
      this.logger.warn(
        `No team lead found for asset ${String(candidate.asset_id)} — skipping notification`,
      );
      return;
    }

    this.notificationService.notifyMaintenanceOverdue(
      candidate.tenant_id,
      this.toNotificationCard(candidate),
      teamLeadId,
    );
  }

  /** Find the team lead responsible for a asset */
  private async resolveTeamLead(
    tenantId: number,
    assetId: number,
  ): Promise<number | null> {
    const result = await this.db.queryOne<{ team_lead_id: number }>(
      `SELECT DISTINCT t.team_lead_id
       FROM teams t
       JOIN asset_teams mt
         ON t.id = mt.team_id AND t.tenant_id = mt.tenant_id
       WHERE mt.asset_id = $1 AND mt.tenant_id = $2
         AND t.is_active = ${IS_ACTIVE.ACTIVE} AND t.team_lead_id IS NOT NULL
       LIMIT 1`,
      [assetId, tenantId],
    );
    return result?.team_lead_id ?? null;
  }

  /** Map a candidate row to the notification card interface */
  private toNotificationCard(candidate: OverdueCandidate): TpmNotificationCard {
    return {
      uuid: candidate.uuid,
      cardCode: candidate.card_code,
      title: candidate.title,
      assetId: candidate.asset_id,
      ...(candidate.asset_name !== null && {
        assetName: candidate.asset_name,
      }),
      intervalType: candidate.interval_type,
      status: 'overdue',
    };
  }
}

// ============================================================================
// Module-level helpers
// ============================================================================

/** Map DB row to API response */
function mapConfigRowToApi(row: TpmEscalationConfigRow): TpmEscalationConfig {
  return {
    escalationAfterHours: row.escalation_after_hours,
    notifyTeamLead: row.notify_team_lead,
    notifyDepartmentLead: row.notify_department_lead,
    createdAt:
      typeof row.created_at === 'string' ?
        row.created_at
      : new Date(row.created_at).toISOString(),
    updatedAt:
      typeof row.updated_at === 'string' ?
        row.updated_at
      : new Date(row.updated_at).toISOString(),
  };
}

/** Build default config when no row exists for a tenant */
function buildDefaultConfig(): TpmEscalationConfig {
  const now = new Date().toISOString();
  return {
    escalationAfterHours: DEFAULT_ESCALATION_HOURS,
    notifyTeamLead: true,
    notifyDepartmentLead: false,
    createdAt: now,
    updatedAt: now,
  };
}
