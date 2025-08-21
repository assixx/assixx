import express, { Router } from 'express';
import { body, param } from 'express-validator';
import { RowDataPacket } from 'mysql2';

import { security } from '../middleware/security';
import { createValidation } from '../middleware/validation';
import Plan from '../models/plan';
import { errorResponse, successResponse } from '../types/response.types';
import { logger } from '../utils/logger';
import { typed } from '../utils/routeHandlers';

const router: Router = express.Router();

// Request body interfaces
interface ChangePlanBody {
  tenantId: number;
  newPlanCode: string;
  effectiveDate?: string;
}

interface UpdateAddonsBody {
  tenantId: number;
  addons: {
    employees?: number;
    admins?: number;
    storage_gb?: number;
  };
}

// Validation schemas
const changePlanValidation = createValidation([
  body('tenantId').isInt({ min: 1 }).withMessage('Ungültige Tenant-ID'),
  body('newPlanCode').notEmpty().trim().withMessage('Plan-Code ist erforderlich'),
  body('effectiveDate').optional().isISO8601(),
]);

const updateAddonsValidation = createValidation([
  body('tenantId').isInt({ min: 1 }).withMessage('Ungültige Tenant-ID'),
  body('addons').isObject().withMessage('Add-ons müssen ein Objekt sein'),
  body('addons.employees')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Mitarbeiter-Anzahl muss positiv sein'),
  body('addons.admins').optional().isInt({ min: 0 }).withMessage('Admin-Anzahl muss positiv sein'),
  body('addons.storage_gb')
    .optional()
    .isNumeric({ no_symbols: true })
    .withMessage('Speicher muss positiv sein'),
]);

// Test route
router.get(
  '/test',
  typed.public((_req, res) => {
    res.json(successResponse({ message: 'Plans API is working!' }));
  }),
);

// Simple available route
router.get(
  '/simple',
  typed.public((_req, res) => {
    try {
      res.json(
        successResponse([
          {
            id: 1,
            code: 'basic',
            name: 'Basic',
            description: 'Perfekt für kleine Teams und Startups',
            base_price: 49.0,
            max_employees: 10,
            max_admins: 1,
            features: [
              {
                feature_code: 'basic_employees',
                feature_name: 'Mitarbeiterverwaltung',
              },
              {
                feature_code: 'document_upload',
                feature_name: 'Dokumentenverwaltung',
              },
            ],
          },
          {
            id: 2,
            code: 'professional',
            name: 'Professional',
            description: 'Für wachsende Unternehmen',
            base_price: 149.0,
            max_employees: 50,
            max_admins: 3,
            features: [
              {
                feature_code: 'basic_employees',
                feature_name: 'Mitarbeiterverwaltung',
              },
              {
                feature_code: 'document_upload',
                feature_name: 'Dokumentenverwaltung',
              },
              { feature_code: 'blackboard', feature_name: 'Schwarzes Brett' },
              { feature_code: 'chat', feature_name: 'Chat System' },
              { feature_code: 'calendar', feature_name: 'Firmenkalender' },
            ],
          },
          {
            id: 3,
            code: 'enterprise',
            name: 'Enterprise',
            description: 'Für große Organisationen',
            base_price: 299.0,
            max_employees: null,
            max_admins: null,
            features: [{ feature_code: 'all', feature_name: 'Alle Features' }],
          },
        ]),
      );
    } catch (error: unknown) {
      console.error('Simple route error:', error);
      res.status(500).json(errorResponse('Fehler beim Abrufen der Pläne', 500));
    }
  }),
);

// Get all available plans (public)
router.get(
  '/available',
  typed.public(async (_req, res) => {
    try {
      console.info('[DEBUG] Plans route - starting');

      // Direct database query to bypass the issue
      const { execute } = await import('../utils/db.js');
      const sql = `
      SELECT * FROM plans
      WHERE is_active = true
      ORDER BY sort_order ASC
    `;
      const [plans] = await execute<RowDataPacket[]>(sql);
      console.info('[DEBUG] Plans fetched directly:', plans);

      // Add feature information to each plan
      const plansWithFeatures = await Promise.all(
        plans.map(async (plan) => {
          const features = await Plan.getPlanFeatures(plan.id as number);
          return {
            ...plan,
            features: features.filter((f) => f.is_included),
          };
        }),
      );

      res.json(successResponse(plansWithFeatures));
    } catch (error: unknown) {
      logger.error(`Error fetching plans: ${(error as Error).message}`);
      res.status(500).json(errorResponse('Fehler beim Abrufen der Pläne', 500));
    }
  }),
);

// Get current plan for authenticated tenant
router.get(
  '/current',
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;

      const currentPlan = await Plan.getTenantPlan(tenantId);
      if (!currentPlan) {
        res.status(404).json(errorResponse('Kein aktiver Plan gefunden', 404));
        return;
      }

      // Get plan details and features
      const plan = await Plan.findByCode(currentPlan.plan_code);
      const features = await Plan.getPlanFeatures(currentPlan.plan_id);
      const addons = await Plan.getTenantAddons(tenantId);
      const costs = await Plan.calculateTenantCost(tenantId);

      res.json(
        successResponse({
          plan: {
            ...currentPlan,
            details: plan,
            features: features.filter((f) => f.is_included),
          },
          addons,
          costs,
        }),
      );
    } catch (error: unknown) {
      logger.error(`Error fetching current plan: ${(error as Error).message}`);
      res.status(500).json(errorResponse('Fehler beim Abrufen des aktuellen Plans', 500));
    }
  }),
);

// Get plan for specific tenant (root only)
router.get(
  '/tenant/:tenantId',
  ...security.root(
    createValidation([param('tenantId').isInt({ min: 1 }).withMessage('Ungültige Tenant-ID')]),
  ),
  typed.params<{ tenantId: string }>(async (req, res) => {
    try {
      const tenantId = Number.parseInt(req.params.tenantId, 10);

      const currentPlan = await Plan.getTenantPlan(tenantId);
      if (!currentPlan) {
        res.status(404).json(errorResponse('Kein aktiver Plan gefunden', 404));
        return;
      }

      const plan = await Plan.findByCode(currentPlan.plan_code);
      const features = await Plan.getPlanFeatures(currentPlan.plan_id);
      const addons = await Plan.getTenantAddons(tenantId);
      const costs = await Plan.calculateTenantCost(tenantId);

      res.json(
        successResponse({
          plan: {
            ...currentPlan,
            details: plan,
            features: features.filter((f) => f.is_included),
          },
          addons,
          costs,
        }),
      );
    } catch (error: unknown) {
      logger.error(`Error fetching tenant plan: ${(error as Error).message}`);
      res.status(500).json(errorResponse('Fehler beim Abrufen des Tenant-Plans', 500));
    }
  }),
);

// Change plan (root and admin only)
router.post(
  '/change',
  ...security.admin(changePlanValidation),
  typed.body<ChangePlanBody>(async (req, res) => {
    try {
      const { tenantId, newPlanCode, effectiveDate } = req.body;

      // Validation is now handled by middleware

      // For admin, can only change own tenant's plan
      const userTenantId = req.user.tenant_id;
      if (req.user.role === 'admin' && tenantId !== userTenantId) {
        res
          .status(403)
          .json(errorResponse('Admins können nur den Plan ihrer eigenen Organisation ändern', 403));
        return;
      }

      await Plan.changeTenantPlan({
        tenantId,
        newPlanCode,
        effectiveDate:
          effectiveDate != null && effectiveDate !== '' ? new Date(effectiveDate) : undefined,
      });

      // Get updated plan info
      const updatedPlan = await Plan.getTenantPlan(tenantId);
      const costs = await Plan.calculateTenantCost(tenantId);

      res.json(
        successResponse(
          {
            plan: updatedPlan,
            costs,
          },
          'Plan erfolgreich geändert',
        ),
      );
    } catch (error: unknown) {
      logger.error(`Error changing plan: ${(error as Error).message}`);
      res.status(500).json(errorResponse('Fehler beim Ändern des Plans', 500));
    }
  }),
);

// Get addons for authenticated tenant
router.get(
  '/addons',
  ...security.user(),
  typed.auth(async (req, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const addons = await Plan.getTenantAddons(tenantId);

      res.json(successResponse(addons));
    } catch (error: unknown) {
      logger.error(`Error fetching addons: ${(error as Error).message}`);
      res.status(500).json(errorResponse('Fehler beim Abrufen der Add-ons', 500));
    }
  }),
);

// Update addons (root and admin only)
router.post(
  '/addons',
  ...security.admin(updateAddonsValidation),
  typed.body<UpdateAddonsBody>(async (req, res) => {
    try {
      const { tenantId, addons } = req.body;

      // Validation is now handled by middleware

      // For admin, can only update own tenant's addons
      const userTenantId = req.user.tenant_id;
      if (req.user.role === 'admin' && tenantId !== userTenantId) {
        res
          .status(403)
          .json(errorResponse('Admins können nur Add-ons ihrer eigenen Organisation ändern', 403));
        return;
      }

      // Addon validation is now handled by middleware

      await Plan.updateTenantAddons({
        tenantId,
        addons,
      });

      // Get updated addons and costs
      const updatedAddons = await Plan.getTenantAddons(tenantId);
      const costs = await Plan.calculateTenantCost(tenantId);

      res.json(
        successResponse(
          {
            addons: updatedAddons,
            costs,
          },
          'Add-ons erfolgreich aktualisiert',
        ),
      );
    } catch (error: unknown) {
      logger.error(`Error updating addons: ${(error as Error).message}`);
      res.status(500).json(errorResponse('Fehler beim Aktualisieren der Add-ons', 500));
    }
  }),
);

// Calculate costs for a tenant
router.get(
  '/costs/:tenantId',
  ...security.user(
    createValidation([param('tenantId').isInt({ min: 1 }).withMessage('Ungültige Tenant-ID')]),
  ),
  typed.params<{ tenantId: string }>(async (req, res) => {
    try {
      const tenantId = Number.parseInt(req.params.tenantId, 10);

      // Only root can view other tenants' costs, others can only see their own
      const userTenantId = req.user.tenant_id;
      if (req.user.role !== 'root' && tenantId !== userTenantId) {
        res.status(403).json(errorResponse('Keine Berechtigung', 403));
        return;
      }

      const costs = await Plan.calculateTenantCost(tenantId);
      res.json(successResponse(costs));
    } catch (error: unknown) {
      logger.error(`Error calculating costs: ${(error as Error).message}`);
      res.status(500).json(errorResponse('Fehler beim Berechnen der Kosten', 500));
    }
  }),
);

export default router;
