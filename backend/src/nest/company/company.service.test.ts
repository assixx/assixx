/**
 * Company Service – Unit Tests
 *
 * Tests for getCompanyData and updateCompanyData with mocked DatabaseService.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { CompanyService } from './company.service.js';
import type { UpdateCompanyDto } from './dto/company.dto.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: CompanyService;
  mockDb: { query: ReturnType<typeof vi.fn> };
} {
  const mockDb = { query: vi.fn() };
  const service = new CompanyService(mockDb as unknown as DatabaseService);
  return { service, mockDb };
}

const FULL_DB_ROW = {
  company_name: 'Test GmbH',
  street: 'Musterstraße',
  house_number: '42a',
  postal_code: '10115',
  city: 'Berlin',
  country_code: 'DE',
  phone: '+49123456789',
  email: 'info@test.de',
};

// ============================================================
// getCompanyData
// ============================================================

describe('CompanyService', () => {
  let service: CompanyService;
  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  describe('getCompanyData', () => {
    it('returns mapped company data', async () => {
      mockDb.query.mockResolvedValueOnce([FULL_DB_ROW]);

      const result = await service.getCompanyData(1);

      expect(result).toEqual({
        companyName: 'Test GmbH',
        street: 'Musterstraße',
        houseNumber: '42a',
        postalCode: '10115',
        city: 'Berlin',
        countryCode: 'DE',
        phone: '+49123456789',
        email: 'info@test.de',
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT company_name'),
        [1],
      );
    });

    it('trims country_code whitespace', async () => {
      mockDb.query.mockResolvedValueOnce([
        { ...FULL_DB_ROW, country_code: 'DE  ' },
      ]);

      const result = await service.getCompanyData(1);

      expect(result.countryCode).toBe('DE');
    });

    it('returns null for null country_code', async () => {
      mockDb.query.mockResolvedValueOnce([
        { ...FULL_DB_ROW, country_code: null },
      ]);

      const result = await service.getCompanyData(1);

      expect(result.countryCode).toBeNull();
    });

    it('returns null for nullable address fields', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          ...FULL_DB_ROW,
          street: null,
          house_number: null,
          postal_code: null,
          city: null,
          phone: null,
        },
      ]);

      const result = await service.getCompanyData(1);

      expect(result.street).toBeNull();
      expect(result.houseNumber).toBeNull();
      expect(result.postalCode).toBeNull();
      expect(result.city).toBeNull();
      expect(result.phone).toBeNull();
    });

    it('throws when tenant not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getCompanyData(999)).rejects.toThrow(
        'Tenant 999 not found',
      );
    });
  });

  // ============================================================
  // updateCompanyData
  // ============================================================

  describe('updateCompanyData', () => {
    it('updates all address fields', async () => {
      const dto: UpdateCompanyDto = {
        street: 'Neue Straße',
        houseNumber: '1',
        postalCode: '20095',
        city: 'Hamburg',
        countryCode: 'DE',
      } as UpdateCompanyDto;

      mockDb.query.mockResolvedValueOnce([
        {
          company_name: 'Test GmbH',
          street: 'Neue Straße',
          house_number: '1',
          postal_code: '20095',
          city: 'Hamburg',
          country_code: 'DE',
          phone: '+49123456789',
          email: 'info@test.de',
        },
      ]);

      const result = await service.updateCompanyData(1, dto);

      expect(result.street).toBe('Neue Straße');
      expect(result.city).toBe('Hamburg');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('UPDATE tenants SET');
      expect(sql).toContain('street = $1');
      expect(sql).toContain('house_number = $2');
      expect(sql).toContain('postal_code = $3');
      expect(sql).toContain('city = $4');
      expect(sql).toContain('country_code = $5');
      expect(sql).toContain('updated_at = NOW()');
      expect(sql).toContain('WHERE id = $6');
      expect(sql).toContain('RETURNING');

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([
        'Neue Straße',
        '1',
        '20095',
        'Hamburg',
        'DE',
        '1',
      ]);
    });

    it('updates only provided fields (partial update)', async () => {
      const dto: UpdateCompanyDto = {
        city: 'München',
      } as UpdateCompanyDto;

      mockDb.query.mockResolvedValueOnce([{ ...FULL_DB_ROW, city: 'München' }]);

      const result = await service.updateCompanyData(1, dto);

      expect(result.city).toBe('München');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('city = $1');
      expect(sql).not.toContain('street = ');
      expect(sql).toContain('WHERE id = $2');

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual(['München', '1']);
    });

    it('falls back to getCompanyData when no fields provided', async () => {
      const dto = {} as UpdateCompanyDto;
      mockDb.query.mockResolvedValueOnce([FULL_DB_ROW]);

      const result = await service.updateCompanyData(1, dto);

      expect(result.companyName).toBe('Test GmbH');
      // Should have called SELECT, not UPDATE
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('SELECT company_name');
      expect(sql).not.toContain('UPDATE');
    });

    it('throws when tenant not found after update', async () => {
      const dto: UpdateCompanyDto = {
        city: 'München',
      } as UpdateCompanyDto;

      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.updateCompanyData(999, dto)).rejects.toThrow(
        'Tenant 999 not found',
      );
    });

    it('trims country_code in update response', async () => {
      const dto: UpdateCompanyDto = {
        countryCode: 'AT',
      } as UpdateCompanyDto;

      mockDb.query.mockResolvedValueOnce([
        { ...FULL_DB_ROW, country_code: 'AT ' },
      ]);

      const result = await service.updateCompanyData(1, dto);

      expect(result.countryCode).toBe('AT');
    });
  });
});
