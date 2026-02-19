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
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import { TpmCardStatusService } from './tpm-card-status.service.js';
import type { TpmNotificationCard } from './tpm-notification.service.js';
import { TpmNotificationService } from './tpm-notification.service.js';

/** Row shape returned by the overdue candidates query */
interface OverdueCandidate {
  id: number;
  uuid: string;
  tenant_id: number;
  card_code: string;
  title: string;
  machine_id: number;
  machine_name: string | null;
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
  ) {}

  /** Startup recovery — catch cards that expired while server was down */
  async onModuleInit(): Promise<void> {
    this.logger.log('Startup recovery: checking for overdue TPM cards...');
    await this.processOverdueCards();
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
              c.machine_id, c.interval_type, c.status,
              m.name AS machine_name
       FROM tpm_cards c
       LEFT JOIN tpm_escalation_config ec
         ON c.tenant_id = ec.tenant_id
       LEFT JOIN machines m
         ON c.machine_id = m.id AND c.tenant_id = m.tenant_id
       WHERE c.status = 'red'
         AND c.is_active = 1
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
               AND status = 'red' AND is_active = 1
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

  /** Resolve team lead for the card's machine and send notification */
  private async notifyTeamLead(candidate: OverdueCandidate): Promise<void> {
    const teamLeadId = await this.resolveTeamLead(
      candidate.tenant_id,
      candidate.machine_id,
    );

    if (teamLeadId === null) {
      this.logger.warn(
        `No team lead found for machine ${String(candidate.machine_id)} — skipping notification`,
      );
      return;
    }

    this.notificationService.notifyMaintenanceOverdue(
      candidate.tenant_id,
      this.toNotificationCard(candidate),
      teamLeadId,
    );
  }

  /** Find the team lead responsible for a machine */
  private async resolveTeamLead(
    tenantId: number,
    machineId: number,
  ): Promise<number | null> {
    const result = await this.db.queryOne<{ team_lead_id: number }>(
      `SELECT DISTINCT t.team_lead_id
       FROM teams t
       JOIN machine_teams mt
         ON t.id = mt.team_id AND t.tenant_id = mt.tenant_id
       WHERE mt.machine_id = $1 AND mt.tenant_id = $2
         AND t.is_active = 1 AND t.team_lead_id IS NOT NULL
       LIMIT 1`,
      [machineId, tenantId],
    );
    return result?.team_lead_id ?? null;
  }

  /** Map a candidate row to the notification card interface */
  private toNotificationCard(candidate: OverdueCandidate): TpmNotificationCard {
    return {
      uuid: candidate.uuid,
      cardCode: candidate.card_code,
      title: candidate.title,
      machineId: candidate.machine_id,
      ...(candidate.machine_name !== null && {
        machineName: candidate.machine_name,
      }),
      intervalType: candidate.interval_type,
      status: 'overdue',
    };
  }
}
