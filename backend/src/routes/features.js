const express = require('express');
const router = express.Router();
const Feature = require('../models/feature');
const { authenticateToken, authorizeRole } = require('../auth');
const { checkFeature } = require('../middleware/features');
const { logger } = require('../utils/logger');

// Alle verfügbaren Features abrufen (öffentlich)
router.get('/available', async (req, res) => {
  try {
    const features = await Feature.findAll();
    res.json(features);
  } catch (error) {
    logger.error(`Error fetching available features: ${error.message}`);
    res.status(500).json({ error: 'Fehler beim Abrufen der Features' });
  }
});

// Features eines Tenants abrufen (authentifiziert)
router.get('/tenant/:tenantId', authenticateToken, async (req, res) => {
  try {
    // Nur Root und Admin dürfen andere Tenants einsehen
    const requestedTenantId = parseInt(req.params.tenantId);
    const userTenantId = req.tenantId;

    if (
      requestedTenantId !== userTenantId &&
      req.user.role !== 'root' &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const features = await Feature.getTenantFeatures(requestedTenantId);
    res.json(features);
  } catch (error) {
    logger.error(`Error fetching tenant features: ${error.message}`);
    res.status(500).json({ error: 'Fehler beim Abrufen der Tenant-Features' });
  }
});

// Eigene Features abrufen
router.get('/my-features', authenticateToken, async (req, res) => {
  try {
    const features = await Feature.getTenantFeatures(req.tenantId);
    res.json(features);
  } catch (error) {
    logger.error(`Error fetching my features: ${error.message}`);
    res.status(500).json({ error: 'Fehler beim Abrufen der Features' });
  }
});

// Feature aktivieren (nur Root und Admin)
router.post('/activate', authenticateToken, async (req, res) => {
  try {
    // Nur Root und Admin dürfen Features aktivieren
    if (req.user.role !== 'root' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { tenantId, featureCode, options = {} } = req.body;

    if (!tenantId || !featureCode) {
      return res
        .status(400)
        .json({ error: 'Tenant ID und Feature Code sind erforderlich' });
    }

    // Setze activatedBy
    options.activatedBy = req.user.id;

    await Feature.activateForTenant(tenantId, featureCode, options);

    logger.info(
      `Feature ${featureCode} activated for tenant ${tenantId} by user ${req.user.username}`
    );
    res.json({ message: 'Feature erfolgreich aktiviert' });
  } catch (error) {
    logger.error(`Error activating feature: ${error.message}`);
    res.status(500).json({ error: 'Fehler beim Aktivieren des Features' });
  }
});

// Feature deaktivieren (nur Root und Admin)
router.post('/deactivate', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'root' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { tenantId, featureCode } = req.body;

    if (!tenantId || !featureCode) {
      return res
        .status(400)
        .json({ error: 'Tenant ID und Feature Code sind erforderlich' });
    }

    await Feature.deactivateForTenant(tenantId, featureCode);

    logger.info(
      `Feature ${featureCode} deactivated for tenant ${tenantId} by user ${req.user.username}`
    );
    res.json({ message: 'Feature erfolgreich deaktiviert' });
  } catch (error) {
    logger.error(`Error deactivating feature: ${error.message}`);
    res.status(500).json({ error: 'Fehler beim Deaktivieren des Features' });
  }
});

// Feature-Nutzungsstatistiken abrufen
router.get('/usage/:featureCode', authenticateToken, async (req, res) => {
  try {
    const { featureCode } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: 'Start- und Enddatum sind erforderlich' });
    }

    const stats = await Feature.getUsageStats(
      req.tenantId,
      featureCode,
      startDate,
      endDate
    );
    res.json(stats);
  } catch (error) {
    logger.error(`Error fetching usage stats: ${error.message}`);
    res
      .status(500)
      .json({ error: 'Fehler beim Abrufen der Nutzungsstatistiken' });
  }
});

// Test-Route um Feature-Zugriff zu prüfen
router.get(
  '/test/:featureCode',
  authenticateToken,
  (req, res, next) => checkFeature(req.params.featureCode)(req, res, next),
  (req, res) => {
    res.json({
      message: `Zugriff auf Feature ${req.params.featureCode} gewährt`,
      feature: req.params.featureCode,
    });
  }
);

// Alle Tenants mit Features abrufen (nur Root)
router.get(
  '/all-tenants',
  authenticateToken,
  authorizeRole('root'),
  async (req, res) => {
    try {
      const db = require('../database');

      // Alle Tenants abrufen
      const [tenants] = await db.query(
        'SELECT id, subdomain, company_name, status FROM tenants ORDER BY company_name'
      );

      // Für jeden Tenant die aktivierten Features abrufen
      for (const tenant of tenants) {
        tenant.features = await Feature.getTenantFeatures(tenant.id);
      }

      res.json(tenants);
    } catch (error) {
      logger.error(
        `Error fetching all tenants with features: ${error.message}`
      );
      res
        .status(500)
        .json({ error: 'Fehler beim Abrufen der Tenant-Features' });
    }
  }
);

module.exports = router;
