import { randomBytes } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

import bcrypt from "bcryptjs";

import { DatabaseTenant } from "../types/models";
import { TenantTrialStatus } from "../types/tenant.types";
import {
  query as executeQuery,
  getConnection,
  RowDataPacket,
  ResultSetHeader,
  PoolConnection,
} from "../utils/db";
import { logger } from "../utils/logger";

// Extended interface for internal use
interface TenantTrialStatusComplete extends TenantTrialStatus {
  isInTrial: boolean;
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

// Neuen Tenant erstellen (Self-Service)
export async function createTenant(
  tenantData: TenantCreateData,
): Promise<TenantCreateResult> {
  logger.info("[DEBUG] Starting tenant creation...");
  const connection = await getConnection();
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

    // Create user first without employee_id but WITH phone
    // Generate unique TEMPORARY employee number using timestamp and cryptographically secure random component
    const timestamp = Date.now().toString().slice(-6);
    // Generate cryptographically secure random number between 0-999 without bias
    // We use rejection sampling to avoid modulo bias
    let randomInt: number;
    do {
      const randomBuffer = randomBytes(2); // 2 bytes = 16 bits (0-65535)
      randomInt = randomBuffer.readUInt16BE(0);
      // Reject values >= 65000 to ensure uniform distribution when using % 1000
      // 65000 = 65 * 1000, so values 0-64999 map uniformly to 0-999
    } while (randomInt >= 65000);
    randomInt = randomInt % 1000; // Now safe to use modulo without bias
    const random = randomInt.toString().padStart(3, "0");
    const employeeNumber = `TEMP-${timestamp}${random}`;

    const [userResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO users (username, email, password, role, first_name, last_name, tenant_id, phone, employee_number) 
         VALUES (?, ?, ?, 'root', ?, ?, ?, ?, ?)`,
      [
        admin_email,
        admin_email,
        hashedPassword,
        admin_first_name,
        admin_last_name,
        tenantId,
        phone,
        employeeNumber, // Unique employee number
      ],
    );

    const userId = userResult.insertId;

    // Generate employee_id using the same format as in root.ts
    const { generateEmployeeId } = await import("../utils/employeeIdGenerator");
    const employeeId = generateEmployeeId(subdomain, "root", userId);

    // Update user with generated employee_id
    await connection.query("UPDATE users SET employee_id = ? WHERE id = ?", [
      employeeId,
      userId,
    ]);

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
      const basicPlanId = plans[0].id as number;

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
    await activateTrialFeatures(tenantId, connection);

    await connection.commit();

    logger.info(`Neuer Tenant erstellt: ${company_name} (${subdomain})`);

    return {
      tenantId,
      userId,
      subdomain,
      trialEndsAt,
    };
  } catch (error: unknown) {
    await connection.rollback();
    logger.error(
      `Fehler beim Erstellen des Tenants: ${(error as Error).message}`,
    );
    throw error;
  } finally {
    connection.release();
  }
}

// Trial-Features aktivieren (private function)
async function activateTrialFeatures(
  tenantId: number,
  connection: PoolConnection | null = null,
): Promise<void> {
  const conn = connection ?? (await getConnection());

  // TEMPORÄR: Aktiviere ALLE Features für Beta-Test
  // TODO: Vor Beta-Test auf Plan-basierte Features umstellen
  const [features] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM features`,
  );

  // Aktiviere alle Features für 14 Tage Trial
  for (const feature of features) {
    await conn.query(
      `INSERT INTO tenant_features (tenant_id, feature_id, is_active, expires_at) 
         VALUES (?, ?, TRUE, DATE_ADD(NOW(), INTERVAL 14 DAY))`,
      [tenantId, feature.id],
    );
  }
}

// Subdomain validieren
export function validateTenantSubdomain(
  subdomain: string,
): SubdomainValidationResult {
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
  const reserved = ["www", "api", "admin", "app", "mail", "ftp", "test", "dev"];
  if (reserved.includes(subdomain)) {
    return { valid: false, error: "Diese Subdomain ist reserviert" };
  }

  return { valid: true };
}

// Prüfe ob Subdomain verfügbar ist
export async function isTenantSubdomainAvailable(
  subdomain: string,
): Promise<boolean> {
  const [result] = await executeQuery<RowDataPacket[]>(
    "SELECT id FROM tenants WHERE subdomain = ?",
    [subdomain],
  );
  return result.length === 0;
}

// Finde Tenant by Subdomain
export async function findTenantBySubdomain(
  subdomain: string,
): Promise<DatabaseTenant | null> {
  const [tenants] = await executeQuery<DbTenant[]>(
    'SELECT * FROM tenants WHERE subdomain = ? AND status != "cancelled"',
    [subdomain],
  );
  return tenants[0] ?? null;
}

// Finde Tenant by ID
export async function findTenantById(
  tenantId: number,
): Promise<DatabaseTenant | null> {
  const [tenants] = await executeQuery<DbTenant[]>(
    'SELECT * FROM tenants WHERE id = ? AND status != "cancelled"',
    [tenantId],
  );
  return tenants[0] ?? null;
}

// Alle Tenants abrufen
export async function findAllTenants(): Promise<DatabaseTenant[]> {
  const [tenants] = await executeQuery<DbTenant[]>(
    'SELECT * FROM tenants WHERE status != "cancelled" ORDER BY company_name',
  );
  return tenants;
}

// Trial-Status prüfen
export async function checkTenantTrialStatus(
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

  if (result.length === 0) return null;

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
export async function upgradeTenantToPlan(
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
  await activatePlanFeatures(tenantId, plan);
}

// Plan-Features aktivieren (private function)
async function activatePlanFeatures(
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
async function safeDelete(
  connection: PoolConnection,
  query: string,
  params: unknown[],
): Promise<void> {
  try {
    await connection.query(query, params);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as Error & { code: string }).code === "ER_NO_SUCH_TABLE"
    ) {
      logger.debug(`Table not found, skipping: ${error.message}`);
    } else {
      throw error;
    }
  }
}

// Tenant komplett löschen - ACHTUNG: Löscht ALLE Daten unwiderruflich!
export async function deleteTenant(tenantId: number): Promise<boolean> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    logger.warn(`Starting complete deletion of tenant ${tenantId}`);

    // 1. Get all user IDs for this tenant (for file cleanup)
    const [users] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE tenant_id = ?",
      [tenantId],
    );
    const userIds = users.map((u) => u.id as number);

    // 2. Delete in correct order to respect foreign key constraints

    // Delete chat-related data
    await safeDelete(
      connection,
      "DELETE FROM message_status WHERE message_id IN (SELECT id FROM messages WHERE sender_id IN (?))",
      [userIds.length > 0 ? userIds : [0]],
    );
    await safeDelete(
      connection,
      "DELETE FROM messages WHERE sender_id IN (?)",
      [userIds.length > 0 ? userIds : [0]],
    );
    await safeDelete(
      connection,
      "DELETE FROM conversation_participants WHERE user_id IN (?)",
      [userIds.length > 0 ? userIds : [0]],
    );
    await safeDelete(
      connection,
      "DELETE FROM conversations WHERE tenant_id = ?",
      [tenantId],
    );

    // Delete survey-related data
    await safeDelete(
      connection,
      "DELETE FROM survey_answers WHERE response_id IN (SELECT id FROM survey_responses WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?))",
      [tenantId],
    );
    await safeDelete(
      connection,
      "DELETE FROM survey_responses WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?)",
      [tenantId],
    );
    await safeDelete(
      connection,
      "DELETE FROM survey_question_options WHERE question_id IN (SELECT id FROM survey_questions WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?))",
      [tenantId],
    );
    await safeDelete(
      connection,
      "DELETE FROM survey_questions WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?)",
      [tenantId],
    );
    await safeDelete(
      connection,
      "DELETE FROM survey_assignments WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?)",
      [tenantId],
    );
    await safeDelete(
      connection,
      "DELETE FROM survey_reminders WHERE survey_id IN (SELECT id FROM surveys WHERE tenant_id = ?)",
      [tenantId],
    );
    await safeDelete(
      connection,
      "DELETE FROM survey_templates WHERE tenant_id = ?",
      [tenantId],
    );
    await safeDelete(connection, "DELETE FROM surveys WHERE tenant_id = ?", [
      tenantId,
    ]);

    // Delete KVP-related data
    await safeDelete(
      connection,
      "DELETE FROM kvp_comments WHERE suggestion_id IN (SELECT id FROM kvp_suggestions WHERE tenant_id = ?)",
      [tenantId],
    );
    await safeDelete(
      connection,
      "DELETE FROM kvp_suggestions WHERE tenant_id = ?",
      [tenantId],
    );

    // Delete shift-related data
    await safeDelete(
      connection,
      "DELETE FROM shift_trades WHERE shift_id IN (SELECT id FROM shifts WHERE tenant_id = ?)",
      [tenantId],
    );
    await safeDelete(
      connection,
      "DELETE FROM shift_assignments WHERE shift_id IN (SELECT id FROM shifts WHERE tenant_id = ?)",
      [tenantId],
    );
    await safeDelete(
      connection,
      "DELETE FROM shift_notes WHERE shift_id IN (SELECT id FROM shifts WHERE tenant_id = ?)",
      [tenantId],
    );
    await safeDelete(connection, "DELETE FROM shifts WHERE tenant_id = ?", [
      tenantId,
    ]);
    await safeDelete(
      connection,
      "DELETE FROM shift_templates WHERE tenant_id = ?",
      [tenantId],
    );
    // Delete shift_types
    await safeDelete(
      connection,
      "DELETE FROM shift_types WHERE tenant_id = ?",
      [tenantId],
    );

    // Delete calendar events
    await safeDelete(
      connection,
      "DELETE FROM calendar_events WHERE tenant_id = ?",
      [tenantId],
    );

    // Delete blackboard entries
    await safeDelete(
      connection,
      "DELETE FROM blackboard_entries WHERE tenant_id = ?",
      [tenantId],
    );

    // Delete documents
    await safeDelete(connection, "DELETE FROM documents WHERE tenant_id = ?", [
      tenantId,
    ]);

    // Delete admin logs (using admin_id column)
    await safeDelete(
      connection,
      "DELETE FROM admin_logs WHERE admin_id IN (?)",
      [userIds.length > 0 ? userIds !== null && userIds !== undefined : [0]],
    );

    // Delete feature assignments
    await safeDelete(
      connection,
      "DELETE FROM tenant_features WHERE tenant_id = ?",
      [tenantId],
    );

    // Delete department/team relationships
    await safeDelete(
      connection,
      "DELETE FROM user_teams WHERE user_id IN (?)",
      [userIds.length > 0 ? userIds !== null && userIds !== undefined : [0]],
    );
    await safeDelete(
      connection,
      "DELETE FROM user_departments WHERE user_id IN (?)",
      [userIds.length > 0 ? userIds !== null && userIds !== undefined : [0]],
    );

    // Delete teams and departments
    await safeDelete(connection, "DELETE FROM teams WHERE tenant_id = ?", [
      tenantId,
    ]);
    await safeDelete(
      connection,
      "DELETE FROM departments WHERE tenant_id = ?",
      [tenantId],
    );

    // Delete tenant admin associations
    await safeDelete(
      connection,
      "DELETE FROM tenant_admins WHERE tenant_id = ?",
      [tenantId],
    );

    // Delete all users
    await safeDelete(connection, "DELETE FROM users WHERE tenant_id = ?", [
      tenantId,
    ]);

    // Finally, delete the tenant itself
    const [result] = await connection.query<ResultSetHeader>(
      "DELETE FROM tenants WHERE id = ?",
      [tenantId],
    );

    await connection.commit();

    // 3. Clean up file system (after successful DB deletion)
    try {
      await cleanupTenantFiles(tenantId, userIds);
    } catch (fileError: unknown) {
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
  } catch (error: unknown) {
    await connection.rollback();
    logger.error(`Error deleting tenant ${tenantId}:`, error);
    throw error;
  } finally {
    connection.release();
  }
}

// Clean up uploaded files for a tenant
async function cleanupTenantFiles(
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
    await removeDirectory(documentsDir);

    // Clean up profile pictures for all users
    const profilePicturesDir = path.join(uploadsDir, "profile-pictures");
    for (const userId of userIds) {
      const userProfileDir = path.join(profilePicturesDir, userId.toString());
      await removeDirectory(userProfileDir);
    }

    // Clean up chat attachments
    const chatDir = path.join(uploadsDir, "chat", tenantId.toString());
    await removeDirectory(chatDir);

    // Clean up KVP attachments
    const kvpDir = path.join(uploadsDir, "kvp", tenantId.toString());
    await removeDirectory(kvpDir);

    logger.info(`Cleaned up all files for tenant ${tenantId}`);
  } catch (error: unknown) {
    logger.error(`Error cleaning up files for tenant ${tenantId}:`, error);
    throw error;
  }
}

// Helper method to remove a directory and its contents
async function removeDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.info(`Removed directory: ${dirPath}`);
  } catch (error: unknown) {
    if ((error as globalThis.NodeJS.ErrnoException).code !== "ENOENT") {
      // Only log if it's not a "directory doesn't exist" error
      logger.error(`Error removing directory ${dirPath}:`, error);
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

// Default export object for backward compatibility
const Tenant = {
  create: createTenant,
  activateTrialFeatures,
  validateSubdomain: validateTenantSubdomain,
  isSubdomainAvailable: isTenantSubdomainAvailable,
  findBySubdomain: findTenantBySubdomain,
  findById: findTenantById,
  findAll: findAllTenants,
  checkTrialStatus: checkTenantTrialStatus,
  upgradeToPlan: upgradeTenantToPlan,
  activatePlanFeatures,
  delete: deleteTenant,
};

export default Tenant;

// CommonJS compatibility
