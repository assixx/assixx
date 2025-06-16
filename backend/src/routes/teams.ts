/**
 * Teams API Routes
 * Handles team management operations and team member management
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../auth';
import { logger } from '../utils/logger';

// Import models (now ES modules)
import Team from '../models/team';
import Department from '../models/department';
import User from '../models/user';

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

/* Unused interfaces - kept for future reference
interface TeamCreateRequest extends AuthenticatedRequest {
  body: {
    name: string;
    description?: string;
    department_id?: number;
    leader_id?: number;
    max_members?: number;
    location?: string;
    budget?: number;
    is_active?: boolean;
    goals?: string;
  };
}

interface TeamUpdateRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  body: {
    name?: string;
    description?: string;
    department_id?: number;
    leader_id?: number;
    max_members?: number;
    location?: string;
    budget?: number;
    is_active?: boolean;
    goals?: string;
  };
}

interface TeamByIdRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
}

interface TeamMemberRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  body: {
    userId: number;
  };
}

interface TeamMemberRemoveRequest extends AuthenticatedRequest {
  params: {
    id: string;
    userId: string;
  };
}
*/

// Authentication required for all routes
router.use(authenticateToken);

// Middleware for role-based access control
router.use((req: Request, res: Response, next: NextFunction): void => {
  // Allow GET requests for all authenticated users
  if (req.method === 'GET') {
    next();
  } else if (
    (req as AuthenticatedRequest).user.role === 'admin' ||
    (req as AuthenticatedRequest).user.role === 'root'
  ) {
    // Only admins and root can create, update, delete
    next();
  } else {
    res.status(403).json({ message: 'Zugriff verweigert' });
  }
});

// Create team
router.post('/', async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, department_id, leader_id } = req.body;

    if (!name) {
      res.status(400).json({ message: 'Teamname ist erforderlich' });
      return;
    }

    // If a department is specified, check if it exists
    if (department_id) {
      const department = await Department.findById(
        department_id,
        authReq.user.tenant_id
      );
      if (!department) {
        res
          .status(400)
          .json({ message: 'Die angegebene Abteilung existiert nicht' });
        return;
      }
    }

    // If a team leader is specified, check if they exist
    if (leader_id) {
      const leader = await User.findById(leader_id, authReq.user.tenant_id);
      if (!leader) {
        res
          .status(400)
          .json({ message: 'Der angegebene Teamleiter existiert nicht' });
        return;
      }
    }

    const teamId = await Team.create({
      ...req.body,
      tenant_id: authReq.user.tenant_id,
    });

    logger.info(
      `Team created with ID ${teamId} by user ${authReq.user.username}`
    );

    res.status(201).json({
      message: 'Team erfolgreich erstellt',
      teamId,
    });
  } catch (error: any) {
    logger.error(`Error creating team: ${error.message}`);
    res.status(500).json({
      message: 'Fehler beim Erstellen des Teams',
      error: error.message,
    });
  }
});

// Get all teams
router.get('/', async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const teams = await Team.findAll(authReq.user.tenant_id);
    res.json(teams);
  } catch (error: any) {
    logger.error(`Error fetching teams: ${error.message}`);
    res.status(500).json({
      message: 'Fehler beim Abrufen der Teams',
      error: error.message,
    });
  }
});

// Get single team
router.get('/:id', async (req, res): Promise<void> => {
  try {
    // const authReq = req as AuthenticatedRequest;
    const team = await Team.findById(parseInt(req.params.id, 10));

    if (!team) {
      res.status(404).json({ message: 'Team nicht gefunden' });
      return;
    }

    res.json(team);
  } catch (error: any) {
    logger.error(`Error fetching team ${req.params.id}: ${error.message}`);
    res.status(500).json({
      message: 'Fehler beim Abrufen des Teams',
      error: error.message,
    });
  }
});

// Update team
router.put('/:id', async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, department_id, leader_id } = req.body;
    const teamId = parseInt(req.params.id, 10);

    // Check if team exists
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ message: 'Team nicht gefunden' });
      return;
    }

    if (name !== undefined && !name) {
      res.status(400).json({ message: 'Teamname ist erforderlich' });
      return;
    }

    // If a department is specified, check if it exists
    if (department_id) {
      const department = await Department.findById(
        department_id,
        authReq.user.tenant_id
      );
      if (!department) {
        res
          .status(400)
          .json({ message: 'Die angegebene Abteilung existiert nicht' });
        return;
      }
    }

    // If a team leader is specified, check if they exist
    if (leader_id) {
      const leader = await User.findById(leader_id, authReq.user.tenant_id);
      if (!leader) {
        res
          .status(400)
          .json({ message: 'Der angegebene Teamleiter existiert nicht' });
        return;
      }
    }

    const success = await Team.update(teamId, req.body);

    if (success) {
      logger.info(`Team ${teamId} updated by user ${authReq.user.username}`);
      res.json({ message: 'Team erfolgreich aktualisiert' });
    } else {
      logger.warn(`Failed to update team ${teamId}`);
      res.status(500).json({ message: 'Fehler beim Aktualisieren des Teams' });
    }
  } catch (error: any) {
    logger.error(`Error updating team ${req.params.id}: ${error.message}`);
    res.status(500).json({
      message: 'Fehler beim Aktualisieren des Teams',
      error: error.message,
    });
  }
});

// Delete team
router.delete('/:id', async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const teamId = parseInt(req.params.id, 10);

    // Check if team exists
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ message: 'Team nicht gefunden' });
      return;
    }

    const success = await Team.delete(teamId);

    if (success) {
      logger.info(`Team ${teamId} deleted by user ${authReq.user.username}`);
      res.json({ message: 'Team erfolgreich gelöscht' });
    } else {
      logger.warn(`Failed to delete team ${teamId}`);
      res.status(500).json({ message: 'Fehler beim Löschen des Teams' });
    }
  } catch (error: any) {
    logger.error(`Error deleting team ${req.params.id}: ${error.message}`);
    res.status(500).json({
      message: 'Fehler beim Löschen des Teams',
      error: error.message,
    });
  }
});

// Get team members
router.get('/:id/members', async (req, res): Promise<void> => {
  try {
    // const authReq = req as AuthenticatedRequest;
    const teamId = parseInt(req.params.id, 10);

    // Check if team exists
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ message: 'Team nicht gefunden' });
      return;
    }

    const members = await Team.getTeamMembers(teamId);
    res.json(members);
  } catch (error: any) {
    logger.error(
      `Error fetching members for team ${req.params.id}: ${error.message}`
    );
    res.status(500).json({
      message: 'Fehler beim Abrufen der Teammitglieder',
      error: error.message,
    });
  }
});

// Add user to team
router.post('/:id/members', async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const teamId = parseInt(req.params.id, 10);
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ message: 'Benutzer-ID ist erforderlich' });
      return;
    }

    // Check if team exists
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ message: 'Team nicht gefunden' });
      return;
    }

    // Check if user exists
    const user = await User.findById(userId, authReq.user.tenant_id);

    if (!user) {
      res.status(404).json({ message: 'Benutzer nicht gefunden' });
      return;
    }

    const success = await Team.addUserToTeam(parseInt(userId, 10), teamId);

    if (success) {
      logger.info(
        `User ${userId} added to team ${teamId} by user ${authReq.user.username}`
      );
      res.json({ message: 'Benutzer erfolgreich zum Team hinzugefügt' });
    } else {
      logger.warn(`Failed to add user ${userId} to team ${teamId}`);
      res
        .status(500)
        .json({ message: 'Fehler beim Hinzufügen des Benutzers zum Team' });
    }
  } catch (error: any) {
    logger.error(
      `Error adding user to team ${req.params.id}: ${error.message}`
    );
    res.status(500).json({
      message: 'Fehler beim Hinzufügen des Benutzers zum Team',
      error: error.message,
    });
  }
});

// Remove user from team
router.delete('/:id/members/:userId', async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const teamId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);

    // Check if team exists
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ message: 'Team nicht gefunden' });
      return;
    }

    // Check if user exists
    const user = await User.findById(userId, authReq.user.tenant_id);

    if (!user) {
      res.status(404).json({ message: 'Benutzer nicht gefunden' });
      return;
    }

    const success = await Team.removeUserFromTeam(userId, teamId);

    if (success) {
      logger.info(
        `User ${userId} removed from team ${teamId} by user ${authReq.user.username}`
      );
      res.json({ message: 'Benutzer erfolgreich aus dem Team entfernt' });
    } else {
      logger.info(`User ${userId} is not a member of team ${teamId}`);
      res
        .status(404)
        .json({ message: 'Benutzer ist kein Mitglied dieses Teams' });
    }
  } catch (error: any) {
    logger.error(
      `Error removing user from team ${req.params.id}: ${error.message}`
    );
    res.status(500).json({
      message: 'Fehler beim Entfernen des Benutzers aus dem Team',
      error: error.message,
    });
  }
});

export default router;

// CommonJS compatibility
