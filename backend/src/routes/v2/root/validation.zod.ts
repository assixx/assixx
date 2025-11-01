/**
 * Root Route Validation Schemas
 * CRITICAL: Root user operations - highest security level
 * Validates all root administrative actions to prevent unauthorized access and data corruption
 */
import { z } from 'zod';

// ========================================
// COMMON SCHEMAS
// ========================================

const IdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'ID must be a number')
    .transform((val: string) => Number.parseInt(val, 10))
    .refine((val: number) => val > 0, 'ID must be positive'),
});

const QueueIdParamSchema = z.object({
  queueId: z
    .string()
    .regex(/^\d+$/, 'Queue ID must be a number')
    .transform((val: string) => Number.parseInt(val, 10))
    .refine((val: number) => val > 0, 'Queue ID must be positive'),
});

const EmailSchema = z
  .string()
  .max(255, 'Email too long')
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- False positive, email() is the correct method in Zod v4
  .email('Invalid email address')
  .transform((val: string) => val.toLowerCase().trim());

const UsernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
  .transform((val: string) => val.trim());

const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number');

const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name too long')
  .regex(/^[a-zA-ZäöüÄÖÜß\s\-']+$/, 'Name contains invalid characters')
  .transform((val: string) => val.trim());

const OptionalNameSchema = NameSchema.optional();

const NotesSchema = z
  .string()
  .max(500, 'Notes too long')
  .optional()
  .transform((val: string | undefined) => val?.trim());

const EmployeeNumberSchema = z
  .string()
  .max(50, 'Employee number too long')
  .optional()
  .transform((val: string | undefined) => val?.trim());

const PositionSchema = z
  .string()
  .max(100, 'Position too long')
  .optional()
  .transform((val: string | undefined) => val?.trim());

const CompanySchema = z
  .string()
  .max(255, 'Company name too long')
  .optional()
  .transform((val: string | undefined) => val?.trim());

const TenantStatusSchema = z.enum(['active', 'inactive', 'suspended', 'deleted'], {
  message: 'Invalid tenant status',
});

// ========================================
// ADMIN MANAGEMENT SCHEMAS
// ========================================

export const CreateAdminSchema = z.object({
  username: UsernameSchema,
  email: EmailSchema,
  password: PasswordSchema,
  firstName: OptionalNameSchema,
  lastName: OptionalNameSchema,
  company: CompanySchema,
  notes: NotesSchema,
  employeeNumber: EmployeeNumberSchema,
  position: PositionSchema,
});

export const UpdateAdminSchema = z.object({
  username: UsernameSchema.optional(),
  email: EmailSchema.optional(),
  password: PasswordSchema.optional(),
  firstName: OptionalNameSchema,
  lastName: OptionalNameSchema,
  company: CompanySchema,
  notes: NotesSchema,
  isActive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  employeeNumber: EmployeeNumberSchema,
  position: PositionSchema,
});

// ========================================
// ROOT USER MANAGEMENT SCHEMAS
// ========================================

export const CreateRootUserSchema = z.object({
  username: UsernameSchema,
  email: EmailSchema,
  password: PasswordSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  position: PositionSchema,
  notes: NotesSchema,
  employeeNumber: EmployeeNumberSchema,
  departmentId: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateRootUserSchema = z.object({
  firstName: NameSchema.optional(),
  lastName: NameSchema.optional(),
  email: EmailSchema.optional(),
  password: PasswordSchema.optional(),
  position: PositionSchema,
  notes: NotesSchema,
  employeeNumber: EmployeeNumberSchema,
  departmentId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

// ========================================
// TENANT DELETION SCHEMAS
// ========================================

export const TenantDeletionRequestSchema = z.object({
  reason: z
    .string()
    .min(10, 'Deletion reason must be at least 10 characters')
    .max(500, 'Deletion reason too long')
    .optional()
    .describe('Reason for tenant deletion (required for audit)'),
});

export const DeletionApprovalSchema = z.object({
  reason: z
    .string()
    .min(5, 'Approval reason must be at least 5 characters')
    .max(500, 'Approval reason too long')
    .optional()
    .describe('Reason for approval decision'),
});

export const DeletionRejectionSchema = z.object({
  reason: z
    .string()
    .min(10, 'Rejection reason must be at least 10 characters')
    .max(500, 'Rejection reason too long')
    .describe('Reason for rejecting deletion (required)'),
});

// ========================================
// QUERY PARAMETER SCHEMAS
// ========================================

export const RootApiFiltersSchema = z.object({
  status: TenantStatusSchema.optional(),
  isActive: z
    .string()
    .regex(/^(true|false)$/, 'isActive must be true or false')
    .transform((val: string) => val === 'true')
    .optional(),
  search: z.string().max(100, 'Search term too long').optional(),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform((val: string) => Number.parseInt(val, 10))
    .refine((val: number) => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional(),
  offset: z
    .string()
    .regex(/^\d+$/, 'Offset must be a number')
    .transform((val: string) => Number.parseInt(val, 10))
    .refine((val: number) => val >= 0, 'Offset must be non-negative')
    .optional(),
});

// ========================================
// EXPORT PATH PARAM SCHEMAS
// ========================================

export const UserIdParamSchema = IdParamSchema;
export const AdminIdParamSchema = IdParamSchema;
export const QueueIdDeletionParamSchema = QueueIdParamSchema;

// ========================================
// TYPE EXPORTS
// ========================================

export type CreateAdminBody = z.infer<typeof CreateAdminSchema>;
export type UpdateAdminBody = z.infer<typeof UpdateAdminSchema>;
export type CreateRootUserBody = z.infer<typeof CreateRootUserSchema>;
export type UpdateRootUserBody = z.infer<typeof UpdateRootUserSchema>;
export type TenantDeletionRequestBody = z.infer<typeof TenantDeletionRequestSchema>;
export type DeletionApprovalBody = z.infer<typeof DeletionApprovalSchema>;
export type DeletionRejectionBody = z.infer<typeof DeletionRejectionSchema>;
export type RootApiFilters = z.infer<typeof RootApiFiltersSchema>;
