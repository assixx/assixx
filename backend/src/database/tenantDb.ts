/**
 * Tenant-spezifische Datenbankverbindungen
 * Erstellt und verwaltet separate DB-Verbindungen für jeden Tenant
 */
import * as fs from 'fs';
import { Connection, Pool, PoolOptions } from 'mysql2/promise';
import * as mysql from 'mysql2/promise';
import * as path from 'path';

// Get project root directory
const projectRoot = process.cwd();

// Cache für Datenbankverbindungen - Use Map for safe access
const connectionCache = new Map<string, Pool>();

/**
 * Erstellt eine Datenbankverbindung für einen spezifischen Tenant
 */
export async function createTenantConnection(tenantId: string): Promise<Pool> {
  // Prüfe ob Verbindung bereits im Cache
  const cachedConnection = connectionCache.get(tenantId);
  if (cachedConnection !== undefined) {
    return cachedConnection;
  }

  try {
    // Tenant-spezifische Datenbank-Konfiguration
    // In der Entwicklungsumgebung verwenden wir die Haupt-Datenbank statt tenant-spezifischer DBs
    const dbConfig: PoolOptions = {
      host: process.env.DB_HOST ?? 'localhost',
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'lohnabrechnung', // Verwende DB_NAME aus .env statt tenant-spezifischer DB
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };

    console.info(
      `Verwende Datenbank ${dbConfig.database ?? 'undefined'} für Tenant ${tenantId} (Entwicklungsmodus)`,
    );

    // Verbindungspool erstellen
    const pool = mysql.createPool(dbConfig);

    // Verbindung testen
    const connection = await pool.getConnection();
    connection.release();

    // Im Cache speichern
    connectionCache.set(tenantId, pool);

    console.info(`Datenbankverbindung für Tenant ${tenantId} erstellt`);
    return pool;
  } catch (error: unknown) {
    console.error(`Fehler beim Erstellen der DB-Verbindung für ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Initialisiert eine neue Tenant-Datenbank
 * Wird beim Onboarding einer neuen Firma verwendet
 *
 * In der Entwicklungsumgebung verwenden wir die Haupt-Datenbank statt tenant-spezifischer DBs
 */
export async function initializeTenantDatabase(tenantId: string): Promise<void> {
  // Im Entwicklungsmodus verwenden wir die Haupt-Datenbank
  if (process.env.NODE_ENV === 'development') {
    console.info(`Dev-Modus: Verwende vorhandene Datenbank für Tenant ${tenantId}`);
    return;
  }

  // Im Produktionsmodus führen wir die ursprüngliche Logik aus
  const connection: Connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
  });

  try {
    // Validate tenantId to prevent SQL injection
    if (!/^\w+$/.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }

    // Datenbank erstellen - tenantId is now validated
    // codeql[js/sql-injection] - False positive: tenantId is validated against /^\w+$/ regex above (alphanumeric only)
    await connection.query(`CREATE DATABASE IF NOT EXISTS assixx_${tenantId}`);
    // codeql[js/sql-injection] - False positive: tenantId is validated against /^\w+$/ regex above (alphanumeric only)
    await connection.query(`USE assixx_${tenantId}`);

    // Tabellen erstellen (Schema aus schema.sql verwenden)
    const schemaPath = path.join(projectRoot, 'backend', 'src', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema.split(';').filter((stmt: string) => stmt.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }

    console.info(`Datenbank für Tenant ${tenantId} initialisiert`);
  } catch (error: unknown) {
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
export async function closeAllConnections(): Promise<void> {
  for (const [tenantId, pool] of connectionCache.entries()) {
    try {
      await pool.end();
      console.info(`Verbindung für Tenant ${tenantId} geschlossen`);
    } catch (error: unknown) {
      console.error(`Fehler beim Schließen der Verbindung für ${tenantId}:`, error);
    }
  }
}
