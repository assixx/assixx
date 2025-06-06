import pool from "../database";
import { logger } from "../utils/logger";
import * as bcrypt from "bcrypt";
import { RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import { DatabaseTenant } from "../types/models";
import { TenantTrialStatus } from "../types/tenant.types";
import * as fs from "fs/promises";
import * as path from "path";

// Extended interface for internal use
interface TenantTrialStatusComplete extends TenantTrialStatus {
  isInTrial: boolean;
}

// Helper function to handle both real pool and mock database
async function executeQuery<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[],
): Promise<[T, any]> {
  const result = await (pool as any).query(sql, params);
  if (Array.isArray(result) && result.length === 2) {
    return result as [T, any];
  }
  return [result as T, null];
}

// Database interfaces
interface DbTenant extends RowDataPacket, DatabaseTenant {}

interface DbFeature extends RowDataPacket {
  id: number;
  feature_id?: number;
}

interface TenantCreateData {
  company_name: string;
  subdomain: string;
  email: string;
  phone?: string;
  address?: string;
  admin_email: string;
  admin_password: string;
  admin_first_name: string;
  admin_last_name: string;
}

interface SubdomainValidationResult {
  valid: boolean;
  error?: string;
}

interface TenantCreateResult {
  tenantId: number;
  userId: number;
  subdomain: string;
  trialEndsAt: Date;
}

export class Tenant {
  // Neuen Tenant erstellen (Self-Service)
  static async create(
    tenantData: TenantCreateData,
  ): Promise<TenantCreateResult> {
    logger.info("[DEBUG] Starting tenant creation...");
    const connection = (await (pool as any).getConnection()) as PoolConnection;
    logger.info("[DEBUG] Got database connection");

    try {
      await connection.beginTransaction();

      const {
        company_name,
        subdomain,
        email,
        phone,
        address,
        admin_email,
        admin_password,
        admin_first_name,
        admin_last_name,
      } = tenantData;

      // 1. Prüfe ob Subdomain bereits existiert
      const [existing] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM tenants WHERE subdomain = ?",
        [subdomain],
      );

      if (existing.length > 0) {
        throw new Error("Diese Subdomain ist bereits vergeben");
      }

      // 2. Erstelle Tenant
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 Tage Trial

      const [tenantResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO tenants (company_name, subdomain, email, phone, address, trial_ends_at, billing_email) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          company_name,
          subdomain,
          email,
          phone,
          address,
          trialEndsAt,
          admin_email,
        ],
      );

      const tenantId = tenantResult.insertId;

      // 3. Erstelle Root-Benutzer (Firmeninhaber)
      const hashedPassword = await bcrypt.hash(admin_password, 10);

      const [userResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO users (username, email, password, role, first_name, last_name, tenant_id) 
         VALUES (?, ?, ?, 'root', ?, ?, ?)`,
        [
          admin_email,
          admin_email,
          hashedPassword,
          admin_first_name,
          admin_last_name,
          tenantId,
        ],
      );

      const userId = userResult.insertId;

      // 4. Verknüpfe Admin mit Tenant
      await connection.query(
        "INSERT INTO tenant_admins (tenant_id, user_id, is_primary) VALUES (?, ?, TRUE)",
        [tenantId, userId],
      );

      // 5. Weise Basic-Plan zu
      // Hole Basic Plan ID
      const [plans] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM plans WHERE code = ? AND is_active = true",
        ["basic"],
      );

      if (plans.length > 0) {
        const basicPlanId = plans[0].id;

        // Erstelle tenant_plans Eintrag
        await connection.query(
          `INSERT INTO tenant_plans (tenant_id, plan_id, status, started_at) 
           VALUES (?, ?, 'trial', NOW())`,
          [tenantId, basicPlanId],
        );

        // Update tenant mit current_plan_id
        await connection.query(
          "UPDATE tenants SET current_plan_id = ? WHERE id = ?",
          [basicPlanId, tenantId],
        );
      }

      // 6. Aktiviere Trial-Features
      await this.activateTrialFeatures(tenantId, connection);

      await connection.commit();

      logger.info(`Neuer Tenant erstellt: ${company_name} (${subdomain})`);

      return {
        tenantId,
        userId,
        subdomain,
        trialEndsAt,
      };
    } catch (error) {
      await connection.rollback();
      logger.error(
        `Fehler beim Erstellen des Tenants: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      connection.release();
    }
  }

  // Trial-Features aktivieren
  static async activateTrialFeatures(
    tenantId: number,
    connection: PoolConnection | null = null,
  ): Promise<void> {
    const conn = connection || pool;

    // TEMPORÄR: Aktiviere ALLE Features für Beta-Test
    // TODO: Vor Beta-Test auf Plan-basierte Features umstellen
    const [features] = await (conn as any).query(`SELECT id FROM features`);

    // Aktiviere alle Features für 14 Tage Trial
    for (const feature of features) {
      await (conn as any).query(
        `INSERT INTO tenant_features (tenant_id, feature_id, is_active, expires_at) 
         VALUES (?, ?, TRUE, DATE_ADD(NOW(), INTERVAL 14 DAY))`,
        [tenantId, feature.id],
      );
    }
  }

  // Subdomain validieren
  static validateSubdomain(subdomain: string): SubdomainValidationResult {
    // Nur Buchstaben, Zahlen und Bindestriche
    const regex = /^[a-z0-9-]+$/;

    if (!regex.test(subdomain)) {
      return {
        valid: false,
        error: "Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt",
      };
    }

    if (subdomain.length < 3 || subdomain.length > 50) {
      return {
        valid: false,
        error: "Subdomain muss zwischen 3 und 50 Zeichen lang sein",
      };
    }

    // Reservierte Subdomains
    const reserved = [
      "www",
      "api",
      "admin",
      "app",
      "mail",
      "ftp",
      "test",
      "dev",
    ];
    if (reserved.includes(subdomain)) {
      return { valid: false, error: "Diese Subdomain ist reserviert" };
    }

    return { valid: true };
  }

  // Prüfe ob Subdomain verfügbar ist
  static async isSubdomainAvailable(subdomain: string): Promise<boolean> {
    const [result] = await executeQuery<RowDataPacket[]>(
      "SELECT id FROM tenants WHERE subdomain = ?",
      [subdomain],
    );
    return result.length === 0;
  }

  // Finde Tenant by Subdomain
  static async findBySubdomain(
    subdomain: string,
  ): Promise<DatabaseTenant | null> {
    const [tenants] = await executeQuery<DbTenant[]>(
      'SELECT * FROM tenants WHERE subdomain = ? AND status != "cancelled"',
      [subdomain],
    );
    return tenants[0] || null;
  }

  // Finde Tenant by ID
  static async findById(tenantId: number): Promise<DatabaseTenant | null> {
    const [tenants] = await executeQuery<DbTenant[]>(
      'SELECT * FROM tenants WHERE id = ? AND status != "cancelled"',
      [tenantId],
    );
    return tenants[0] || null;
  }

  // Alle Tenants abrufen
  static async findAll(): Promise<DatabaseTenant[]> {
    const [tenants] = await executeQuery<DbTenant[]>(
      'SELECT * FROM tenants WHERE status != "cancelled" ORDER BY name',
    );
    return tenants;
  }

  // Trial-Status prüfen
  static async checkTrialStatus(
    tenantId: number,
  ): Promise<TenantTrialStatusComplete | null> {
    interface TrialResult extends RowDataPacket {
      trial_ends_at: Date;
      status: string;
    }

    const [result] = await executeQuery<TrialResult[]>(
      "SELECT trial_ends_at, status FROM tenants WHERE id = ?",
      [tenantId],
    );

    if (!result[0]) return null;

    const tenant = result[0];
    const now = new Date();
    const trialEnd = new Date(tenant.trial_ends_at);

    return {
      isInTrial: tenant.status === "trial",
      trialEndsAt: trialEnd,
      daysRemaining: Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
      isExpired: now > trialEnd,
    };
  }

  // Upgrade auf bezahlten Plan
  static async upgradeToPlan(
    tenantId: number,
    plan: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ): Promise<void> {
    await executeQuery(
      `UPDATE tenants 
       SET status = 'active', 
           current_plan = ?, 
           stripe_customer_id = ?, 
           stripe_subscription_id = ?
       WHERE id = ?`,
      [plan, stripeCustomerId, stripeSubscriptionId, tenantId],
    );

    // Aktiviere Plan-Features
    await this.activatePlanFeatures(tenantId, plan);
  }

  // Plan-Features aktivieren
  static async activatePlanFeatures(
    tenantId: number,
    plan: string,
  ): Promise<void> {
    // Deaktiviere alle aktuellen Features
    await executeQuery(
      "UPDATE tenant_features SET is_active = FALSE WHERE tenant_id = ?",
      [tenantId],
    );

    // Hole Features für den Plan
    const [planFeatures] = await executeQuery<DbFeature[]>(
      `SELECT feature_id 
       FROM plan_features pf
       JOIN subscription_plans sp ON pf.plan_id = sp.id
       WHERE sp.name = ?`,
      [plan],
    );

    // Aktiviere neue Features
    for (const feature of planFeatures) {
      await executeQuery(
        `INSERT INTO tenant_features (tenant_id, feature_id, is_active) 
         VALUES (?, ?, TRUE)
         ON DUPLICATE KEY UPDATE is_active = TRUE, expires_at = NULL`,
        [tenantId, feature.feature_id],
      );
    }
  }

  // Helper function to execute delete queries and ignore missing table errors
  private static async safeDelete(
    connection: PoolConnection,
    query: string,
    params: any[],
  ): Promise<void> {
    try {
      await connection.query(query, params);
    } catch (error: any) {
      if (error.code === "ER_NO_SUCH_TABLE") {
        logger.debug(`Table not found, skipping: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  // Tenant komplett löschen - ACHTUNG: Löscht ALLE Daten unwiderruflich!
  static async delete(tenantId: number): Promise<boolean> {
    const connection = (await (pool as any).getConnection()) as PoolConnection;

    try {
      await connection.beginTransaction();

      logger.warn(`Starting complete deletion of tenant ${tenantId}`);

      // 1. Get all user IDs for this tenant (for file cleanup)
      const [users] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE tenant_id = ?",
        [tenantId],
      );
      const userIds = users.map((u) => u.id);

      // 2. Delete in correct order to respect foreign key constraints

      // Delete chat-related data
      await this.safeDelete(
        connection,
        "DELETE FROM message_status WHERE message_id IN (SELECT id FROM messages WHERE sender_id IN (?))",
        [userIds.length > 0 ? userIds : [0]],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM messages WHERE sender_id IN (?)",
        [userIds.length > 0 ? userIds : [0]],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM conversation_participants WHERE user_id IN (?)",
        [userIds.length > 0 ? userIds : [0]],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM conversations WHERE tenant_id = ?",
        [tenantId],
      );

      // Delete survey-related data
      await this.safeDelete(
        connection,
        "DELETE FROM survey_answers WHERE response_id IN (SELECT id FROM survey_responses WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?))",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM survey_responses WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?)",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM survey_question_options WHERE question_id IN (SELECT id FROM survey_questions WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?))",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM survey_questions WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?)",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM survey_assignments WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?)",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM survey_reminders WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?)",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM survey_templates WHERE tenant_id = ?",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM surveys WHERE tenant_id = ?",
        [tenantId],
      );

      // Delete KVP-related data
      await this.safeDelete(
        connection,
        "DELETE FROM kvp_comments WHERE suggestion_id IN (SELECT id FROM kvp_suggestions WHERE tenant_id = ?)",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM kvp_suggestions WHERE tenant_id = ?",
        [tenantId],
      );

      // Delete shift-related data
      await this.safeDelete(
        connection,
        "DELETE FROM shift_trades WHERE shift_id IN (SELECT id FROM shifts WHERE tenant_id = ?)",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM shift_assignments WHERE shift_id IN (SELECT id FROM shifts WHERE tenant_id = ?)",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM shift_notes WHERE shift_id IN (SELECT id FROM shifts WHERE tenant_id = ?)",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM shifts WHERE tenant_id = ?",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM shift_templates WHERE tenant_id = ?",
        [tenantId],
      );
      // Delete shift_types
      await this.safeDelete(
        connection,
        "DELETE FROM shift_types WHERE tenant_id = ?",
        [tenantId],
      );

      // Delete calendar events
      await this.safeDelete(
        connection,
        "DELETE FROM calendar_events WHERE tenant_id = ?",
        [tenantId],
      );

      // Delete blackboard entries
      await this.safeDelete(
        connection,
        "DELETE FROM blackboard_entries WHERE tenant_id = ?",
        [tenantId],
      );

      // Delete documents
      await this.safeDelete(
        connection,
        "DELETE FROM documents WHERE tenant_id = ?",
        [tenantId],
      );

      // Delete admin logs (using admin_id column)
      await this.safeDelete(
        connection,
        "DELETE FROM admin_logs WHERE admin_id IN (?)",
        [userIds.length > 0 ? userIds : [0]],
      );

      // Delete feature assignments
      await this.safeDelete(
        connection,
        "DELETE FROM tenant_features WHERE tenant_id = ?",
        [tenantId],
      );

      // Delete department/team relationships
      await this.safeDelete(
        connection,
        "DELETE FROM user_teams WHERE user_id IN (?)",
        [userIds.length > 0 ? userIds : [0]],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM user_departments WHERE user_id IN (?)",
        [userIds.length > 0 ? userIds : [0]],
      );

      // Delete teams and departments
      await this.safeDelete(
        connection,
        "DELETE FROM teams WHERE tenant_id = ?",
        [tenantId],
      );
      await this.safeDelete(
        connection,
        "DELETE FROM departments WHERE tenant_id = ?",
        [tenantId],
      );

      // Delete tenant admin associations
      await this.safeDelete(
        connection,
        "DELETE FROM tenant_admins WHERE tenant_id = ?",
        [tenantId],
      );

      // Delete all users
      await this.safeDelete(
        connection,
        "DELETE FROM users WHERE tenant_id = ?",
        [tenantId],
      );

      // Finally, delete the tenant itself
      const [result] = await connection.query<ResultSetHeader>(
        "DELETE FROM tenants WHERE id = ?",
        [tenantId],
      );

      await connection.commit();

      // 3. Clean up file system (after successful DB deletion)
      try {
        await this.cleanupTenantFiles(tenantId, userIds);
      } catch (fileError) {
        // Log error but don't fail the deletion
        logger.error(
          `Error cleaning up files for tenant ${tenantId}:`,
          fileError,
        );
      }

      logger.warn(
        `Successfully deleted tenant ${tenantId} and all associated data`,
      );
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      logger.error(`Error deleting tenant ${tenantId}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Clean up uploaded files for a tenant
  private static async cleanupTenantFiles(
    tenantId: number,
    userIds: number[],
  ): Promise<void> {
    const uploadsDir = path.join(__dirname, "../../../../uploads");

    try {
      // Clean up document files
      const documentsDir = path.join(
        uploadsDir,
        "documents",
        tenantId.toString(),
      );
      await this.removeDirectory(documentsDir);

      // Clean up profile pictures for all users
      const profilePicturesDir = path.join(uploadsDir, "profile-pictures");
      for (const userId of userIds) {
        const userProfileDir = path.join(profilePicturesDir, userId.toString());
        await this.removeDirectory(userProfileDir);
      }

      // Clean up chat attachments
      const chatDir = path.join(uploadsDir, "chat", tenantId.toString());
      await this.removeDirectory(chatDir);

      // Clean up KVP attachments
      const kvpDir = path.join(uploadsDir, "kvp", tenantId.toString());
      await this.removeDirectory(kvpDir);

      logger.info(`Cleaned up all files for tenant ${tenantId}`);
    } catch (error) {
      logger.error(`Error cleaning up files for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // Helper method to remove a directory and its contents
  private static async removeDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
      await fs.rm(dirPath, { recursive: true, force: true });
      logger.info(`Removed directory: ${dirPath}`);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        // Only log if it's not a "directory doesn't exist" error
        logger.error(`Error removing directory ${dirPath}:`, error);
      }
    }
  }
}

// Export types
export type {
  DbTenant,
  TenantCreateData,
  TenantCreateResult,
  SubdomainValidationResult,
};

// Default export for CommonJS compatibility
export default Tenant;

// CommonJS compatibility
