/**
 * Teams v2 API Routes
 * RESTful endpoints for team management
 *
 * @swagger
 * tags:
 *   name: Teams v2
 *   description: Team management API v2
 */

import { Router, RequestHandler } from "express";

import {
  authenticateV2,
  requireRoleV2,
} from "../../../middleware/v2/auth.middleware.js";
import { typed } from "../../../utils/routeHandlers.js";

import { teamsController } from "./teams.controller.js";
import { teamsValidation } from "./teams.validation.js";

const router = Router();

/**
 * @swagger
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
  "/",
  authenticateV2,
  teamsValidation.list,
  typed.auth(teamsController.listTeams),
);

/**
 * @swagger
 * /api/v2/teams/{id}:
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
  "/:id",
  authenticateV2,
  teamsValidation.getById,
  typed.auth(teamsController.getTeamById),
);

/**
 * @swagger
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
  "/",
  authenticateV2,
  requireRoleV2(["admin", "root"]) as RequestHandler,
  teamsValidation.create,
  typed.auth(teamsController.createTeam),
);

/**
 * @swagger
 * /api/v2/teams/{id}:
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
  "/:id",
  authenticateV2,
  requireRoleV2(["admin", "root"]) as RequestHandler,
  teamsValidation.update,
  typed.auth(teamsController.updateTeam),
);

/**
 * @swagger
 * /api/v2/teams/{id}:
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
  "/:id",
  authenticateV2,
  requireRoleV2(["admin", "root"]) as RequestHandler,
  teamsValidation.delete,
  typed.auth(teamsController.deleteTeam),
);

/**
 * @swagger
 * /api/v2/teams/{id}/members:
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
  "/:id/members",
  authenticateV2,
  teamsValidation.getMembers,
  typed.auth(teamsController.getTeamMembers),
);

/**
 * @swagger
 * /api/v2/teams/{id}/members:
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
  "/:id/members",
  authenticateV2,
  requireRoleV2(["admin", "root"]) as RequestHandler,
  teamsValidation.addMember,
  typed.auth(teamsController.addTeamMember),
);

/**
 * @swagger
 * /api/v2/teams/{id}/members/{userId}:
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
  "/:id/members/:userId",
  authenticateV2,
  requireRoleV2(["admin", "root"]) as RequestHandler,
  teamsValidation.removeMember,
  typed.auth(teamsController.removeTeamMember),
);

export default router;
