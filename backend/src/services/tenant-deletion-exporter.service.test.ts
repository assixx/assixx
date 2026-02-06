/**
 * Unit tests for TenantDeletionExporter
 *
 * Phase 13 Batch C (C4): MITTEL — 280 lines, 1 public method + private pure functions.
 * Tests public method integration + private pure helpers via type-safe access.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantDeletionExporter } from './tenant-deletion-exporter.service.js';
import { getTablesWithTenantId } from './tenant-deletion.helpers.js';

const { mockMkdir, mockWriteFile, mockStat, mockExecPromise } = vi.hoisted(
  () => ({
    mockMkdir: vi.fn().mockResolvedValue(undefined),
    mockWriteFile: vi.fn().mockResolvedValue(undefined),
    mockStat: vi.fn().mockResolvedValue({ size: 2048 }),
    mockExecPromise: vi.fn().mockResolvedValue(undefined),
  }),
);

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    stat: mockStat,
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecPromise),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./tenant-deletion.helpers.js', () => ({
  getTablesWithTenantId: vi.fn(),
}));

const mockGetTables = vi.mocked(getTablesWithTenantId);

/** Type-safe access to private methods */
type ExporterPrivate = {
  sanitizeCompanyName: (name: string) => string;
  formatSqlValue: (val: unknown) => string;
  generateInsertStatement: (
    table: string,
    row: Record<string, unknown>,
  ) => string;
  setupBackupPaths: (
    name: string,
    id: number,
  ) => { backupDir: string; dataDir: string; backupDirName: string };
  fetchTenantInfo: (
    id: number,
    conn: unknown,
  ) => Promise<{ company_name: string } | undefined>;
};

describe('TenantDeletionExporter', () => {
  let exporter: TenantDeletionExporter;
  let priv: ExporterPrivate;

  beforeEach(() => {
    vi.clearAllMocks();
    exporter = new TenantDeletionExporter();
    priv = exporter as unknown as ExporterPrivate;
  });

  // ============================================
  // sanitizeCompanyName (private pure)
  // ============================================

  describe('sanitizeCompanyName', () => {
    it('should lowercase the name', () => {
      expect(priv.sanitizeCompanyName('ACME')).toBe('acme');
    });

    it('should replace special chars with underscore', () => {
      expect(priv.sanitizeCompanyName('Acme & Co.')).toBe('acme_co');
    });

    it('should collapse multiple underscores', () => {
      expect(priv.sanitizeCompanyName('a---b___c')).toBe('a_b_c');
    });

    it('should trim leading/trailing underscores', () => {
      expect(priv.sanitizeCompanyName('--test--')).toBe('test');
    });

    it('should truncate to 50 chars', () => {
      const longName = 'a'.repeat(100);
      expect(priv.sanitizeCompanyName(longName)).toHaveLength(50);
    });

    it('should preserve German umlauts', () => {
      const result = priv.sanitizeCompanyName('Müller GmbH');
      expect(result).toContain('müller');
    });

    it('should handle empty string', () => {
      expect(priv.sanitizeCompanyName('')).toBe('');
    });
  });

  // ============================================
  // formatSqlValue (private pure)
  // ============================================

  describe('formatSqlValue', () => {
    it('should return NULL for null', () => {
      expect(priv.formatSqlValue(null)).toBe('NULL');
    });

    it('should return number as string', () => {
      expect(priv.formatSqlValue(42)).toBe('42');
    });

    it('should return TRUE/FALSE for booleans', () => {
      expect(priv.formatSqlValue(true)).toBe('TRUE');
      expect(priv.formatSqlValue(false)).toBe('FALSE');
    });

    it('should return Date as ISO string in quotes', () => {
      const date = new Date('2025-01-15T12:00:00.000Z');
      expect(priv.formatSqlValue(date)).toBe("'2025-01-15T12:00:00.000Z'");
    });

    it('should return string with escaped single quotes', () => {
      expect(priv.formatSqlValue("it's")).toBe("'it''s'");
    });

    it('should return object as JSON with escaped quotes', () => {
      expect(priv.formatSqlValue({ key: "val'ue" })).toBe(
        '\'{"key":"val\'\'ue"}\'',
      );
    });

    it('should return NULL for undefined', () => {
      expect(priv.formatSqlValue(undefined)).toBe('NULL');
    });

    it('should return zero as string', () => {
      expect(priv.formatSqlValue(0)).toBe('0');
    });
  });

  // ============================================
  // generateInsertStatement (private pure)
  // ============================================

  describe('generateInsertStatement', () => {
    it('should generate correct INSERT statement', () => {
      const result = priv.generateInsertStatement('users', {
        id: 1,
        name: 'Test',
      });

      expect(result).toBe(
        'INSERT INTO "users" ("id", "name") VALUES (1, \'Test\');\n',
      );
    });

    it('should handle multiple column types', () => {
      const result = priv.generateInsertStatement('records', {
        id: 42,
        active: true,
        note: null,
      });

      expect(result).toContain('"id", "active", "note"');
      expect(result).toContain('42, TRUE, NULL');
    });
  });

  // ============================================
  // setupBackupPaths (private pure)
  // ============================================

  describe('setupBackupPaths', () => {
    it('should create backup directory under /backups/tenant_deletions', () => {
      const { backupDir, dataDir } = priv.setupBackupPaths('Acme Corp', 1);

      expect(backupDir).toMatch(
        /^\/backups\/tenant_deletions\/acme_corp_1_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/,
      );
      expect(dataDir).toBe(`${backupDir}/data`);
    });

    it('should sanitize company name in directory', () => {
      const { backupDirName } = priv.setupBackupPaths('Bad & Co!', 5);

      expect(backupDirName).toMatch(/^bad_co_5_/);
    });
  });

  // ============================================
  // fetchTenantInfo (private, DB-mocked)
  // ============================================

  describe('fetchTenantInfo', () => {
    it('should return tenant info from DB', async () => {
      const mockConn = {
        query: vi.fn().mockResolvedValue([
          {
            company_name: 'Corp',
            subdomain: 'corp',
            email: 'a@b.com',
            created_at: '2024-01-01',
          },
        ]),
      };

      const result = await priv.fetchTenantInfo(1, mockConn);

      expect(result).toEqual(expect.objectContaining({ company_name: 'Corp' }));
    });

    it('should return undefined when tenant not found', async () => {
      const mockConn = { query: vi.fn().mockResolvedValue([]) };

      const result = await priv.fetchTenantInfo(999, mockConn);

      expect(result).toBeUndefined();
    });
  });

  // ============================================
  // createTenantDataExport (public orchestrator)
  // ============================================

  describe('createTenantDataExport', () => {
    it('should orchestrate full backup creation', async () => {
      const mockConn = { query: vi.fn() };

      // fetchTenantInfo
      mockConn.query.mockResolvedValueOnce([
        {
          company_name: 'TestCorp',
          subdomain: 'test',
          email: 'e@e.com',
          created_at: '2024-01-01',
        },
      ]);

      // createSqlBackup: getTablesWithTenantId + data queries
      mockGetTables.mockResolvedValueOnce([{ TABLE_NAME: 'users' }] as never);
      mockConn.query.mockResolvedValueOnce([{ id: 1, name: 'Test' }]); // SELECT * FROM users

      // exportTablesToJson: getTablesWithTenantId + data queries
      mockGetTables.mockResolvedValueOnce([{ TABLE_NAME: 'users' }] as never);
      mockConn.query.mockResolvedValueOnce([{ id: 1, name: 'Test' }]);

      // createArchiveAndStore: INSERT backup + INSERT export
      mockConn.query
        .mockResolvedValueOnce(undefined) // INSERT backup
        .mockResolvedValueOnce(undefined); // INSERT export

      const archivePath = await exporter.createTenantDataExport(
        1,
        mockConn as never,
      );

      expect(archivePath).toContain('.tar.gz');
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockExecPromise).toHaveBeenCalled();
    });

    it('should use "unknown" when tenant has no company_name', async () => {
      const mockConn = { query: vi.fn() };

      // fetchTenantInfo — no tenant found
      mockConn.query.mockResolvedValueOnce([]);

      // createSqlBackup
      mockGetTables.mockResolvedValueOnce([] as never);

      // exportTablesToJson
      mockGetTables.mockResolvedValueOnce([] as never);

      // createArchiveAndStore
      mockConn.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const archivePath = await exporter.createTenantDataExport(
        1,
        mockConn as never,
      );

      expect(archivePath).toContain('unknown');
    });

    it('should handle table export errors gracefully', async () => {
      const mockConn = { query: vi.fn() };

      // fetchTenantInfo
      mockConn.query.mockResolvedValueOnce([
        { company_name: 'Corp', subdomain: 's', email: null, created_at: null },
      ]);

      // createSqlBackup: table query fails
      mockGetTables.mockResolvedValueOnce([{ TABLE_NAME: 'broken' }] as never);
      mockConn.query.mockRejectedValueOnce(new Error('table gone'));

      // exportTablesToJson: table query fails
      mockGetTables.mockResolvedValueOnce([{ TABLE_NAME: 'broken' }] as never);
      mockConn.query.mockRejectedValueOnce(new Error('table gone'));

      // createArchiveAndStore
      mockConn.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      // Should not throw — errors are logged/captured
      const archivePath = await exporter.createTenantDataExport(
        1,
        mockConn as never,
      );

      expect(archivePath).toContain('.tar.gz');
    });
  });
});
