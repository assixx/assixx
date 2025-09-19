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

interface DeletionLog {
  table: string;
  deleted: number;
}

const CRITICAL_TABLES = [
  'tenant_deletion_queue', // Brauchen wir für den Prozess
  'deletion_audit_trail', // Audit muss bleiben
  'tenant_deletion_backups', // Backups müssen bleiben
  'archived_tenant_invoices', // Archivierte Rechnungen (10 Jahre)
  'tenant_data_exports', // DSGVO Exports
];

/**
 * Validate tenant ID
 */
function validateTenantId(tenantId: number): void {
  if (!tenantId || tenantId <= 0 || !Number.isInteger(tenantId)) {
    throw new Error(`INVALID TENANT_ID: ${tenantId} - must be positive integer`);
  }
}

/**
 * Get all tables with tenant_id column
 */
async function getTablesWithTenantId(conn: ConnectionWrapper): Promise<TableNameRow[]> {
  return await conn.query<TableNameRow[]>(`
    SELECT DISTINCT TABLE_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME = 'tenant_id'
    AND TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME
  `);
}

/**
 * Delete data from a single table
 */
async function deleteFromTable(
  tableName: string,
  tenantId: number,
  conn: ConnectionWrapper,
): Promise<DeletionLog | null> {
  try {
    const result = await conn.query<ResultSetHeader>(
      `DELETE FROM \`${tableName}\` WHERE tenant_id = ?`,
      [tenantId],
    );

    const deleted = result.affectedRows;
    if (deleted > 0) {
      logger.info(`✅ Deleted ${deleted} rows from ${tableName}`);
    }
    return { table: tableName, deleted };
  } catch (error) {
    logger.error(`❌ Failed to delete from ${tableName}:`, error);
    return null;
  }
}

/**
 * Delete data from tenant-id based tables
 */
async function deleteFromTenantTables(
  tables: TableNameRow[],
  tenantId: number,
  conn: ConnectionWrapper,
): Promise<DeletionLog[]> {
  const deletionLog: DeletionLog[] = [];

  for (const tableRow of tables) {
    const tableName = tableRow.TABLE_NAME;

    if (CRITICAL_TABLES.includes(tableName)) {
      logger.info(`Skipping critical table: ${tableName}`);
      continue;
    }

    const result = await deleteFromTable(tableName, tenantId, conn);
    if (result) {
      deletionLog.push(result);
    }
  }

  return deletionLog;
}

/**
 * Get user-related tables
 */
async function getUserRelatedTables(conn: ConnectionWrapper): Promise<TableNameRow[]> {
  const placeholders = CRITICAL_TABLES.map(() => '?').join(',');
  return await conn.query<TableNameRow[]>(
    `SELECT DISTINCT TABLE_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME = 'user_id'
    AND TABLE_SCHEMA = DATABASE()
    ${placeholders ? `AND TABLE_NAME NOT IN (${placeholders})` : ''}`,
    CRITICAL_TABLES,
  );
}

/**
 * Delete data from user-related tables
 */
async function deleteFromUserRelatedTables(
  tables: TableNameRow[],
  tenantId: number,
  conn: ConnectionWrapper,
): Promise<DeletionLog[]> {
  const deletionLog: DeletionLog[] = [];

  for (const tableRow of tables) {
    const tableName = tableRow.TABLE_NAME;

    try {
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
      logger.debug(
        `Skipped ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  return deletionLog;
}

/**
 * Delete tenant record itself
 */
async function deleteTenantRecord(tenantId: number, conn: ConnectionWrapper): Promise<DeletionLog> {
  const result = await conn.query<ResultSetHeader>('DELETE FROM tenants WHERE id = ?', [tenantId]);
  return {
    table: 'tenants',
    deleted: result.affectedRows,
  };
}

/**
 * Log deletion summary
 */
function logDeletionSummary(tenantId: number, deletionLog: DeletionLog[]): number {
  const totalDeleted = deletionLog.reduce((sum, log) => sum + log.deleted, 0);
  logger.warn(`
    ========================================
    TENANT ${tenantId} DELETION COMPLETE
    ========================================
    Tables affected: ${deletionLog.length}
    Total rows deleted: ${totalDeleted}
    ========================================
  `);
  return totalDeleted;
}

export async function dynamicTenantDeletion(
  tenantId: number,
  conn: ConnectionWrapper,
): Promise<DeletionResult> {
  // SICHERHEITSSCHICHT 1: Validierung der tenant_id
  validateTenantId(tenantId);

  logger.warn(`🚨 STARTING DYNAMIC DELETION FOR TENANT ${tenantId}`);

  const deletionLog: DeletionLog[] = [];

  // 1. FINDE ALLE TABELLEN MIT tenant_id SPALTE
  const tables = await getTablesWithTenantId(conn);
  logger.info(`Found ${tables.length} tables with tenant_id column`);

  // 2. FOREIGN KEY CONSTRAINTS TEMPORÄR DEAKTIVIEREN
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  try {
    // 3. LÖSCHE AUS ALLEN TABELLEN (AUSSER KRITISCHE)
    const tenantTableDeletions = await deleteFromTenantTables(tables, tenantId, conn);
    deletionLog.push(...tenantTableDeletions);

    // 4. SPECIAL CASE: User-bezogene Tabellen
    const userRelatedTables = await getUserRelatedTables(conn);
    const userTableDeletions = await deleteFromUserRelatedTables(userRelatedTables, tenantId, conn);
    deletionLog.push(...userTableDeletions);

    // 5. FINALE LÖSCHUNG: tenants Tabelle selbst
    const tenantDeletion = await deleteTenantRecord(tenantId, conn);
    deletionLog.push(tenantDeletion);
  } finally {
    // 6. FOREIGN KEYS WIEDER AKTIVIEREN
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  // 7. ZUSAMMENFASSUNG
  const totalDeleted = logDeletionSummary(tenantId, deletionLog);

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
