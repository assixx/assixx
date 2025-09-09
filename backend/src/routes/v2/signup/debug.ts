/**
 * Debug route for v2 signup
 */
import { Request, Response, Router } from 'express';

// Sequelize Models müssen PascalCase sein (Klassen/Konstruktoren)
// eslint-disable-next-line @typescript-eslint/naming-convention
import Tenant from '../../../models/tenant.js';
import { logger } from '../../../utils/logger.js';
import { SignupService } from './service.js';

const router = Router();

router.get('/debug', async (_req: Request, res: Response) => {
  try {
    logger.info('[SIGNUP DEBUG] Starting debug check');

    // Test 1: Check if Tenant model is loaded
    logger.info('[SIGNUP DEBUG] Tenant model:', {
      hasCreate: typeof Tenant.create === 'function',
      hasValidateSubdomain: typeof Tenant.validateSubdomain === 'function',
      hasIsSubdomainAvailable: typeof Tenant.isSubdomainAvailable === 'function',
    });

    // Test 2: Check if SignupService can be instantiated
    const service = new SignupService();
    logger.info('[SIGNUP DEBUG] SignupService instance created:', {
      hasRegisterTenant: typeof service.registerTenant === 'function',
    });

    // Test 3: Try subdomain validation
    const testSubdomain = 'debugtest123';
    const validation = Tenant.validateSubdomain(testSubdomain);
    logger.info('[SIGNUP DEBUG] Subdomain validation result:', validation);

    // Test 4: Try subdomain availability check
    const isAvailable = await Tenant.isSubdomainAvailable(testSubdomain);
    logger.info('[SIGNUP DEBUG] Subdomain availability:', isAvailable);

    res.json({
      success: true,
      debug: {
        tenantModel: {
          hasCreate: typeof Tenant.create === 'function',
          hasValidateSubdomain: typeof Tenant.validateSubdomain === 'function',
          hasIsSubdomainAvailable: typeof Tenant.isSubdomainAvailable === 'function',
        },
        signupService: {
          canInstantiate: true,
          hasRegisterTenant: typeof service.registerTenant === 'function',
        },
        subdomainValidation: validation,
        subdomainAvailable: isAvailable,
      },
    });
  } catch (error: unknown) {
    logger.error('[SIGNUP DEBUG] Error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
  }
});

export default router;
