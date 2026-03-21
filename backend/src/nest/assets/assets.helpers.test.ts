import { IS_ACTIVE } from '@assixx/shared/constants';
import { describe, expect, it } from 'vitest';

import {
  MACHINE_DATE_FIELD_MAPPINGS,
  MACHINE_FIELD_MAPPINGS,
  buildAssetDateFields,
  buildAssetInsertParams,
  buildAssetReferenceFields,
  buildAssetStringFields,
  buildAssetUpdateFields,
  buildMaintenanceDetailFields,
  buildMaintenanceInsertParams,
  buildMaintenanceNumericFields,
  hasContent,
  mapDbAssetToApi,
  mapMaintenanceToApi,
  parseFloatOrUndefined,
  parseIntOrZero,
  parseTeamsJson,
} from './assets.helpers.js';
import type {
  AssetCreateRequest,
  AssetUpdateRequest,
  DbAssetRow,
  DbMaintenanceRow,
  MaintenanceRecordRequest,
} from './assets.types.js';

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

function createMockAssetRow(overrides?: Partial<DbAssetRow>): DbAssetRow {
  return {
    id: 1,
    tenant_id: 10,
    uuid: '01953d6a-0000-7000-8000-000000000001',
    name: 'CNC Milling 001',
    model: null,
    manufacturer: null,
    serial_number: null,
    asset_number: null,
    department_id: null,
    area_id: null,
    location: null,
    asset_type: 'production',
    status: 'operational',
    purchase_date: null,
    installation_date: null,
    warranty_until: null,
    last_maintenance: null,
    next_maintenance: null,
    operating_hours: null,
    production_capacity: null,
    energy_consumption: null,
    manual_url: null,
    qr_code: null,
    notes: null,
    created_at: new Date('2025-01-15T10:00:00Z'),
    updated_at: new Date('2025-01-20T14:30:00Z'),
    created_by: null,
    updated_by: null,
    is_active: IS_ACTIVE.ACTIVE,
    ...overrides,
  };
}

function createMockMaintenanceRow(overrides?: Partial<DbMaintenanceRow>): DbMaintenanceRow {
  return {
    id: 100,
    tenant_id: 10,
    asset_id: 1,
    maintenance_type: 'preventive',
    performed_date: new Date('2025-06-01T08:00:00Z'),
    performed_by: null,
    external_company: null,
    description: null,
    parts_replaced: null,
    cost: null,
    duration_hours: null,
    status_after: 'operational',
    next_maintenance_date: null,
    report_url: null,
    created_at: new Date('2025-06-01T09:00:00Z'),
    created_by: null,
    ...overrides,
  };
}

// ============================================================================
// GENERAL HELPERS
// ============================================================================

describe('hasContent', () => {
  it('should return true for non-empty strings', () => {
    expect(hasContent('hello')).toBe(true);
    expect(hasContent(' ')).toBe(true);
  });

  it('should return false for null', () => {
    expect(hasContent(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(hasContent(undefined)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(hasContent('')).toBe(false);
  });
});

describe('parseIntOrZero', () => {
  it('should parse valid integer string', () => {
    expect(parseIntOrZero('42')).toBe(42);
  });

  it('should parse actual number', () => {
    expect(parseIntOrZero(42)).toBe(42);
  });

  it('should return 0 for NaN-producing input', () => {
    expect(parseIntOrZero('abc')).toBe(0);
  });

  it('should return 0 for undefined', () => {
    expect(parseIntOrZero(undefined)).toBe(0);
  });

  it('should return 0 for null', () => {
    expect(parseIntOrZero(null)).toBe(0);
  });

  it('should truncate float strings to integer', () => {
    expect(parseIntOrZero('3.9')).toBe(3);
  });

  it('should parse negative integers', () => {
    expect(parseIntOrZero('-5')).toBe(-5);
  });
});

describe('parseFloatOrUndefined', () => {
  it('should parse valid float string', () => {
    expect(parseFloatOrUndefined('3.14')).toBe(3.14);
  });

  it('should parse integer string as float', () => {
    expect(parseFloatOrUndefined('42')).toBe(42);
  });

  it('should return undefined for NaN-producing input', () => {
    expect(parseFloatOrUndefined('abc')).toBeUndefined();
  });

  it('should return undefined for undefined', () => {
    expect(parseFloatOrUndefined(undefined)).toBeUndefined();
  });

  it('should return undefined for null', () => {
    expect(parseFloatOrUndefined(null)).toBeUndefined();
  });

  it('should parse negative floats', () => {
    expect(parseFloatOrUndefined('-2.5')).toBe(-2.5);
  });
});

// ============================================================================
// MACHINE MAPPERS
// ============================================================================

describe('buildAssetStringFields', () => {
  it('should return empty object when all fields are null', () => {
    const row = createMockAssetRow();
    expect(buildAssetStringFields(row)).toEqual({});
  });

  it('should include model when not null', () => {
    const row = createMockAssetRow({ model: 'XR-500' });
    expect(buildAssetStringFields(row)).toEqual(expect.objectContaining({ model: 'XR-500' }));
  });

  it('should include all non-null string fields', () => {
    const row = createMockAssetRow({
      model: 'XR-500',
      manufacturer: 'Siemens',
      serial_number: 'SN123',
      asset_number: 'AS456',
      location: 'Hall A',
      production_capacity: '100 units/hr',
      energy_consumption: '50kW',
      manual_url: 'https://docs.example.com',
      qr_code: 'QR001',
      notes: 'Test note',
    });
    const result = buildAssetStringFields(row);
    expect(result.model).toBe('XR-500');
    expect(result.manufacturer).toBe('Siemens');
    expect(result.serialNumber).toBe('SN123');
    expect(result.assetNumber).toBe('AS456');
    expect(result.location).toBe('Hall A');
    expect(result.productionCapacity).toBe('100 units/hr');
    expect(result.energyConsumption).toBe('50kW');
    expect(result.manualUrl).toBe('https://docs.example.com');
    expect(result.qrCode).toBe('QR001');
    expect(result.notes).toBe('Test note');
  });

  it('should omit fields that are null', () => {
    const row = createMockAssetRow({ model: 'XR-500' });
    const result = buildAssetStringFields(row);
    expect(result).not.toHaveProperty('manufacturer');
    expect(result).not.toHaveProperty('serialNumber');
  });
});

describe('buildAssetDateFields', () => {
  it('should return empty object when all date fields are null', () => {
    const row = createMockAssetRow();
    expect(buildAssetDateFields(row)).toEqual({});
  });

  it('should convert purchase_date to ISO string', () => {
    const date = new Date('2024-03-15T00:00:00Z');
    const row = createMockAssetRow({ purchase_date: date });
    const result = buildAssetDateFields(row);
    expect(result.purchaseDate).toBe(date.toISOString());
  });

  it('should convert all non-null date fields', () => {
    const dates = {
      purchase_date: new Date('2024-01-01'),
      installation_date: new Date('2024-02-01'),
      warranty_until: new Date('2026-01-01'),
      last_maintenance: new Date('2025-05-01'),
      next_maintenance: new Date('2025-08-01'),
    };
    const row = createMockAssetRow(dates);
    const result = buildAssetDateFields(row);
    expect(result.purchaseDate).toBeDefined();
    expect(result.installationDate).toBeDefined();
    expect(result.warrantyUntil).toBeDefined();
    expect(result.lastMaintenance).toBeDefined();
    expect(result.nextMaintenance).toBeDefined();
  });
});

describe('parseTeamsJson', () => {
  it('should return undefined for undefined input', () => {
    expect(parseTeamsJson(undefined)).toBeUndefined();
  });

  it('should return array as-is when already parsed', () => {
    const teams = [{ id: 1, name: 'Team A' }];
    expect(parseTeamsJson(teams)).toEqual(teams);
  });

  it('should parse valid JSON string', () => {
    const json = '[{"id":1,"name":"Team A"}]';
    expect(parseTeamsJson(json)).toEqual([{ id: 1, name: 'Team A' }]);
  });

  it('should return empty array for invalid JSON', () => {
    expect(parseTeamsJson('not-json')).toEqual([]);
  });

  it('should return empty array for empty JSON string', () => {
    expect(parseTeamsJson('')).toEqual([]);
  });
});

describe('buildAssetReferenceFields', () => {
  it('should return empty object when all reference fields are null/undefined', () => {
    const row = createMockAssetRow();
    expect(buildAssetReferenceFields(row)).toEqual({});
  });

  it('should include department_id when not null', () => {
    const row = createMockAssetRow({ department_id: 5 });
    const result = buildAssetReferenceFields(row);
    expect(result.departmentId).toBe(5);
  });

  it('should include department_name when defined', () => {
    const row = createMockAssetRow({ department_name: 'Engineering' });
    const result = buildAssetReferenceFields(row);
    expect(result.departmentName).toBe('Engineering');
  });

  it('should include area fields', () => {
    const row = createMockAssetRow({ area_id: 3, area_name: 'Zone B' });
    const result = buildAssetReferenceFields(row);
    expect(result.areaId).toBe(3);
    expect(result.areaName).toBe('Zone B');
  });

  it('should include created_by and updated_by fields', () => {
    const row = createMockAssetRow({
      created_by: 7,
      created_by_name: 'John',
      updated_by: 8,
      updated_by_name: 'Jane',
    });
    const result = buildAssetReferenceFields(row);
    expect(result.createdBy).toBe(7);
    expect(result.createdByName).toBe('John');
    expect(result.updatedBy).toBe(8);
    expect(result.updatedByName).toBe('Jane');
  });

  it('should include parsed teams', () => {
    const row = createMockAssetRow({
      teams: [{ id: 1, name: 'Team A' }],
    });
    const result = buildAssetReferenceFields(row);
    expect(result.teams).toEqual([{ id: 1, name: 'Team A' }]);
  });

  it('should include operating_hours when not null', () => {
    const row = createMockAssetRow({ operating_hours: 1500 });
    const result = buildAssetReferenceFields(row);
    expect(result.operatingHours).toBe(1500);
  });
});

describe('mapDbAssetToApi', () => {
  it('should map required fields from DB row', () => {
    const row = createMockAssetRow();
    const result = mapDbAssetToApi(row);

    expect(result.id).toBe(1);
    expect(result.tenantId).toBe(10);
    expect(result.name).toBe('CNC Milling 001');
    expect(result.assetType).toBe('production');
    expect(result.status).toBe('operational');
    expect(result.isActive).toBe(true);
    expect(result.createdAt).toBe(row.created_at.toISOString());
    expect(result.updatedAt).toBe(row.updated_at.toISOString());
  });

  it('should include optional string/date/reference fields when populated', () => {
    const row = createMockAssetRow({
      model: 'XR-500',
      purchase_date: new Date('2024-01-01'),
      department_id: 5,
    });
    const result = mapDbAssetToApi(row);
    expect(result.model).toBe('XR-500');
    expect(result.purchaseDate).toBeDefined();
    expect(result.departmentId).toBe(5);
  });

  it('should convert is_active number to boolean', () => {
    const rowActive = createMockAssetRow({ is_active: IS_ACTIVE.ACTIVE });
    const rowInactive = createMockAssetRow({ is_active: IS_ACTIVE.INACTIVE });

    expect(mapDbAssetToApi(rowActive).isActive).toBe(true);
    expect(mapDbAssetToApi(rowInactive).isActive).toBe(false);
  });
});

// ============================================================================
// MAINTENANCE MAPPERS
// ============================================================================

describe('buildMaintenanceDetailFields', () => {
  it('should return empty object when all fields are null/undefined', () => {
    const row = createMockMaintenanceRow();
    expect(buildMaintenanceDetailFields(row)).toEqual({});
  });

  it('should include all non-null detail fields', () => {
    const row = createMockMaintenanceRow({
      performed_by: 5,
      performed_by_name: 'Techniker A',
      external_company: 'ServiceCo',
      description: 'Oil change',
      parts_replaced: 'Filter, gasket',
      report_url: '/reports/100.pdf',
      created_by: 3,
      created_by_name: 'Admin',
      next_maintenance_date: new Date('2025-09-01'),
    });
    const result = buildMaintenanceDetailFields(row);
    expect(result.performedBy).toBe(5);
    expect(result.performedByName).toBe('Techniker A');
    expect(result.externalCompany).toBe('ServiceCo');
    expect(result.description).toBe('Oil change');
    expect(result.partsReplaced).toBe('Filter, gasket');
    expect(result.reportUrl).toBe('/reports/100.pdf');
    expect(result.createdBy).toBe(3);
    expect(result.createdByName).toBe('Admin');
    expect(result.nextMaintenanceDate).toBeDefined();
  });
});

describe('buildMaintenanceNumericFields', () => {
  it('should return empty object when cost and duration_hours are null', () => {
    const row = createMockMaintenanceRow();
    expect(buildMaintenanceNumericFields(row)).toEqual({});
  });

  it('should parse numeric cost', () => {
    const row = createMockMaintenanceRow({ cost: 150.5 });
    expect(buildMaintenanceNumericFields(row).cost).toBe(150.5);
  });

  it('should parse string cost', () => {
    const row = createMockMaintenanceRow({ cost: '250.00' });
    expect(buildMaintenanceNumericFields(row).cost).toBe(250);
  });

  it('should parse numeric duration_hours', () => {
    const row = createMockMaintenanceRow({ duration_hours: 2.5 });
    expect(buildMaintenanceNumericFields(row).durationHours).toBe(2.5);
  });

  it('should parse string duration_hours', () => {
    const row = createMockMaintenanceRow({ duration_hours: '3.0' });
    expect(buildMaintenanceNumericFields(row).durationHours).toBe(3);
  });

  it('should omit cost when parse returns NaN', () => {
    const row = createMockMaintenanceRow({
      cost: 'not-a-number' as unknown as number,
    });
    expect(buildMaintenanceNumericFields(row)).not.toHaveProperty('cost');
  });
});

describe('mapMaintenanceToApi', () => {
  it('should map required fields', () => {
    const row = createMockMaintenanceRow();
    const result = mapMaintenanceToApi(row);

    expect(result.id).toBe(100);
    expect(result.tenantId).toBe(10);
    expect(result.assetId).toBe(1);
    expect(result.maintenanceType).toBe('preventive');
    expect(result.performedDate).toBe(row.performed_date.toISOString());
    expect(result.statusAfter).toBe('operational');
    expect(result.createdAt).toBe(row.created_at.toISOString());
  });

  it('should include optional fields when populated', () => {
    const row = createMockMaintenanceRow({
      performed_by: 5,
      cost: 100,
      duration_hours: 2,
    });
    const result = mapMaintenanceToApi(row);
    expect(result.performedBy).toBe(5);
    expect(result.cost).toBe(100);
    expect(result.durationHours).toBe(2);
  });
});

// ============================================================================
// QUERY BUILDERS
// ============================================================================

describe('buildAssetInsertParams', () => {
  it('should return params array with correct length', () => {
    const data: AssetCreateRequest = { name: 'New Asset' };
    const params = buildAssetInsertParams(data, 10, 5, 'uuid-123');
    expect(params).toHaveLength(25);
  });

  it('should place tenantId, name at positions 0 and 1', () => {
    const data: AssetCreateRequest = { name: 'Test' };
    const params = buildAssetInsertParams(data, 10, 5, 'uuid-123');
    expect(params[0]).toBe(10);
    expect(params[1]).toBe('Test');
  });

  it('should default optional fields to null', () => {
    const data: AssetCreateRequest = { name: 'Minimal' };
    const params = buildAssetInsertParams(data, 10, 5, 'uuid-123');
    // model (index 2) should be null
    expect(params[2]).toBeNull();
    // manufacturer (index 3) should be null
    expect(params[3]).toBeNull();
  });

  it('should default assetType to production and status to operational', () => {
    const data: AssetCreateRequest = { name: 'Test' };
    const params = buildAssetInsertParams(data, 10, 5, 'uuid-123');
    expect(params[9]).toBe('production');
    expect(params[10]).toBe('operational');
  });

  it('should default operatingHours to 0', () => {
    const data: AssetCreateRequest = { name: 'Test' };
    const params = buildAssetInsertParams(data, 10, 5, 'uuid-123');
    expect(params[16]).toBe(0);
  });

  it('should convert date strings to Date objects', () => {
    const data: AssetCreateRequest = {
      name: 'Test',
      purchaseDate: '2024-01-01',
    };
    const params = buildAssetInsertParams(data, 10, 5, 'uuid-123');
    expect(params[11]).toBeInstanceOf(Date);
  });

  it('should set null for empty date strings', () => {
    const data: AssetCreateRequest = {
      name: 'Test',
      purchaseDate: '',
    };
    const params = buildAssetInsertParams(data, 10, 5, 'uuid-123');
    expect(params[11]).toBeNull();
  });

  it('should place userId as created_by and updated_by', () => {
    const data: AssetCreateRequest = { name: 'Test' };
    const params = buildAssetInsertParams(data, 10, 5, 'uuid-123');
    expect(params[22]).toBe(5); // created_by
    expect(params[23]).toBe(5); // updated_by
  });

  it('should place assetUuid as last param', () => {
    const data: AssetCreateRequest = { name: 'Test' };
    const params = buildAssetInsertParams(data, 10, 5, 'my-uuid');
    expect(params[24]).toBe('my-uuid');
  });
});

describe('MACHINE_FIELD_MAPPINGS', () => {
  it('should be an array of [apiField, dbField] tuples', () => {
    for (const mapping of MACHINE_FIELD_MAPPINGS) {
      expect(mapping).toHaveLength(2);
      expect(typeof mapping[0]).toBe('string');
      expect(typeof mapping[1]).toBe('string');
    }
  });

  it('should contain name mapping', () => {
    const nameMapping = MACHINE_FIELD_MAPPINGS.find(([api]) => api === 'name');
    expect(nameMapping).toEqual(['name', 'name']);
  });

  it('should contain serialNumber → serial_number mapping', () => {
    const mapping = MACHINE_FIELD_MAPPINGS.find(([api]) => api === 'serialNumber');
    expect(mapping).toEqual(['serialNumber', 'serial_number']);
  });
});

describe('MACHINE_DATE_FIELD_MAPPINGS', () => {
  it('should contain 5 date field mappings', () => {
    expect(MACHINE_DATE_FIELD_MAPPINGS).toHaveLength(5);
  });

  it('should map purchaseDate → purchase_date', () => {
    const mapping = MACHINE_DATE_FIELD_MAPPINGS.find(([api]) => api === 'purchaseDate');
    expect(mapping).toEqual(['purchaseDate', 'purchase_date']);
  });
});

describe('buildAssetUpdateFields', () => {
  it('should return empty fields for empty update request', () => {
    const data: AssetUpdateRequest = {};
    const result = buildAssetUpdateFields(data, 5);
    // Should still include updated_by and updated_at
    expect(result.fields.some((f) => f.includes('updated_by'))).toBe(true);
    expect(result.fields).toContain('updated_at = CURRENT_TIMESTAMP');
  });

  it('should build SET clauses with parameterized placeholders', () => {
    const data: AssetUpdateRequest = {
      name: 'Updated Name',
      status: 'maintenance',
    };
    const result = buildAssetUpdateFields(data, 5);
    expect(result.fields[0]).toBe('name = $1');
    expect(result.params[0]).toBe('Updated Name');
    expect(result.fields[1]).toBe('status = $2');
    expect(result.params[1]).toBe('maintenance');
  });

  it('should include date fields when provided', () => {
    const data: AssetUpdateRequest = { purchaseDate: '2024-06-01' };
    const result = buildAssetUpdateFields(data, 5);
    const purchaseDateField = result.fields.find((f) => f.includes('purchase_date'));
    expect(purchaseDateField).toBeDefined();
    expect(result.params.some((p) => p instanceof Date)).toBe(true);
  });

  it('should always append updated_by as the last parameterized field', () => {
    const data: AssetUpdateRequest = { name: 'Test' };
    const result = buildAssetUpdateFields(data, 42);
    // updated_by should be in params
    expect(result.params).toContain(42);
  });

  it('should always append updated_at = CURRENT_TIMESTAMP', () => {
    const data: AssetUpdateRequest = {};
    const result = buildAssetUpdateFields(data, 5);
    expect(result.fields).toContain('updated_at = CURRENT_TIMESTAMP');
  });

  it('should increment paramIndex correctly', () => {
    const data: AssetUpdateRequest = { name: 'A', model: 'B' };
    const result = buildAssetUpdateFields(data, 5);
    // name=$1, model=$2, updated_by=$3 → paramIndex should be 4
    expect(result.paramIndex).toBe(4);
  });
});

describe('buildMaintenanceInsertParams', () => {
  it('should return params array with correct length', () => {
    const data: MaintenanceRecordRequest = {
      assetId: 1,
      maintenanceType: 'preventive',
      performedDate: '2025-06-01',
    };
    const params = buildMaintenanceInsertParams(data, 10, 5);
    expect(params).toHaveLength(14);
  });

  it('should place tenantId and assetId at positions 0 and 1', () => {
    const data: MaintenanceRecordRequest = {
      assetId: 7,
      maintenanceType: 'corrective',
      performedDate: '2025-06-01',
    };
    const params = buildMaintenanceInsertParams(data, 10, 5);
    expect(params[0]).toBe(10);
    expect(params[1]).toBe(7);
  });

  it('should convert performedDate to Date object', () => {
    const data: MaintenanceRecordRequest = {
      assetId: 1,
      maintenanceType: 'inspection',
      performedDate: '2025-06-15',
    };
    const params = buildMaintenanceInsertParams(data, 10, 5);
    expect(params[3]).toBeInstanceOf(Date);
  });

  it('should default performedBy to userId', () => {
    const data: MaintenanceRecordRequest = {
      assetId: 1,
      maintenanceType: 'preventive',
      performedDate: '2025-06-01',
    };
    const params = buildMaintenanceInsertParams(data, 10, 5);
    expect(params[4]).toBe(5);
  });

  it('should use provided performedBy when specified', () => {
    const data: MaintenanceRecordRequest = {
      assetId: 1,
      maintenanceType: 'preventive',
      performedDate: '2025-06-01',
      performedBy: 99,
    };
    const params = buildMaintenanceInsertParams(data, 10, 5);
    expect(params[4]).toBe(99);
  });

  it('should default statusAfter to operational', () => {
    const data: MaintenanceRecordRequest = {
      assetId: 1,
      maintenanceType: 'preventive',
      performedDate: '2025-06-01',
    };
    const params = buildMaintenanceInsertParams(data, 10, 5);
    expect(params[10]).toBe('operational');
  });

  it('should convert nextMaintenanceDate to Date when provided', () => {
    const data: MaintenanceRecordRequest = {
      assetId: 1,
      maintenanceType: 'preventive',
      performedDate: '2025-06-01',
      nextMaintenanceDate: '2025-09-01',
    };
    const params = buildMaintenanceInsertParams(data, 10, 5);
    expect(params[11]).toBeInstanceOf(Date);
  });

  it('should set null for empty nextMaintenanceDate', () => {
    const data: MaintenanceRecordRequest = {
      assetId: 1,
      maintenanceType: 'preventive',
      performedDate: '2025-06-01',
      nextMaintenanceDate: '',
    };
    const params = buildMaintenanceInsertParams(data, 10, 5);
    expect(params[11]).toBeNull();
  });

  it('should place userId as created_by (last param)', () => {
    const data: MaintenanceRecordRequest = {
      assetId: 1,
      maintenanceType: 'preventive',
      performedDate: '2025-06-01',
    };
    const params = buildMaintenanceInsertParams(data, 10, 42);
    expect(params[13]).toBe(42);
  });
});
