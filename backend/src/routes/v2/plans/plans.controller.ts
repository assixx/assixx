import { Router } from 'express';

import { security } from '../../../middleware/security';
import { errorResponse, successResponse } from '../../../utils/apiResponse';
import { getErrorMessage } from '../../../utils/errorHandler';
import { typed } from '../../../utils/routeHandlers';
import { PlansService } from './plans.service';
import { plansValidation } from './plans.validation';
import type { UpdateAddonsRequest, UpgradePlanRequest } from './types';

const router = Router();

/**
 * @swagger
 * /api/v2/plans:
 *   get:
 *     summary: Get all available plans
 *     description: Retrieve all subscription plans with their features. Public endpoint - no authentication required.
 *     tags: [Plans]
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive plans in the response
 *     responses:
 *       200:
 *         description: List of plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       code:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       basePrice:
 *                         type: number
 *                       maxEmployees:
 *                         type: integer
 *                       maxAdmins:
 *                         type: integer
 *                       maxStorageGb:
 *                         type: integer
 *                       isActive:
 *                         type: boolean
 *                       features:
 *                         type: array
 *                         items:
 *                           type: object
 *                 meta:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                       example: "2.0"
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  typed.public(async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const plans = await PlansService.getAllPlans(includeInactive);

      res.json(successResponse(plans));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('PLANS_FETCH_ERROR', message));
    }
  }),
);

/**
 * @swagger
 * /api/v2/plans/current:
 *   get:
 *     summary: Get current tenant plan
 *     description: Retrieve the current subscription plan for the authenticated tenant including details, features, addons, and costs
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current plan retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     plan:
 *                       type: object
 *                     addons:
 *                       type: array
 *                     costs:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No active plan found
 */
router.get(
  '/current',
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const currentPlan = await PlansService.getCurrentPlan(tenantId);

      if (!currentPlan) {
        res.status(404).json(errorResponse('PLAN_NOT_FOUND', 'No active plan found'));
        return;
      }

      res.json(successResponse(currentPlan));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('CURRENT_PLAN_ERROR', message));
    }
  }),
);

/**
 * @swagger
 * /api/v2/plans/addons:
 *   get:
 *     summary: Get tenant addons
 *     description: Retrieve current addons for the authenticated tenant
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Addons retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     employees:
 *                       type: integer
 *                     admins:
 *                       type: integer
 *                     storageGb:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/addons',
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const addons = await PlansService.getTenantAddons(tenantId);

      res.json(successResponse(addons));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('ADDONS_FETCH_ERROR', message));
    }
  }),
);

/**
 * @swagger
 * /api/v2/plans/addons:
 *   put:
 *     summary: Update tenant addons
 *     description: Update addon quantities for the authenticated tenant
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               employees:
 *                 type: integer
 *                 minimum: 0
 *               admins:
 *                 type: integer
 *                 minimum: 0
 *               storageGb:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Addons updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     employees:
 *                       type: integer
 *                     admins:
 *                       type: integer
 *                     storageGb:
 *                       type: integer
 *                 meta:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Addons updated successfully"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.put(
  '/addons',
  ...security.admin(),
  plansValidation.updateAddons,
  typed.body<UpdateAddonsRequest>(async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const result = await PlansService.updateAddons(tenantId, req.body, req.user.id);

      res.json(successResponse(result));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('ADDONS_UPDATE_ERROR', message));
    }
  }),
);

/**
 * @swagger
 * /api/v2/plans/costs:
 *   get:
 *     summary: Calculate tenant costs
 *     description: Calculate current monthly costs for the authenticated tenant
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Costs calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     basePlanCost:
 *                       type: number
 *                     addonCosts:
 *                       type: object
 *                       properties:
 *                         employees:
 *                           type: number
 *                         admins:
 *                           type: number
 *                         storage:
 *                           type: number
 *                     totalMonthlyCost:
 *                       type: number
 *                     currency:
 *                       type: string
 *                       example: "EUR"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/costs',
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const costs = await PlansService.calculateCosts(tenantId);

      res.json(successResponse(costs));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('COSTS_CALC_ERROR', message));
    }
  }),
);

/**
 * @swagger
 * /api/v2/plans/{id}:
 *   get:
 *     summary: Get plan by ID
 *     description: Retrieve a specific plan by its ID
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     code:
 *                       type: string
 *                     name:
 *                       type: string
 *                     basePrice:
 *                       type: number
 *                     features:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Invalid plan ID
 *       404:
 *         description: Plan not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  plansValidation.getPlanById,
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const planId = Number.parseInt(req.params.id, 10);
      const plan = await PlansService.getPlanById(planId);

      if (!plan) {
        res.status(404).json(errorResponse('PLAN_NOT_FOUND', 'Plan not found'));
        return;
      }

      res.json(successResponse(plan));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('PLAN_FETCH_ERROR', message));
    }
  }),
);

/**
 * @swagger
 * /api/v2/plans/{id}/features:
 *   get:
 *     summary: Get plan features
 *     description: Retrieve all features included in a specific plan
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Features retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       planId:
 *                         type: integer
 *                       featureId:
 *                         type: integer
 *                       featureCode:
 *                         type: string
 *                       featureName:
 *                         type: string
 *                       isIncluded:
 *                         type: boolean
 *       400:
 *         description: Invalid plan ID
 *       500:
 *         description: Server error
 */
router.get(
  '/:id/features',
  plansValidation.getPlanById,
  typed.params<{ id: string }>(async (req, res) => {
    try {
      const planId = Number.parseInt(req.params.id, 10);
      const features = await PlansService.getPlanFeatures(planId);

      res.json(successResponse(features));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('FEATURES_FETCH_ERROR', message));
    }
  }),
);

/**
 * @swagger
 * /api/v2/plans/{id}/upgrade:
 *   put:
 *     summary: Upgrade or downgrade plan
 *     description: Change the subscription plan for the authenticated tenant
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPlanCode
 *             properties:
 *               newPlanCode:
 *                 type: string
 *                 description: Code of the new plan
 *               effectiveDate:
 *                 type: string
 *                 format: date-time
 *                 description: When the change should take effect
 *     responses:
 *       200:
 *         description: Plan upgraded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Updated plan information
 *                 meta:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Plan changed successfully"
 *       400:
 *         description: Invalid request or validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error or upgrade failed
 */
router.put(
  '/:id/upgrade',
  ...security.admin(),
  plansValidation.upgradePlan,
  typed.body<UpgradePlanRequest>(async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const { newPlanCode, effectiveDate } = req.body;

      const result = await PlansService.upgradePlan(
        tenantId,
        newPlanCode,
        effectiveDate ? new Date(effectiveDate) : undefined,
        req.user.id,
      );

      res.json(successResponse(result));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      res.status(500).json(errorResponse('PLAN_UPGRADE_ERROR', message));
    }
  }),
);

export default router;
