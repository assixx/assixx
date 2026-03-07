/**
 * Tenant Deletion Exporter — Backup & GDPR data export.
 *
 * WHY this is a separate service:
 * Data export before deletion is a self-contained domain: fetch tenant info,
 * create SQL backup, export JSON, write metadata, create archive. ~200 lines
 * of I/O-heavy logic that has zero overlap with the deletion engine.
 *
 * Rule: This sub-service NEVER calls other sub-services.
 *
 * Migrated from services/ — uses PoolClient instead of ConnectionWrapper.
 */
import { Injectable, Logger } from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';
import type { PoolClient } from 'pg';

import { getErrorMessage } from '../common/index.js';
import { getTablesWithTenantId } from './tenant-deletion.helpers.js';
import type { TableNameRow, TenantInfoRow } from './tenant-deletion.types.js';

@Injectable()
export class TenantDeletionExporter {
  private readonly logger = new Logger(TenantDeletionExporter.name);

  /**
   * Create complete tenant backup before deletion.
   * Includes: SQL dump + JSON exports + metadata + tar.gz archive.
   */
  async createTenantDataExport(
    tenantId: number,
    client: PoolClient,
  ): Promise<string> {
    const tenant = await this.fetchTenantInfo(tenantId, client);
    const companyName = tenant?.company_name ?? 'unknown';

    const { backupDir, dataDir, backupDirName } = this.setupBackupPaths(
      companyName,
      tenantId,
    );

    await fs.mkdir(dataDir, { recursive: true });
    this.logger.log(`Creating tenant backup in ${backupDir}`);

    await this.createSqlBackup(
      tenantId,
      companyName,
      `${backupDir}/backup.sql`,
      client,
    );
    const { tables, totalRecords } = await this.exportTablesToJson(
      tenantId,
      dataDir,
      client,
    );
    await this.writeBackupMetadata(
      backupDir,
      tenantId,
      companyName,
      tenant,
      tables.length,
      totalRecords,
    );

    return await this.createArchiveAndStore(
      tenantId,
      backupDir,
      backupDirName,
      client,
    );
  }

  /**
   * Fetch tenant info for backup metadata
   */
  private async fetchTenantInfo(
    tenantId: number,
    client: PoolClient,
  ): Promise<TenantInfoRow | undefined> {
    const result = await client.query<TenantInfoRow>(
      'SELECT company_name, subdomain, email, created_at FROM tenants WHERE id = $1',
      [tenantId],
    );
    return result.rows[0];
  }

  /**
   * Set up backup directory paths
   */
  private setupBackupPaths(
    companyName: string,
    tenantId: number,
  ): { backupDir: string; dataDir: string; backupDirName: string } {
    const sanitizedName = this.sanitizeCompanyName(companyName);
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .substring(0, 19);
    const backupDirName = `${sanitizedName}_${tenantId}_${timestamp}`;
    const backupDir = `/backups/tenant_deletions/${backupDirName}`;
    return { backupDir, dataDir: `${backupDir}/data`, backupDirName };
  }

  /**
   * Sanitize company name for use in file/folder names
   */
  private sanitizeCompanyName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }

  /**
   * Create SQL backup file with INSERT statements for all tenant data
   */

  private async createSqlBackup(
    tenantId: number,
    companyName: string,
    sqlBackupPath: string,
    client: PoolClient,
  ): Promise<void> {
    const tables = await getTablesWithTenantId(client);
    const tableNames = tables.map((t: TableNameRow) => t.TABLE_NAME);

    let sqlContent = `-- Tenant Backup: ${companyName} (ID: ${tenantId})\n`;
    sqlContent += `-- Created: ${new Date().toISOString()}\n`;
    sqlContent += `-- Tables: ${tableNames.length}\n\n`;

    for (const tableName of tableNames) {
      try {
        const result = await client.query(
          `SELECT * FROM "${tableName}" WHERE tenant_id = $1`,
          [tenantId],
        );
        const data = result.rows;
        if (data.length > 0) {
          sqlContent += `-- Table: ${tableName} (${data.length} rows)\n`;
          for (const row of data) {
            sqlContent += this.generateInsertStatement(
              tableName,
              row as Record<string, unknown>,
            );
          }
          sqlContent += '\n';
        }
      } catch (error: unknown) {
        sqlContent += `-- ERROR exporting ${tableName}: ${getErrorMessage(error)}\n`;
      }
    }

    await fs.writeFile(sqlBackupPath, sqlContent);
    this.logger.log(`SQL backup created: ${sqlBackupPath}`);
  }

  /**
   * Export tenant data to JSON files
   */
  private async exportTablesToJson(
    tenantId: number,
    dataDir: string,
    client: PoolClient,
  ): Promise<{ tables: TableNameRow[]; totalRecords: number }> {
    const tables = await getTablesWithTenantId(client);
    let totalRecords = 0;

    for (const tableRow of tables) {
      const tableName = tableRow.TABLE_NAME;
      try {
        const result = await client.query(
          `SELECT * FROM "${tableName}" WHERE tenant_id = $1`,
          [tenantId],
        );
        const data = result.rows;
        if (data.length > 0) {
          const jsonPath = path.join(dataDir, `${tableName}.json`);
          await fs.writeFile(jsonPath, JSON.stringify(data, null, 2));
          totalRecords += data.length;
          this.logger.log(`Exported ${data.length} records from ${tableName}`);
        }
      } catch (error: unknown) {
        this.logger.warn(
          `Could not export ${tableName}: ${getErrorMessage(error)}`,
        );
      }
    }

    return { tables, totalRecords };
  }

  /**
   * Write backup metadata JSON file
   */
  private async writeBackupMetadata(
    backupDir: string,
    tenantId: number,
    companyName: string,
    tenant: TenantInfoRow | undefined,
    tablesExported: number,
    totalRecords: number,
  ): Promise<void> {
    const metadata = {
      tenantId,
      companyName,
      subdomain: tenant?.subdomain ?? null,
      email: tenant?.email ?? null,
      tenantCreatedAt: tenant?.created_at ?? null,
      backupCreatedAt: new Date().toISOString(),
      tablesExported,
      totalRecords,
      backupType: 'pre_deletion',
      version: '1.0',
    };
    await fs.writeFile(
      `${backupDir}/metadata.json`,
      JSON.stringify(metadata, null, 2),
    );
  }

  /**
   * Create tar.gz archive and store reference in DB
   */
  private async createArchiveAndStore(
    tenantId: number,
    backupDir: string,
    backupDirName: string,
    client: PoolClient,
  ): Promise<string> {
    const archivePath = `${backupDir}.tar.gz`;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    await promisify(exec)(
      `tar -czf "${archivePath}" -C /backups/tenant_deletions "${backupDirName}"`,
    );

    const archiveStats = await fs.stat(archivePath);
    await client.query(
      `INSERT INTO tenant_deletion_backups (tenant_id, backup_file, backup_size, backup_type) VALUES ($1, $2, $3, 'final')`,
      [tenantId, archivePath, archiveStats.size],
    );
    await client.query(
      'INSERT INTO tenant_data_exports (tenant_id, file_path, file_size) VALUES ($1, $2, $3)',
      [tenantId, archivePath, archiveStats.size],
    );

    this.logger.log(
      `Backup complete: ${archivePath} (${Math.round(archiveStats.size / 1024)} KB)`,
    );
    return archivePath;
  }

  /**
   * Generate SQL INSERT statement for a single row
   */
  private generateInsertStatement(
    tableName: string,
    row: Record<string, unknown>,
  ): string {
    const entries = Object.entries(row);
    const columns = entries.map(([col]: [string, unknown]) => `"${col}"`);
    const values = entries.map(([, val]: [string, unknown]) =>
      this.formatSqlValue(val),
    );
    return `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
  }

  /**
   * Format a value for SQL INSERT statement
   */
  private formatSqlValue(val: unknown): string {
    if (val === null) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (val instanceof Date) return `'${val.toISOString()}'`;
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    if (typeof val === 'object')
      return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    return 'NULL';
  }
}
