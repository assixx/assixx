const Feature = require('../models/feature');
const logger = require('../utils/logger');

// Middleware um zu prüfen ob ein Tenant ein bestimmtes Feature hat
const checkFeature = (featureCode, options = {}) => {
  return async (req, res, next) => {
    try {
      // Tenant ID aus Request holen (gesetzt durch tenant middleware)
      const tenantSubdomain = req.tenantId;
      
      if (!tenantSubdomain) {
        return res.status(400).json({ 
          error: 'Tenant nicht identifiziert',
          upgrade_required: true
        });
      }

      // Hole numerische Tenant ID aus Datenbank
      const db = require('../database');
      const [tenantRows] = await db.query('SELECT id FROM tenants WHERE subdomain = ?', [tenantSubdomain]);
      
      if (tenantRows.length === 0) {
        return res.status(404).json({ 
          error: 'Tenant nicht gefunden',
          upgrade_required: true
        });
      }
      
      const numericTenantId = tenantRows[0].id;

      // Prüfe ob Tenant das Feature hat
      const hasAccess = await Feature.checkTenantAccess(numericTenantId, featureCode);
      
      if (!hasAccess) {
        logger.warn(`Tenant ${tenantSubdomain} tried to access feature ${featureCode} without permission`);
        
        // Hole Feature-Details für bessere Fehlermeldung
        const feature = await Feature.findByCode(featureCode);
        
        return res.status(403).json({ 
          error: `Feature '${feature?.name || featureCode}' nicht verfügbar`,
          feature_code: featureCode,
          upgrade_required: true,
          message: 'Bitte upgraden Sie Ihren Plan um diese Funktion zu nutzen'
        });
      }

      // Log Feature-Nutzung wenn gewünscht
      if (options.logUsage) {
        await Feature.logUsage(tenantId, featureCode, req.user?.id);
      }

      // Feature ist verfügbar, weiter zur nächsten Middleware
      req.features = req.features || {};
      req.features[featureCode] = true;
      
      next();
    } catch (error) {
      logger.error(`Error in checkFeature middleware: ${error.message}`);
      res.status(500).json({ error: 'Fehler bei der Feature-Überprüfung' });
    }
  };
};

// Middleware um mehrere Features gleichzeitig zu prüfen
const checkFeatures = (featureCodes, requireAll = true) => {
  return async (req, res, next) => {
    try {
      const tenantSubdomain = req.tenantId;
      
      if (!tenantSubdomain) {
        return res.status(400).json({ 
          error: 'Tenant nicht identifiziert'
        });
      }

      // Hole numerische Tenant ID aus Datenbank
      const db = require('../database');
      const [tenantRows] = await db.query('SELECT id FROM tenants WHERE subdomain = ?', [tenantSubdomain]);
      
      if (tenantRows.length === 0) {
        return res.status(404).json({ 
          error: 'Tenant nicht gefunden'
        });
      }
      
      const numericTenantId = tenantRows[0].id;

      const results = {};
      const missingFeatures = [];

      // Prüfe jedes Feature
      for (const featureCode of featureCodes) {
        const hasAccess = await Feature.checkTenantAccess(numericTenantId, featureCode);
        results[featureCode] = hasAccess;
        
        if (!hasAccess) {
          missingFeatures.push(featureCode);
        }
      }

      // Wenn alle Features benötigt werden und einige fehlen
      if (requireAll && missingFeatures.length > 0) {
        return res.status(403).json({ 
          error: 'Nicht alle benötigten Features verfügbar',
          missing_features: missingFeatures,
          upgrade_required: true
        });
      }

      // Wenn mindestens ein Feature benötigt wird und alle fehlen
      if (!requireAll && missingFeatures.length === featureCodes.length) {
        return res.status(403).json({ 
          error: 'Keine der benötigten Features verfügbar',
          missing_features: missingFeatures,
          upgrade_required: true
        });
      }

      req.features = results;
      next();
    } catch (error) {
      logger.error(`Error in checkFeatures middleware: ${error.message}`);
      res.status(500).json({ error: 'Fehler bei der Feature-Überprüfung' });
    }
  };
};

// Middleware um alle Features eines Tenants zu laden
const loadTenantFeatures = async (req, res, next) => {
  try {
    const tenantSubdomain = req.tenantId;
    
    if (!tenantSubdomain) {
      req.availableFeatures = [];
      return next();
    }

    // Hole numerische Tenant ID aus Datenbank
    const db = require('../database');
    const [tenantRows] = await db.query('SELECT id FROM tenants WHERE subdomain = ?', [tenantSubdomain]);
    
    if (tenantRows.length === 0) {
      req.availableFeatures = [];
      return next();
    }
    
    const numericTenantId = tenantRows[0].id;
    const features = await Feature.getTenantFeatures(numericTenantId);
    req.availableFeatures = features.filter(f => f.is_available);
    req.allFeatures = features;
    
    next();
  } catch (error) {
    logger.error(`Error loading tenant features: ${error.message}`);
    req.availableFeatures = [];
    next();
  }
};

// Helper Funktion für Views
const hasFeature = (features, featureCode) => {
  return features.some(f => f.code === featureCode && f.is_available);
};

module.exports = {
  checkFeature,
  checkFeatures,
  loadTenantFeatures,
  hasFeature
};