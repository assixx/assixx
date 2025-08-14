/**
 * Middleware für Multi-Tenant-Unterstützung
 * Erkennt die Firma basierend auf der Subdomain und lädt die entsprechende Konfiguration
 */

import { Request, Response, NextFunction } from "express";

import TenantModel from "../models/tenant";
import { TenantInfo } from "../types/tenant.types";
import { logger } from "../utils/logger";

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
 * Beispiel: bosch.assixx.de -> bosch
 */
function getTenantFromHost(hostname: string): string | null {
  const parts = hostname.split(".");

  // Lokale Entwicklung: localhost:3000 -> aus Header oder Query
  if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
    return null; // Will be handled by header/query fallback
  }

  // Produktion: firma.assixx.de -> firma
  if (parts.length >= 3) {
    return parts[0].toLowerCase();
  }

  return null;
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
    // 1. Tenant identifizieren (Priorität: Subdomain > Header > Query)
    let tenantSubdomain = getTenantFromHost(req.hostname);

    // Fallback für Entwicklung: X-Tenant-ID Header oder Query Parameter
    if (tenantSubdomain == null || tenantSubdomain === "") {
      const headerTenant = req.headers["x-tenant-id"];
      const queryTenant = req.query.tenant;

      tenantSubdomain =
        typeof headerTenant === "string"
          ? headerTenant
          : typeof queryTenant === "string"
            ? queryTenant
            : null;
    }

    // Für Login/Signup: Tenant aus Body
    const reqWithBody = req as RequestWithBody;
    if (
      (tenantSubdomain == null || tenantSubdomain === "") &&
      reqWithBody.body.subdomain != null &&
      reqWithBody.body.subdomain !== ""
    ) {
      tenantSubdomain = reqWithBody.body.subdomain;
    }

    // Fallback: Wenn User eingeloggt ist, verwende tenant_id aus JWT
    if (
      (tenantSubdomain == null || tenantSubdomain === "") &&
      reqWithBody.user?.tenant_id != null
    ) {
      const tenant = await TenantModel.findById(reqWithBody.user.tenant_id);
      if (tenant) {
        tenantSubdomain = tenant.subdomain;
      }
    }

    if (tenantSubdomain == null || tenantSubdomain === "") {
      res.status(400).json({
        error:
          "Keine Tenant-Identifikation möglich. Bitte Subdomain verwenden.",
      });
      return;
    }

    // 2. Tenant aus Datenbank laden
    const tenant = await TenantModel.findBySubdomain(tenantSubdomain);

    if (!tenant) {
      res.status(404).json({
        error: "Firma nicht gefunden",
        subdomain: tenantSubdomain,
      });
      return;
    }

    // 3. Prüfe Tenant-Status
    if (tenant.status === "cancelled" || tenant.status === "suspended") {
      res.status(403).json({
        error:
          "Dieser Account ist nicht aktiv. Bitte kontaktieren Sie den Support.",
      });
      return;
    }

    // 4. Trial-Status prüfen
    const trialStatus = await TenantModel.checkTrialStatus(tenant.id);
    if (trialStatus && trialStatus.isExpired && tenant.status === "trial") {
      res.status(402).json({
        error: "Ihre Testphase ist abgelaufen. Bitte wählen Sie einen Plan.",
        trialEndsAt: trialStatus.trialEndsAt,
      });
      return;
    }

    // 5. Tenant-Informationen an Request anhängen
    const tenantInfo: TenantInfo = {
      id: tenant.id,
      subdomain: tenant.subdomain,
      name: tenant.company_name,
      status: tenant.status as "active" | "trial" | "cancelled" | "suspended",
      plan: tenant.current_plan,
      trialStatus: trialStatus ?? undefined,
    };

    req.tenant = tenantInfo;
    // Wichtig: tenant_id für alle DB-Queries verfügbar machen
    req.tenantId = tenant.id;

    // 6. Wenn User eingeloggt ist, prüfe ob er zu diesem Tenant gehört
    if (
      "user" in reqWithBody &&
      reqWithBody.user != null &&
      "tenant_id" in reqWithBody.user &&
      typeof reqWithBody.user.tenant_id === "number" &&
      reqWithBody.user.tenant_id !== tenant.id
    ) {
      res.status(403).json({
        error: "Sie haben keinen Zugriff auf diese Firma.",
      });
      return;
    }

    logger.info(
      `Tenant middleware: ${tenant.company_name} (${tenant.subdomain})`,
    );

    next();
  } catch (error: unknown) {
    logger.error("Tenant middleware error:", error);
    res.status(500).json({
      error: "Fehler beim Laden der Firmenkonfiguration",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Skip tenant check für öffentliche Routen
 */
export function skipTenantCheck(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  // Setze einen Default-Tenant für öffentliche Routen
  req.tenantId = null;
  req.tenant = null;
  next();
}
