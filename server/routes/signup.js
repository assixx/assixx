const express = require('express');
const router = express.Router();
const Tenant = require('../models/tenant');
const logger = require('../utils/logger');

// Öffentliche Signup-Route
router.post('/signup', async (req, res) => {
  try {
    const {
      company_name,
      subdomain,
      email,
      phone,
      admin_email,
      admin_password,
      admin_first_name,
      admin_last_name,
      selectedPlan
    } = req.body;
    
    // Validierung
    if (!company_name || !subdomain || !email || !admin_password) {
      return res.status(400).json({ message: 'Alle Pflichtfelder müssen ausgefüllt werden' });
    }
    
    // Subdomain validieren
    const subdomainValidation = Tenant.validateSubdomain(subdomain);
    if (!subdomainValidation.valid) {
      return res.status(400).json({ message: subdomainValidation.error });
    }
    
    // Prüfe ob Subdomain verfügbar
    const isAvailable = await Tenant.isSubdomainAvailable(subdomain);
    if (!isAvailable) {
      return res.status(400).json({ message: 'Diese Subdomain ist bereits vergeben' });
    }
    
    // Erstelle Tenant und Admin-User
    const result = await Tenant.create({
      company_name,
      subdomain,
      email,
      phone,
      admin_email,
      admin_password,
      admin_first_name,
      admin_last_name
    });
    
    logger.info(`Neuer Tenant registriert: ${company_name} (${subdomain})`);
    
    // Später: Willkommens-E-Mail senden
    // await sendWelcomeEmail(admin_email, subdomain);
    
    res.json({
      success: true,
      subdomain: subdomain,
      trialEndsAt: result.trialEndsAt,
      message: 'Registrierung erfolgreich! Sie können sich jetzt anmelden.'
    });
    
  } catch (error) {
    logger.error(`Signup-Fehler: ${error.message}`);
    res.status(500).json({ 
      message: 'Fehler bei der Registrierung', 
      error: error.message 
    });
  }
});

// Subdomain-Verfügbarkeit prüfen
router.get('/check-subdomain/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    
    const validation = Tenant.validateSubdomain(subdomain);
    if (!validation.valid) {
      return res.json({ available: false, error: validation.error });
    }
    
    const available = await Tenant.isSubdomainAvailable(subdomain);
    res.json({ available });
    
  } catch (error) {
    logger.error(`Subdomain-Check-Fehler: ${error.message}`);
    res.status(500).json({ error: 'Fehler bei der Überprüfung' });
  }
});

module.exports = router;