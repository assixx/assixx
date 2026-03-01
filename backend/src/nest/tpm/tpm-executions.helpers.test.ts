import { describe, expect, it } from 'vitest';

import {
  type TpmExecutionJoinRow,
  mapDefectRowToApi,
  mapExecutionRowToApi,
  mapPhotoRowToApi,
  toIsoString,
} from './tpm-executions.helpers.js';
import type {
  TpmCardExecutionPhotoRow,
  TpmExecutionDefectRow,
} from './tpm.types.js';

// =============================================================
// toIsoString
// =============================================================

describe('toIsoString', () => {
  it('should pass through string values unchanged', () => {
    expect(toIsoString('2026-03-01T10:00:00.000Z')).toBe(
      '2026-03-01T10:00:00.000Z',
    );
  });

  it('should convert Date to ISO string', () => {
    const date = new Date('2026-03-01T10:00:00.000Z');
    expect(toIsoString(date)).toBe('2026-03-01T10:00:00.000Z');
  });
});

// =============================================================
// mapDefectRowToApi
// =============================================================

describe('mapDefectRowToApi', () => {
  const baseRow: TpmExecutionDefectRow = {
    id: 1,
    uuid: '  019c9547-9fc0-771a-b022-3767e233d6f3  ',
    tenant_id: 1,
    execution_id: 10,
    title: 'Leckage am Ventil',
    description: 'Ölaustritt an Position 3',
    position_number: 1,
    is_active: 1,
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
  };

  it('should map all fields correctly', () => {
    const result = mapDefectRowToApi(baseRow);
    expect(result).toEqual({
      uuid: '019c9547-9fc0-771a-b022-3767e233d6f3',
      title: 'Leckage am Ventil',
      description: 'Ölaustritt an Position 3',
      positionNumber: 1,
      createdAt: '2026-03-01T10:00:00.000Z',
    });
  });

  it('should trim uuid whitespace', () => {
    const result = mapDefectRowToApi(baseRow);
    expect(result.uuid).not.toContain(' ');
  });

  it('should handle null description', () => {
    const result = mapDefectRowToApi({ ...baseRow, description: null });
    expect(result.description).toBeNull();
  });

  it('should convert Date created_at', () => {
    const result = mapDefectRowToApi({
      ...baseRow,
      created_at: new Date('2026-01-15T08:30:00Z') as unknown as string,
    });
    expect(result.createdAt).toBe('2026-01-15T08:30:00.000Z');
  });
});

// =============================================================
// mapExecutionRowToApi
// =============================================================

describe('mapExecutionRowToApi', () => {
  const baseRow: TpmExecutionJoinRow = {
    id: 1,
    uuid: '  019ca5f9-e841-755e-8168-dd68579fa70a  ',
    tenant_id: 1,
    card_id: 5,
    executed_by: 42,
    execution_date: '2026-03-01',
    documentation: 'Alles in Ordnung',
    approval_status: 'none',
    approved_by: null,
    approved_at: null,
    approval_note: null,
    custom_data: {},
    no_issues_found: true,
    actual_duration_minutes: 15,
    actual_staff_count: 2,
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:30:00.000Z',
  };

  it('should map required fields', () => {
    const result = mapExecutionRowToApi(baseRow);
    expect(result.uuid).toBe('019ca5f9-e841-755e-8168-dd68579fa70a');
    expect(result.executedBy).toBe(42);
    expect(result.noIssuesFound).toBe(true);
    expect(result.actualDurationMinutes).toBe(15);
    expect(result.actualStaffCount).toBe(2);
    expect(result.approvalStatus).toBe('none');
    expect(result.approvedBy).toBeNull();
    expect(result.approvedAt).toBeNull();
  });

  it('should include optional card_uuid when present', () => {
    const result = mapExecutionRowToApi({
      ...baseRow,
      card_uuid: '  abc-def  ',
    });
    expect(result.cardUuid).toBe('abc-def');
  });

  it('should omit cardUuid when card_uuid undefined', () => {
    const result = mapExecutionRowToApi(baseRow);
    expect(result.cardUuid).toBeUndefined();
  });

  it('should include photo_count when present', () => {
    const result = mapExecutionRowToApi({ ...baseRow, photo_count: 3 });
    expect(result.photoCount).toBe(3);
  });

  it('should include defect_count when present', () => {
    const result = mapExecutionRowToApi({ ...baseRow, defect_count: 5 });
    expect(result.defectCount).toBe(5);
  });

  it('should omit defectCount when defect_count undefined', () => {
    const result = mapExecutionRowToApi(baseRow);
    expect(result.defectCount).toBeUndefined();
  });

  it('should include executed_by_name when present', () => {
    const result = mapExecutionRowToApi({
      ...baseRow,
      executed_by_name: 'Max Müller',
    });
    expect(result.executedByName).toBe('Max Müller');
  });

  it('should include participants array when present', () => {
    const result = mapExecutionRowToApi({
      ...baseRow,
      participants: [{ uuid: 'p1', firstName: 'Anna', lastName: 'Schmidt' }],
    });
    expect(result.participants).toHaveLength(1);
    expect(result.participants?.[0]?.firstName).toBe('Anna');
  });

  it('should handle approved_at as Date', () => {
    const result = mapExecutionRowToApi({
      ...baseRow,
      approved_at: new Date('2026-03-02T14:00:00Z') as unknown as string,
    });
    expect(result.approvedAt).toBe('2026-03-02T14:00:00.000Z');
  });
});

// =============================================================
// mapPhotoRowToApi
// =============================================================

describe('mapPhotoRowToApi', () => {
  const baseRow: TpmCardExecutionPhotoRow = {
    id: 1,
    uuid: '  photo-uuid-123  ',
    tenant_id: 1,
    execution_id: 10,
    file_path: 'uploads/tpm/photo.jpg',
    file_name: 'photo.jpg',
    file_size: 1024,
    mime_type: 'image/jpeg',
    sort_order: 1,
    created_at: '2026-03-01T10:00:00.000Z',
  };

  it('should map all fields correctly', () => {
    const result = mapPhotoRowToApi(baseRow);
    expect(result).toEqual({
      uuid: 'photo-uuid-123',
      filePath: 'uploads/tpm/photo.jpg',
      fileName: 'photo.jpg',
      fileSize: 1024,
      mimeType: 'image/jpeg',
      sortOrder: 1,
      createdAt: '2026-03-01T10:00:00.000Z',
    });
  });

  it('should trim uuid whitespace', () => {
    const result = mapPhotoRowToApi(baseRow);
    expect(result.uuid).toBe('photo-uuid-123');
  });
});
