/**
 * Blackboard API Routes
 * Handles all operations related to the blackboard system
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';

// Import blackboard model (now ES modules)
import blackboardModel from '../models/blackboard';

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    tenant_id?: number;
    tenantId?: number;
    role: string;
    departmentId?: number;
    teamId?: number;
    username?: string;
    email?: string;
  };
  entry?: any; // Set by middleware
}

// Removed unused interfaces - using AuthenticatedRequest directly

// Helper function to get tenant ID from user object
function getTenantId(user: AuthenticatedRequest['user']): number {
  return user.tenant_id || user.tenantId || 1;
}

// Helper function to check if user can manage the entry
async function canManageEntry(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const entryId = req.params.id;
    const authReq = req as AuthenticatedRequest;
    const tenantId = getTenantId(authReq.user);

    const entry = await blackboardModel.getEntryById(
      parseInt(entryId, 10),
      tenantId,
      authReq.user.id
    );

    if (!entry) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }

    // Check if user is admin or the author of the entry
    const isAdmin =
      authReq.user.role === 'admin' || authReq.user.role === 'root';
    const isAuthor = entry.author_id === authReq.user.id;

    // Admins have permission always
    if (isAdmin) {
      req.entry = entry;
      return next();
    }

    // Authors only if they're not admins
    if (isAuthor) {
      req.entry = entry;
      return next();
    }

    // Neither admin nor author
    res
      .status(403)
      .json({ message: 'You do not have permission to manage this entry' });
  } catch (error: any) {
    console.error('Error in canManageEntry middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Helper function to check if user can create entry for specified org level
async function canCreateForOrgLevel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const { org_level, org_id } = req.body;
    const { role, departmentId, teamId } = authReq.user;

    // Admins can create entries for any org level
    if (role === 'admin' || role === 'root') {
      return next();
    }

    // Check permissions based on org level
    if (org_level === 'company') {
      res
        .status(403)
        .json({ message: 'Only admins can create company-wide entries' });
      return;
    }

    if (org_level === 'department') {
      // Check if user is department head
      if (role !== 'department_head' || departmentId !== Number(org_id)) {
        res.status(403).json({
          message:
            'You can only create department entries for your own department',
        });
        return;
      }
    }

    if (org_level === 'team') {
      // Check if user is team leader
      if (role !== 'team_leader' || teamId !== Number(org_id)) {
        res.status(403).json({
          message: 'You can only create team entries for your own team',
        });
        return;
      }
    }

    next();
  } catch (error: any) {
    console.error('Error in canCreateForOrgLevel middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * @route GET /api/blackboard
 * @desc Get all blackboard entries visible to the user
 */
router.get(
  '/api/blackboard',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = getTenantId(authReq.user);

      const options = {
        status: String(req.query.status || 'active'),
        filter: String(req.query.filter || 'all'),
        search: String(req.query.search || ''),
        page: parseInt(String(req.query.page || '1'), 10),
        limit: parseInt(String(req.query.limit || '10'), 10),
        sortBy: String(req.query.sortBy || 'created_at'),
        sortDir: String(req.query.sortDir || 'DESC'),
      };

      const result = await blackboardModel.getAllEntries(
        tenantId,
        authReq.user.id,
        options as any
      );

      res.json(result);
    } catch (error: any) {
      console.error('Error in GET /api/blackboard:', error);
      res.status(500).json({ message: 'Error retrieving blackboard entries' });
    }
  }
);

/**
 * @route GET /api/blackboard/dashboard
 * @desc Get blackboard entries for dashboard widget
 */
router.get(
  '/api/blackboard/dashboard',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = getTenantId(authReq.user);
      const limit = parseInt(String(req.query.limit || '3'), 10);

      const entries = await blackboardModel.getDashboardEntries(
        tenantId,
        authReq.user.id,
        limit
      );
      res.json(entries);
    } catch (error: any) {
      console.error('Error in GET /api/blackboard/dashboard:', error);
      res.status(500).json({ message: 'Error retrieving dashboard entries' });
    }
  }
);

/**
 * @route GET /api/blackboard/:id
 * @desc Get a specific blackboard entry
 */
router.get(
  '/api/blackboard/:id',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = getTenantId(authReq.user);

      const entry = await blackboardModel.getEntryById(
        parseInt(req.params.id, 10),
        tenantId,
        authReq.user.id
      );

      if (!entry) {
        res.status(404).json({ message: 'Entry not found' });
        return;
      }

      res.json(entry);
    } catch (error: any) {
      console.error('Error in GET /api/blackboard/:id:', error);
      res.status(500).json({ message: 'Error retrieving blackboard entry' });
    }
  }
);

/**
 * @route POST /api/blackboard
 * @desc Create a new blackboard entry
 */
router.post(
  '/api/blackboard',
  authenticateToken,
  canCreateForOrgLevel,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = getTenantId(authReq.user);

      // Convert org_id to number if it's a string
      let org_id = req.body.org_id;
      if (typeof org_id === 'string') {
        org_id = parseInt(org_id, 10);
      }

      const entryData = {
        tenant_id: tenantId,
        title: req.body.title,
        content: req.body.content,
        org_level: req.body.org_level,
        org_id,
        author_id: authReq.user.id,
        expires_at: req.body.expires_at || null,
        priority: req.body.priority || 'normal',
        color: req.body.color || 'blue',
        tags: req.body.tags || [],
        requires_confirmation: req.body.requires_confirmation || false,
      };

      const entry = await blackboardModel.createEntry(entryData);
      res.status(201).json(entry);
    } catch (error: any) {
      console.error('Error in POST /api/blackboard:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        message: 'Error creating blackboard entry',
        error: error.message,
      });
    }
  }
);

/**
 * @route PUT /api/blackboard/:id
 * @desc Update a blackboard entry
 */
router.put(
  '/api/blackboard/:id',
  authenticateToken,
  canManageEntry as any,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const entryData = {
        author_id: authReq.user.id,
        title: req.body.title,
        content: req.body.content,
        org_level: req.body.org_level,
        org_id: req.body.org_id,
        priority: req.body.priority,
        color: req.body.color,
        tags: req.body.tags,
        expires_at: req.body.expires_at,
        requires_confirmation: req.body.requires_confirmation,
        status: req.body.status,
      };

      const tenantId = getTenantId(authReq.user);
      const updatedEntry = await blackboardModel.updateEntry(
        parseInt(req.params.id, 10),
        entryData,
        tenantId
      );

      res.json(updatedEntry);
    } catch (error: any) {
      console.error('Error in PUT /api/blackboard/:id:', error);
      res.status(500).json({ message: 'Error updating blackboard entry' });
    }
  }
);

/**
 * @route DELETE /api/blackboard/:id
 * @desc Delete a blackboard entry
 */
router.delete(
  '/api/blackboard/:id',
  authenticateToken,
  canManageEntry as any,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = getTenantId(authReq.user);
      const success = await blackboardModel.deleteEntry(
        parseInt(req.params.id, 10),
        tenantId
      );

      if (!success) {
        res.status(404).json({ message: 'Entry not found' });
        return;
      }

      res.json({ message: 'Entry deleted successfully' });
    } catch (error: any) {
      console.error('Error in DELETE /api/blackboard/:id:', error);
      res.status(500).json({ message: 'Error deleting blackboard entry' });
    }
  }
);

/**
 * @route POST /api/blackboard/:id/confirm
 * @desc Mark a blackboard entry as read
 */
router.post(
  '/api/blackboard/:id/confirm',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const success = await blackboardModel.confirmEntry(
        parseInt(req.params.id, 10),
        authReq.user.id
      );

      if (!success) {
        res.status(400).json({
          message: 'Entry does not exist or does not require confirmation',
        });
        return;
      }

      res.json({ message: 'Entry confirmed successfully' });
    } catch (error: any) {
      console.error('Error in POST /api/blackboard/:id/confirm:', error);
      res.status(500).json({ message: 'Error confirming blackboard entry' });
    }
  }
);

/**
 * @route GET /api/blackboard/:id/confirmations
 * @desc Get confirmation status for an entry
 */
router.get(
  '/api/blackboard/:id/confirmations',
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      // Only admins can view confirmation status
      if (authReq.user.role !== 'admin' && authReq.user.role !== 'root') {
        res
          .status(403)
          .json({ message: 'Only admins can view confirmation status' });
        return;
      }
      const tenantId = getTenantId(authReq.user);
      const confirmations = await blackboardModel.getConfirmationStatus(
        parseInt(req.params.id, 10),
        tenantId
      );

      res.json(confirmations);
    } catch (error: any) {
      console.error('Error in GET /api/blackboard/:id/confirmations:', error);
      res.status(500).json({ message: 'Error retrieving confirmation status' });
    }
  }
);

export default router;

// CommonJS compatibility
