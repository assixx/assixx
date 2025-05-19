/**
 * Middleware für Multi-Tenant-Unterstützung
 * Erkennt die Firma basierend auf der Subdomain und lädt die entsprechende Konfiguration
 */

const tenantConfigs = require('../config/tenants');
const { createTenantConnection } = require('../database/tenantDb');
const db = require('../database');

// Whitelist of allowed tenant subdomains
const ALLOWED_TENANTS = new Set([
    'demo',
    'bosch',
    'mercedes',
    'siemens'
    // Add new tenants here after verification
]);

/**
 * Extrahiert den Tenant aus der Subdomain
 * Beispiel: bosch.assixx.de -> bosch
 */
function getTenantFromHost(hostname) {
    const parts = hostname.split('.');
    
    // Lokale Entwicklung: localhost:3000 -> default tenant
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return process.env.DEFAULT_TENANT || 'demo';
    }
    
    // Produktion: firma.assixx.de -> firma
    if (parts.length >= 3) {
        const tenantId = parts[0].toLowerCase();
        
        // Security: Only allow whitelisted tenants
        if (!ALLOWED_TENANTS.has(tenantId)) {
            console.warn(`Unauthorized tenant access attempt: ${tenantId}`);
            return null;
        }
        
        return tenantId;
    }
    
    return null;
}

/**
 * Load allowed tenants from database (for dynamic whitelist)
 */
async function loadAllowedTenants() {
    try {
        const [rows] = await db.query('SELECT subdomain FROM tenants WHERE is_active = 1');
        return new Set(rows.map(row => row.subdomain));
    } catch (error) {
        console.error('Error loading allowed tenants:', error);
        return ALLOWED_TENANTS;
    }
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