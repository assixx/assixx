/**
 * Documents API v2 Validation with Zod
 * Replaces express-validator with Zod for document endpoints
 */
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.zod';
import { DateSchema, IdSchema, PaginationSchema } from '../../../schemas/common.schema';

// ============================================================
// CUSTOM SCHEMAS
// ============================================================

/**
 * Document category enum
 */
const CategorySchema = z.enum(['personal', 'work', 'training', 'general', 'salary'], {
  message: 'Invalid category',
});

/**
 * Recipient type enum
 */
const RecipientTypeSchema = z.enum(['user', 'team', 'department', 'company'], {
  message: 'Invalid recipient type',
});

/**
 * Tags array schema
 * For use in query/body parameters
 */
const TagsArraySchema = z
  .array(z.string().max(50, 'Each tag must not exceed 50 characters'))
  .optional();

/**
 * Tags JSON string schema
 * For multipart form data where tags come as JSON string
 */
const TagsJsonStringSchema = z
  .string()
  .refine(
    (val: string) => {
      try {
        const tags = JSON.parse(val) as unknown;
        if (!Array.isArray(tags)) return false;
        return tags.every((tag: unknown) => typeof tag === 'string' && tag.length <= 50);
      } catch {
        return false;
      }
    },
    { message: 'Tags must be a JSON array of strings (max 50 chars each)' },
  )
  .optional();

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * List documents query parameters
 */
export const ListDocumentsQuerySchema = PaginationSchema.extend({
  category: CategorySchema.optional(),
  recipientType: RecipientTypeSchema.optional(),
  userId: IdSchema.optional(),
  teamId: IdSchema.optional(),
  departmentId: IdSchema.optional(),
  year: z.preprocess(
    (val: unknown) =>
      typeof val === 'string' || typeof val === 'number' ?
        Number.parseInt(val.toString(), 10)
      : val,
    z.number().int().min(2000).max(2100).optional(),
  ),
  month: z.preprocess(
    (val: unknown) =>
      typeof val === 'string' || typeof val === 'number' ?
        Number.parseInt(val.toString(), 10)
      : val,
    z.number().int().min(1).max(12).optional(),
  ),
  isArchived: z.preprocess(
    (val: unknown) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
  search: z
    .string()
    .trim()
    .min(1, 'Search query must be at least 1 character')
    .max(100, 'Search query must not exceed 100 characters')
    .optional(),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Document ID parameter validation
 */
export const DocumentIdParamSchema = z.object({
  id: IdSchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create document request body
 * Note: File is handled by multer middleware
 */
export const CreateDocumentBodySchema = z.object({
  category: CategorySchema,
  recipientType: RecipientTypeSchema,
  userId: z.number().int().positive('User ID must be a positive integer').optional(),
  teamId: z.number().int().positive('Team ID must be a positive integer').optional(),
  departmentId: z.number().int().positive('Department ID must be a positive integer').optional(),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  tags: TagsJsonStringSchema,
  isPublic: z.preprocess(
    (val: unknown) =>
      val === 'true' ? true
      : val === 'false' ? false
      : val,
    z.boolean().optional(),
  ),
  expiresAt: DateSchema.optional(),
});

/**
 * Update document request body (all fields optional)
 */
export const UpdateDocumentBodySchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1, 'Filename cannot be empty')
    .max(255, 'Filename must not exceed 255 characters')
    .optional(),
  category: CategorySchema.optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be null or a string with max 500 characters')
    .nullable()
    .optional(),
  tags: TagsArraySchema.nullable(),
  isPublic: z.boolean().optional(),
  expiresAt: z
    .string()
    .refine(
      (val: string) => {
        const date = new Date(val);
        return !Number.isNaN(date.getTime());
      },
      { message: 'expiresAt must be a valid date' },
    )
    .nullable()
    .optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ListDocumentsQuery = z.infer<typeof ListDocumentsQuerySchema>;
export type DocumentIdParam = z.infer<typeof DocumentIdParamSchema>;
export type CreateDocumentBody = z.infer<typeof CreateDocumentBodySchema>;
export type UpdateDocumentBody = z.infer<typeof UpdateDocumentBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for document routes
 */
export const documentsValidationZod = {
  list: validateQuery(ListDocumentsQuerySchema),
  getById: validateParams(DocumentIdParamSchema),
  create: validateBody(CreateDocumentBodySchema),
  update: [validateParams(DocumentIdParamSchema), validateBody(UpdateDocumentBodySchema)],
  delete: validateParams(DocumentIdParamSchema),
  archive: validateParams(DocumentIdParamSchema),
  unarchive: validateParams(DocumentIdParamSchema),
};
