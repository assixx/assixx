/**
 * Middleware für Multi-Tenant-Unterstützung
 * Erkennt die Firma basierend auf der Subdomain und lädt die entsprechende Konfiguration
 */

const db = require('../database');
const Tenant = require('../models/tenant');
const logger = require('../utils/logger');

/**
 * Extrahiert den Tenant aus der Subdomain
 * Beispiel: bosch.assixx.de -> bosch
 */
function getTenantFromHost(hostname) {
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
 * Tenant Middleware
 * - Identifiziert den Tenant
 * - Lädt tenant-spezifische Daten aus der DB
 * - Fügt tenant_id zu allen Requests hinzu
 */
async function tenantMiddleware(req, res, next) {
    try {
        // 1. Tenant identifizieren (Priorität: Subdomain > Header > Query)
        let tenantSubdomain = getTenantFromHost(req.hostname);
        
        // Fallback für Entwicklung: X-Tenant-ID Header oder Query Parameter
        if (!tenantSubdomain) {
            tenantSubdomain = req.headers['x-tenant-id'] || req.query.tenant;
        }
        
        // Für Login/Signup: Tenant aus Body
        if (!tenantSubdomain && req.body && req.body.subdomain) {
            tenantSubdomain = req.body.subdomain;
        }
        
        // Fallback: Wenn User eingeloggt ist, verwende tenant_id aus JWT
        if (!tenantSubdomain && req.user && req.user.tenant_id) {
            const tenant = await Tenant.findById(req.user.tenant_id);
            if (tenant) {
                tenantSubdomain = tenant.subdomain;
            }
        }
        
        if (!tenantSubdomain) {
            return res.status(400).json({ 
                error: 'Keine Tenant-Identifikation möglich. Bitte Subdomain verwenden.' 
            });
        }
        
        // 2. Tenant aus Datenbank laden
        const tenant = await Tenant.findBySubdomain(tenantSubdomain);
        
        if (!tenant) {
            return res.status(404).json({ 
                error: 'Firma nicht gefunden',
                subdomain: tenantSubdomain
            });
        }
        
        // 3. Prüfe Tenant-Status
        if (tenant.status === 'cancelled' || tenant.status === 'suspended') {
            return res.status(403).json({ 
                error: 'Dieser Account ist nicht aktiv. Bitte kontaktieren Sie den Support.' 
            });
        }
        
        // 4. Trial-Status prüfen
        const trialStatus = await Tenant.checkTrialStatus(tenant.id);
        if (trialStatus && trialStatus.isExpired && tenant.status === 'trial') {
            return res.status(402).json({ 
                error: 'Ihre Testphase ist abgelaufen. Bitte wählen Sie einen Plan.',
                trialEndsAt: trialStatus.trialEndsAt
            });
        }
        
        // 5. Tenant-Informationen an Request anhängen
        req.tenant = {
            id: tenant.id,
            subdomain: tenant.subdomain,
            name: tenant.company_name,
            status: tenant.status,
            plan: tenant.current_plan,
            trialStatus: trialStatus
        };
        
        // Wichtig: tenant_id für alle DB-Queries verfügbar machen
        req.tenantId = tenant.id;
        
        // 6. Wenn User eingeloggt ist, prüfe ob er zu diesem Tenant gehört
        if (req.user && req.user.tenant_id && req.user.tenant_id !== tenant.id) {
            return res.status(403).json({ 
                error: 'Sie haben keinen Zugriff auf diese Firma.' 
            });
        }
        
        logger.info(`Tenant middleware: ${tenant.company_name} (${tenant.subdomain})`);
        
        next();
    } catch (error) {
        logger.error('Tenant middleware error:', error);
        res.status(500).json({ 
            error: 'Fehler beim Laden der Firmenkonfiguration',
            details: error.message
        });
    }
}

/**
 * Skip tenant check für öffentliche Routen
 */
function skipTenantCheck(req, res, next) {
    // Setze einen Default-Tenant für öffentliche Routen
    req.tenantId = null;
    req.tenant = null;
    next();
}

module.exports = {
    tenantMiddleware,
    skipTenantCheck
};