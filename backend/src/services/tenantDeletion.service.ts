/**
 * Tenant Deletion Service
 * Handles complete tenant deletion with background processing, audit trail, and rollback capability
 */

// import Feature from '../models/feature'; // Currently unused
import { exec } from "child_process";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
// import archiver from 'archiver/index.js';

import axios from "axios";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

import { getRedisClient } from "../config/redis";
import { DbUser } from "../models/user";
import { execute, query, transaction } from "../utils/db";
import {
  ConnectionWrapper as DbConnectionWrapper,
  wrapConnection,
} from "../utils/dbWrapper";
import emailService from "../utils/emailService";
import { logger } from "../utils/logger";

import { alertingService } from "./alerting.service.stub";

const execAsync = promisify(exec);

type ConnectionWrapper = DbConnectionWrapper;

interface CountResult extends RowDataPacket {
  count: number;
}

interface TenantInfoRow extends RowDataPacket {
  id: number;
  company_name: string;
  subdomain: string;
  tax_id?: string;
  email?: string;
  phone?: string;
}

interface QueueRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  approval_status: string;
  created_by: number;
}

interface FileRow extends RowDataPacket {
  id: number;
  file_path: string;
  file_name: string;
}

interface WebhookRow extends RowDataPacket {
  url: string;
  secret?: string;
}

interface DeletionStatusRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  approval_status: string;
  status: string;
  deletion_status: string;
  deletion_requested_at: Date;
  completed_steps: number;
  failed_steps: number;
}

interface DeletionStep {
  name: string;
  description: string;
  handler: (
    tenantId: number,
    queueId: number,
    connection: ConnectionWrapper,
  ) => Promise<number>;
  critical: boolean; // If true, failure stops entire process
}

// Removed unused interfaces QueueItem and TenantInfo

export class TenantDeletionService {
  private steps: DeletionStep[] = [];

  constructor() {
    this.initializeSteps();
  }

  private initializeSteps() {
    this.steps = [
      // ========== PRE-DELETION PHASE ==========
      {
        name: "legal_hold_check",
        description: "Prüfe Legal Hold Status",
        critical: true,
        handler: async (tenantId: number) => {
          const [legalHolds] = await query<RowDataPacket[]>(
            "SELECT * FROM legal_holds WHERE tenant_id = ? AND active = 1",
            [tenantId],
          );

          if (legalHolds.length > 0) {
            const legalHold = legalHolds[0];
            throw new Error(
              `Tenant has active legal hold: ${String(legalHold.reason ?? "No reason specified")}`,
            );
          }

          return 0;
        },
      },
      {
        name: "shared_resources_check",
        description: "Prüfe geteilte Ressourcen",
        critical: true,
        handler: async (tenantId: number) => {
          const [sharedDocsResult] = await query<CountResult[]>(
            "SELECT COUNT(*) as count FROM document_shares WHERE owner_tenant_id = ? AND shared_with_tenant_id != ?",
            [tenantId, tenantId],
          );

          const sharedDocs = sharedDocsResult[0];
          if (sharedDocs.count > 0) {
            throw new Error(
              `Tenant has ${sharedDocs.count} documents shared with other tenants`,
            );
          }

          return 0;
        },
      },
      {
        name: "create_data_export",
        description: "Erstelle DSGVO Datenexport",
        critical: true,
        handler: async (tenantId: number, _queueId: number) => {
          const exportPath = await this.createTenantDataExport(tenantId);

          await execute(
            "INSERT INTO tenant_data_exports (tenant_id, file_path, file_size, checksum, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 90 DAY))",
            [
              tenantId,
              exportPath,
              (await fs.stat(exportPath)).size,
              await this.calculateFileChecksum(exportPath),
            ],
          );

          return 1;
        },
      },
      {
        name: "create_final_backup",
        description: "Erstelle finales Backup",
        critical: true,
        handler: async (tenantId: number) => {
          const backupFile = `/backups/tenant_${tenantId}_final_${String(Date.now())}.sql.gz`;

          // Erstelle tenant-spezifisches Backup
          // Da wir innerhalb des Containers sind, können wir direkt auf MySQL zugreifen
          await execAsync(
            `mysqldump --single-transaction --routines --triggers -h mysql -u assixx_user -pAssixxP@ss2025! main --where="tenant_id=${tenantId}" users departments teams documents messages conversations calendar_events shifts blackboard_entries surveys kvp_suggestions | gzip > ${backupFile}`,
          );

          await execute(
            "INSERT INTO tenant_deletion_backups (tenant_id, backup_file, backup_size, backup_type) VALUES (?, ?, ?, ?)",
            [tenantId, backupFile, (await fs.stat(backupFile)).size, "final"],
          );

          return 1;
        },
      },
      {
        name: "archive_billing_records",
        description: "Archiviere Rechnungen (10 Jahre Aufbewahrung)",
        critical: false, // Nicht kritisch, da invoices Tabelle optional ist
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          try {
            // Prüfe ob invoices Tabelle existiert
            const tables = await conn.query("SHOW TABLES LIKE 'invoices'");

            if (tables.length === 0) {
              logger.info(
                `Invoices table not found, skipping archival for tenant ${tenantId}`,
              );
              return 0;
            }

            // Hole Tenant-Info für Archivierung
            const tenantInfoResult = await conn.query<TenantInfoRow[]>(
              "SELECT * FROM tenants WHERE id = ?",
              [tenantId],
            );
            const tenantInfo = tenantInfoResult[0];

            // Archiviere alle Rechnungen (wenn vorhanden)
            const result = await conn.query(
              `INSERT INTO archived_tenant_invoices 
               (original_tenant_id, tenant_name, tenant_tax_id, invoice_data, invoice_number, invoice_date, invoice_amount, delete_after)
               SELECT 
                 ?, ?, ?, 
                 JSON_OBJECT('invoice_id', id, 'data', invoice_data),
                 invoice_number,
                 invoice_date,
                 amount,
                 DATE_ADD(NOW(), INTERVAL 10 YEAR)
               FROM invoices 
               WHERE tenant_id = ?`,
              [
                tenantId,
                tenantInfo.company_name,
                tenantInfo.tax_id ?? "",
                tenantId,
              ],
            );

            return (result as unknown as ResultSetHeader).affectedRows ?? 0;
          } catch (error: unknown) {
            logger.warn(
              `Failed to archive billing records for tenant ${tenantId}:`,
              error,
            );
            return 0; // Nicht kritisch, also 0 zurückgeben
          }
        },
      },
      {
        name: "send_final_notifications",
        description: "Sende finale Benachrichtigungen",
        critical: false,
        handler: async (tenantId: number) => {
          const [admins] = await query<DbUser[]>(
            'SELECT u.* FROM users u WHERE u.tenant_id = ? AND u.role IN ("admin", "root")',
            [tenantId],
          );

          for (const admin of admins) {
            await emailService.sendEmail({
              to: admin.email,
              subject: "Ihr Assixx-Konto wird gelöscht",
              html: `
                <h2>Ihr Assixx-Konto wird endgültig gelöscht</h2>
                <p>Sehr geehrte/r ${admin.first_name} ${admin.last_name},</p>
                <p>Ihr Assixx-Konto wird in Kürze endgültig gelöscht.</p>
                <p>Falls Sie einen Datenexport benötigen, kontaktieren Sie bitte umgehend den Support.</p>
                <p>Mit freundlichen Grüßen<br>Ihr Assixx-Team</p>
              `,
            });
          }

          return admins.length;
        },
      },
      {
        name: "notify_external_services",
        description: "Benachrichtige externe Services",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const webhooks = await conn.query(
            "SELECT * FROM tenant_webhooks WHERE tenant_id = ? AND active = 1",
            [tenantId],
          );

          for (const webhook of webhooks as unknown as WebhookRow[]) {
            try {
              await axios.post(
                (webhook as unknown as WebhookRow).url,
                {
                  event: "tenant.deletion",
                  tenant_id: tenantId,
                  timestamp: new Date().toISOString(),
                },
                {
                  headers: {
                    "X-Webhook-Secret":
                      (webhook as unknown as WebhookRow).secret ?? "",
                  },
                  timeout: 5000,
                },
              );
            } catch (error: unknown) {
              logger.warn(
                `Webhook notification failed: ${(webhook as unknown as WebhookRow).url}`,
                error,
              );
            }
          }

          return webhooks.length;
        },
      },

      // ========== CACHE & SESSION CLEANUP ==========
      {
        name: "redis_cleanup",
        description: "Lösche Redis Sessions und Cache",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          let deletedKeys = 0;

          try {
            const redis = await getRedisClient();
            if (redis == null) {
              logger.info("Redis not available - skipping cleanup");
              return 0;
            }

            // Hole alle User IDs des Tenants
            interface UserIdRow extends RowDataPacket {
              id: number;
            }
            const userRows = await conn.query<UserIdRow[]>(
              "SELECT id FROM users WHERE tenant_id = ?",
              [tenantId],
            );

            for (const user of userRows) {
              // Lösche alle Keys die mit user:id: beginnen
              const keys = await redis.keys(`user:${user.id}:*`);
              if (keys.length > 0) {
                await redis.del(keys);
                deletedKeys += keys.length;
              }

              // Lösche Session Keys
              const sessionKeys = await redis.keys(`session:${user.id}:*`);
              if (sessionKeys.length > 0) {
                await redis.del(sessionKeys);
                deletedKeys += sessionKeys.length;
              }
            }

            // Lösche Tenant-spezifischen Cache
            const tenantKeys = await redis.keys(`tenant:${tenantId}:*`);
            if (tenantKeys.length > 0) {
              await redis.del(tenantKeys);
              deletedKeys += tenantKeys.length;
            }
          } catch (error: unknown) {
            logger.warn("Error during Redis cleanup:", error);
          }

          return deletedKeys;
        },
      },
      {
        name: "user_sessions",
        description: "Lösche User Sessions",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE s FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "user_chat_status",
        description: "Lösche Chat Status",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE cs FROM user_chat_status cs JOIN users u ON cs.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // ========== MAIN DELETION PHASE ==========
      // Level 1: Notifications & Temp Data
      {
        name: "chat_notifications",
        description: "Lösche Chat Benachrichtigungen",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE cn FROM chat_notifications cn JOIN users u ON cn.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "email_queue",
        description: "Lösche ausstehende E-Mails",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            'DELETE FROM email_queue WHERE tenant_id = ? AND status = "pending"',
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 2: Activity & Logs
      {
        name: "activity_logs",
        description: "Lösche Activity Logs",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.execute(
            "DELETE al FROM activity_logs al JOIN users u ON al.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return result.affectedRows ?? 0;
        },
      },
      {
        name: "api_logs",
        description: "Lösche API Logs",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE al FROM api_logs al JOIN users u ON al.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "security_logs",
        description: "Lösche Security Logs",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE sl FROM security_logs sl JOIN users u ON sl.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "admin_logs",
        description: "Lösche Admin Logs",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.execute(
            "DELETE FROM admin_logs WHERE tenant_id = ?",
            [tenantId],
          );
          return result.affectedRows ?? 0;
        },
      },

      // Level 3: OAuth & API Keys
      {
        name: "revoke_oauth_tokens",
        description: "Widerrufe OAuth Tokens",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          await conn.query(
            "UPDATE oauth_tokens SET revoked = 1, revoked_at = NOW() WHERE tenant_id = ?",
            [tenantId],
          );

          const result = await conn.query(
            "DELETE FROM oauth_tokens WHERE tenant_id = ?",
            [tenantId],
          );

          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "revoke_api_keys",
        description: "Deaktiviere API Keys",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          await conn.query(
            "UPDATE api_keys SET active = 0, deactivated_at = NOW() WHERE tenant_id = ?",
            [tenantId],
          );

          const result = await conn.query(
            "DELETE FROM api_keys WHERE tenant_id = ?",
            [tenantId],
          );

          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 4: 2FA Data
      {
        name: "remove_2fa_secrets",
        description: "Lösche 2FA Secrets",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE s FROM user_2fa_secrets s JOIN users u ON s.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "remove_2fa_backup_codes",
        description: "Lösche 2FA Backup Codes",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE c FROM user_2fa_backup_codes c JOIN users u ON c.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 5: Messages & Communication
      {
        name: "message_read_receipts",
        description: "Lösche Message Read Receipts",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE mr FROM message_read_receipts mr JOIN users u ON mr.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "message_status",
        description: "Lösche Message Status",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE ms FROM message_status ms JOIN users u ON ms.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "messages",
        description: "Lösche Messages",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE m FROM messages m JOIN users u ON m.sender_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "conversation_participants",
        description: "Lösche Conversation Participants",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE cp FROM conversation_participants cp JOIN users u ON cp.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "conversations",
        description: "Lösche Conversations",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM conversations WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 6: Documents
      {
        name: "document_read_status",
        description: "Lösche Document Read Status",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE dr FROM document_read_status dr JOIN users u ON dr.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "documents_with_files",
        description: "Lösche Documents und Dateien",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          // Erst Dateipfade sammeln
          const files = await conn.query(
            "SELECT id, file_path, filename FROM documents WHERE tenant_id = ?",
            [tenantId],
          );

          const failedFiles = [];
          const uploadDir = process.env.UPLOAD_DIR ?? "/uploads";

          // Dateien löschen mit Error Handling
          for (const file of files) {
            if (!(file as unknown as FileRow).file_path) continue;

            try {
              const fullPath = path.join(
                uploadDir,
                (file as unknown as FileRow).file_path,
              );

              // Prüfe ob Datei existiert
              try {
                await fs.access(fullPath);
                await fs.unlink(fullPath);
              } catch (err: unknown) {
                if (
                  err instanceof Error &&
                  "code" in err &&
                  err.code !== "ENOENT"
                ) {
                  throw err;
                }
              }
            } catch (error: unknown) {
              failedFiles.push({
                document_id: (file as unknown as FileRow).id,
                path: (file as unknown as FileRow).file_path,
                name: (file as unknown as FileRow).file_name,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Failed files loggen für manuelle Bereinigung
          if (failedFiles.length > 0) {
            await conn.query(
              "INSERT INTO failed_file_deletions (queue_id, file_data) VALUES (?, ?)",
              [_queueId, JSON.stringify(failedFiles)],
            );

            logger.warn(
              `Failed to delete ${failedFiles.length} files for tenant ${tenantId}`,
            );
          }

          // Dann DB-Einträge löschen
          const result = await conn.query(
            "DELETE FROM documents WHERE tenant_id = ?",
            [tenantId],
          );

          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 7: KVP System
      {
        name: "kvp_comments",
        description: "Lösche KVP Comments",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE kc FROM kvp_comments kc JOIN users u ON kc.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "kvp_ratings",
        description: "Lösche KVP Ratings",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE kr FROM kvp_ratings kr JOIN users u ON kr.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "kvp_points",
        description: "Lösche KVP Points",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE kp FROM kvp_points kp JOIN users u ON kp.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "kvp_status_history",
        description: "Lösche KVP Status History",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE ksh FROM kvp_status_history ksh JOIN users u ON ksh.changed_by = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "kvp_attachments",
        description: "Lösche KVP Attachments",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE ka FROM kvp_attachments ka JOIN users u ON ka.uploaded_by = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "kvp_suggestions",
        description: "Lösche KVP Suggestions",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM kvp_suggestions WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 8: Calendar
      {
        name: "calendar_attendees",
        description: "Lösche Calendar Attendees",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE ca FROM calendar_attendees ca JOIN users u ON ca.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "calendar_participants",
        description: "Lösche Calendar Participants",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE cp FROM calendar_participants cp JOIN users u ON cp.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "calendar_reminders",
        description: "Lösche Calendar Reminders",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE cr FROM calendar_reminders cr JOIN users u ON cr.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "calendar_shares",
        description: "Lösche Calendar Shares",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE cs FROM calendar_shares cs JOIN users u1 ON cs.calendar_owner_id = u1.id JOIN users u2 ON cs.shared_with_id = u2.id WHERE u1.tenant_id = ? OR u2.tenant_id = ?",
            [tenantId, tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "calendar_events",
        description: "Lösche Calendar Events",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM calendar_events WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 9: Shifts
      {
        name: "shift_assignments",
        description: "Lösche Shift Assignments",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE sa FROM shift_assignments sa JOIN users u ON sa.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "shift_notes",
        description: "Lösche Shift Notes",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE sn FROM shift_notes sn JOIN users u ON sn.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "weekly_shift_notes",
        description: "Lösche Weekly Shift Notes",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE wsn FROM weekly_shift_notes wsn JOIN departments d ON wsn.department_id = d.id WHERE d.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "shifts",
        description: "Lösche Shifts",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM shifts WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 10: Blackboard
      {
        name: "blackboard_confirmations",
        description: "Lösche Blackboard Confirmations",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE bc FROM blackboard_confirmations bc JOIN users u ON bc.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "blackboard_attachments",
        description: "Lösche Blackboard Attachments",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE ba FROM blackboard_attachments ba JOIN users u ON ba.uploaded_by = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "blackboard_entries",
        description: "Lösche Blackboard Entries",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM blackboard_entries WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 11: Surveys
      {
        name: "survey_comments",
        description: "Lösche Survey Comments",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE sc FROM survey_comments sc JOIN users u ON sc.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "survey_responses",
        description: "Lösche Survey Responses",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE sr FROM survey_responses sr JOIN users u ON sr.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "survey_participants",
        description: "Lösche Survey Participants",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE sp FROM survey_participants sp JOIN users u ON sp.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "survey_assignments",
        description: "Lösche Survey Assignments",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE sa FROM survey_assignments sa JOIN users u ON sa.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "survey_questions",
        description: "Lösche Survey Questions",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE sq FROM survey_questions sq JOIN surveys s ON sq.survey_id = s.id WHERE s.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "surveys",
        description: "Lösche Surveys",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM surveys WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 12: User Settings & Preferences
      {
        name: "user_settings",
        description: "Lösche User Settings",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE us FROM user_settings us JOIN users u ON us.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "notification_preferences",
        description: "Lösche Notification Preferences",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE np FROM notification_preferences np JOIN users u ON np.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 13: Scheduled Tasks & Jobs
      {
        name: "scheduled_tasks",
        description: "Lösche Scheduled Tasks",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM scheduled_tasks WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "recurring_jobs",
        description: "Lösche Recurring Jobs",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM recurring_jobs WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 14: Employee & Features
      {
        name: "employee_availability",
        description: "Lösche Employee Availability",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE ea FROM employee_availability ea JOIN users u ON ea.employee_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "feature_usage_logs",
        description: "Lösche Feature Usage Logs",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE ful FROM feature_usage_logs ful JOIN users u ON ful.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 15: Admin Permissions
      {
        name: "admin_permission_logs",
        description: "Lösche Admin Permission Logs",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE apl FROM admin_permission_logs apl JOIN users u1 ON apl.admin_user_id = u1.id JOIN users u2 ON apl.changed_by = u2.id WHERE u1.tenant_id = ? OR u2.tenant_id = ?",
            [tenantId, tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "admin_department_permissions",
        description: "Lösche Admin Department Permissions",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE adp FROM admin_department_permissions adp JOIN users u ON adp.admin_user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "admin_group_permissions",
        description: "Lösche Admin Group Permissions",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE agp FROM admin_group_permissions agp JOIN users u ON agp.admin_user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 16: Teams & User Relations
      {
        name: "user_teams",
        description: "Lösche User Teams",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE ut FROM user_teams ut JOIN users u ON ut.user_id = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "department_group_members",
        description: "Lösche Department Group Members",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE dgm FROM department_group_members dgm JOIN users u ON dgm.added_by = u.id WHERE u.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "tenant_admins",
        description: "Lösche Tenant Admins",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM tenant_admins WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 17: Nullify Foreign Keys
      {
        name: "nullify_foreign_keys",
        description: "Setze Foreign Keys auf NULL",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          // Teams
          await conn.query(
            "UPDATE teams SET team_lead_id = NULL WHERE tenant_id = ?",
            [tenantId],
          );
          await conn.query(
            "UPDATE teams SET created_by = NULL WHERE tenant_id = ?",
            [tenantId],
          );

          // Departments
          await conn.query(
            "UPDATE departments SET manager_id = NULL WHERE tenant_id = ?",
            [tenantId],
          );
          await conn.query(
            "UPDATE departments SET created_by = NULL WHERE tenant_id = ?",
            [tenantId],
          );

          // Department Groups
          await conn.query(
            "UPDATE department_groups SET created_by = NULL WHERE tenant_id = ?",
            [tenantId],
          );

          // Tenant Features
          await conn.query(
            "UPDATE tenant_features SET activated_by = NULL WHERE tenant_id = ?",
            [tenantId],
          );

          // Tenants
          await conn.query(
            "UPDATE tenants SET created_by = NULL WHERE id = ?",
            [tenantId],
          );

          // Tenant deletion_requested_by (wichtig vor User-Löschung!)
          await conn.query(
            "UPDATE tenants SET deletion_requested_by = NULL WHERE id = ?",
            [tenantId],
          );

          // Tenant deletion queue - alle User-Referenzen auf NULL (wichtig vor User-Löschung!)
          await conn.query(
            "UPDATE tenant_deletion_queue SET second_approver_id = NULL, emergency_stopped_by = NULL WHERE tenant_id = ?",
            [tenantId],
          );

          return 0; // Kein affected rows count nötig
        },
      },

      // Level 18: Core Entities
      {
        name: "department_groups",
        description: "Lösche Department Groups",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE dg FROM department_groups dg JOIN departments d ON dg.department_id = d.id WHERE d.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "teams",
        description: "Lösche Teams",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM teams WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "departments",
        description: "Lösche Departments",
        critical: true,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM departments WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "deletion_approvals",
        description: "Lösche Deletion Approvals",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          // Lösche alle Approval-Einträge für diesen Tenant
          const result = await conn.query(
            "DELETE ta FROM tenant_deletion_approvals ta " +
              "JOIN tenant_deletion_queue tdq ON ta.queue_id = tdq.id " +
              "WHERE tdq.tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "deletion_queue_entries",
        description: "Lösche alte Deletion Queue Einträge",
        critical: false,
        handler: async (
          tenantId: number,
          queueId: number,
          conn: ConnectionWrapper,
        ) => {
          // Lösche alle Queue-Einträge außer dem aktuellen
          const result = await conn.query(
            "DELETE FROM tenant_deletion_queue WHERE tenant_id = ? AND id != ?",
            [tenantId, queueId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "users",
        description: "Lösche Users",
        critical: true,
        handler: async (
          tenantId: number,
          queueId: number,
          conn: ConnectionWrapper,
        ) => {
          // Zuerst hole den User der die Queue erstellt hat
          const queueResult = await conn.query(
            "SELECT created_by FROM tenant_deletion_queue WHERE id = ?",
            [queueId],
          );

          if (
            queueResult[0] == null ||
            (queueResult as unknown as QueueRow[])[0].created_by == null
          ) {
            logger.warn(`No created_by found for queue ${queueId}`);
            // Lösche alle Users wenn kein created_by gefunden wurde
            const result = await conn.query(
              "DELETE FROM users WHERE tenant_id = ?",
              [tenantId],
            );
            return (result as unknown as ResultSetHeader).affectedRows ?? 0;
          }

          // Lösche alle Users AUSSER dem Queue-Ersteller
          const result = await conn.query(
            "DELETE FROM users WHERE tenant_id = ? AND id != ?",
            [tenantId, (queueResult as unknown as QueueRow[])[0].created_by],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 19: Tenant Features & Plans
      {
        name: "tenant_features",
        description: "Lösche Tenant Features",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM tenant_features WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },
      {
        name: "tenant_plans",
        description: "Lösche Tenant Plans",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM tenant_plans WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 20: Scheduled Tasks & Cronjobs
      {
        name: "scheduled_tasks_cleanup",
        description: "Lösche geplante Tasks und Cronjobs",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          let deleted = 0;

          // Scheduled Tasks
          const tasksResult = await conn.execute(
            "DELETE FROM scheduled_tasks WHERE tenant_id = ?",
            [tenantId],
          );
          deleted += tasksResult.affectedRows ?? 0;

          // Recurring Jobs
          const jobsResult = await conn.execute(
            "DELETE FROM recurring_jobs WHERE tenant_id = ?",
            [tenantId],
          );
          deleted += jobsResult.affectedRows ?? 0;

          return deleted;
        },
      },

      // Level 21: Webhooks
      {
        name: "tenant_webhooks",
        description: "Lösche Tenant Webhooks",
        critical: false,
        handler: async (
          tenantId: number,
          _queueId: number,
          conn: ConnectionWrapper,
        ) => {
          const result = await conn.query(
            "DELETE FROM tenant_webhooks WHERE tenant_id = ?",
            [tenantId],
          );
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 22: Lösche den letzten User (Queue-Ersteller)
      {
        name: "last_user",
        description: "Lösche letzten User",
        critical: true,
        handler: async (
          _tenantId: number,
          queueId: number,
          conn: ConnectionWrapper,
        ) => {
          // Hole den User der die Queue erstellt hat
          const queueResult = await conn.query(
            "SELECT created_by FROM tenant_deletion_queue WHERE id = ?",
            [queueId],
          );

          if (
            queueResult[0] == null ||
            (queueResult as unknown as QueueRow[])[0].created_by == null
          ) {
            logger.warn(`No created_by found for queue ${queueId}`);
            return 0;
          }

          // Setze created_by auf NULL bevor wir den User löschen
          await conn.query(
            "UPDATE tenant_deletion_queue SET created_by = NULL WHERE id = ?",
            [queueId],
          );

          // Jetzt können wir den Queue-Ersteller sicher löschen
          const result = await conn.query("DELETE FROM users WHERE id = ?", [
            (queueResult as unknown as QueueRow[])[0].created_by,
          ]);
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // Level 23: Final - Tenant selbst
      {
        name: "tenant",
        description: "Lösche Tenant",
        critical: true,
        handler: async (
          tenantId: number,
          queueId: number,
          conn: ConnectionWrapper,
        ) => {
          // Setze tenant_id auf NULL in tenant_deletion_queue bevor wir den Tenant löschen
          await conn.query(
            "UPDATE tenant_deletion_queue SET tenant_id = NULL WHERE id = ?",
            [queueId],
          );

          // Jetzt können wir den Tenant sicher löschen
          const result = await conn.query("DELETE FROM tenants WHERE id = ?", [
            tenantId,
          ]);
          return (result as unknown as ResultSetHeader).affectedRows ?? 0;
        },
      },

      // ========== POST-DELETION PHASE ==========
      {
        name: "release_subdomain",
        description: "Subdomain wieder verfügbar machen",
        critical: false,
        handler: (
          tenantId: number,
          _queueId: number,
          _conn: ConnectionWrapper,
        ) => {
          // Tenant ist bereits gelöscht, wir nutzen nur die ID
          // Subdomain-Release sollte eigentlich vorher in einem separaten Schritt passieren
          logger.info(
            `Tenant ${tenantId} deletion completed - subdomain can be reused`,
          );
          return 0;
        },
      },
      {
        name: "cleanup_temp_files",
        description: "Bereinige temporäre Dateien",
        critical: false,
        handler: async (tenantId: number) => {
          const tempDirs = [
            `/temp/tenant_${tenantId}`,
            `/exports/tenant_${tenantId}`,
            `/uploads/tenant_${tenantId}`,
          ];

          let cleanedDirs = 0;
          for (const dir of tempDirs) {
            try {
              await fs.rm(dir, { recursive: true, force: true });
              cleanedDirs++;
            } catch (error: unknown) {
              logger.warn(`Failed to clean directory ${dir}:`, error);
            }
          }

          return cleanedDirs;
        },
      },
      {
        name: "external_storage_cleanup",
        description: "Bereinige S3/CDN",
        critical: false,
        handler: (_tenantId: number) => {
          if (process.env.USE_S3 === "true") {
            logger.warn("S3 cleanup disabled - AWS SDK not installed");
            // AWS SDK not currently installed
            // try {
            //   const s3 = new AWS.S3({
            //     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            //     region: process.env.AWS_REGION
            //   });
            //
            //   const prefix = `tenants/${tenantId}/`;
            //
            //   // Liste alle Objekte
            //   const objects = await s3.listObjectsV2({
            //     Bucket: process.env.S3_BUCKET!,
            //     Prefix: prefix
            //   }).promise();
            //
            //   // Lösche alle Objekte
            //   if (objects.Contents && objects.Contents.length > 0) {
            //     await s3.deleteObjects({
            //       Bucket: process.env.S3_BUCKET!,
            //       Delete: {
            //         Objects: objects.Contents.map(obj => ({ Key: obj.Key! }))
            //       }
            //     }).promise();
            //
            //     return objects.Contents.length;
            //   }
            // } catch (error: unknown) {
            //   logger.error('S3 cleanup failed:', error);
            // }
          }

          return 0;
        },
      },
    ];
  }

  /**
   * Request tenant deletion (requires approval from second root user)
   */
  async requestTenantDeletion(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<number> {
    return await transaction(async (connection) => {
      // 1. Check if tenant exists and is active
      interface TenantRow extends RowDataPacket {
        id: number;
        deletion_status: string | null;
        company_name: string;
      }
      const [[tenant]] = await connection.query<TenantRow[]>(
        "SELECT id, deletion_status, company_name FROM tenants WHERE id = ?",
        [tenantId],
      );

      if (tenant == null) {
        throw new Error("Tenant not found");
      }

      // If deletion_status is null/undefined, treat as 'active'
      const currentStatus = tenant.deletion_status ?? "active";

      if (currentStatus !== "active") {
        throw new Error(`Tenant is already ${currentStatus}`);
      }

      // 2. Create audit trail
      await this.createDeletionAuditTrail(
        tenantId,
        requestedBy,
        reason,
        ipAddress,
        wrapConnection(connection),
      );

      // 3. Mark tenant as marked_for_deletion
      await connection.query(
        "UPDATE tenants SET deletion_status = ?, deletion_requested_at = NOW(), deletion_requested_by = ? WHERE id = ?",
        ["marked_for_deletion", requestedBy, tenantId],
      );

      // 4. Calculate scheduled deletion date (30 days grace period)
      // TESTPHASE: Grace Period kann über Umgebungsvariable gesetzt werden
      const gracePeriodDays =
        process.env.DELETION_GRACE_PERIOD_DAYS != null &&
        process.env.DELETION_GRACE_PERIOD_DAYS !== ""
          ? parseInt(process.env.DELETION_GRACE_PERIOD_DAYS)
          : 30;
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + gracePeriodDays);

      // 5. Create queue entry with pending approval status and 24h cooling-off
      // TESTPHASE: Cooling-off kann über Umgebungsvariable gesetzt werden
      const coolingOffHours =
        process.env.DELETION_COOLING_OFF_HOURS != null &&
        process.env.DELETION_COOLING_OFF_HOURS !== ""
          ? parseInt(process.env.DELETION_COOLING_OFF_HOURS)
          : process.env.NODE_ENV === "development"
            ? 0
            : 24;

      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO tenant_deletion_queue 
         (tenant_id, created_by, total_steps, grace_period_days, scheduled_deletion_date, 
          status, approval_status, approval_required, approval_requested_at, cooling_off_hours) 
         VALUES (?, ?, ?, ?, ?, 'pending_approval', 'pending', TRUE, NOW(), ?)`,
        [
          tenantId,
          requestedBy,
          this.steps.length,
          gracePeriodDays,
          scheduledDate,
          coolingOffHours,
        ],
      );

      // 6. Send deletion warning emails (non-blocking)
      this.sendDeletionWarningEmails(tenantId, scheduledDate).catch(
        (err: unknown) => {
          logger.error("Failed to send deletion warning emails:", err);
        },
      );

      // 7. Notify other root admins for approval (non-blocking)
      this.notifyRootAdminsForApproval(
        tenantId,
        requestedBy,
        tenant.company_name,
        result.insertId,
      ).catch((err: unknown) => {
        logger.error("Failed to notify root admins:", err);
      });

      logger.warn(
        `Tenant ${tenantId} deletion requested by user ${requestedBy}. Awaiting approval.`,
      );

      return result.insertId;
    });
  }

  /**
   * Approve tenant deletion request
   */
  async approveDeletion(
    queueId: number,
    approverId: number,
    comment?: string,
  ): Promise<void> {
    await transaction(async (connection) => {
      // Get queue item
      interface QueueRowLocal extends RowDataPacket {
        id: number;
        tenant_id: number;
        created_by: number;
        approval_status: string;
        approval_requested_at: Date;
        cooling_off_hours?: number;
        scheduled_deletion_date?: Date;
      }
      const [queueResults] = await connection.query<QueueRowLocal[]>(
        "SELECT * FROM tenant_deletion_queue WHERE id = ?",
        [queueId],
      );

      if (queueResults.length === 0) {
        throw new Error("Deletion request not found");
      }

      const queue = queueResults[0];

      if (queue.approval_status !== "pending") {
        throw new Error("Deletion request is not pending approval");
      }

      if (queue.created_by === approverId) {
        throw new Error("Cannot approve own deletion request");
      }

      // Check if cooling-off period has passed (24 hours)
      const requestedAt = new Date(queue.approval_requested_at);
      const hoursSinceRequest =
        (Date.now() - requestedAt.getTime()) / (1000 * 60 * 60);
      const coolingOffHours = queue.cooling_off_hours ?? 24;

      if (hoursSinceRequest < coolingOffHours) {
        const hoursRemaining = Math.ceil(coolingOffHours - hoursSinceRequest);
        throw new Error(
          `Cooling-off period not met. Please wait ${hoursRemaining} more hours before approving.`,
        );
      }

      // Update queue status to approved and queued
      await connection.query(
        `UPDATE tenant_deletion_queue 
         SET second_approver_id = ?, approved_at = NOW(), 
             approval_status = 'approved', status = 'queued'
         WHERE id = ?`,
        [approverId, queueId],
      );

      // Log approval
      await connection.query(
        `INSERT INTO tenant_deletion_approvals 
         (queue_id, approver_id, action, comment, created_at) 
         VALUES (?, ?, 'approved', ?, NOW())`,
        [queueId, approverId, comment],
      );

      // Update tenant status to suspended (immediate effect)
      await connection.query(
        "UPDATE tenants SET deletion_status = ? WHERE id = ?",
        ["suspended", queue.tenant_id],
      );

      logger.info(`Deletion request ${queueId} approved by user ${approverId}`);

      // Send notification to requester
      await this.notifyApprovalStatus(
        queue.tenant_id,
        queue.created_by,
        "approved",
        approverId,
      );

      // Send alert about approval
      await alertingService
        .sendSlackAlert({
          channel: process.env.SLACK_AUDIT_CHANNEL ?? "#audit",
          severity: "info",
          title: "✅ Tenant Deletion Approved",
          message: "A tenant deletion request has been approved",
          fields: {
            "Queue ID": queueId,
            "Tenant ID": queue.tenant_id,
            "Approved By": `User ${approverId}`,
            "Scheduled Date": queue.scheduled_deletion_date
              ? new Date(queue.scheduled_deletion_date).toISOString()
              : "Not scheduled",
          },
        })
        .catch((err: unknown) =>
          logger.error("Failed to send approval alert:", err),
        );
    });
  }

  /**
   * Reject tenant deletion request
   */
  async rejectDeletion(
    queueId: number,
    approverId: number,
    reason: string,
  ): Promise<void> {
    await transaction(async (connection) => {
      interface QueueRowLocal extends RowDataPacket {
        id: number;
        tenant_id: number;
        created_by: number;
        approval_status: string;
        approval_requested_at: Date;
        cooling_off_hours?: number;
        scheduled_deletion_date?: Date;
      }

      const [queueResults] = await connection.query<QueueRowLocal[]>(
        "SELECT * FROM tenant_deletion_queue WHERE id = ?",
        [queueId],
      );

      if (queueResults.length === 0) {
        throw new Error("Deletion request not found");
      }

      const queue = queueResults[0];

      if (queue.approval_status !== "pending") {
        throw new Error("Deletion request is not pending approval");
      }

      // Update queue status to rejected
      await connection.query(
        `UPDATE tenant_deletion_queue 
         SET approval_status = 'rejected', status = 'rejected',
             error_message = ?
         WHERE id = ?`,
        [reason, queueId],
      );

      // Log rejection
      await connection.query(
        `INSERT INTO tenant_deletion_approvals 
         (queue_id, approver_id, action, comment, created_at) 
         VALUES (?, ?, 'rejected', ?, NOW())`,
        [queueId, approverId, reason],
      );

      // Revert tenant status
      await connection.query(
        "UPDATE tenants SET deletion_status = ?, deletion_requested_at = NULL, deletion_requested_by = NULL WHERE id = ?",
        ["active", queue.tenant_id],
      );

      logger.info(`Deletion request ${queueId} rejected by user ${approverId}`);

      // Send notification to requester
      await this.notifyApprovalStatus(
        queue.tenant_id,
        queue.created_by,
        "rejected",
        approverId,
        reason,
      );

      // Send alert about rejection
      await alertingService
        .sendSlackAlert({
          channel: process.env.SLACK_AUDIT_CHANNEL ?? "#audit",
          severity: "info",
          title: "❌ Tenant Deletion Rejected",
          message: "A tenant deletion request has been rejected",
          fields: {
            "Queue ID": queueId,
            "Tenant ID": queue.tenant_id,
            "Rejected By": `User ${approverId}`,
            Reason: reason,
          },
        })
        .catch((err: unknown) =>
          logger.error("Failed to send rejection alert:", err),
        );
    });
  }

  /**
   * Emergency stop for a deletion in progress
   */
  async emergencyStop(queueId: number, stoppedBy: number): Promise<void> {
    try {
      // Update the queue status
      await execute(
        `UPDATE tenant_deletion_queue 
         SET status = 'cancelled', 
             emergency_stop = true,
             emergency_stopped_by = ?,
             emergency_stopped_at = NOW()
         WHERE id = ? AND status IN ('processing', 'queued')`,
        [stoppedBy, queueId],
      );

      // Get tenant info for notifications
      interface QueueItemWithTenant extends RowDataPacket {
        id: number;
        tenant_id: number;
        company_name: string;
      }
      const [[queueItem]] = await query<QueueItemWithTenant[]>(
        `SELECT q.*, t.company_name 
         FROM tenant_deletion_queue q
         JOIN tenants t ON t.id = q.tenant_id
         WHERE q.id = ?`,
        [queueId],
      );

      if (queueItem != null) {
        // Notify about emergency stop
        await this.notifyEmergencyStop(
          (queueItem as unknown as QueueRow).tenant_id,
          queueId,
          stoppedBy,
        );

        // Log the emergency stop
        logger.warn(
          `EMERGENCY STOP activated for tenant ${String((queueItem as unknown as QueueRow).tenant_id)} deletion by user ${stoppedBy}`,
        );
      }
    } catch (error: unknown) {
      logger.error("Error in emergency stop:", error);
      throw error;
    }
  }

  /**
   * Process deletion queue (called by worker)
   */
  async processQueue(): Promise<void> {
    try {
      // Get next queued item where grace period has expired and cooling-off is complete
      const [queueItems] = await query<RowDataPacket[]>(
        `SELECT * FROM tenant_deletion_queue 
         WHERE status = 'queued' 
         AND approval_status = 'approved'
         AND (scheduled_deletion_date IS NULL OR scheduled_deletion_date <= NOW())
         AND (approved_at IS NULL OR DATE_ADD(approved_at, INTERVAL cooling_off_hours HOUR) <= NOW())
         ORDER BY created_at ASC 
         LIMIT 1`,
      );

      if (queueItems.length === 0) {
        return; // Nothing to process
      }

      await this.processTenantDeletion(queueItems[0].id as number);
    } catch (error: unknown) {
      logger.error("Error processing deletion queue:", error);
    }
  }

  /**
   * Process single tenant deletion
   */
  private async processTenantDeletion(queueId: number): Promise<void> {
    let tenantId = 0;

    try {
      // Get tenant info first
      const [queueInfo] = await query<RowDataPacket[]>(
        "SELECT * FROM tenant_deletion_queue WHERE id = ?",
        [queueId],
      );

      if (queueInfo.length === 0) {
        throw new Error(`Queue item ${queueId} not found`);
      }

      tenantId = queueInfo[0].tenant_id as number;

      await transaction(async (connection) => {
        // 1. Mark as processing
        await connection.query(
          "UPDATE tenant_deletion_queue SET status = ?, started_at = NOW() WHERE id = ?",
          ["processing", queueId],
        );

        // 2. Update tenant status to suspended (immediate logout)
        await connection.query(
          "UPDATE tenants SET deletion_status = ? WHERE id = ?",
          ["suspended", tenantId],
        );

        // 3. Log out all users immediately
        await connection.query(
          "DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)",
          [tenantId],
        );
      });

      // 5. Now mark as deleting
      await execute("UPDATE tenants SET deletion_status = ? WHERE id = ?", [
        "deleting",
        tenantId,
      ]);

      // 6. Process each step
      let completedSteps = 0;

      for (const step of this.steps) {
        const startTime = Date.now();

        // Check for emergency stop before each step
        interface EmergencyCheckRow extends RowDataPacket {
          emergency_stop: boolean;
        }
        const [[emergencyCheck]] = await query<EmergencyCheckRow[]>(
          "SELECT emergency_stop FROM tenant_deletion_queue WHERE id = ?",
          [queueId],
        );

        if (emergencyCheck?.emergency_stop) {
          logger.warn(`Emergency stop detected for queue ${queueId}`);
          await this.handleEmergencyStop(queueId, tenantId);
          return;
        }

        try {
          logger.info(
            `Processing deletion step: ${step.name} for tenant ${tenantId}`,
          );

          // Update current step
          await execute(
            "UPDATE tenant_deletion_queue SET current_step = ?, progress = ? WHERE id = ?",
            [
              step.description,
              Math.round((completedSteps / this.steps.length) * 100),
              queueId,
            ],
          );

          // Execute step in new connection to isolate transactions
          let recordsDeleted = 0;

          try {
            recordsDeleted = await transaction(async (stepConnection) => {
              logger.debug(
                `Executing step ${step.name} for tenant ${tenantId}`,
              );

              // Create a wrapper using the dbWrapper utility
              const connWrapper = wrapConnection(stepConnection);

              return await step.handler(tenantId, queueId, connWrapper);
            });
          } catch (stepError: unknown) {
            logger.error(
              `Step ${step.name} failed for tenant ${tenantId}:`,
              stepError,
            );
            throw stepError;
          }

          // Log success
          await execute(
            `INSERT INTO tenant_deletion_log 
             (queue_id, step_name, table_name, records_deleted, duration_ms, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              queueId,
              step.name,
              step.name,
              recordsDeleted,
              Date.now() - startTime,
              "success",
            ],
          );

          completedSteps++;
        } catch (error: unknown) {
          logger.error(`Error in deletion step ${step.name}:`, error);

          // Log failure
          await execute(
            `INSERT INTO tenant_deletion_log 
             (queue_id, step_name, table_name, duration_ms, status, error_message) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              queueId,
              step.name,
              step.name,
              Date.now() - startTime,
              "failed",
              error instanceof Error ? error.message : String(error),
            ],
          );

          if (step.critical) {
            throw new Error(
              `Critical step ${step.name} failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }

      // 7. Mark as completed
      await execute(
        "UPDATE tenant_deletion_queue SET status = ?, completed_at = NOW(), progress = 100 WHERE id = ?",
        ["completed", queueId],
      );

      logger.info(`Tenant ${tenantId} deletion completed successfully`);
    } catch (error: unknown) {
      logger.error("Tenant deletion failed:", error);

      // Mark as failed
      await execute(
        "UPDATE tenant_deletion_queue SET status = ?, error_message = ? WHERE id = ?",
        [
          "failed",
          error instanceof Error ? error.message : String(error),
          queueId,
        ],
      );

      // Revert tenant status
      const [queueItem] = await query(
        "SELECT tenant_id FROM tenant_deletion_queue WHERE id = ?",
        [queueId],
      );

      if (queueItem != null) {
        await execute("UPDATE tenants SET deletion_status = ? WHERE id = ?", [
          "active",
          (queueItem as unknown as QueueRow).tenant_id,
        ]);
      }

      // Send failure alert
      await this.sendDeletionFailureAlert(
        queueId,
        error instanceof Error ? error.message : String(error),
      );

      // Send critical alert to all channels
      await alertingService.sendCriticalAlert(
        "🚨 Tenant Deletion Failed",
        `Critical failure during tenant deletion process`,
        {
          "Queue ID": queueId,
          "Tenant ID": tenantId,
          Error: error instanceof Error ? error.message : String(error),
          Environment: process.env.NODE_ENV ?? "production",
        },
      );

      throw error;
    }
  }

  /**
   * Trigger emergency stop for deletion
   */
  async triggerEmergencyStop(
    queueId: number,
    stoppedBy: number,
  ): Promise<void> {
    // Set emergency stop flag
    await execute(
      `UPDATE tenant_deletion_queue 
       SET emergency_stop = TRUE, emergency_stopped_at = NOW(), emergency_stopped_by = ?
       WHERE id = ? AND status = 'processing'`,
      [stoppedBy, queueId],
    );

    // Log emergency stop
    await execute(
      `INSERT INTO tenant_deletion_log 
       (queue_id, step_name, status, error_message) 
       VALUES (?, 'EMERGENCY_STOP', 'triggered', ?)`,
      [queueId, `Emergency stop triggered by user ${stoppedBy}`],
    );

    logger.warn(
      `Emergency stop triggered for deletion queue ${queueId} by user ${stoppedBy}`,
    );

    // Send alert about emergency stop
    await alertingService
      .sendSlackAlert({
        channel: process.env.SLACK_ALERTS_CHANNEL ?? "#alerts",
        severity: "warning",
        title: "🛑 Emergency Stop Triggered",
        message: "Tenant deletion was halted by emergency stop",
        fields: {
          "Queue ID": queueId,
          "Stopped By": `User ${stoppedBy}`,
          Action: "Deletion process will be halted at next checkpoint",
        },
      })
      .catch((err: unknown) =>
        logger.error("Failed to send emergency stop alert:", err),
      );
  }

  /**
   * Handle emergency stop during deletion
   */
  private async handleEmergencyStop(
    queueId: number,
    tenantId: number,
  ): Promise<void> {
    logger.warn(`Handling emergency stop for queue ${queueId}`);

    // Update queue status
    await execute(
      `UPDATE tenant_deletion_queue 
       SET status = 'emergency_stopped', 
           error_message = 'Emergency stop requested by administrator'
       WHERE id = ?`,
      [queueId],
    );

    // Revert tenant status to active
    await execute("UPDATE tenants SET deletion_status = ? WHERE id = ?", [
      "active",
      tenantId,
    ]);

    // Log final status
    await execute(
      `INSERT INTO tenant_deletion_log 
       (queue_id, step_name, status, error_message) 
       VALUES (?, 'EMERGENCY_STOP_COMPLETED', 'success', 'Deletion halted and tenant restored to active')`,
      [queueId],
    );

    // Notify admins
    interface StoppedByRow extends RowDataPacket {
      emergency_stopped_by: number | null;
    }
    const [[stoppedByUser]] = await query<StoppedByRow[]>(
      "SELECT emergency_stopped_by FROM tenant_deletion_queue WHERE id = ?",
      [queueId],
    );

    if (
      stoppedByUser?.emergency_stopped_by != null &&
      stoppedByUser.emergency_stopped_by !== 0
    ) {
      await this.notifyEmergencyStop(
        tenantId,
        queueId,
        stoppedByUser.emergency_stopped_by,
      );
    }
  }

  /**
   * Get deletion status
   */
  async getDeletionStatus(tenantId: number): Promise<DeletionStatusRow | null> {
    const [result] = await query<DeletionStatusRow[]>(
      `SELECT 
        q.*,
        t.deletion_status,
        t.deletion_requested_at,
        (SELECT COUNT(*) FROM tenant_deletion_log WHERE queue_id = q.id) as completed_steps,
        (SELECT COUNT(*) FROM tenant_deletion_log WHERE queue_id = q.id AND status = 'failed') as failed_steps
       FROM tenant_deletion_queue q
       JOIN tenants t ON t.id = q.tenant_id
       WHERE q.tenant_id = ?
       ORDER BY q.created_at DESC
       LIMIT 1`,
      [tenantId],
    );

    return result[0] ?? null;
  }

  /**
   * Retry failed deletion
   */
  async retryDeletion(queueId: number): Promise<void> {
    const [queueItem] = await query(
      "SELECT * FROM tenant_deletion_queue WHERE id = ? AND status = ?",
      [queueId, "failed"],
    );

    if (queueItem == null) {
      throw new Error("Queue item not found or not in failed state");
    }

    await execute(
      "UPDATE tenant_deletion_queue SET status = ?, retry_count = retry_count + 1, error_message = NULL WHERE id = ?",
      ["queued", queueId],
    );
  }

  /**
   * Cancel queued deletion (within grace period)
   */
  async cancelDeletion(tenantId: number, cancelledBy: number): Promise<void> {
    const [queueItem] = await query(
      "SELECT * FROM tenant_deletion_queue WHERE tenant_id = ? AND status = ? AND scheduled_deletion_date > NOW()",
      [tenantId, "queued"],
    );

    if (queueItem == null) {
      throw new Error("No cancellable deletion found for this tenant");
    }

    await transaction(async (connection) => {
      // Update tenant status back to active
      await connection.query(
        "UPDATE tenants SET deletion_status = ?, deletion_requested_at = NULL, deletion_requested_by = NULL WHERE id = ?",
        ["active", tenantId],
      );

      // Cancel queue item
      await connection.query(
        "UPDATE tenant_deletion_queue SET status = ?, completed_at = NOW() WHERE id = ?",
        ["cancelled", (queueItem as unknown as QueueRow).id],
      );

      // Log cancellation
      await connection.query(
        `INSERT INTO tenant_deletion_log 
         (queue_id, step_name, status, error_message) 
         VALUES (?, ?, ?, ?)`,
        [
          (queueItem as unknown as QueueRow).id,
          "deletion_cancelled",
          "success",
          `Cancelled by user ${cancelledBy}`,
        ],
      );

      logger.info(
        `Tenant ${tenantId} deletion cancelled by user ${cancelledBy}`,
      );
    });
  }

  // ========== HELPER METHODS ==========

  private async createTenantDataExport(tenantId: number): Promise<string> {
    const exportDir = `/exports/tenant_${tenantId}`;
    const timestamp = Date.now();
    const exportFile = `${exportDir}/tenant_${tenantId}_export_${timestamp}.tar.gz`;

    // Create export directory
    await fs.mkdir(exportDir, { recursive: true });

    // Create JSON export directory instead of zip for now
    const jsonExportDir = `${exportDir}/json_export`;
    await fs.mkdir(jsonExportDir, { recursive: true });

    // Export all tenant data as JSON files
    const tables = [
      "users",
      "departments",
      "teams",
      "documents",
      "messages",
      "conversations",
      "calendar_events",
      "shifts",
      "blackboard_entries",
      "surveys",
      "kvp_suggestions",
    ];

    for (const table of tables) {
      // Validate table name against whitelist to prevent SQL injection
      if (!tables.includes(table)) {
        throw new Error(`Invalid table name: ${table}`);
      }

      // Use backticks for table name (MySQL identifier quote)
      const data = await query(
        `SELECT * FROM \`${table}\` WHERE tenant_id = ?`,
        [tenantId],
      );
      if (data.length > 0) {
        await fs.writeFile(
          `${jsonExportDir}/${table}.json`,
          JSON.stringify(data, null, 2),
        );
      }
    }

    // Create a simple tar archive using system command
    await execAsync(
      `cd ${exportDir} && tar -czf tenant_${tenantId}_export_${timestamp}.tar.gz json_export/`,
    );

    return exportFile;
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash("sha256");
    hashSum.update(fileBuffer);
    return hashSum.digest("hex");
  }

  private async createDeletionAuditTrail(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
    connection?: ConnectionWrapper,
  ): Promise<void> {
    if (connection) {
      // If connection is provided, use it directly
      const [tenantResults] = await connection.query(
        "SELECT * FROM tenants WHERE id = ?",
        [tenantId],
      );
      const tenantInfo = tenantResults[0] as RowDataPacket;

      const [userResults] = await connection.query(
        "SELECT COUNT(*) as user_count FROM users WHERE tenant_id = ?",
        [tenantId],
      );
      const firstUserResult = userResults[0] as
        | { user_count: number }
        | undefined;
      const userCount = firstUserResult?.user_count ?? 0;

      await connection.query(
        `INSERT INTO deletion_audit_trail 
         (tenant_id, tenant_name, user_count, deleted_by, deleted_by_ip, deletion_reason, metadata) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          (tenantInfo?.company_name as string) ?? "Unknown",
          userCount,
          requestedBy,
          ipAddress ?? "unknown",
          reason ?? "No reason provided",
          JSON.stringify({
            subdomain: (tenantInfo?.subdomain as string) ?? null,
            created_at: (tenantInfo?.created_at as Date) ?? null,
            plan: (tenantInfo?.current_plan_id as number) ?? null,
            deletion_status: (tenantInfo?.deletion_status as string) ?? null,
          }),
        ],
      );
    } else {
      // If no connection provided, use transaction
      await transaction(async (conn) => {
        const [tenantResults] = await conn.query<RowDataPacket[]>(
          "SELECT * FROM tenants WHERE id = ?",
          [tenantId],
        );
        const tenantInfo = tenantResults[0];

        const [userResults] = await conn.query<RowDataPacket[]>(
          "SELECT COUNT(*) as user_count FROM users WHERE tenant_id = ?",
          [tenantId],
        );
        const userCount = (userResults[0]?.user_count as number) ?? 0;

        await conn.query(
          `INSERT INTO deletion_audit_trail 
           (tenant_id, tenant_name, user_count, deleted_by, deleted_by_ip, deletion_reason, metadata) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            tenantId,
            (tenantInfo?.company_name as string) ?? "Unknown",
            userCount,
            requestedBy,
            ipAddress ?? "unknown",
            reason ?? "No reason provided",
            JSON.stringify({
              subdomain: (tenantInfo?.subdomain as string | undefined) ?? null,
              created_at: (tenantInfo?.created_at as Date | undefined) ?? null,
              plan: (tenantInfo?.current_plan_id as number | undefined) ?? null,
              deletion_status:
                (tenantInfo?.deletion_status as string | undefined) ?? null,
            }),
          ],
        );
      });
    }
  }

  private async sendDeletionWarningEmails(
    tenantId: number,
    scheduledDate: Date,
  ): Promise<void> {
    const [admins] = await query<DbUser[]>(
      'SELECT * FROM users WHERE tenant_id = ? AND role IN ("admin", "root")',
      [tenantId],
    );

    for (const admin of admins) {
      await emailService.sendEmail({
        to: admin.email,
        subject: "Wichtig: Ihr Assixx-Konto wird in 30 Tagen gelöscht",
        html: `
          <h2>Ihr Assixx-Konto wird gelöscht</h2>
          <p>Sehr geehrte/r ${admin.first_name} ${admin.last_name},</p>
          <p>Ihr Assixx-Konto wurde zur Löschung markiert und wird am <strong>${scheduledDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}</strong> endgültig gelöscht.</p>
          <h3>Was Sie jetzt tun können:</h3>
          <ul>
            <li>Laden Sie Ihre Daten herunter über das <a href="${process.env.APP_URL}/export-data">Export-Tool</a></li>
            <li>Kontaktieren Sie den Support, wenn dies ein Fehler ist</li>
            <li>Sichern Sie wichtige Dokumente und Informationen</li>
          </ul>
          <p>Nach der Löschung sind Ihre Daten unwiderruflich verloren.</p>
          <p>Mit freundlichen Grüßen<br>Ihr Assixx-Team</p>
        `,
      });
    }

    // Schedule reminder emails (non-blocking)
    try {
      await this.scheduleReminderEmails(tenantId, scheduledDate);
    } catch (err: unknown) {
      logger.error("Failed to schedule reminder emails:", err);
      // Don't fail the whole operation
    }
  }

  private async scheduleReminderEmails(
    tenantId: number,
    scheduledDate: Date,
  ): Promise<void> {
    const reminders = [
      {
        days: 14,
        subject: "Erinnerung: Ihr Assixx-Konto wird in 14 Tagen gelöscht",
      },
      {
        days: 7,
        subject: "Letzte Warnung: Ihr Assixx-Konto wird in 7 Tagen gelöscht",
      },
      { days: 1, subject: "DRINGEND: Ihr Assixx-Konto wird morgen gelöscht" },
    ];

    for (const reminder of reminders) {
      const reminderDate = new Date(scheduledDate);
      reminderDate.setDate(reminderDate.getDate() - reminder.days);

      await execute(
        "INSERT INTO scheduled_tasks (tenant_id, task_type, task_data, scheduled_at) VALUES (?, ?, ?, ?)",
        [
          tenantId,
          "deletion_reminder",
          JSON.stringify({
            days_remaining: reminder.days,
            subject: reminder.subject,
          }),
          reminderDate,
        ],
      );
    }
  }

  private async notifyRootAdminsForApproval(
    tenantId: number,
    requestedBy: number,
    tenantName: string,
    queueId: number,
  ): Promise<void> {
    const [rootUsers] = await query<DbUser[]>(
      'SELECT * FROM users WHERE role = "root" AND id != ?',
      [requestedBy],
    );

    interface UserNameInfo extends RowDataPacket {
      username: string;
      first_name: string;
      last_name: string;
    }
    const [[requestedByUser]] = await query<UserNameInfo[]>(
      "SELECT username, first_name, last_name FROM users WHERE id = ?",
      [requestedBy],
    );

    for (const root of rootUsers) {
      await emailService.sendEmail({
        to: (root as unknown as DbUser).email,
        subject: "Genehmigung erforderlich: Tenant-Löschung",
        html: `
          <h2>Tenant-Löschung Genehmigung erforderlich</h2>
          <p><strong>${requestedByUser.first_name} ${requestedByUser.last_name}</strong> (${requestedByUser.username}) hat die Löschung des folgenden Tenants beantragt:</p>
          <ul>
            <li><strong>Firma:</strong> ${tenantName}</li>
            <li><strong>Tenant ID:</strong> ${tenantId}</li>
            <li><strong>Geplantes Löschdatum:</strong> ${(() => {
              const d = new Date();
              d.setDate(d.getDate() + 30);
              return d.toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              });
            })()}</li>
          </ul>
          <h3>Aktion erforderlich:</h3>
          <p>Als zweiter Root-User müssen Sie diese Löschung genehmigen oder ablehnen.</p>
          <p>
            <a href="${process.env.APP_URL}/root/deletion-approvals/${queueId}" 
               style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">
              Zur Genehmigung
            </a>
          </p>
          <p><em>Hinweis: Ohne Ihre Genehmigung wird die Löschung nicht durchgeführt.</em></p>
        `,
      });
    }
  }

  private async notifyApprovalStatus(
    tenantId: number,
    requesterId: number,
    status: "approved" | "rejected",
    approverId: number,
    reason?: string,
  ): Promise<void> {
    const [[requester]] = await query<DbUser[]>(
      "SELECT * FROM users WHERE id = ?",
      [requesterId],
    );
    interface ApproverRow extends RowDataPacket {
      username: string;
    }
    const [[approver]] = await query<ApproverRow[]>(
      "SELECT username FROM users WHERE id = ?",
      [approverId],
    );
    interface TenantNameRow extends RowDataPacket {
      company_name: string;
    }
    const [[tenant]] = await query<TenantNameRow[]>(
      "SELECT company_name FROM tenants WHERE id = ?",
      [tenantId],
    );

    const subject =
      status === "approved"
        ? "Ihre Tenant-Löschung wurde genehmigt"
        : "Ihre Tenant-Löschung wurde abgelehnt";

    const statusText =
      status === "approved"
        ? `<p style="color: green;"><strong>✅ Genehmigt von ${approver.username}</strong></p>`
        : `<p style="color: red;"><strong>❌ Abgelehnt von ${approver.username}</strong></p>`;

    await emailService.sendEmail({
      to: requester.email,
      subject,
      html: `
        <h2>${subject}</h2>
        <p>Ihre Anfrage zur Löschung des Tenants <strong>${tenant.company_name}</strong> wurde bearbeitet.</p>
        ${statusText}
        ${reason != null && reason !== "" ? `<p><strong>Grund:</strong> ${reason}</p>` : ""}
        ${
          status === "approved"
            ? `
          <p>Die Löschung wird nach der 30-tägigen Wartefrist automatisch durchgeführt.</p>
          <p>Sie können den Status im Admin-Dashboard verfolgen.</p>
        `
            : `
          <p>Der Tenant bleibt aktiv. Bei Fragen wenden Sie sich bitte an ${approver.username}.</p>
        `
        }
      `,
    });
  }

  /* Unused function - kept for future use
  private async _notifyRootAdmins(tenantId: number, deletedBy: number, tenantName: string): Promise<void> {
    const [rootUsers] = await query<DbUser[]>(
      'SELECT * FROM users WHERE role = "root" AND id != ?',
      [deletedBy]
    );
    
    interface UsernameRow extends RowDataPacket {
      username: string;
    }
    const [[deletedByUser]] = await query<UsernameRow[]>(
      'SELECT username FROM users WHERE id = ?',
      [deletedBy]
    );
    
    for (const root of rootUsers) {
      await emailService.sendEmail({
        to: (root as unknown as DbUser).email,
        subject: 'Tenant-Löschung eingeleitet',
        html: `
          <h2>Tenant-Löschung eingeleitet</h2>
          <p>Der Tenant <strong>${tenantName}</strong> (ID: ${tenantId}) wurde zur Löschung markiert.</p>
          <p>Gelöscht von: ${deletedByUser.username}</p>
          <p>Geplantes Löschdatum: ${String((() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' )}); })()}</p>
          <p>Sie können die Löschung im Admin-Dashboard überwachen oder abbrechen.</p>
        `
      });
    }
  } */

  private async sendDeletionFailureAlert(
    queueId: number,
    error: string,
  ): Promise<void> {
    // Email an alle Root-User
    const rootUsers = await query('SELECT * FROM users WHERE role = "root"');

    for (const root of rootUsers) {
      await emailService.sendEmail({
        to: (root as unknown as DbUser).email,
        subject: "🚨 Kritischer Fehler: Tenant-Löschung fehlgeschlagen",
        html: `
          <h2>Tenant-Löschung fehlgeschlagen</h2>
          <p>Die Löschung eines Tenants ist fehlgeschlagen und erfordert Ihre Aufmerksamkeit.</p>
          <p><strong>Queue ID:</strong> ${queueId}</p>
          <p><strong>Fehler:</strong> ${error}</p>
          <p>Bitte prüfen Sie die Logs und versuchen Sie die Löschung erneut oder kontaktieren Sie den Support.</p>
        `,
      });
    }

    // Send alerts to configured channels
    await alertingService
      .sendSlackAlert({
        channel: process.env.SLACK_CRITICAL_CHANNEL ?? "#alerts-critical",
        severity: "critical",
        title: "🚨 Tenant Deletion Failed",
        message: `Queue ${queueId} failed with error: ${error}`,
        fields: {
          "Queue ID": queueId,
          Error: error,
          Time: new Date().toISOString(),
          "Action Required": "Check logs and retry or contact support",
        },
      })
      .catch((err: unknown) =>
        logger.error("Failed to send Slack alert:", err),
      );

    await alertingService
      .sendTeamsAlert({
        severity: "critical",
        title: "Tenant Deletion Failed",
        message: `Critical failure in tenant deletion process (Queue: ${queueId})`,
        facts: [
          { name: "Queue ID", value: String(queueId) },
          { name: "Error", value: error },
          { name: "Time", value: new Date().toISOString() },
        ],
      })
      .catch((err: unknown) =>
        logger.error("Failed to send Teams alert:", err),
      );
  }

  /**
   * Notify admins about emergency stop
   */
  private async notifyEmergencyStop(
    tenantId: number,
    queueId: number,
    stoppedBy: number,
  ): Promise<void> {
    interface TenantNameRow extends RowDataPacket {
      company_name: string;
    }
    const [[tenant]] = await query<TenantNameRow[]>(
      "SELECT company_name FROM tenants WHERE id = ?",
      [tenantId],
    );
    interface UsernameRow extends RowDataPacket {
      username: string;
    }
    const [[user]] = await query<UsernameRow[]>(
      "SELECT username FROM users WHERE id = ?",
      [stoppedBy],
    );
    const [rootUsers] = await query<DbUser[]>(
      'SELECT * FROM users WHERE role = "root"',
    );

    for (const root of rootUsers) {
      await emailService.sendEmail({
        to: (root as unknown as DbUser).email,
        subject: "🚨 Emergency Stop: Tenant-Löschung angehalten",
        html: `
          <h2>Emergency Stop ausgelöst</h2>
          <p>Die Löschung des Tenants <strong>${tenant.company_name}</strong> wurde durch einen Emergency Stop angehalten.</p>
          <p><strong>Gestoppt von:</strong> ${user.username}</p>
          <p><strong>Queue ID:</strong> ${queueId}</p>
          <p><strong>Status:</strong> Der Tenant wurde auf "active" zurückgesetzt.</p>
          <p>Bitte prüfen Sie die Logs für weitere Details.</p>
        `,
      });
    }
  }

  /**
   * Perform dry-run simulation
   */
  async performDryRun(tenantId: number): Promise<{
    tenantId: number;
    estimatedDuration: number;
    affectedRecords: Record<string, number>;
    warnings: string[];
    blockers: string[];
    totalRecords: number;
  }> {
    const report = {
      tenantId,
      estimatedDuration: 0,
      affectedRecords: {} as Record<string, number>,
      warnings: [] as string[],
      blockers: [] as string[],
      totalRecords: 0,
    };

    // Check for blockers
    interface LegalHoldRow extends RowDataPacket {
      reason: string;
    }
    const [[legalHold]] = await query<LegalHoldRow[]>(
      "SELECT * FROM legal_holds WHERE tenant_id = ? AND active = 1",
      [tenantId],
    );

    if (legalHold != null) {
      report.blockers.push(`Legal hold active: ${legalHold.reason}`);
    }

    // Simulate each step
    for (const step of this.steps) {
      try {
        let count = 0;

        // Estimate records based on step type
        if (step.name.includes("users")) {
          const [result] = await query(
            "SELECT COUNT(*) as count FROM users WHERE tenant_id = ?",
            [tenantId],
          );
          const countResult = result as unknown as CountResult;
          count = countResult.count;
        } else if (step.name.includes("documents")) {
          const [result] = await query(
            "SELECT COUNT(*) as count FROM documents WHERE tenant_id = ?",
            [tenantId],
          );
          const countResult = result as unknown as CountResult;
          count = countResult.count;
        } else if (step.name.includes("messages")) {
          const [result] = await query(
            "SELECT COUNT(*) as count FROM messages WHERE sender_id IN (SELECT id FROM users WHERE tenant_id = ?)",
            [tenantId],
          );
          const countResult = result as unknown as CountResult;
          count = countResult.count;
        }
        // Add more estimations for other steps...

        report.affectedRecords[step.name] = count;
        report.totalRecords += count;
        report.estimatedDuration += count * 0.001; // 1ms per record estimate
      } catch (error: unknown) {
        report.warnings.push(
          `Could not estimate ${step.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Convert duration to minutes
    report.estimatedDuration = Math.ceil(report.estimatedDuration / 60);

    return report;
  }
}

// Create singleton instance
export const tenantDeletionService = new TenantDeletionService();

// Export for backwards compatibility
export default tenantDeletionService;
