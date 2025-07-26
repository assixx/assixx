/**
 * Teams API Routes
 * Handles team management operations and team member management
 * @swagger
 * tags:
 *   name: Teams
 *   description: Team management and team member operations
 */

import express, { Router, Request, Response, NextFunction } from "express";

const router: Router = express.Router();

import { authenticateToken } from "../auth";
import Department from "../models/department";
import Team from "../models/team";
import User from "../models/user";
import { getErrorMessage } from "../utils/errorHandler";
import { logger } from "../utils/logger";
/**
 * Teams API Routes
 * Handles team management operations and team member management
 * @swagger
 * tags:
 *   name: Teams
 *   description: Team management and team member operations
 */

// Import models (now ES modules)
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
  if (req.method === "GET") {
    next();
  } else if (
    (req as AuthenticatedRequest).user.role === "admin" ||
    (req as AuthenticatedRequest).user.role === "root"
  ) {
    // Only admins and root can create, update, delete
    next();
  } else {
    res.status(403).json({ message: "Zugriff verweigert" });
  }
});

/**
 * @swagger
 * /teams:
 *   post:
 *     summary: Create a new team
 *     description: Create a new team (Admin/Root only)
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Team name
 *                 example: DevOps Team
 *               description:
 *                 type: string
 *                 description: Team description
 *                 example: Verantwortlich für CI/CD und Infrastruktur
 *               department_id:
 *                 type: integer
 *                 description: Department ID this team belongs to
 *                 example: 2
 *               leader_id:
 *                 type: integer
 *                 description: User ID of team leader
 *                 example: 15
 *               max_members:
 *                 type: integer
 *                 description: Maximum team size
 *                 example: 10
 *               location:
 *                 type: string
 *                 description: Team location
 *                 example: Gebäude B, Raum 201
 *               budget:
 *                 type: number
 *                 description: Team budget
 *                 example: 50000
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 description: Whether team is active
 *               goals:
 *                 type: string
 *                 description: Team goals and objectives
 *     responses:
 *       201:
 *         description: Team created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team erfolgreich erstellt
 *                 teamId:
 *                   type: integer
 *                   example: 8
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Teamname ist erforderlich
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not admin/root
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Zugriff verweigert
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Create team
router.post("/", async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, department_id, leader_id } = req.body;

    if (!name) {
      res.status(400).json({ message: "Teamname ist erforderlich" });
      return;
    }

    // If a department is specified, check if it exists
    if (department_id) {
      const department = await Department.findById(
        department_id,
        authReq.user.tenant_id,
      );
      if (!department) {
        res
          .status(400)
          .json({ message: "Die angegebene Abteilung existiert nicht" });
        return;
      }
    }

    // If a team leader is specified, check if they exist
    if (leader_id) {
      const leader = await User.findById(leader_id, authReq.user.tenant_id);
      if (!leader) {
        res
          .status(400)
          .json({ message: "Der angegebene Teamleiter existiert nicht" });
        return;
      }
    }

    const teamId = await Team.create({
      ...req.body,
      tenant_id: authReq.user.tenant_id,
    });

    logger.info(
      `Team created with ID ${teamId} by user ${authReq.user.username}`,
    );

    res.status(201).json({
      message: "Team erfolgreich erstellt",
      teamId,
    });
  } catch (error) {
    logger.error(`Error creating team: ${getErrorMessage(error)}`);
    res.status(500).json({
      message: "Fehler beim Erstellen des Teams",
      error: getErrorMessage(error),
    });
  }
});

/**
 * @swagger
 * /teams:
 *   get:
 *     summary: Get all teams
 *     description: Retrieve all teams for the tenant
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Teams retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Team'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all teams
router.get("/", async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const teams = await Team.findAll(authReq.user.tenant_id);
    res.json(teams);
  } catch (error) {
    logger.error(`Error fetching teams: ${getErrorMessage(error)}`);
    res.status(500).json({
      message: "Fehler beim Abrufen der Teams",
      error: getErrorMessage(error),
    });
  }
});

/**
 * @swagger
 * /teams/{id}:
 *   get:
 *     summary: Get team by ID
 *     description: Retrieve a specific team by its ID
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Team'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Team not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get single team
router.get("/:id", async (req, res): Promise<void> => {
  try {
    // const authReq = req as AuthenticatedRequest;
    const team = await Team.findById(parseInt(req.params.id, 10));

    if (!team) {
      res.status(404).json({ message: "Team nicht gefunden" });
      return;
    }

    res.json(team);
  } catch (error) {
    logger.error(
      `Error fetching team ${req.params.id}: ${getErrorMessage(error)}`,
    );
    res.status(500).json({
      message: "Fehler beim Abrufen des Teams",
      error: getErrorMessage(error),
    });
  }
});

/**
 * @swagger
 * /teams/{id}:
 *   put:
 *     summary: Update team
 *     description: Update an existing team (Admin/Root only)
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Team name
 *               description:
 *                 type: string
 *                 description: Team description
 *               department_id:
 *                 type: integer
 *                 description: Department ID
 *               leader_id:
 *                 type: integer
 *                 description: Team leader user ID
 *               max_members:
 *                 type: integer
 *                 description: Maximum team size
 *               location:
 *                 type: string
 *                 description: Team location
 *               budget:
 *                 type: number
 *                 description: Team budget
 *               is_active:
 *                 type: boolean
 *                 description: Whether team is active
 *               goals:
 *                 type: string
 *                 description: Team goals
 *     responses:
 *       200:
 *         description: Team updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team erfolgreich aktualisiert
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Teamname ist erforderlich
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not admin/root
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Zugriff verweigert
 *       404:
 *         description: Team not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Update team
router.put("/:id", authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, department_id, leader_id } = req.body;
    const teamId = parseInt(req.params.id, 10);

    // Check if team exists
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ message: "Team nicht gefunden" });
      return;
    }

    if (name !== undefined && !name) {
      res.status(400).json({ message: "Teamname ist erforderlich" });
      return;
    }

    // If a department is specified, check if it exists
    if (department_id) {
      const department = await Department.findById(
        department_id,
        authReq.user.tenant_id,
      );
      if (!department) {
        res
          .status(400)
          .json({ message: "Die angegebene Abteilung existiert nicht" });
        return;
      }
    }

    // If a team leader is specified, check if they exist
    if (leader_id) {
      const leader = await User.findById(leader_id, authReq.user.tenant_id);
      if (!leader) {
        res
          .status(400)
          .json({ message: "Der angegebene Teamleiter existiert nicht" });
        return;
      }
    }

    const success = await Team.update(teamId, req.body);

    if (success) {
      logger.info(`Team ${teamId} updated by user ${authReq.user.username}`);
      res.json({ message: "Team erfolgreich aktualisiert" });
    } else {
      logger.warn(`Failed to update team ${teamId}`);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Teams" });
    }
  } catch (error) {
    logger.error(
      `Error updating team ${req.params.id}: ${getErrorMessage(error)}`,
    );
    res.status(500).json({
      message: "Fehler beim Aktualisieren des Teams",
      error: getErrorMessage(error),
    });
  }
});

/**
 * @swagger
 * /teams/{id}:
 *   delete:
 *     summary: Delete team
 *     description: Delete a team (Admin/Root only)
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team erfolgreich gelöscht
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not admin/root
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Zugriff verweigert
 *       404:
 *         description: Team not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Delete team
router.delete("/:id", authenticateToken, async (req, res): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const teamId = parseInt(req.params.id, 10);

    // Check if team exists
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ message: "Team nicht gefunden" });
      return;
    }

    const success = await Team.delete(teamId);

    if (success) {
      logger.info(`Team ${teamId} deleted by user ${authReq.user.username}`);
      res.json({ message: "Team erfolgreich gelöscht" });
    } else {
      logger.warn(`Failed to delete team ${teamId}`);
      res.status(500).json({ message: "Fehler beim Löschen des Teams" });
    }
  } catch (error) {
    logger.error(
      `Error deleting team ${req.params.id}: ${getErrorMessage(error)}`,
    );
    res.status(500).json({
      message: "Fehler beim Löschen des Teams",
      error: getErrorMessage(error),
    });
  }
});

/**
 * @swagger
 * /teams/{id}/members:
 *   get:
 *     summary: Get team members
 *     description: Retrieve all members of a specific team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   username:
 *                     type: string
 *                   email:
 *                     type: string
 *                   first_name:
 *                     type: string
 *                   last_name:
 *                     type: string
 *                   role:
 *                     type: string
 *                     enum: [root, admin, employee]
 *                   position:
 *                     type: string
 *                   joined_at:
 *                     type: string
 *                     format: date-time
 *                   is_leader:
 *                     type: boolean
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Team not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get team members
router.get("/:id/members", async (req, res): Promise<void> => {
  try {
    // const authReq = req as AuthenticatedRequest;
    const teamId = parseInt(req.params.id, 10);

    // Check if team exists
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ message: "Team nicht gefunden" });
      return;
    }

    const members = await Team.getTeamMembers(teamId);
    res.json(members);
  } catch (error) {
    logger.error(
      `Error fetching members for team ${req.params.id}: ${getErrorMessage(error)}`,
    );
    res.status(500).json({
      message: "Fehler beim Abrufen der Teammitglieder",
      error: getErrorMessage(error),
    });
  }
});

/**
 * @swagger
 * /teams/{id}/members:
 *   post:
 *     summary: Add user to team
 *     description: Add a user to a team (Admin/Root only)
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID to add to team
 *                 example: 42
 *     responses:
 *       200:
 *         description: User added to team successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Benutzer erfolgreich zum Team hinzugefügt
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Benutzer-ID ist erforderlich
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not admin/root
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Zugriff verweigert
 *       404:
 *         description: Team or user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team nicht gefunden
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Add user to team
router.post(
  "/:id/members",
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const teamId = parseInt(req.params.id, 10);
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({ message: "Benutzer-ID ist erforderlich" });
        return;
      }

      // Check if team exists
      const team = await Team.findById(teamId);

      if (!team) {
        res.status(404).json({ message: "Team nicht gefunden" });
        return;
      }

      // Check if user exists
      const user = await User.findById(userId, authReq.user.tenant_id);

      if (!user) {
        res.status(404).json({ message: "Benutzer nicht gefunden" });
        return;
      }

      const success = await Team.addUserToTeam(parseInt(userId, 10), teamId);

      if (success) {
        logger.info(
          `User ${userId} added to team ${teamId} by user ${authReq.user.username}`,
        );
        res.json({ message: "Benutzer erfolgreich zum Team hinzugefügt" });
      } else {
        logger.warn(`Failed to add user ${userId} to team ${teamId}`);
        res
          .status(500)
          .json({ message: "Fehler beim Hinzufügen des Benutzers zum Team" });
      }
    } catch (error) {
      logger.error(
        `Error adding user to team ${req.params.id}: ${getErrorMessage(error)}`,
      );
      res.status(500).json({
        message: "Fehler beim Hinzufügen des Benutzers zum Team",
        error: getErrorMessage(error),
      });
    }
  },
);

/**
 * @swagger
 * /teams/{id}/members/{userId}:
 *   delete:
 *     summary: Remove user from team
 *     description: Remove a user from a team (Admin/Root only)
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to remove
 *     responses:
 *       200:
 *         description: User removed from team successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Benutzer erfolgreich aus dem Team entfernt
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Not admin/root
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Zugriff verweigert
 *       404:
 *         description: Team, user, or membership not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Benutzer ist kein Mitglied dieses Teams
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Remove user from team
router.delete(
  "/:id/members/:userId",
  authenticateToken,
  async (req, res): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const teamId = parseInt(req.params.id, 10);
      const userId = parseInt(req.params.userId, 10);

      // Check if team exists
      const team = await Team.findById(teamId);

      if (!team) {
        res.status(404).json({ message: "Team nicht gefunden" });
        return;
      }

      // Check if user exists
      const user = await User.findById(userId, authReq.user.tenant_id);

      if (!user) {
        res.status(404).json({ message: "Benutzer nicht gefunden" });
        return;
      }

      const success = await Team.removeUserFromTeam(userId, teamId);

      if (success) {
        logger.info(
          `User ${userId} removed from team ${teamId} by user ${authReq.user.username}`,
        );
        res.json({ message: "Benutzer erfolgreich aus dem Team entfernt" });
      } else {
        logger.info(`User ${userId} is not a member of team ${teamId}`);
        res
          .status(404)
          .json({ message: "Benutzer ist kein Mitglied dieses Teams" });
      }
    } catch (error) {
      logger.error(
        `Error removing user from team ${req.params.id}: ${getErrorMessage(error)}`,
      );
      res.status(500).json({
        message: "Fehler beim Entfernen des Benutzers aus dem Team",
        error: getErrorMessage(error),
      });
    }
  },
);

export default router;

// CommonJS compatibility
