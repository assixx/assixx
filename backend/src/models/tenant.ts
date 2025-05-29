import pool from '../database';
import { logger } from '../utils/logger';
import * as bcrypt from 'bcrypt';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { DatabaseTenant } from '../types/models';
import { TenantTrialStatus } from '../types/tenant.types';

// Extended interface for internal use
interface TenantTrialStatusComplete extends TenantTrialStatus {
  isInTrial: boolean;
}

// Helper function to handle both real pool and mock database
async function executeQuery<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[]
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
    tenantData: TenantCreateData
  ): Promise<TenantCreateResult> {
    const connection = (await (pool as any).getConnection()) as PoolConnection;

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
        'SELECT id FROM tenants WHERE subdomain = ?',
        [subdomain]
      );

      if (existing.length > 0) {
        throw new Error('Diese Subdomain ist bereits vergeben');
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
        ]
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
        ]
      );

      const userId = userResult.insertId;

      // 4. Verknüpfe Admin mit Tenant
      await connection.query(
        'INSERT INTO tenant_admins (tenant_id, user_id, is_primary) VALUES (?, ?, TRUE)',
        [tenantId, userId]
      );

      // 5. Aktiviere Trial-Features
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
        `Fehler beim Erstellen des Tenants: ${(error as Error).message}`
      );
      throw error;
    } finally {
      connection.release();
    }
  }

  // Trial-Features aktivieren
  static async activateTrialFeatures(
    tenantId: number,
    connection: PoolConnection | null = null
  ): Promise<void> {
    const conn = connection || pool;

    // Hole alle Basic und einige Premium Features für Trial
    const [features] = await (conn as any).query(
      `SELECT id FROM features 
       WHERE category IN ('basic', 'premium') 
       AND code IN ('basic_employees', 'document_upload', 'payslip_management', 
                    'email_notifications', 'advanced_reports')`
    );

    // Aktiviere Features für 14 Tage
    for (const feature of features) {
      await (conn as any).query(
        `INSERT INTO tenant_features (tenant_id, feature_id, status, valid_until, trial_days) 
         VALUES (?, ?, 'trial', DATE_ADD(NOW(), INTERVAL 14 DAY), 14)`,
        [tenantId, feature.id]
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
        error: 'Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt',
      };
    }

    if (subdomain.length < 3 || subdomain.length > 50) {
      return {
        valid: false,
        error: 'Subdomain muss zwischen 3 und 50 Zeichen lang sein',
      };
    }

    // Reservierte Subdomains
    const reserved = [
      'www',
      'api',
      'admin',
      'app',
      'mail',
      'ftp',
      'test',
      'dev',
    ];
    if (reserved.includes(subdomain)) {
      return { valid: false, error: 'Diese Subdomain ist reserviert' };
    }

    return { valid: true };
  }

  // Prüfe ob Subdomain verfügbar ist
  static async isSubdomainAvailable(subdomain: string): Promise<boolean> {
    const [result] = await executeQuery<RowDataPacket[]>(
      'SELECT id FROM tenants WHERE subdomain = ?',
      [subdomain]
    );
    return result.length === 0;
  }

  // Finde Tenant by Subdomain
  static async findBySubdomain(
    subdomain: string
  ): Promise<DatabaseTenant | null> {
    const [tenants] = await executeQuery<DbTenant[]>(
      'SELECT * FROM tenants WHERE subdomain = ? AND status != "cancelled"',
      [subdomain]
    );
    return tenants[0] || null;
  }

  // Finde Tenant by ID
  static async findById(tenantId: number): Promise<DatabaseTenant | null> {
    const [tenants] = await executeQuery<DbTenant[]>(
      'SELECT * FROM tenants WHERE id = ? AND status != "cancelled"',
      [tenantId]
    );
    return tenants[0] || null;
  }

  // Trial-Status prüfen
  static async checkTrialStatus(
    tenantId: number
  ): Promise<TenantTrialStatusComplete | null> {
    interface TrialResult extends RowDataPacket {
      trial_ends_at: Date;
      status: string;
    }

    const [result] = await executeQuery<TrialResult[]>(
      'SELECT trial_ends_at, status FROM tenants WHERE id = ?',
      [tenantId]
    );

    if (!result[0]) return null;

    const tenant = result[0];
    const now = new Date();
    const trialEnd = new Date(tenant.trial_ends_at);

    return {
      isInTrial: tenant.status === 'trial',
      trialEndsAt: trialEnd,
      daysRemaining: Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
      isExpired: now > trialEnd,
    };
  }

  // Upgrade auf bezahlten Plan
  static async upgradeToPlan(
    tenantId: number,
    plan: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string
  ): Promise<void> {
    await executeQuery(
      `UPDATE tenants 
       SET status = 'active', 
           current_plan = ?, 
           stripe_customer_id = ?, 
           stripe_subscription_id = ?
       WHERE id = ?`,
      [plan, stripeCustomerId, stripeSubscriptionId, tenantId]
    );

    // Aktiviere Plan-Features
    await this.activatePlanFeatures(tenantId, plan);
  }

  // Plan-Features aktivieren
  static async activatePlanFeatures(
    tenantId: number,
    plan: string
  ): Promise<void> {
    // Deaktiviere alle aktuellen Features
    await executeQuery(
      'UPDATE tenant_features SET status = "disabled" WHERE tenant_id = ?',
      [tenantId]
    );

    // Hole Features für den Plan
    const [planFeatures] = await executeQuery<DbFeature[]>(
      `SELECT feature_id 
       FROM plan_features pf
       JOIN subscription_plans sp ON pf.plan_id = sp.id
       WHERE sp.name = ?`,
      [plan]
    );

    // Aktiviere neue Features
    for (const feature of planFeatures) {
      await executeQuery(
        `INSERT INTO tenant_features (tenant_id, feature_id, status) 
         VALUES (?, ?, 'active')
         ON DUPLICATE KEY UPDATE status = 'active', valid_until = NULL`,
        [tenantId, feature.feature_id]
      );
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
