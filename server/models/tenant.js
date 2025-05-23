const db = require('../database');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');

class Tenant {
  // Neuen Tenant erstellen (Self-Service)
  static async create(tenantData) {
    const connection = await db.getConnection();
    
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
        admin_last_name
      } = tenantData;
      
      // 1. Prüfe ob Subdomain bereits existiert
      const [existing] = await connection.query(
        'SELECT id FROM tenants WHERE subdomain = ?',
        [subdomain]
      );
      
      if (existing.length > 0) {
        throw new Error('Diese Subdomain ist bereits vergeben');
      }
      
      // 2. Erstelle Tenant
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 Tage Trial
      
      const [tenantResult] = await connection.query(
        `INSERT INTO tenants (company_name, subdomain, email, phone, address, trial_ends_at, billing_email) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [company_name, subdomain, email, phone, address, trialEndsAt, admin_email]
      );
      
      const tenantId = tenantResult.insertId;
      
      // 3. Erstelle Root-Benutzer (Firmeninhaber)
      const hashedPassword = await bcrypt.hash(admin_password, 10);
      
      const [userResult] = await connection.query(
        `INSERT INTO users (username, email, password, role, first_name, last_name, tenant_id) 
         VALUES (?, ?, ?, 'root', ?, ?, ?)`,
        [admin_email, admin_email, hashedPassword, admin_first_name, admin_last_name, tenantId]
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
        trialEndsAt
      };
      
    } catch (error) {
      await connection.rollback();
      logger.error(`Fehler beim Erstellen des Tenants: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // Trial-Features aktivieren
  static async activateTrialFeatures(tenantId, connection = null) {
    const conn = connection || db;
    
    // Hole alle Basic und einige Premium Features für Trial
    const [features] = await conn.query(
      `SELECT id FROM features 
       WHERE category IN ('basic', 'premium') 
       AND code IN ('basic_employees', 'document_upload', 'payslip_management', 
                    'email_notifications', 'advanced_reports')`
    );
    
    // Aktiviere Features für 14 Tage
    for (const feature of features) {
      await conn.query(
        `INSERT INTO tenant_features (tenant_id, feature_id, status, valid_until, trial_days) 
         VALUES (?, ?, 'trial', DATE_ADD(NOW(), INTERVAL 14 DAY), 14)`,
        [tenantId, feature.id]
      );
    }
  }
  
  // Subdomain validieren
  static validateSubdomain(subdomain) {
    // Nur Buchstaben, Zahlen und Bindestriche
    const regex = /^[a-z0-9-]+$/;
    
    if (!regex.test(subdomain)) {
      return { valid: false, error: 'Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt' };
    }
    
    if (subdomain.length < 3 || subdomain.length > 50) {
      return { valid: false, error: 'Subdomain muss zwischen 3 und 50 Zeichen lang sein' };
    }
    
    // Reservierte Subdomains
    const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'test', 'dev'];
    if (reserved.includes(subdomain)) {
      return { valid: false, error: 'Diese Subdomain ist reserviert' };
    }
    
    return { valid: true };
  }
  
  // Prüfe ob Subdomain verfügbar ist
  static async isSubdomainAvailable(subdomain) {
    const [result] = await db.query(
      'SELECT id FROM tenants WHERE subdomain = ?',
      [subdomain]
    );
    return result.length === 0;
  }
  
  // Finde Tenant by Subdomain
  static async findBySubdomain(subdomain) {
    const [tenants] = await db.query(
      'SELECT * FROM tenants WHERE subdomain = ? AND status != "cancelled"',
      [subdomain]
    );
    return tenants[0];
  }
  
  // Trial-Status prüfen
  static async checkTrialStatus(tenantId) {
    const [result] = await db.query(
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
      daysRemaining: Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)),
      isExpired: now > trialEnd
    };
  }
  
  // Upgrade auf bezahlten Plan
  static async upgradeToPlan(tenantId, plan, stripeCustomerId, stripeSubscriptionId) {
    await db.query(
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
  static async activatePlanFeatures(tenantId, plan) {
    // Deaktiviere alle aktuellen Features
    await db.query(
      'UPDATE tenant_features SET status = "disabled" WHERE tenant_id = ?',
      [tenantId]
    );
    
    // Hole Features für den Plan
    const [planFeatures] = await db.query(
      `SELECT feature_id 
       FROM plan_features pf
       JOIN subscription_plans sp ON pf.plan_id = sp.id
       WHERE sp.name = ?`,
      [plan]
    );
    
    // Aktiviere neue Features
    for (const feature of planFeatures) {
      await db.query(
        `INSERT INTO tenant_features (tenant_id, feature_id, status) 
         VALUES (?, ?, 'active')
         ON DUPLICATE KEY UPDATE status = 'active', valid_until = NULL`,
        [tenantId, feature.feature_id]
      );
    }
  }
}

module.exports = Tenant;