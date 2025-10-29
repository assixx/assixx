/**
 * Teams v2 API Routes
 * RESTful endpoints for team management
 *

 * tags:
 *   name: Teams v2
 *   description: Team management API v2
 */
import { RequestHandler, Response, Router } from 'express';

import { authenticateV2, requireRoleV2 } from '../../../middleware/v2/auth.middleware';
import type { AuthenticatedRequest } from '../../../types/request.types';
import { typed } from '../../../utils/routeHandlers';
import { teamsController } from './teams.controller';
import { teamsValidationZod } from './teams.validation.zod';

const router = Router();

/**

 * /api/v2/teams:
 *   get:
 *     summary: List all teams
 *     tags: [Teams v2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: integer
 *         description: Filter by department ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search teams by name or description
 *       - in: query
 *         name: includeMembers
 *         schema:
 *           type: boolean
 *         description: Include member count in response
 *     responses:
 *       200:
 *         description: List of teams
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeamsListResponseV2'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedV2'
 */
router.get(
  '/',
  authenticateV2,
  teamsValidationZod.list,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.listTeams(req, res);
  }),
);

/**

 * /api/v2/teams/\{id\}:
 *   get:
 *     summary: Get team by ID
 *     tags: [Teams v2]
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
 *         description: Team details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeamResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.get(
  '/:id',
  authenticateV2,
  teamsValidationZod.getById,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.getTeamById(req, res);
  }),
);

/**

 * /api/v2/teams:
 *   post:
 *     summary: Create new team
 *     tags: [Teams v2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTeamRequestV2'
 *     responses:
 *       201:
 *         description: Team created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeamResponseV2'
 *       400:
 *         $ref: '#/components/responses/BadRequestV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 */
router.post(
  '/',
  authenticateV2,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  teamsValidationZod.create,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.createTeam(req, res);
  }),
);

/**

 * /api/v2/teams/\{id\}:
 *   put:
 *     summary: Update team
 *     tags: [Teams v2]
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
 *             $ref: '#/components/schemas/UpdateTeamRequestV2'
 *     responses:
 *       200:
 *         description: Team updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeamResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 */
router.put(
  '/:id',
  authenticateV2,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  teamsValidationZod.update,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.updateTeam(req, res);
  }),
);

/**

 * /api/v2/teams/\{id\}:
 *   delete:
 *     summary: Delete team
 *     tags: [Teams v2]
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
 *               $ref: '#/components/schemas/SuccessMessageResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       400:
 *         description: Cannot delete team with members
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 */
router.delete(
  '/:id',
  authenticateV2,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  teamsValidationZod.delete,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.deleteTeam(req, res);
  }),
);

/**

 * /api/v2/teams/\{id\}/members:
 *   get:
 *     summary: Get team members
 *     tags: [Teams v2]
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
 *         description: List of team members
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeamMembersResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.get(
  '/:id/members',
  authenticateV2,
  teamsValidationZod.getMembers,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.getTeamMembers(req, res);
  }),
);

/**

 * /api/v2/teams/\{id\}/members:
 *   post:
 *     summary: Add member to team
 *     tags: [Teams v2]
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
 *     responses:
 *       201:
 *         description: Member added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       400:
 *         description: Invalid user ID or user already in team
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 */
router.post(
  '/:id/members',
  authenticateV2,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  teamsValidationZod.addMember,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.addTeamMember(req, res);
  }),
);

/**

 * /api/v2/teams/\{id\}/members/\{userId\}:
 *   delete:
 *     summary: Remove member from team
 *     tags: [Teams v2]
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
 *         description: Member removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       400:
 *         description: User is not a member of this team
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 */
router.delete(
  '/:id/members/:userId',
  authenticateV2,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  teamsValidationZod.removeMember,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.removeTeamMember(req, res);
  }),
);

/**

 * /api/v2/teams/\{id\}/machines:
 *   get:
 *     summary: Get team machines
 *     tags: [Teams v2]
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
 *         description: Team machines retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   serial_number:
 *                     type: string
 *                   status:
 *                     type: string
 *                   is_primary:
 *                     type: boolean
 *                   assigned_at:
 *                     type: string
 *                     format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 */
router.get(
  '/:id/machines',
  authenticateV2,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  teamsValidationZod.getMembers,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.getTeamMachines(req, res);
  }),
);

/**

 * /api/v2/teams/\{id\}/machines:
 *   post:
 *     summary: Add machine to team
 *     tags: [Teams v2]
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
 *               - machineId
 *             properties:
 *               machineId:
 *                 type: integer
 *                 description: Machine ID to add to team
 *     responses:
 *       201:
 *         description: Machine added to team successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponseV2'
 *       409:
 *         description: Machine already assigned to this team
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 */
router.post(
  '/:id/machines',
  authenticateV2,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  teamsValidationZod.addMachine,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.addTeamMachine(req, res);
  }),
);

/**

 * /api/v2/teams/\{id\}/machines/\{machineId\}:
 *   delete:
 *     summary: Remove machine from team
 *     tags: [Teams v2]
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
 *         name: machineId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Machine ID to remove
 *     responses:
 *       200:
 *         description: Machine removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponseV2'
 *       404:
 *         $ref: '#/components/responses/NotFoundV2'
 *       403:
 *         $ref: '#/components/responses/ForbiddenV2'
 */
router.delete(
  '/:id/machines/:machineId',
  authenticateV2,
  requireRoleV2(['admin', 'root']) as RequestHandler,
  teamsValidationZod.removeMachine,
  typed.auth(async (req: AuthenticatedRequest, res: Response) => {
    await teamsController.removeTeamMachine(req, res);
  }),
);

export default router;
