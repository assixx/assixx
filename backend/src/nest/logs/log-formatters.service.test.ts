/**
 * Unit tests for LogFormattersService
 *
 * Phase 9: Service tests — pure logic, zero DB dependencies.
 * No mocking needed. Service instantiated directly with `new LogFormattersService()`.
 *
 * 1 test per public method. Private helpers tested indirectly through public API.
 */
import { describe, expect, it } from 'vitest';

import type { ExportMetadata, UnifiedLogEntry } from './dto/export-logs.dto.js';
import { LogFormattersService } from './log-formatters.service.js';

// =============================================================
// Test Fixtures (minimal input, reusable)
// =============================================================

function createMinimalEntry(overrides?: Partial<UnifiedLogEntry>): UnifiedLogEntry {
  return {
    id: 1,
    timestamp: '2026-02-05T10:30:00.000Z',
    tenantId: 1,
    userId: 42,
    userName: 'Max Mustermann',
    userRole: 'admin',
    source: 'audit_trail',
    action: 'create',
    entityType: 'users',
    status: 'success',
    ...overrides,
  };
}

function createMinimalMetadata(overrides?: Partial<ExportMetadata>): ExportMetadata {
  return {
    tenantId: 1,
    tenantName: 'Test GmbH',
    dateFrom: '2026-01-01T00:00:00.000Z',
    dateTo: '2026-02-05T23:59:59.000Z',
    generatedAt: '2026-02-05T12:00:00.000Z',
    totalEntries: 1234,
    source: 'all',
    ...overrides,
  };
}

// =============================================================
// LogFormattersService
// =============================================================

describe('LogFormattersService', () => {
  const service = new LogFormattersService();

  // =============================================================
  // getHeader
  // =============================================================

  describe('getHeader', () => {
    it('should return JSON opening bracket for json format', () => {
      const result = service.getHeader('json');

      expect(result).toBe('[\n');
    });

    it('should return CSV column headers for csv format', () => {
      const result = service.getHeader('csv');

      expect(result).toContain('ID,Timestamp,Source');
      expect(result).toMatch(/\n$/);
    });

    it('should return TXT header with metadata when metadata provided', () => {
      const metadata = createMinimalMetadata();

      const result = service.getHeader('txt', metadata);

      expect(result).toContain('ASSIXX AUDIT LOG EXPORT');
      expect(result).toContain('Test GmbH (ID: 1)');
    });

    it('should return empty string for txt format without metadata', () => {
      const result = service.getHeader('txt');

      expect(result).toBe('');
    });
  });

  // =============================================================
  // formatEntry
  // =============================================================

  describe('formatEntry', () => {
    it('should format entry as JSON without leading comma when isFirst is true', () => {
      const entry = createMinimalEntry();

      const result = service.formatEntry(entry, 'json', true);

      expect(result).not.toMatch(/^,/);
      const parsed = JSON.parse(result) as UnifiedLogEntry;
      expect(parsed.id).toBe(1);
    });

    it('should format entry as JSON with leading comma when isFirst is false', () => {
      const entry = createMinimalEntry();

      const result = service.formatEntry(entry, 'json', false);

      expect(result).toMatch(/^,\n/);
    });

    it('should format entry as CSV row ending with newline', () => {
      const entry = createMinimalEntry();

      const result = service.formatEntry(entry, 'csv', true);

      expect(result).toMatch(/\n$/);
      expect(result).toContain('Max Mustermann');
    });

    it('should format entry as TXT line ending with newline', () => {
      const entry = createMinimalEntry();

      const result = service.formatEntry(entry, 'txt', true);

      expect(result).toMatch(/\n$/);
      expect(result).toContain('CREATE');
    });
  });

  // =============================================================
  // getFooter
  // =============================================================

  describe('getFooter', () => {
    it('should return JSON closing bracket for json format', () => {
      const result = service.getFooter('json');

      expect(result).toBe('\n]');
    });

    it('should return empty string for csv format', () => {
      const result = service.getFooter('csv');

      expect(result).toBe('');
    });

    it('should return END OF EXPORT for txt format', () => {
      const result = service.getFooter('txt');

      expect(result).toContain('END OF EXPORT');
    });
  });

  // =============================================================
  // generateTxtHeader
  // =============================================================

  describe('generateTxtHeader', () => {
    it('should include tenant name and ID when tenantName is provided', () => {
      const metadata = createMinimalMetadata({ tenantName: 'Acme Corp', tenantId: 5 });

      const result = service.generateTxtHeader(metadata);

      expect(result).toContain('Acme Corp (ID: 5)');
    });

    it('should show only tenant ID when tenantName is empty', () => {
      const metadata = createMinimalMetadata({ tenantName: '' });

      const result = service.generateTxtHeader(metadata);

      expect(result).toContain('Tenant ID: 1');
      expect(result).not.toContain('(ID:');
    });

    it('should show combined source when source is all', () => {
      const metadata = createMinimalMetadata({ source: 'all' });

      const result = service.generateTxtHeader(metadata);

      expect(result).toContain('audit_trail + root_logs');
    });

    it('should show specific source name when source is not all', () => {
      const metadata = createMinimalMetadata({ source: 'audit_trail' });

      const result = service.generateTxtHeader(metadata);

      expect(result).toContain('Source: audit_trail');
      expect(result).not.toContain('root_logs');
    });

    it('should format totalEntries with German locale', () => {
      const metadata = createMinimalMetadata({ totalEntries: 12345 });

      const result = service.generateTxtHeader(metadata);

      expect(result).toContain('12.345');
    });
  });

  // =============================================================
  // generateTxtFooter
  // =============================================================

  describe('generateTxtFooter', () => {
    it('should contain END OF EXPORT between separators', () => {
      const result = service.generateTxtFooter();

      const lines = result.split('\n');
      const endLine = lines.find((l) => l.includes('END OF EXPORT'));
      expect(endLine).toBeDefined();
      expect(result).toContain('='.repeat(80));
    });
  });

  // =============================================================
  // formatLogAsTxt
  // =============================================================

  describe('formatLogAsTxt', () => {
    it('should include uppercase action and entity info', () => {
      const entry = createMinimalEntry({ action: 'update', entityType: 'documents', entityId: 99 });

      const result = service.formatLogAsTxt(entry);

      expect(result).toContain('UPDATE');
      expect(result).toContain('entity=documents');
      expect(result).toContain('id=99');
    });

    it('should include FAILURE marker when status is failure', () => {
      const entry = createMinimalEntry({ status: 'failure' });

      const result = service.formatLogAsTxt(entry);

      expect(result).toContain('[FAILURE]');
    });

    it('should include ROLE-SWITCHED marker when wasRoleSwitched is true', () => {
      const entry = createMinimalEntry({ wasRoleSwitched: true });

      const result = service.formatLogAsTxt(entry);

      expect(result).toContain('[ROLE-SWITCHED]');
    });

    it('should truncate details longer than 50 characters', () => {
      const longDetails = 'A'.repeat(60);
      const entry = createMinimalEntry({ details: longDetails });

      const result = service.formatLogAsTxt(entry);

      expect(result).toContain('AAA...');
      expect(result).not.toContain('A'.repeat(60));
    });

    it('should include source tag at the end', () => {
      const entry = createMinimalEntry({ source: 'root_logs' });

      const result = service.formatLogAsTxt(entry);

      expect(result).toContain('[root_logs]');
    });
  });

  // =============================================================
  // generateCsvHeader
  // =============================================================

  describe('generateCsvHeader', () => {
    it('should return all 13 column headers as comma-separated line', () => {
      const result = service.generateCsvHeader();

      const columns = result.trim().split(',');
      expect(columns).toHaveLength(13);
      expect(columns[0]).toBe('ID');
      expect(columns[12]).toBe('Role Switched');
    });
  });

  // =============================================================
  // formatLogAsCsv
  // =============================================================

  describe('formatLogAsCsv', () => {
    it('should produce comma-separated row with all fields', () => {
      const entry = createMinimalEntry();

      const result = service.formatLogAsCsv(entry);

      expect(result).toMatch(/\n$/);
      const columns = result.trim().split(',');
      expect(columns[0]).toBe('1'); // id
      expect(columns[12]).toBe('No'); // wasRoleSwitched
    });

    it('should escape CSV fields containing commas', () => {
      const entry = createMinimalEntry({ details: 'value1, value2' });

      const result = service.formatLogAsCsv(entry);

      expect(result).toContain('"value1, value2"');
    });

    it('should escape CSV fields containing double quotes', () => {
      const entry = createMinimalEntry({ details: 'said "hello"' });

      const result = service.formatLogAsCsv(entry);

      expect(result).toContain('"said ""hello"""');
    });

    it('should show Yes for wasRoleSwitched when true', () => {
      const entry = createMinimalEntry({ wasRoleSwitched: true });

      const result = service.formatLogAsCsv(entry);

      expect(result).toContain('Yes');
    });
  });

  // =============================================================
  // formatLogAsJson
  // =============================================================

  describe('formatLogAsJson', () => {
    it('should return valid JSON string of the entry', () => {
      const entry = createMinimalEntry();

      const result = service.formatLogAsJson(entry);

      const parsed = JSON.parse(result) as UnifiedLogEntry;
      expect(parsed.id).toBe(1);
      expect(parsed.userName).toBe('Max Mustermann');
    });
  });
});
