/**
 * Legacy Routes
 * Handles old API endpoints for backward compatibility
 */

import express, { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

// Import models (now ES modules)
import User from '../models/user';
import Document from '../models/document';
import Department from '../models/department';
import Team from '../models/team';

const router: Router = express.Router();

// Response interfaces
interface AuthCheckResponse {
  authenticated: boolean;
  user: {
    id: number;
    role: string;
    email: string;
  };
}

interface CountsResponse {
  employees: number;
  documents: number;
  departments: number;
  teams: number;
}

interface RootDashboardResponse {
  user: {
    id: number;
    username: string;
    role: string;
    iat?: number;
    exp?: number;
  };
}

interface CreateAdminResponse {
  message: string;
  admin: {
    id: number;
    username: string;
    email: string;
    company?: string;
  };
}

// Auth check endpoint (legacy location)
router.get(
  '/api/auth/check',
  [authenticateToken] as any[],
  (req: any, res: any) => {
    const authReq = req as any;
    const response: AuthCheckResponse = {
      authenticated: true,
      user: {
        id: authReq.user.id,
        role: authReq.user.role,
        email: authReq.user.email,
      },
    };
    res.json(response);
  }
);

// User profile endpoint
router.get(
  '/api/user/profile',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const user = await User.findById(authReq.user.id, authReq.user.tenant_id);

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      const { password: _password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Test DB endpoints (for admin dashboard)
router.get(
  '/test/db/employees',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const employees = await User.findAll({
        role: 'employee',
        tenant_id: authReq.user.tenant_id,
      });
      res.json(employees);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.get(
  '/test/db/counts',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const employees = await User.count({
        role: 'employee',
        tenant_id: authReq.user.tenant_id,
      });
      const documents = await Document.countByTenant(authReq.user.tenant_id);

      const response: CountsResponse = {
        employees: employees || 0,
        documents: documents || 0,
        departments: 0,
        teams: 0,
      };

      res.json(response);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.get(
  '/test/db/documents',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const documents = await Document.findWithFilters({
        tenantId: authReq.user.tenant_id,
      });
      res.json(documents);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.get(
  '/test/db/departments',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const departments = await Department.findAll(authReq.user.tenant_id);
      res.json(departments || []);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Teams endpoint
router.get(
  '/teams',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const teams = await Team.findAll(authReq.user.tenant_id);
      res.json(teams || []);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Admin employees endpoint
router.get(
  '/admin/employees',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const employees = await User.findAllByTenant(authReq.user.tenant_id);
      res.json(employees);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Root admins endpoint - legacy location
router.get(
  '/root/admins',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      if (authReq.user.role !== 'root') {
        res.status(403).json({ message: 'Access denied' });
        return;
      }

      const admins = await User.findAll({
        role: 'admin',
        tenant_id: authReq.user.tenant_id,
      });
      res.json(admins || []);
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Root dashboard data endpoint
router.get(
  '/api/root-dashboard-data',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      if (authReq.user.role !== 'root') {
        res.status(403).json({ message: 'Access denied' });
        return;
      }

      const response: RootDashboardResponse = {
        user: {
          id: authReq.user.id,
          username: authReq.user.username,
          role: authReq.user.role,
          iat: authReq.user.iat,
          exp: authReq.user.exp,
        },
      };

      res.json(response);
    } catch (error: any) {
      console.error('Error fetching root dashboard data:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Root create admin endpoint
router.post(
  '/root/create-admin',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      if (authReq.user.role !== 'root') {
        res.status(403).json({ message: 'Access denied' });
        return;
      }

      const { username, password, email, company } = req.body;

      // Create admin user
      const newAdminId = await User.create({
        username,
        password,
        email,
        company,
        role: 'admin',
        tenant_id: authReq.user.tenant_id,
        first_name: '',
        last_name: '',
      });

      const response: CreateAdminResponse = {
        message: 'Admin created successfully',
        admin: {
          id: newAdminId,
          username,
          email,
          company,
        },
      };

      res.json(response);
    } catch (error: any) {
      console.error('Error creating admin:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Root delete admin endpoint
router.delete(
  '/root/delete-admin/:id',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      if (authReq.user.role !== 'root') {
        res.status(403).json({ message: 'Access denied' });
        return;
      }

      const adminId = parseInt(req.params.id, 10);
      await User.delete(adminId);

      res.json({ message: 'Admin deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting admin:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Documents endpoint
router.get(
  '/documents',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;
      const documents = await Document.findByUserId(authReq.user.id);
      res.json(documents || []);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Admin employees endpoint
router.get(
  '/admin/employees',
  [authenticateToken] as any[],
  async (req: any, res: any) => {
    try {
      const authReq = req as any;

      // Check if user is admin or root
      if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const employees = await User.findAllByTenant(authReq.user.tenant_id);

      // Remove sensitive data
      const sanitizedEmployees = employees.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        department_id: user.department_id,
        team_id: user.team_id,
        phone: user.phone,
        created_at: user.created_at,
        is_active: user.is_active,
      }));

      res.json(sanitizedEmployees);
    } catch (error: any) {
      logger.error('Error fetching employees:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Teams endpoint
router.get(
  '/teams',
  [authenticateToken] as any[],
  async (_req: any, res: any) => {
    try {
      // For now, return empty array since teams table structure needs to be defined
      // This will prevent JSON parse errors
      res.json([]);
    } catch (error: any) {
      logger.error('Error fetching teams:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

export default router;

// CommonJS compatibility
