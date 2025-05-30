/**
 * Signup/Registration Routes
 * API endpoints for tenant registration and subdomain validation
 */

import express, { Router } from 'express';
import { logger } from '../utils/logger';

// Import models (keeping require pattern for compatibility)
import Tenant from '../models/tenant';

const router: Router = express.Router();

// Request interfaces
/* Unused interface - kept for future reference
interface SignupRequest extends Request {
  body: {
    company_name: string;
    subdomain: string;
    email: string;
    phone?: string;
    admin_email: string;
    admin_password: string;
    admin_first_name: string;
    admin_last_name: string;
    selectedPlan?: string;
  };
}
*/

// Removed unused SubdomainCheckRequest interface

// Response interfaces
interface SignupResult {
  success: boolean;
  subdomain: string;
  trialEndsAt?: Date;
  message: string;
}

interface SubdomainValidation {
  valid: boolean;
  error?: string;
}

interface SubdomainAvailabilityResponse {
  available: boolean;
  error?: string;
}

// Öffentliche Signup-Route
router.post('/signup', async (req, res): Promise<void> => {
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
      // selectedPlan,
    } = req.body;

    // Validierung
    if (!company_name || !subdomain || !email || !admin_password) {
      res
        .status(400)
        .json({ message: 'Alle Pflichtfelder müssen ausgefüllt werden' });
      return;
    }

    // Subdomain validieren
    const subdomainValidation: SubdomainValidation =
      Tenant.validateSubdomain(subdomain);
    if (!subdomainValidation.valid) {
      res.status(400).json({ message: subdomainValidation.error });
      return;
    }

    // Prüfe ob Subdomain verfügbar
    const isAvailable: boolean = await Tenant.isSubdomainAvailable(subdomain);
    if (!isAvailable) {
      res.status(400).json({ message: 'Diese Subdomain ist bereits vergeben' });
      return;
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
      admin_last_name,
    });

    logger.info(`Neuer Tenant registriert: ${company_name} (${subdomain})`);

    // Später: Willkommens-E-Mail senden
    // await sendWelcomeEmail(admin_email, subdomain);

    const response: SignupResult = {
      success: true,
      subdomain,
      trialEndsAt: result.trialEndsAt,
      message: 'Registrierung erfolgreich! Sie können sich jetzt anmelden.',
    };

    res.json(response);
  } catch (error: any) {
    logger.error(`Signup-Fehler: ${error.message}`);
    res.status(500).json({
      message: 'Fehler bei der Registrierung',
      error: error.message,
    });
  }
});

// Subdomain-Verfügbarkeit prüfen
router.get('/check-subdomain/:subdomain', async (req, res): Promise<void> => {
  try {
    const { subdomain } = req.params;

    const validation: SubdomainValidation = Tenant.validateSubdomain(subdomain);
    if (!validation.valid) {
      const response: SubdomainAvailabilityResponse = {
        available: false,
        error: validation.error,
      };
      res.json(response);
      return;
    }

    const available: boolean = await Tenant.isSubdomainAvailable(subdomain);
    const response: SubdomainAvailabilityResponse = { available };
    res.json(response);
  } catch (error: any) {
    logger.error(`Subdomain-Check-Fehler: ${error.message}`);
    res.status(500).json({ error: 'Fehler bei der Überprüfung' });
  }
});

export default router;

// CommonJS compatibility
