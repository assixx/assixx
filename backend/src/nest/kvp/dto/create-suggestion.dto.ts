/**
 * Create KVP Suggestion DTO
 *
 * Validation schema for creating KVP improvement suggestions.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Organization level enum
 */
const OrgLevelSchema = z.enum(
  ['company', 'department', 'area', 'team', 'machine'],
  {
    message:
      'Organization level must be company, department, area, team, or machine',
  },
);

/**
 * Priority enum
 */
const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'], {
  message: 'Priority must be low, normal, high, or urgent',
});

/**
 * Create suggestion request body schema
 *
 * Either categoryId (global) or customCategoryId (tenant-specific) must be provided.
 * Either teamIds[] or machineIds[] must be provided (at least one entry).
 */
const BaseCreateSuggestionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must not exceed 255 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must not exceed 5000 characters'),
  categoryId: IdSchema.optional().nullable(),
  customCategoryId: IdSchema.optional().nullable(),
  departmentId: IdSchema.optional().nullable(),
  orgLevel: OrgLevelSchema.optional(),
  orgId: z
    .number()
    .int()
    .min(0, 'Organization ID must be a non-negative integer')
    .optional(),
  teamIds: z
    .array(IdSchema)
    .max(3, 'Maximal 3 Teams pro Vorschlag')
    .optional()
    .default([]),
  machineIds: z.array(IdSchema).optional().default([]),
  priority: PrioritySchema.optional(),
  expectedBenefit: z
    .string()
    .trim()
    .max(500, 'Expected benefit cannot exceed 500 characters')
    .optional(),
  estimatedCost: z
    .string()
    .trim()
    .max(100, 'Estimated cost cannot exceed 100 characters')
    .optional(),
});

/**
 * Explicit output type for refine callbacks.
 * Avoids z.infer index signature that conflicts with
 * noPropertyAccessFromIndexSignature + @typescript-eslint/dot-notation.
 */
interface RefineData {
  categoryId?: number | null | undefined;
  customCategoryId?: number | null | undefined;
  teamIds: number[];
  machineIds: number[];
  orgLevel?: 'company' | 'department' | 'area' | 'team' | 'machine' | undefined;
  orgId?: number | undefined;
}

export const CreateSuggestionSchema = BaseCreateSuggestionSchema.refine(
  (data: RefineData) =>
    data.categoryId != null || data.customCategoryId != null,
  {
    message: 'Either categoryId or customCategoryId must be provided',
    path: ['categoryId'],
  },
).refine(
  (data: RefineData) =>
    data.teamIds.length > 0 ||
    data.machineIds.length > 0 ||
    (data.orgLevel !== undefined && data.orgId !== undefined),
  {
    message: 'Mindestens ein Team oder eine Maschine muss ausgewählt werden',
    path: ['teamIds'],
  },
);

/**
 * Create Suggestion DTO class
 */
export class CreateSuggestionDto extends createZodDto(CreateSuggestionSchema) {}
