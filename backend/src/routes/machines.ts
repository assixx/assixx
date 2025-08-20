/**
 * Machines Routes
 * API endpoints for machine management
 */
import express, { Request, Router } from 'express';
import { RowDataPacket } from 'mysql2/promise';

import { authenticateToken } from '../auth';
import { execute } from '../database';
import { getErrorMessage } from '../utils/errorHandler';

const router: Router = express.Router();

// Extended Request interfaces
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    tenant_id: number;
  };
}

// Removed unused interfaces - MachinesListRequest, MachineByIdRequest, MachineCreateRequest

// Machine type definition
interface Machine {
  id: number;
  name: string;
  department_id: number;
  status: string;
  description?: string;
  location?: string;
  maintenance_schedule?: string;
  created_at?: Date;
}

/**
 * Get all machines
 * GET /api/machines
 */
router.get('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;

    // Build query with optional department filter
    let query = `
      SELECT
        m.id,
        m.name,
        m.model,
        m.manufacturer,
        m.department_id,
        m.area_id,
        m.status,
        m.location,
        m.machine_type,
        d.name as department_name
      FROM machines m
      LEFT JOIN departments d ON m.department_id = d.id
      WHERE m.tenant_id = ?
        AND m.is_active = 1
    `;

    const params: (string | number)[] = [authReq.user.tenant_id];

    // Filter by department if specified
    if (req.query.department_id !== undefined && req.query.department_id !== '') {
      query += ' AND m.department_id = ?';
      params.push(Number(req.query.department_id));
    }

    query += ' ORDER BY m.name ASC';

    const [machines] = await execute<RowDataPacket[]>(query, params);

    // Return raw array for frontend compatibility
    res.json(machines);
  } catch (error: unknown) {
    console.error('[Machines] List error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching machines',
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get teams assigned to a machine
 * GET /api/machines/:machineId/teams
 */
router.get('/:machineId/teams', authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const machineId = Number(req.params.machineId);

    // Query teams via machine_teams junction table
    const query = `
      SELECT
        t.id,
        t.name,
        t.description,
        t.department_id,
        t.team_lead_id,
        mt.is_primary,
        d.name as department_name
      FROM teams t
      INNER JOIN machine_teams mt ON t.id = mt.team_id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE mt.machine_id = ?
        AND mt.tenant_id = ?
        AND t.is_active = 1
      ORDER BY mt.is_primary DESC, t.name ASC
    `;

    const [teams] = await execute<RowDataPacket[]>(query, [machineId, authReq.user.tenant_id]);

    // Return raw array for frontend compatibility
    res.json(teams);
  } catch (error: unknown) {
    console.error('[Machines] Teams list error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teams for machine',
      error: getErrorMessage(error),
    });
  }
});

/**
 * Get all machines (MOCK DATA - OLD VERSION)
 * GET /api/machines/mock
 */
router.get('/mock', authenticateToken, (req, res): void => {
  try {
    // const authReq = req as AuthenticatedRequest;
    // For now, return dummy machine data
    // In production, this would query the machines table
    const machines: Machine[] = [
      { id: 1, name: 'Anlage 01', department_id: 1, status: 'active' },
      { id: 2, name: 'Anlage 02', department_id: 1, status: 'active' },
      { id: 3, name: 'Förderband A', department_id: 2, status: 'active' },
      { id: 4, name: 'Förderband B', department_id: 2, status: 'active' },
      { id: 5, name: 'Prüfstand 01', department_id: 3, status: 'maintenance' },
      { id: 6, name: 'Prüfstand 02', department_id: 3, status: 'active' },
    ];

    // Filter by department if requested
    const departmentId = req.query.department_id;
    let filteredMachines = machines;

    if (departmentId !== undefined && departmentId !== '') {
      filteredMachines = machines.filter(
        (machine) =>
          machine.department_id ==
          Number.parseInt(
            typeof departmentId === 'string' ? departmentId
            : typeof departmentId === 'number' ? String(departmentId)
            : '0',
          ),
      );
    }

    res.json({
      success: true,
      machines: filteredMachines,
    });
  } catch (error: unknown) {
    console.error('Error fetching machines:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Maschinen',
    });
  }
});

/**
 * Get machine by ID
 * GET /api/machines/:id
 */
router.get('/:id', authenticateToken, (req, res): void => {
  try {
    // const authReq = req as AuthenticatedRequest;
    const machineId = Number.parseInt(req.params.id);

    // Dummy machine data
    const machine: Machine = {
      id: machineId,
      name: `Maschine ${String(machineId)}`,
      department_id: 1,
      status: 'active',
      description: 'Automatisch generierte Maschine',
      location: 'Halle A',
      maintenance_schedule: 'Wöchentlich',
    };

    res.json({
      success: true,
      machine,
    });
  } catch (error: unknown) {
    console.error('Error fetching machine:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Maschine',
    });
  }
});

/**
 * Create new machine (Admin only)
 * POST /api/machines
 */
router.post('/', authenticateToken, (req, res): void => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Check admin permission
    if (!['admin', 'root', 'manager'].includes(authReq.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Keine Berechtigung zum Erstellen von Maschinen',
      });
      return;
    }

    const { name, department_id, description, location } = req.body as {
      name?: string;
      department_id?: number;
      description?: string;
      location?: string;
    };

    if (name == null || name === '' || department_id == null || department_id === 0) {
      res.status(400).json({
        success: false,
        message: 'Name und Abteilung sind erforderlich',
      });
      return;
    }

    // For now, return dummy created machine
    const machine: Machine = {
      id: Date.now(),
      name: name,
      department_id: department_id,
      description: description ?? undefined,
      location: location ?? undefined,
      status: 'active',
      created_at: new Date(),
    };

    res.status(201).json({
      success: true,
      message: 'Maschine erfolgreich erstellt',
      machine,
    });
  } catch (error: unknown) {
    console.error('Error creating machine:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      message: 'Fehler beim Erstellen der Maschine',
    });
  }
});

export default router;

// CommonJS compatibility
