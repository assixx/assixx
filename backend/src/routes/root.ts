/**
 * Root Management Routes
 * API endpoints for root user admin management and dashboard
 */

import express, { Router } from 'express';
import bcrypt from 'bcrypt';
import { authenticateToken, authorizeRole } from '../auth';
import { logger } from '../utils/logger';

// Import models (now ES modules)
import User from '../models/user';
import AdminLog from '../models/adminLog';

const router: Router = express.Router();

// Extended Request interfaces
// Removed unused AuthenticatedRequest interface - using the one from auth types

/* Unused interfaces - kept for future reference
interface CreateAdminRequest extends AuthenticatedRequest {
  body: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    notes?: string;
    [key: string]: any; // Allow additional fields
  };
}

interface AdminListRequest extends AuthenticatedRequest {}

interface DeleteAdminRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
}

interface AdminDetailsRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
}

interface UpdateAdminRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  body: {
    username?: string;
    email?: string;
    company?: string;
    new_password?: string;
    notes?: string;
  };
}

interface AdminLogsRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  query: {
    days?: string;
  };
}

interface DashboardDataRequest extends AuthenticatedRequest {}
*/

// Response interfaces
interface DashboardData {
  adminCount: number;
  employeeCount: number;
  totalUsers: number;
  tenantId: number;
  features: any[];
}

interface DatabaseError extends Error {
  code?: string;
}

// Admin-Benutzer erstellen
router.post(
  '/create-admin',
  authenticateToken,
  authorizeRole('root'),
  async (req, res): Promise<void> => {
    logger.info(
      `Attempt to create admin user by root user: ${req.user.username}`
    );
    try {
      const adminData = {
        ...req.body,
        role: 'admin',
        tenant_id: req.user.tenant_id,
      };
      const adminId = await User.create(adminData);
      logger.info(`Admin user created successfully with ID: ${adminId}`);
      res
        .status(201)
        .json({ message: 'Admin-Benutzer erfolgreich erstellt', adminId });
    } catch (error: any) {
      logger.error('Fehler beim Erstellen des Admin-Benutzers:', error);
      const dbError = error as DatabaseError;
      if (dbError.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          message:
            'Ein Benutzer mit diesem Benutzernamen oder dieser E-Mail existiert bereits.',
        });
        return;
      }
      res.status(500).json({
        message: 'Fehler beim Erstellen des Admin-Benutzers',
        error: error.message,
      });
    }
  }
);

// Liste aller Admin-Benutzer abrufen
router.get(
  '/admins',
  authenticateToken,
  authorizeRole('root'),
  async (req, res): Promise<void> => {
    logger.info(
      `Fetching admin users list for root user: ${req.user.username}`
    );
    try {
      const admins = await User.findByRole('admin', false, req.user.tenant_id);
      logger.info(`Retrieved ${admins.length} admin users`);
      res.json(admins);
    } catch (error: any) {
      logger.error('Fehler beim Abrufen der Admin-Benutzer:', error);
      res.status(500).json({
        message: 'Fehler beim Abrufen der Admin-Benutzer',
        error: error.message,
      });
    }
  }
);

// Admin-Benutzer löschen
router.delete(
  '/delete-admin/:id',
  authenticateToken,
  authorizeRole('root'),
  async (req, res): Promise<void> => {
    const rootUser = req.user.username;
    const adminId = req.params.id;

    logger.info(
      `Attempt to delete admin (ID: ${adminId}) by root user: ${rootUser}`
    );

    try {
      // Zuerst prüfen, ob der zu löschende Benutzer wirklich ein Admin ist
      const adminToDelete = await User.findById(parseInt(adminId, 10));

      if (!adminToDelete) {
        logger.warn(`Admin user with ID ${adminId} not found`);
        res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
        return;
      }

      if (adminToDelete.role !== 'admin') {
        logger.warn(`User with ID ${adminId} is not an admin`);
        res
          .status(403)
          .json({ message: 'Der zu löschende Benutzer ist kein Admin' });
        return;
      }

      // Admin löschen - hier müssen wir eine neue Methode in der User-Klasse erstellen
      const success = await User.delete(parseInt(adminId, 10));

      if (success) {
        logger.info(`Admin user with ID ${adminId} deleted successfully`);
        res.json({ message: 'Admin-Benutzer erfolgreich gelöscht' });
      } else {
        logger.warn(`Failed to delete admin user with ID ${adminId}`);
        res
          .status(500)
          .json({ message: 'Fehler beim Löschen des Admin-Benutzers' });
      }
    } catch (error: any) {
      logger.error(`Error deleting admin user with ID ${adminId}:`, error);
      res.status(500).json({
        message: 'Fehler beim Löschen des Admin-Benutzers',
        error: error.message,
      });
    }
  }
);

// NEUE ROUTE: Details eines Admin-Benutzers abrufen
router.get(
  '/admin/:id',
  authenticateToken,
  authorizeRole('root'),
  async (req, res): Promise<void> => {
    const rootUser = req.user.username;
    const adminId = req.params.id;

    logger.info(
      `Root user ${rootUser} requesting details for admin ${adminId}`
    );

    try {
      const admin = await User.findById(parseInt(adminId, 10));

      if (!admin) {
        logger.warn(`Admin with ID ${adminId} not found`);
        res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
        return;
      }

      if (admin.role !== 'admin') {
        logger.warn(`User with ID ${adminId} is not an admin`);
        res
          .status(403)
          .json({ message: 'Der abgefragte Benutzer ist kein Admin' });
        return;
      }

      // Passwort-Hash aus den Antwortdaten entfernen
      const { password, ...adminData } = admin;

      // Letzten Login-Zeitpunkt hinzufügen, falls vorhanden
      const lastLogin = await AdminLog.getLastLogin(parseInt(adminId, 10));
      if (lastLogin) {
        adminData.last_login = lastLogin.timestamp;
      }

      logger.info(`Details for admin ${adminId} retrieved successfully`);
      res.json(adminData);
    } catch (error: any) {
      logger.error(`Error retrieving details for admin ${adminId}:`, error);
      res.status(500).json({
        message: 'Fehler beim Abrufen der Admin-Details',
        error: error.message,
      });
    }
  }
);

// NEUE ROUTE: Admin-Benutzer aktualisieren
router.put(
  '/admin/:id',
  authenticateToken,
  authorizeRole('root'),
  async (req, res): Promise<void> => {
    const rootUser = req.user.username;
    const adminId = req.params.id;

    logger.info(`Root user ${rootUser} attempting to update admin ${adminId}`);

    try {
      const admin = await User.findById(parseInt(adminId, 10));

      if (!admin) {
        logger.warn(`Admin with ID ${adminId} not found`);
        res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
        return;
      }

      if (admin.role !== 'admin') {
        logger.warn(`User with ID ${adminId} is not an admin`);
        res
          .status(403)
          .json({ message: 'Der zu aktualisierende Benutzer ist kein Admin' });
        return;
      }

      // Aktualisierbare Felder extrahieren
      const { username, email, company, new_password, notes } = req.body;

      // Objekt für die Aktualisierung erstellen
      const updateData: any = {
        username,
        email,
        company,
        notes,
      };

      // Wenn ein neues Passwort übermittelt wurde, Hash erstellen
      if (new_password && new_password.trim() !== '') {
        updateData.password = await bcrypt.hash(new_password, 10);
      }

      // Admin aktualisieren
      await User.update(parseInt(adminId, 10), updateData);

      logger.info(
        `Admin ${adminId} updated successfully by root user ${rootUser}`
      );
      res.json({ message: 'Admin-Benutzer erfolgreich aktualisiert' });
    } catch (error: any) {
      logger.error(`Error updating admin ${adminId}:`, error);
      res.status(500).json({
        message: 'Fehler beim Aktualisieren des Admin-Benutzers',
        error: error.message,
      });
    }
  }
);

// NEUE ROUTE: Admin-Logs abrufen
router.get(
  '/admin/:id/logs',
  authenticateToken,
  authorizeRole('root'),
  async (req, res): Promise<void> => {
    const rootUser = req.user.username;
    const adminId = req.params.id;
    const days = parseInt(req.query.days as string) || 0; // 0 bedeutet alle Logs

    logger.info(
      `Root user ${rootUser} requesting logs for admin ${adminId} (days: ${days})`
    );

    try {
      const admin = await User.findById(parseInt(adminId, 10));

      if (!admin) {
        logger.warn(`Admin with ID ${adminId} not found`);
        res.status(404).json({ message: 'Admin-Benutzer nicht gefunden' });
        return;
      }

      if (admin.role !== 'admin') {
        logger.warn(`User with ID ${adminId} is not an admin`);
        res
          .status(403)
          .json({ message: 'Der abgefragte Benutzer ist kein Admin' });
        return;
      }

      // Logs abrufen
      const logs = await AdminLog.getByUserId(parseInt(adminId, 10), days);

      logger.info(`Retrieved ${logs.length} logs for admin ${adminId}`);
      res.json(logs);
    } catch (error: any) {
      logger.error(`Error retrieving logs for admin ${adminId}:`, error);
      res.status(500).json({
        message: 'Fehler beim Abrufen der Admin-Logs',
        error: error.message,
      });
    }
  }
);

// Dashboard-Daten für Root-User
router.get(
  '/dashboard-data',
  authenticateToken,
  authorizeRole('root'),
  async (req, res): Promise<void> => {
    logger.info(`Root user ${req.user.username} requesting dashboard data`);

    try {
      // Anzahl der Admins abrufen
      const admins = await User.findByRole('admin', false, req.user.tenant_id);
      const adminCount = admins.length;

      // Anzahl der Mitarbeiter abrufen
      const employees = await User.findByRole(
        'employee',
        false,
        req.user.tenant_id
      );
      const employeeCount = employees.length;

      // Tenant-Informationen könnten hier ergänzt werden
      const dashboardData: DashboardData = {
        adminCount,
        employeeCount,
        totalUsers: adminCount + employeeCount + 1, // +1 für Root-User
        tenantId: req.user.tenant_id,
        features: [], // Könnte mit Feature-Informationen ergänzt werden
      };

      logger.info(
        `Dashboard data retrieved successfully for root user ${req.user.username}`
      );
      res.json(dashboardData);
    } catch (error: any) {
      logger.error(`Error retrieving dashboard data:`, error);
      res.status(500).json({
        message: 'Fehler beim Abrufen der Dashboard-Daten',
        error: error.message,
      });
    }
  }
);

// NEUE ROUTE: Tenant komplett löschen (Root-User löscht sich selbst und seinen Tenant)
router.delete(
  '/delete-tenant',
  authenticateToken,
  authorizeRole('root'),
  async (req, res): Promise<void> => {
    const rootUser = req.user;
    logger.warn(`Root user ${rootUser.username} attempting to delete entire tenant ${rootUser.tenant_id}`);

    try {
      // Import Tenant model
      const Tenant = (await import('../models/tenant')).default;
      
      // Bestätigung dass es der Root-User des Tenants ist
      const tenant = await Tenant.findById(rootUser.tenant_id);
      
      if (!tenant) {
        logger.error(`Tenant ${rootUser.tenant_id} not found`);
        res.status(404).json({ message: 'Tenant nicht gefunden' });
        return;
      }

      // Log this critical action
      await AdminLog.create({
        user_id: rootUser.id,
        action: 'TENANT_DELETE_INITIATED',
        ip_address: req.ip,
        status: 'success',
        details: JSON.stringify({
          resource_type: 'tenant',
          resource_id: rootUser.tenant_id,
          tenant_name: tenant.company_name,
          subdomain: tenant.subdomain,
          initiated_by: rootUser.username
        })
      });

      // Delete the entire tenant (cascades to all related data)
      const success = await Tenant.delete(rootUser.tenant_id);

      if (success) {
        logger.warn(`Tenant ${rootUser.tenant_id} and all associated data deleted successfully`);
        res.json({ 
          success: true,
          message: 'Tenant und alle zugehörigen Daten wurden erfolgreich gelöscht' 
        });
      } else {
        logger.error(`Failed to delete tenant ${rootUser.tenant_id}`);
        res.status(500).json({ 
          success: false,
          message: 'Fehler beim Löschen des Tenants' 
        });
      }
    } catch (error: any) {
      logger.error(`Critical error deleting tenant ${rootUser.tenant_id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Kritischer Fehler beim Löschen des Tenants',
        error: error.message,
      });
    }
  }
);

export default router;

// CommonJS compatibility
