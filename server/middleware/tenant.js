/**
 * Middleware für Multi-Tenant-Unterstützung
 * Erkennt die Firma basierend auf der Subdomain und lädt die entsprechende Konfiguration
 */

const tenantConfigs = require('../config/tenants');
const { createTenantConnection } = require('../database/tenantDb');

/**
 * Extrahiert den Tenant aus der Subdomain
 * Beispiel: bosch.assixx.de -> bosch
 */
function getTenantFromHost(hostname) {
    const parts = hostname.split('.');
    
    // Lokale Entwicklung: localhost:3000 -> default tenant
    if (hostname.includes('localhost')) {
        return process.env.DEFAULT_TENANT || 'demo';
    }
    
    // Produktion: firma.assixx.de -> firma
    if (parts.length >= 3) {
        return parts[0];
    }
    
    return null;
}

/**
 * Tenant Middleware
 * - Identifiziert den Tenant
 * - Lädt tenant-spezifische Konfiguration
 * - Erstellt Datenbankverbindung für Tenant
 */
async function tenantMiddleware(req, res, next) {
    try {
        // Tenant aus Hostname extrahieren
        const tenantId = getTenantFromHost(req.hostname);
        
        if (!tenantId) {
            return res.status(400).json({ 
                error: 'Keine gültige Firmen-Domain erkannt' 
            });
        }
        
        // Tenant-Konfiguration laden
        const tenantConfig = tenantConfigs[tenantId];
        
        if (!tenantConfig) {
            return res.status(404).json({ 
                error: 'Firma nicht gefunden' 
            });
        }
        
        // Tenant-Informationen an Request anhängen
        req.tenant = {
            id: tenantId,
            config: tenantConfig,
            db: await createTenantConnection(tenantId)
        };
        
        // Firmen-spezifisches Branding laden
        req.branding = {
            logo: tenantConfig.branding.logo,
            primaryColor: tenantConfig.branding.primaryColor,
            companyName: tenantConfig.name
        };
        
        next();
    } catch (error) {
        console.error('Tenant middleware error:', error);
        res.status(500).json({ 
            error: 'Fehler beim Laden der Firmenkonfiguration' 
        });
    }
}

module.exports = tenantMiddleware;