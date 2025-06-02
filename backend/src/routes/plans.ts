import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { Plan } from '../models/plan';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types/request.types';

const router = express.Router();

// Test route
router.get('/test', (_req, res) => {
  res.json({ message: 'Plans API is working!' });
});

// Simple available route  
router.get('/simple', async (_req, res) => {
  try {
    res.json([
      {
        id: 1,
        code: 'basic',
        name: 'Basic',
        description: 'Perfekt für kleine Teams und Startups',
        base_price: 49.00,
        max_employees: 10,
        max_admins: 1,
        features: [
          { feature_code: 'basic_employees', feature_name: 'Mitarbeiterverwaltung' },
          { feature_code: 'document_upload', feature_name: 'Dokumentenverwaltung' }
        ]
      },
      {
        id: 2,
        code: 'professional', 
        name: 'Professional',
        description: 'Für wachsende Unternehmen',
        base_price: 149.00,
        max_employees: 50,
        max_admins: 3,
        features: [
          { feature_code: 'basic_employees', feature_name: 'Mitarbeiterverwaltung' },
          { feature_code: 'document_upload', feature_name: 'Dokumentenverwaltung' },
          { feature_code: 'blackboard', feature_name: 'Schwarzes Brett' },
          { feature_code: 'chat', feature_name: 'Chat System' },
          { feature_code: 'calendar', feature_name: 'Firmenkalender' }
        ]
      },
      {
        id: 3,
        code: 'enterprise',
        name: 'Enterprise', 
        description: 'Für große Organisationen',
        base_price: 299.00,
        max_employees: null,
        max_admins: null,
        features: [
          { feature_code: 'all', feature_name: 'Alle Features' }
        ]
      }
    ]);
  } catch (error) {
    console.error('Simple route error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// Get all available plans (public)
router.get('/available', async (_req, res) => {
  try {
    console.log('[DEBUG] Plans route - starting');
    
    // Direct database query to bypass the issue
    const pool = (await import('../database')).default;
    const query = `
      SELECT * FROM plans 
      WHERE is_active = true 
      ORDER BY sort_order ASC
    `;
    const [plans] = await (pool as any).execute(query);
    console.log('[DEBUG] Plans fetched directly:', plans);
    
    // Add feature information to each plan
    const plansWithFeatures = await Promise.all(
      plans.map(async (plan: any) => {
        const features = await Plan.getPlanFeatures(plan.id);
        return {
          ...plan,
          features: features.filter(f => f.is_included)
        };
      })
    );

    res.json(plansWithFeatures);
  } catch (error) {
    logger.error(`Error fetching plans: ${(error as Error).message}`);
    res.status(500).json({ error: 'Fehler beim Abrufen der Pläne' });
  }
});

// Get current plan for authenticated tenant
router.get('/current', authenticateToken as any, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.user?.tenantId;
    
    const currentPlan = await Plan.getTenantPlan(tenantId);
    if (!currentPlan) {
      res.status(404).json({ error: 'Kein aktiver Plan gefunden' });
      return;
    }

    // Get plan details and features
    const plan = await Plan.findByCode(currentPlan.plan_code);
    const features = await Plan.getPlanFeatures(currentPlan.plan_id);
    const addons = await Plan.getTenantAddons(tenantId);
    const costs = await Plan.calculateTenantCost(tenantId);

    res.json({
      plan: {
        ...currentPlan,
        details: plan,
        features: features.filter(f => f.is_included)
      },
      addons,
      costs
    });
  } catch (error) {
    logger.error(`Error fetching current plan: ${(error as Error).message}`);
    res.status(500).json({ error: 'Fehler beim Abrufen des aktuellen Plans' });
  }
});

// Get plan for specific tenant (root only)
router.get('/tenant/:tenantId', authenticateToken as any, async (req: any, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Only root can view other tenants' plans
    if (authReq.user.role !== 'root') {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }

    const tenantId = parseInt(req.params.tenantId, 10);
    
    const currentPlan = await Plan.getTenantPlan(tenantId);
    if (!currentPlan) {
      res.status(404).json({ error: 'Kein aktiver Plan gefunden' });
      return;
    }

    const plan = await Plan.findByCode(currentPlan.plan_code);
    const features = await Plan.getPlanFeatures(currentPlan.plan_id);
    const addons = await Plan.getTenantAddons(tenantId);
    const costs = await Plan.calculateTenantCost(tenantId);

    res.json({
      plan: {
        ...currentPlan,
        details: plan,
        features: features.filter(f => f.is_included)
      },
      addons,
      costs
    });
  } catch (error) {
    logger.error(`Error fetching tenant plan: ${(error as Error).message}`);
    res.status(500).json({ error: 'Fehler beim Abrufen des Tenant-Plans' });
  }
});

// Change plan (root and admin only)
router.post('/change', authenticateToken as any, async (req: any, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Only root and admin can change plans
    if (authReq.user.role !== 'root' && authReq.user.role !== 'admin') {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }

    const { tenantId, newPlanCode, effectiveDate } = req.body;

    if (!tenantId || !newPlanCode) {
      res.status(400).json({ 
        error: 'Tenant ID und neuer Plan-Code sind erforderlich' 
      });
      return;
    }

    // For admin, can only change own tenant's plan
    const userTenantId = req.user?.tenant_id || req.user?.tenantId;
    if (authReq.user.role === 'admin' && tenantId !== userTenantId) {
      res.status(403).json({ 
        error: 'Admins können nur den Plan ihrer eigenen Organisation ändern' 
      });
      return;
    }

    await Plan.changeTenantPlan({
      tenantId,
      newPlanCode,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined
    });

    // Get updated plan info
    const updatedPlan = await Plan.getTenantPlan(tenantId);
    const costs = await Plan.calculateTenantCost(tenantId);

    res.json({
      success: true,
      message: 'Plan erfolgreich geändert',
      plan: updatedPlan,
      costs
    });
  } catch (error) {
    logger.error(`Error changing plan: ${(error as Error).message}`);
    res.status(500).json({ error: 'Fehler beim Ändern des Plans' });
  }
});

// Get addons for authenticated tenant
router.get('/addons', authenticateToken as any, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.user?.tenantId;
    const addons = await Plan.getTenantAddons(tenantId);
    
    res.json(addons);
  } catch (error) {
    logger.error(`Error fetching addons: ${(error as Error).message}`);
    res.status(500).json({ error: 'Fehler beim Abrufen der Add-ons' });
  }
});

// Update addons (root and admin only)
router.post('/addons', authenticateToken as any, async (req: any, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Only root and admin can update addons
    if (authReq.user.role !== 'root' && authReq.user.role !== 'admin') {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }

    const { tenantId, addons } = req.body;

    if (!tenantId || !addons) {
      res.status(400).json({ 
        error: 'Tenant ID und Add-ons sind erforderlich' 
      });
      return;
    }

    // For admin, can only update own tenant's addons
    const userTenantId = req.user?.tenant_id || req.user?.tenantId;
    if (authReq.user.role === 'admin' && tenantId !== userTenantId) {
      res.status(403).json({ 
        error: 'Admins können nur Add-ons ihrer eigenen Organisation ändern' 
      });
      return;
    }

    // Validate addon quantities
    if (addons.employees !== undefined && addons.employees < 0) {
      res.status(400).json({ error: 'Mitarbeiter-Anzahl kann nicht negativ sein' });
      return;
    }
    if (addons.admins !== undefined && addons.admins < 0) {
      res.status(400).json({ error: 'Admin-Anzahl kann nicht negativ sein' });
      return;
    }
    if (addons.storage_gb !== undefined && addons.storage_gb < 0) {
      res.status(400).json({ error: 'Speicher kann nicht negativ sein' });
      return;
    }

    await Plan.updateTenantAddons({
      tenantId,
      addons
    });

    // Get updated addons and costs
    const updatedAddons = await Plan.getTenantAddons(tenantId);
    const costs = await Plan.calculateTenantCost(tenantId);

    res.json({
      success: true,
      message: 'Add-ons erfolgreich aktualisiert',
      addons: updatedAddons,
      costs
    });
  } catch (error) {
    logger.error(`Error updating addons: ${(error as Error).message}`);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Add-ons' });
  }
});

// Calculate costs for a tenant
router.get('/costs/:tenantId', authenticateToken as any, async (req: any, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = parseInt(req.params.tenantId, 10);
    
    // Only root can view other tenants' costs, others can only see their own
    const userTenantId = req.user?.tenant_id || req.user?.tenantId;
    if (authReq.user.role !== 'root' && tenantId !== userTenantId) {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }

    const costs = await Plan.calculateTenantCost(tenantId);
    res.json(costs);
  } catch (error) {
    logger.error(`Error calculating costs: ${(error as Error).message}`);
    res.status(500).json({ error: 'Fehler beim Berechnen der Kosten' });
  }
});

export default router;