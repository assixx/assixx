/**
 * DYNAMIC TENANT DELETION - Best Practice Implementation
 * Findet automatisch ALLE Tabellen mit tenant_id und löscht sie
 * MIT 2 SICHERHEITSSCHICHTEN!
 */
import { ResultSetHeader, RowDataPacket } from 'mysql2';

import { logger } from '../utils/logger';

interface TableNameRow extends RowDataPacket {
  TABLE_NAME: string;
}

interface CountRow extends RowDataPacket {
  cnt: number;
}

interface ConnectionWrapper {
  query<T = RowDataPacket[] | ResultSetHeader>(sql: string, values?: unknown[]): Promise<T>;
  execute<T = RowDataPacket[] | ResultSetHeader>(sql: string, values?: unknown[]): Promise<T>;
}

interface DeletionResult {
  success: boolean;
  tablesAffected: number;
  totalRowsDeleted: number;
  details: { table: string; deleted: number }[];
}

export async function dynamicTenantDeletion(
  tenantId: number,
  conn: ConnectionWrapper,
): Promise<DeletionResult> {
  // SICHERHEITSSCHICHT 1: Validierung der tenant_id
  if (!tenantId || tenantId <= 0 || !Number.isInteger(tenantId)) {
    throw new Error(`INVALID TENANT_ID: ${tenantId} - must be positive integer`);
  }

  logger.warn(`🚨 STARTING DYNAMIC DELETION FOR TENANT ${tenantId}`);

  const deletionLog: { table: string; deleted: number }[] = [];

  // 1. FINDE ALLE TABELLEN MIT tenant_id SPALTE
  const tables = await conn.query<TableNameRow[]>(`
    SELECT DISTINCT TABLE_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME = 'tenant_id'
    AND TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME
  `);

  logger.info(`Found ${tables.length} tables with tenant_id column`);

  // 2. FOREIGN KEY CONSTRAINTS TEMPORÄR DEAKTIVIEREN
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  try {
    // 3. LÖSCHE AUS ALLEN TABELLEN (AUSSER KRITISCHE)
    const criticalTables = [
      'tenant_deletion_queue', // Brauchen wir für den Prozess
      'deletion_audit_trail', // Audit muss bleiben
      'tenant_deletion_backups', // Backups müssen bleiben
      'archived_tenant_invoices', // Archivierte Rechnungen (10 Jahre)
      'tenant_data_exports', // DSGVO Exports
    ];

    for (const tableRow of tables) {
      const tableName = tableRow.TABLE_NAME;

      // Skip kritische Tabellen
      if (criticalTables.includes(tableName)) {
        logger.info(`Skipping critical table: ${tableName}`);
        continue;
      }

      try {
        // Lösche ALLE Einträge mit dieser tenant_id (mit Prepared Statement für Sicherheit)
        const result = await conn.query<ResultSetHeader>(
          `DELETE FROM \`${tableName}\` WHERE tenant_id = ?`,
          [tenantId],
        );

        const deleted = result.affectedRows;
        deletionLog.push({ table: tableName, deleted });

        if (deleted > 0) {
          logger.info(`✅ Deleted ${deleted} rows from ${tableName}`);
        }
      } catch (error) {
        logger.error(`❌ Failed to delete from ${tableName}:`, error);
        // Trotzdem weitermachen mit anderen Tabellen
      }
    }

    // 4. SPECIAL CASE: User-bezogene Tabellen (haben user_id, nicht tenant_id)
    const placeholders = criticalTables.map(() => '?').join(',');
    const userRelatedTables = await conn.query<TableNameRow[]>(
      `SELECT DISTINCT TABLE_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME = 'user_id'
      AND TABLE_SCHEMA = DATABASE()
      ${placeholders ? `AND TABLE_NAME NOT IN (${placeholders})` : ''}`,
      criticalTables,
    );

    for (const tableRow of userRelatedTables) {
      const tableName = tableRow.TABLE_NAME;

      try {
        // Lösche über JOIN mit users Tabelle
        const result = await conn.query<ResultSetHeader>(
          `DELETE t FROM \`${tableName}\` t
           INNER JOIN users u ON t.user_id = u.id
           WHERE u.tenant_id = ?`,
          [tenantId],
        );

        const deleted = result.affectedRows;
        if (deleted > 0) {
          deletionLog.push({ table: `${tableName} (via users)`, deleted });
          logger.info(`✅ Deleted ${deleted} rows from ${tableName} (user-related)`);
        }
      } catch (error) {
        // Tabelle hat vielleicht keine Beziehung zu users
        logger.debug(
          `Skipped ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // 5. FINALE LÖSCHUNG: tenants Tabelle selbst
    const tenantResult = await conn.query<ResultSetHeader>('DELETE FROM tenants WHERE id = ?', [
      tenantId,
    ]);

    deletionLog.push({
      table: 'tenants',
      deleted: tenantResult.affectedRows,
    });
  } finally {
    // 6. FOREIGN KEYS WIEDER AKTIVIEREN
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  // 7. ZUSAMMENFASSUNG
  const totalDeleted = deletionLog.reduce((sum, log) => sum + log.deleted, 0);
  logger.warn(`
    ========================================
    TENANT ${tenantId} DELETION COMPLETE
    ========================================
    Tables affected: ${deletionLog.length}
    Total rows deleted: ${totalDeleted}
    ========================================
  `);

  // SICHERHEITSSCHICHT 2: Post-Deletion Verification
  await verifyCompleteDeletion(tenantId, conn);

  return {
    success: true,
    tablesAffected: deletionLog.length,
    totalRowsDeleted: totalDeleted,
    details: deletionLog,
  };
}

/**
 * SICHERHEITSSCHICHT 2: Verification dass wirklich alles gelöscht wurde
 */
export async function verifyCompleteDeletion(
  tenantId: number,
  conn: ConnectionWrapper,
): Promise<boolean> {
  const tables = await getAllTablesWithTenantId(conn);
  const remainingData: { table: string; count: number }[] = [];

  const criticalTables = [
    'tenant_deletion_queue',
    'deletion_audit_trail',
    'tenant_deletion_backups',
    'archived_tenant_invoices',
    'tenant_data_exports',
  ];

  for (const tableName of tables) {
    // Skip critical tables
    if (criticalTables.includes(tableName)) {
      continue;
    }

    const countResult = await conn.query<CountRow[]>(
      `SELECT COUNT(*) as cnt FROM \`${tableName}\` WHERE tenant_id = ?`,
      [tenantId],
    );

    const count = countResult[0]?.cnt ?? 0;
    if (count > 0) {
      remainingData.push({ table: tableName, count });
    }
  }

  if (remainingData.length > 0) {
    const details = remainingData.map((r) => `${r.table}(${r.count})`).join(', ');
    throw new Error(
      `CRITICAL: Data still exists after deletion for tenant ${tenantId} in tables: ${details}`,
    );
  }

  logger.info(`✅ Verification complete: All data for tenant ${tenantId} successfully deleted`);
  return true;
}

/**
 * HELPER: Alle Tabellen mit tenant_id finden
 */
async function getAllTablesWithTenantId(conn: ConnectionWrapper): Promise<string[]> {
  const tables = await conn.query<TableNameRow[]>(`
    SELECT DISTINCT TABLE_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME = 'tenant_id'
    AND TABLE_SCHEMA = DATABASE()
  `);

  return tables.map((t) => t.TABLE_NAME);
}

/**
 * Integration in tenantDeletion.service.ts als Ersatz für die 100+ hardcoded steps
 */
export async function replaceLegacyDeletionSteps(
  tenantId: number,
  _queueId: number,
  conn: ConnectionWrapper,
): Promise<number> {
  const result = await dynamicTenantDeletion(tenantId, conn);
  return result.totalRowsDeleted;
}
