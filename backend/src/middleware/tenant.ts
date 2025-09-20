/**
 * Middleware für Multi-Tenant-Unterstützung
 * Erkennt die Firma basierend auf der Subdomain und lädt die entsprechende Konfiguration
 */
import { NextFunction, Request, Response } from 'express';

import tenantModel from '../models/tenant';
import { DatabaseTenant } from '../types/models';
import { TenantInfo, TenantTrialStatus } from '../types/tenant.types';
import { logger } from '../utils/logger';

// Request interface is already extended in types/express-extensions.d.ts

interface RequestWithBody extends Request {
  body: {
    subdomain?: string;
    tenant_id?: number;
    [key: string]: unknown;
  };
  user?: {
    tenant_id?: number;
    [key: string]: unknown;
  };
}

/**
 * Extrahiert den Tenant aus der Subdomain
 * Beispiel: bosch.assixx.de -\> bosch
 */
function getTenantFromHost(hostname: string): string | null {
  const parts = hostname.split('.');

  // Lokale Entwicklung: localhost:3000 -> aus Header oder Query
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return null; // Will be handled by header/query fallback
  }

  // Produktion: firma.assixx.de -> firma
  if (parts.length >= 3) {
    return parts[0].toLowerCase();
  }

  return null;
}

/**
 * Extract tenant subdomain from various sources
 */
async function extractTenantSubdomain(req: Request): Promise<string | null> {
  const reqWithBody = req as RequestWithBody;

  // 1. Try hostname first
  const hostTenant = getTenantFromHost(req.hostname);
  if (hostTenant) return hostTenant;

  // 2. Try header or query (development fallback)
  const headerTenant = req.headers['x-tenant-id'];
  if (typeof headerTenant === 'string' && headerTenant !== '') return headerTenant;

  const queryTenant = req.query.tenant;
  if (typeof queryTenant === 'string' && queryTenant !== '') return queryTenant;

  // 3. Try body subdomain (for login/signup)
  if (reqWithBody.body.subdomain && reqWithBody.body.subdomain !== '') {
    return reqWithBody.body.subdomain;
  }

  // 4. Try user's tenant_id from JWT
  if (reqWithBody.user?.tenant_id != null) {
    const tenant = await tenantModel.findById(reqWithBody.user.tenant_id);
    if (tenant) return tenant.subdomain;
  }

  return null;
}

/**
 * Validate tenant status and trial
 */
function validateTenantStatus(
  tenant: DatabaseTenant,
  trialStatus: TenantTrialStatus | null,
  res: Response,
): boolean {
  // Check if tenant is active
  if (tenant.status === 'cancelled' || tenant.status === 'suspended') {
    res.status(403).json({
      error: 'Dieser Account ist nicht aktiv. Bitte kontaktieren Sie den Support.',
    });
    return false;
  }

  // Check trial expiration
  if (trialStatus?.isExpired && tenant.status === 'trial') {
    res.status(402).json({
      error: 'Ihre Testphase ist abgelaufen. Bitte wählen Sie einen Plan.',
      trialEndsAt: trialStatus.trialEndsAt,
    });
    return false;
  }

  return true;
}

/**
 * Check if user belongs to tenant
 */
function validateUserTenant(req: Request, tenantId: number): boolean {
  const reqWithBody = req as RequestWithBody;

  if (!reqWithBody.user) return true;
  if (typeof reqWithBody.user.tenant_id !== 'number') return true;

  return reqWithBody.user.tenant_id === tenantId;
}

/**
 * Tenant Middleware
 * - Identifiziert den Tenant
 * - Lädt tenant-spezifische Daten aus der DB
 * - Fügt tenant_id zu allen Requests hinzu
 */
export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // 1. Identify tenant
    const tenantSubdomain = await extractTenantSubdomain(req);

    if (!tenantSubdomain) {
      res.status(400).json({
        error: 'Keine Tenant-Identifikation möglich. Bitte Subdomain verwenden.',
      });
      return;
    }

    // 2. Load tenant from database
    const tenant = await tenantModel.findBySubdomain(tenantSubdomain);

    if (!tenant) {
      res.status(404).json({
        error: 'Firma nicht gefunden',
        subdomain: tenantSubdomain,
      });
      return;
    }

    // 3. Validate tenant status
    const trialStatus = await tenantModel.checkTrialStatus(tenant.id);
    if (!validateTenantStatus(tenant, trialStatus, res)) {
      return;
    }

    // 4. Check user-tenant relationship
    if (!validateUserTenant(req, tenant.id)) {
      res.status(403).json({
        error: 'Sie haben keinen Zugriff auf diese Firma.',
      });
      return;
    }

    // 5. Attach tenant info to request
    const tenantInfo: TenantInfo = {
      id: tenant.id,
      subdomain: tenant.subdomain,
      name: tenant.company_name,
      status: tenant.status,
      plan: tenant.current_plan,
      trialStatus: trialStatus ?? undefined,
    };

    req.tenant = tenantInfo;
    req.tenantId = tenant.id;

    logger.info(`Tenant middleware: ${tenant.company_name} (${tenant.subdomain})`);
    next();
  } catch (error: unknown) {
    logger.error('Tenant middleware error:', error);
    res.status(500).json({
      error: 'Fehler beim Laden der Firmenkonfiguration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Skip tenant check für öffentliche Routen
 */
export function skipTenantCheck(req: Request, _res: Response, next: NextFunction): void {
  // Setze einen Default-Tenant für öffentliche Routen
  req.tenantId = null;
  req.tenant = null;
  next();
}
