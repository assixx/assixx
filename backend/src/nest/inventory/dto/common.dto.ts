/**
 * Inventory Common DTO Schemas
 *
 * Reusable Zod schemas for inventory module validation.
 * Only schemas here — DTO classes in their own files (max-classes-per-file rule).
 */
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';

// ── Path Parameter Schemas ──────────────────────────────────────

export const UuidParamSchema = z.object({
  id: z.uuid('Ungültige UUID'),
});

export const ItemUuidParamSchema = z.object({
  uuid: z.uuid('Ungültige Item-UUID'),
});

export const FieldIdParamSchema = z.object({
  fieldId: z.uuid('Ungültige Feld-UUID'),
});

export const PhotoIdParamSchema = z.object({
  photoId: z.uuid('Ungültige Foto-UUID'),
});

// ── Enum Schemas ────────────────────────────────────────────────

export const InventoryItemStatusSchema = z.enum([
  'operational',
  'defective',
  'repair',
  'maintenance',
  'decommissioned',
  'removed',
  'stored',
]);

export const InventoryFieldTypeSchema = z.enum(['text', 'number', 'date', 'boolean', 'select']);

// ── Query Schemas ───────────────────────────────────────────────

// Phase 1.2a (2026-05-01): extends PaginationSchema (ADR-030 §4 + audit D1).
// limit default 50 (inventory-domain higher-than-default; D1 — preserve per-endpoint).
// search.max tightened 255 → 100 per D3 convention; matches KVP/Blackboard.
export const ItemsQuerySchema = PaginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  listId: z.uuid('Ungültige Listen-UUID'),
  status: InventoryItemStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

// ── Custom Value Schema (embedded in item create/update) ────────

export const CustomValueInputSchema = z.object({
  fieldId: z.uuid('Ungültige Feld-UUID'),
  valueText: z.string().max(5000).nullish(),
  valueNumber: z.number().nullish(),
  valueDate: z.iso.date('Ungültiges Datum (YYYY-MM-DD)').nullish(),
  valueBoolean: z.boolean().nullish(),
});

// ── Photo Body Schemas ─────────────────────────────────────────

export const UploadPhotoSchema = z.object({
  filePath: z.string().trim().min(1, 'Dateipfad ist erforderlich').max(1000),
  caption: z.string().trim().max(255).nullish(),
});

export const UpdatePhotoCaptionSchema = z.object({
  caption: z.string().trim().max(255).nullable(),
});

export const ReorderPhotosSchema = z.object({
  photoIds: z
    .array(z.uuid('Ungültige Foto-UUID'))
    .min(1, 'Mindestens ein Foto erforderlich')
    .max(100),
});
