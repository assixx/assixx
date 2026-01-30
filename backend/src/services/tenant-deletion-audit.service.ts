/**
 * Tenant Deletion Audit — Audit trail, legal holds & compliance notifications.
 *
 * WHY this is a separate service despite being ~90 lines:
 * Exception to the 100-line minimum rule. Compliance code deserves explicit
 * ownership and visibility. During a GDPR review, auditors need to find
 * `tenant-deletion-audit.service.ts` immediately without searching through
 * a 400-line facade.
 *
 * Rule: This sub-service NEVER calls other sub-services.
 */
import { type PoolConnection, query, transaction } from '../utils/db.js';
import type { ConnectionWrapper } from '../utils/dbWrapper.js';
import { wrapConnection } from '../utils/dbWrapper.js';
import emailService from '../utils/emailService.js';
import type {
  CountResult,
  DeletionWarningUser,
  LegalHoldRow,
  TenantInfoRow,
} from './tenant-deletion.types.js';

export class TenantDeletionAudit {
  /**
   * Check for active legal holds that block deletion.
   * @throws Error if tenant has active legal holds
   */
  async checkLegalHolds(
    tenantId: number,
    conn: ConnectionWrapper,
  ): Promise<void> {
    const holds = await conn.query<LegalHoldRow[]>(
      'SELECT * FROM legal_holds WHERE tenant_id = $1 AND active = true',
      [tenantId],
    );

    if (holds.length > 0) {
      const firstHold = holds[0];
      if (!firstHold) {
        throw new Error('Tenant has active legal hold: No reason specified');
      }
      throw new Error(
        `Tenant has active legal hold: ${firstHold.reason ?? 'No reason specified'}`,
      );
    }
  }

  /**
   * Create audit trail entry for tenant deletion.
   * Supports both transaction-scoped (conn provided) and standalone mode.
   */
  async createDeletionAuditTrail(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
    connection?: ConnectionWrapper,
  ): Promise<void> {
    const executeAudit = async (conn: ConnectionWrapper): Promise<void> => {
      const tenantResults = await conn.query<TenantInfoRow[]>(
        'SELECT * FROM tenants WHERE id = $1',
        [tenantId],
      );
      const tenantInfo = tenantResults[0];

      const userResults = await conn.query<CountResult[]>(
        'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1',
        [tenantId],
      );
      const firstUserResult: CountResult | undefined = userResults[0];
      // PostgreSQL COUNT(*) returns bigint as string — must convert
      const userCount = Number(firstUserResult?.count ?? 0);

      await conn.query(
        `INSERT INTO deletion_audit_trail
         (tenant_id, tenant_name, user_count, deleted_by, deleted_by_ip, deletion_reason, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          tenantInfo?.company_name ?? 'Unknown',
          userCount,
          requestedBy,
          ipAddress ?? 'unknown',
          reason ?? 'No reason provided',
          JSON.stringify({
            subdomain: tenantInfo?.subdomain ?? null,
            created_at: tenantInfo?.created_at ?? null,
          }),
        ],
      );
    };

    if (connection) {
      await executeAudit(connection);
    } else {
      await transaction(async (conn: PoolConnection) => {
        const wrappedConn = wrapConnection(conn);
        await executeAudit(wrappedConn);
      });
    }
  }

  /**
   * Send deletion warning notification emails to tenant admins.
   * Standalone operation — manages its own DB query (no transaction needed).
   */
  async sendDeletionWarningEmails(
    tenantId: number,
    scheduledDate: Date,
  ): Promise<void> {
    const [admins] = await query<DeletionWarningUser[]>(
      "SELECT email, first_name, last_name FROM users WHERE tenant_id = $1 AND role IN ('admin', 'root')",
      [tenantId],
    );

    for (const admin of admins) {
      const nameParts = [admin.first_name, admin.last_name]
        .filter(Boolean)
        .join(' ');
      const displayName = nameParts !== '' ? nameParts : 'Nutzer';
      await emailService.sendEmail({
        to: admin.email,
        subject: 'Wichtig: Ihr Assixx-Konto wird in 30 Tagen gelöscht',
        html: `
          <h2>Ihr Assixx-Konto wird gelöscht</h2>
          <p>Sehr geehrte/r ${displayName},</p>
          <p>Ihr Assixx-Konto wurde zur Löschung markiert und wird am <strong>${scheduledDate.toLocaleDateString('de-DE')}</strong> endgültig gelöscht.</p>
          <h3>Was Sie jetzt tun können:</h3>
          <ul>
            <li>Laden Sie Ihre Daten herunter über das Export-Tool</li>
            <li>Kontaktieren Sie den Support, wenn dies ein Fehler ist</li>
            <li>Sichern Sie wichtige Dokumente und Informationen</li>
          </ul>
          <p>Nach der Löschung sind Ihre Daten unwiderruflich verloren.</p>
        `,
      });
    }
  }
}
