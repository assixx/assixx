/**
 * Inventory DTO Validation Tests
 *
 * Covers all Zod schemas in the inventory module DTOs.
 * Pattern: ADR-018 Phase 8 — safeParse-based DTO validation tests.
 */
import { describe, expect, it } from 'vitest';

import {
  CustomValueInputSchema,
  FieldIdParamSchema,
  InventoryFieldTypeSchema,
  InventoryItemStatusSchema,
  ItemUuidParamSchema,
  ItemsQuerySchema,
  PhotoIdParamSchema,
  ReorderPhotosSchema,
  UpdatePhotoCaptionSchema,
  UploadPhotoSchema,
  UuidParamSchema,
} from './common.dto.js';
import { CreateCustomFieldSchema } from './create-custom-field.dto.js';
import { CreateItemSchema } from './create-item.dto.js';
import { CreateListSchema } from './create-list.dto.js';
import { CreateTagSchema } from './create-tag.dto.js';
import { ListsQuerySchema } from './lists-query.dto.js';
import { TagIdParamSchema } from './tag-id-param.dto.js';
import { UpdateCustomFieldSchema } from './update-custom-field.dto.js';
import { UpdateItemSchema } from './update-item.dto.js';
import { UpdateListSchema } from './update-list.dto.js';
import { UpdateTagSchema } from './update-tag.dto.js';

const VALID_UUID = '01936b7e-1c3d-7000-8000-000000000001';
const VALID_UUID_2 = '01936b7e-1c3d-7000-8000-000000000002';

// ── Path Parameter Schemas ──────────────────────────────────────

describe('UuidParamSchema', () => {
  it('should accept valid UUID', () => {
    expect(UuidParamSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    expect(UuidParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });

  it('should reject missing id', () => {
    expect(UuidParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('ItemUuidParamSchema', () => {
  it('should accept valid UUID in uuid field', () => {
    expect(ItemUuidParamSchema.safeParse({ uuid: VALID_UUID }).success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    expect(ItemUuidParamSchema.safeParse({ uuid: 'xyz' }).success).toBe(false);
  });
});

describe('FieldIdParamSchema', () => {
  it('should accept valid fieldId', () => {
    expect(FieldIdParamSchema.safeParse({ fieldId: VALID_UUID }).success).toBe(true);
  });

  it('should reject invalid fieldId', () => {
    expect(FieldIdParamSchema.safeParse({ fieldId: '' }).success).toBe(false);
  });
});

describe('PhotoIdParamSchema', () => {
  it('should accept valid photoId', () => {
    expect(PhotoIdParamSchema.safeParse({ photoId: VALID_UUID }).success).toBe(true);
  });

  it('should reject non-UUID photoId', () => {
    expect(PhotoIdParamSchema.safeParse({ photoId: '123' }).success).toBe(false);
  });
});

describe('TagIdParamSchema', () => {
  it('should accept valid tagId', () => {
    expect(TagIdParamSchema.safeParse({ tagId: VALID_UUID }).success).toBe(true);
  });

  it('should reject missing tagId', () => {
    expect(TagIdParamSchema.safeParse({}).success).toBe(false);
  });
});

// ── Enum Schemas ────────────────────────────────────────────────

describe('InventoryItemStatusSchema', () => {
  const validStatuses = [
    'operational',
    'defective',
    'repair',
    'maintenance',
    'decommissioned',
    'removed',
    'stored',
  ];

  for (const status of validStatuses) {
    it(`should accept "${status}"`, () => {
      expect(InventoryItemStatusSchema.safeParse(status).success).toBe(true);
    });
  }

  it('should reject unknown status', () => {
    expect(InventoryItemStatusSchema.safeParse('broken').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(InventoryItemStatusSchema.safeParse('').success).toBe(false);
  });
});

describe('InventoryFieldTypeSchema', () => {
  const validTypes = ['text', 'number', 'date', 'boolean', 'select'];

  for (const type of validTypes) {
    it(`should accept "${type}"`, () => {
      expect(InventoryFieldTypeSchema.safeParse(type).success).toBe(true);
    });
  }

  it('should reject unknown type', () => {
    expect(InventoryFieldTypeSchema.safeParse('json').success).toBe(false);
  });
});

// ── ItemsQuerySchema ────────────────────────────────────────────

describe('ItemsQuerySchema', () => {
  it('should accept minimal valid query (listId only)', () => {
    const data = ItemsQuerySchema.parse({ listId: VALID_UUID });
    expect(data.page).toBe(1);
    expect(data.limit).toBe(50);
  });

  it('should coerce string page/limit to numbers', () => {
    const data = ItemsQuerySchema.parse({ listId: VALID_UUID, page: '3', limit: '25' });
    expect(data.page).toBe(3);
    expect(data.limit).toBe(25);
  });

  it('should reject page < 1', () => {
    expect(ItemsQuerySchema.safeParse({ listId: VALID_UUID, page: '0' }).success).toBe(false);
  });

  it('should reject limit > 100', () => {
    expect(ItemsQuerySchema.safeParse({ listId: VALID_UUID, limit: '101' }).success).toBe(false);
  });

  it('should accept optional status filter', () => {
    const result = ItemsQuerySchema.safeParse({ listId: VALID_UUID, status: 'defective' });
    expect(result.success).toBe(true);
  });

  it('should accept optional search string', () => {
    const result = ItemsQuerySchema.safeParse({ listId: VALID_UUID, search: 'Kran' });
    expect(result.success).toBe(true);
  });

  it('should reject search > 255 chars', () => {
    const result = ItemsQuerySchema.safeParse({ listId: VALID_UUID, search: 'x'.repeat(256) });
    expect(result.success).toBe(false);
  });

  it('should reject missing listId', () => {
    expect(ItemsQuerySchema.safeParse({}).success).toBe(false);
  });

  it('should reject invalid listId', () => {
    expect(ItemsQuerySchema.safeParse({ listId: 'not-uuid' }).success).toBe(false);
  });
});

// ── CustomValueInputSchema ──────────────────────────────────────

describe('CustomValueInputSchema', () => {
  it('should accept text value', () => {
    const result = CustomValueInputSchema.safeParse({ fieldId: VALID_UUID, valueText: 'hello' });
    expect(result.success).toBe(true);
  });

  it('should accept number value', () => {
    const result = CustomValueInputSchema.safeParse({ fieldId: VALID_UUID, valueNumber: 42 });
    expect(result.success).toBe(true);
  });

  it('should accept date value (ISO format)', () => {
    const result = CustomValueInputSchema.safeParse({
      fieldId: VALID_UUID,
      valueDate: '2026-04-10',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid date format', () => {
    const result = CustomValueInputSchema.safeParse({
      fieldId: VALID_UUID,
      valueDate: '10.04.2026',
    });
    expect(result.success).toBe(false);
  });

  it('should accept boolean value', () => {
    const result = CustomValueInputSchema.safeParse({ fieldId: VALID_UUID, valueBoolean: true });
    expect(result.success).toBe(true);
  });

  it('should accept null values (nullish)', () => {
    const result = CustomValueInputSchema.safeParse({
      fieldId: VALID_UUID,
      valueText: null,
      valueNumber: null,
      valueDate: null,
      valueBoolean: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept fieldId-only (no values)', () => {
    const result = CustomValueInputSchema.safeParse({ fieldId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('should reject valueText > 5000 chars', () => {
    const result = CustomValueInputSchema.safeParse({
      fieldId: VALID_UUID,
      valueText: 'x'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

// ── Photo Schemas ───────────────────────────────────────────────

describe('UploadPhotoSchema', () => {
  it('should accept valid photo data', () => {
    const result = UploadPhotoSchema.safeParse({ filePath: '/uploads/photo.jpg', caption: 'Test' });
    expect(result.success).toBe(true);
  });

  it('should reject empty filePath', () => {
    expect(UploadPhotoSchema.safeParse({ filePath: '' }).success).toBe(false);
  });

  it('should accept null caption', () => {
    const result = UploadPhotoSchema.safeParse({ filePath: '/path.jpg', caption: null });
    expect(result.success).toBe(true);
  });

  it('should reject caption > 255 chars', () => {
    const result = UploadPhotoSchema.safeParse({ filePath: '/p.jpg', caption: 'x'.repeat(256) });
    expect(result.success).toBe(false);
  });
});

describe('UpdatePhotoCaptionSchema', () => {
  it('should accept string caption', () => {
    expect(UpdatePhotoCaptionSchema.safeParse({ caption: 'Neue Beschriftung' }).success).toBe(true);
  });

  it('should accept null caption', () => {
    expect(UpdatePhotoCaptionSchema.safeParse({ caption: null }).success).toBe(true);
  });

  it('should reject caption > 255 chars', () => {
    expect(UpdatePhotoCaptionSchema.safeParse({ caption: 'x'.repeat(256) }).success).toBe(false);
  });
});

describe('ReorderPhotosSchema', () => {
  it('should accept valid UUID array', () => {
    const result = ReorderPhotosSchema.safeParse({ photoIds: [VALID_UUID, VALID_UUID_2] });
    expect(result.success).toBe(true);
  });

  it('should reject empty array', () => {
    expect(ReorderPhotosSchema.safeParse({ photoIds: [] }).success).toBe(false);
  });

  it('should reject non-UUID entries', () => {
    expect(ReorderPhotosSchema.safeParse({ photoIds: ['abc'] }).success).toBe(false);
  });

  it('should reject > 100 entries', () => {
    const ids = Array.from({ length: 101 }, () => VALID_UUID);
    expect(ReorderPhotosSchema.safeParse({ photoIds: ids }).success).toBe(false);
  });
});

// ── ListsQuerySchema (transform logic) ──────────────────────────

describe('ListsQuerySchema', () => {
  it('should accept missing tagIds (returns undefined)', () => {
    const data = ListsQuerySchema.parse({});
    expect(data.tagIds).toBeUndefined();
  });

  it('should split comma-separated UUIDs', () => {
    const data = ListsQuerySchema.parse({ tagIds: `${VALID_UUID},${VALID_UUID_2}` });
    expect(data.tagIds).toEqual([VALID_UUID, VALID_UUID_2]);
  });

  it('should trim whitespace around UUIDs', () => {
    const data = ListsQuerySchema.parse({ tagIds: ` ${VALID_UUID} , ${VALID_UUID_2} ` });
    expect(data.tagIds).toEqual([VALID_UUID, VALID_UUID_2]);
  });

  it('should return undefined for empty string after split', () => {
    const data = ListsQuerySchema.parse({ tagIds: '  ,  ,  ' });
    expect(data.tagIds).toBeUndefined();
  });

  it('should reject invalid UUIDs after split', () => {
    const result = ListsQuerySchema.safeParse({ tagIds: 'not-a-uuid,also-not' });
    expect(result.success).toBe(false);
  });
});

// ── CreateCustomFieldSchema (with refine) ───────────────────────

describe('CreateCustomFieldSchema', () => {
  it('should accept valid text field', () => {
    const result = CreateCustomFieldSchema.safeParse({
      fieldName: 'Tragkraft',
      fieldType: 'text',
      isRequired: false,
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should default fieldType to text', () => {
    const data = CreateCustomFieldSchema.parse({ fieldName: 'Test' });
    expect(data.fieldType).toBe('text');
  });

  it('should default isRequired to false', () => {
    const data = CreateCustomFieldSchema.parse({ fieldName: 'Test' });
    expect(data.isRequired).toBe(false);
  });

  it('should accept select field with valid options', () => {
    const result = CreateCustomFieldSchema.safeParse({
      fieldName: 'Zustand',
      fieldType: 'select',
      fieldOptions: ['gut', 'schlecht'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject select field without options', () => {
    const result = CreateCustomFieldSchema.safeParse({
      fieldName: 'Zustand',
      fieldType: 'select',
    });
    expect(result.success).toBe(false);
  });

  it('should reject select field with only 1 option', () => {
    const result = CreateCustomFieldSchema.safeParse({
      fieldName: 'Zustand',
      fieldType: 'select',
      fieldOptions: ['nur-eine'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject select field with > 50 options', () => {
    const result = CreateCustomFieldSchema.safeParse({
      fieldName: 'Viel',
      fieldType: 'select',
      fieldOptions: Array.from({ length: 51 }, (_, i) => `opt-${String(i)}`),
    });
    expect(result.success).toBe(false);
  });

  it('should accept number field with unit', () => {
    const result = CreateCustomFieldSchema.safeParse({
      fieldName: 'Gewicht',
      fieldType: 'number',
      fieldUnit: 'kg',
    });
    expect(result.success).toBe(true);
  });

  it('should reject fieldUnit > 20 chars', () => {
    const result = CreateCustomFieldSchema.safeParse({
      fieldName: 'X',
      fieldType: 'number',
      fieldUnit: 'x'.repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty fieldName', () => {
    expect(CreateCustomFieldSchema.safeParse({ fieldName: '' }).success).toBe(false);
  });

  it('should reject fieldName > 100 chars', () => {
    expect(CreateCustomFieldSchema.safeParse({ fieldName: 'x'.repeat(101) }).success).toBe(false);
  });

  it('should accept non-select type with null fieldOptions (no refine error)', () => {
    const result = CreateCustomFieldSchema.safeParse({
      fieldName: 'Gewicht',
      fieldType: 'number',
      fieldOptions: null,
    });
    expect(result.success).toBe(true);
  });

  it('should reject sortOrder > 999', () => {
    const result = CreateCustomFieldSchema.safeParse({
      fieldName: 'X',
      sortOrder: 1000,
    });
    expect(result.success).toBe(false);
  });
});

// ── UpdateCustomFieldSchema ─────────────────────────────────────

describe('UpdateCustomFieldSchema', () => {
  it('should accept partial update (fieldName only)', () => {
    expect(UpdateCustomFieldSchema.safeParse({ fieldName: 'Gewicht' }).success).toBe(true);
  });

  it('should accept empty object (no changes)', () => {
    expect(UpdateCustomFieldSchema.safeParse({}).success).toBe(true);
  });

  it('should accept fieldOptions null (clear)', () => {
    expect(UpdateCustomFieldSchema.safeParse({ fieldOptions: null }).success).toBe(true);
  });

  it('should reject invalid fieldType', () => {
    expect(UpdateCustomFieldSchema.safeParse({ fieldType: 'xml' }).success).toBe(false);
  });
});

// ── CreateTagSchema ─────────────────────────────────────────────

describe('CreateTagSchema', () => {
  it('should accept valid tag', () => {
    const result = CreateTagSchema.safeParse({ name: 'Lastaufnahmemittel', icon: 'fa-anchor' });
    expect(result.success).toBe(true);
  });

  it('should accept tag without icon', () => {
    expect(CreateTagSchema.safeParse({ name: 'Test' }).success).toBe(true);
  });

  it('should reject empty name', () => {
    expect(CreateTagSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('should reject name > 50 chars', () => {
    expect(CreateTagSchema.safeParse({ name: 'x'.repeat(51) }).success).toBe(false);
  });

  it('should reject icon > 50 chars', () => {
    expect(CreateTagSchema.safeParse({ name: 'OK', icon: 'x'.repeat(51) }).success).toBe(false);
  });

  it('should trim name whitespace', () => {
    const data = CreateTagSchema.parse({ name: '  Krane  ' });
    expect(data.name).toBe('Krane');
  });
});

// ── UpdateTagSchema ─────────────────────────────────────────────

describe('UpdateTagSchema', () => {
  it('should accept partial (name only)', () => {
    expect(UpdateTagSchema.safeParse({ name: 'Neuer Name' }).success).toBe(true);
  });

  it('should accept partial (icon only)', () => {
    expect(UpdateTagSchema.safeParse({ icon: 'fa-truck' }).success).toBe(true);
  });

  it('should accept empty object', () => {
    expect(UpdateTagSchema.safeParse({}).success).toBe(true);
  });
});

// ── CreateItemSchema ────────────────────────────────────────────

describe('CreateItemSchema', () => {
  it('should accept valid item with default status', () => {
    const data = CreateItemSchema.parse({ listId: VALID_UUID, name: 'Brückenkran A' });
    expect(data.status).toBe('operational');
  });

  it('should reject missing name', () => {
    expect(CreateItemSchema.safeParse({ listId: VALID_UUID }).success).toBe(false);
  });

  it('should reject empty name', () => {
    expect(CreateItemSchema.safeParse({ listId: VALID_UUID, name: '' }).success).toBe(false);
  });

  it('should reject name > 255 chars', () => {
    expect(CreateItemSchema.safeParse({ listId: VALID_UUID, name: 'x'.repeat(256) }).success).toBe(
      false,
    );
  });

  it('should accept all optional fields', () => {
    const result = CreateItemSchema.safeParse({
      listId: VALID_UUID,
      name: 'Kran',
      description: 'Brückenkran',
      status: 'maintenance',
      location: 'Halle A',
      manufacturer: 'Demag',
      model: 'EKV 5',
      serialNumber: 'SN-123',
      yearOfManufacture: 2019,
      notes: 'Notiz',
      customValues: [{ fieldId: VALID_UUID, valueText: 'test' }],
    });
    expect(result.success).toBe(true);
  });

  it('should reject yearOfManufacture < 1900', () => {
    const result = CreateItemSchema.safeParse({
      listId: VALID_UUID,
      name: 'Kran',
      yearOfManufacture: 1899,
    });
    expect(result.success).toBe(false);
  });

  it('should reject yearOfManufacture > 2100', () => {
    const result = CreateItemSchema.safeParse({
      listId: VALID_UUID,
      name: 'Kran',
      yearOfManufacture: 2101,
    });
    expect(result.success).toBe(false);
  });

  it('should reject customValues > 30', () => {
    const cvs = Array.from({ length: 31 }, (_, i) => ({
      fieldId: VALID_UUID,
      valueText: String(i),
    }));
    const result = CreateItemSchema.safeParse({
      listId: VALID_UUID,
      name: 'Kran',
      customValues: cvs,
    });
    expect(result.success).toBe(false);
  });
});

// ── UpdateItemSchema ────────────────────────────────────────────

describe('UpdateItemSchema', () => {
  it('should accept partial update (name only)', () => {
    expect(UpdateItemSchema.safeParse({ name: 'Neuer Name' }).success).toBe(true);
  });

  it('should accept empty object', () => {
    expect(UpdateItemSchema.safeParse({}).success).toBe(true);
  });

  it('should accept null for nullable fields', () => {
    const result = UpdateItemSchema.safeParse({
      description: null,
      location: null,
      manufacturer: null,
      model: null,
      serialNumber: null,
      yearOfManufacture: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept status change', () => {
    expect(UpdateItemSchema.safeParse({ status: 'defective' }).success).toBe(true);
  });

  it('should reject invalid status', () => {
    expect(UpdateItemSchema.safeParse({ status: 'kaputt' }).success).toBe(false);
  });
});

// ── CreateListSchema ────────────────────────────────────────────

describe('CreateListSchema', () => {
  it('should accept valid list with defaults', () => {
    const data = CreateListSchema.parse({ title: 'Kräne', codePrefix: 'KRN' });
    expect(data.codeSeparator).toBe('-');
    expect(data.codeDigits).toBe(3);
  });

  it('should reject empty title', () => {
    expect(CreateListSchema.safeParse({ title: '', codePrefix: 'KRN' }).success).toBe(false);
  });

  it('should reject codePrefix < 2 chars', () => {
    expect(CreateListSchema.safeParse({ title: 'X', codePrefix: 'K' }).success).toBe(false);
  });

  it('should reject codePrefix > 5 chars', () => {
    expect(CreateListSchema.safeParse({ title: 'X', codePrefix: 'ABCDEF' }).success).toBe(false);
  });

  it('should reject lowercase codePrefix', () => {
    expect(CreateListSchema.safeParse({ title: 'X', codePrefix: 'krn' }).success).toBe(false);
  });

  it('should reject codePrefix with digits', () => {
    expect(CreateListSchema.safeParse({ title: 'X', codePrefix: 'KR1' }).success).toBe(false);
  });

  it('should accept valid codePrefix ABCDE', () => {
    expect(CreateListSchema.safeParse({ title: 'X', codePrefix: 'ABCDE' }).success).toBe(true);
  });

  it('should reject codeDigits < 2', () => {
    expect(
      CreateListSchema.safeParse({ title: 'X', codePrefix: 'KRN', codeDigits: 1 }).success,
    ).toBe(false);
  });

  it('should reject codeDigits > 6', () => {
    expect(
      CreateListSchema.safeParse({ title: 'X', codePrefix: 'KRN', codeDigits: 7 }).success,
    ).toBe(false);
  });

  it('should accept tagIds array of UUIDs', () => {
    const result = CreateListSchema.safeParse({
      title: 'X',
      codePrefix: 'KRN',
      tagIds: [VALID_UUID],
    });
    expect(result.success).toBe(true);
  });

  it('should reject tagIds > MAX_TAGS_PER_LIST (10)', () => {
    const ids = Array.from({ length: 11 }, () => VALID_UUID);
    const result = CreateListSchema.safeParse({ title: 'X', codePrefix: 'KRN', tagIds: ids });
    expect(result.success).toBe(false);
  });
});

// ── UpdateListSchema ────────────────────────────────────────────

describe('UpdateListSchema', () => {
  it('should accept partial update (title only)', () => {
    expect(UpdateListSchema.safeParse({ title: 'Neuer Titel' }).success).toBe(true);
  });

  it('should accept empty object', () => {
    expect(UpdateListSchema.safeParse({}).success).toBe(true);
  });

  it('should still enforce codePrefix regex on partial', () => {
    expect(UpdateListSchema.safeParse({ codePrefix: 'abc' }).success).toBe(false);
  });
});
