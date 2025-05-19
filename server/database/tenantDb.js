/**
 * Tenant-spezifische Datenbankverbindungen
 * Erstellt und verwaltet separate DB-Verbindungen für jeden Tenant
 */

const mysql = require('mysql2/promise');

// Cache für Datenbankverbindungen
const connectionCache = {};

/**
 * Erstellt eine Datenbankverbindung für einen spezifischen Tenant
 */
async function createTenantConnection(tenantId) {
    // Prüfe ob Verbindung bereits im Cache
    if (connectionCache[tenantId]) {
        return connectionCache[tenantId];
    }
    
    try {
        // Tenant-spezifische Datenbank-Konfiguration
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: `assixx_${tenantId}`,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };
        
        // Verbindungspool erstellen
        const pool = await mysql.createPool(dbConfig);
        
        // Verbindung testen
        await pool.getConnection();
        
        // Im Cache speichern
        connectionCache[tenantId] = pool;
        
        console.log(`Datenbankverbindung für Tenant ${tenantId} erstellt`);
        return pool;
        
    } catch (error) {
        console.error(`Fehler beim Erstellen der DB-Verbindung für ${tenantId}:`, error);
        throw error;
    }
}

/**
 * Initialisiert eine neue Tenant-Datenbank
 * Wird beim Onboarding einer neuen Firma verwendet
 */
async function initializeTenantDatabase(tenantId) {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });
    
    try {
        // Datenbank erstellen
        await connection.query(`CREATE DATABASE IF NOT EXISTS assixx_${tenantId}`);
        await connection.query(`USE assixx_${tenantId}`);
        
        // Tabellen erstellen (Schema aus schema.sql verwenden)
        const schema = require('fs').readFileSync('./database/schema.sql', 'utf8');
        const statements = schema.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                await connection.query(statement);
            }
        }
        
        console.log(`Datenbank für Tenant ${tenantId} initialisiert`);
        
    } catch (error) {
        console.error(`Fehler beim Initialisieren der Tenant-DB ${tenantId}:`, error);
        throw error;
    } finally {
        await connection.end();
    }
}

/**
 * Schließt alle Datenbankverbindungen
 * Sollte beim Herunterfahren der Anwendung aufgerufen werden
 */
async function closeAllConnections() {
    for (const [tenantId, pool] of Object.entries(connectionCache)) {
        try {
            await pool.end();
            console.log(`Verbindung für Tenant ${tenantId} geschlossen`);
        } catch (error) {
            console.error(`Fehler beim Schließen der Verbindung für ${tenantId}:`, error);
        }
    }
}

module.exports = {
    createTenantConnection,
    initializeTenantDatabase,
    closeAllConnections
};