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

/**
 * Username validation
 * NOTE: Username = Email in our system, so we allow email characters (\@, ., etc.)
 * Regex removed to accept email-like usernames
 */
const UsernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(255, 'Username too long')
  .transform((val: string) => val.toLowerCase().trim());

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

// REMOVED: CompanySchema - company column dropped (2025-11-27)

const TenantStatusSchema = z.enum(['active', 'inactive', 'suspended', 'deleted'], {
  message: 'Invalid tenant status',
});

// ========================================
// ADMIN MANAGEMENT SCHEMAS
// ========================================

/**
 * Create Admin Schema
 * CRITICAL: username is ALWAYS set to email (lowercase) in the service
 * Username field is optional and ignored - email is the source of truth
 * REMOVED: company column dropped (2025-11-27)
 */
export const CreateAdminSchema = z.object({
  // username is optional - will be set to email in service (username = email always)
  username: UsernameSchema.optional(),
  email: EmailSchema, // Already has .toLowerCase().trim()
  password: PasswordSchema,
  firstName: OptionalNameSchema,
  lastName: OptionalNameSchema,
  notes: NotesSchema,
  employeeNumber: EmployeeNumberSchema,
  position: PositionSchema,
});

/**
 * Update Admin Schema
 * CRITICAL: When email changes, username is also updated to match (handled in service)
 * Username field is optional and IGNORED - email is the source of truth
 * REMOVED: company column dropped (2025-11-27)
 * UPDATED: isArchived removed, using isActive status (2025-12-02)
 */
export const UpdateAdminSchema = z.object({
  // username is optional and IGNORED - will be synced from email in service (username = email always)
  username: UsernameSchema.optional(),
  email: EmailSchema.optional(), // Already has .toLowerCase().trim()
  password: PasswordSchema.optional(),
  firstName: OptionalNameSchema,
  lastName: OptionalNameSchema,
  notes: NotesSchema,
  // Status: 0=inactive, 1=active, 3=archived, 4=deleted (coerce for string input from forms)
  isActive: z.coerce.number().int().min(0).max(4).optional(),
  employeeNumber: EmployeeNumberSchema,
  position: PositionSchema,
});

// ========================================
// ROOT USER MANAGEMENT SCHEMAS
// ========================================

/**
 * Create Root User Schema
 * IMPORTANT: username is always set to email (lowercase) in the service
 * Username field is optional and ignored - email is the source of truth
 */
export const CreateRootUserSchema = z.object({
  // username is optional - will be set to email in service (username = email always)
  username: UsernameSchema.optional(),
  email: EmailSchema, // Already has .toLowerCase().trim()
  password: PasswordSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  position: PositionSchema,
  notes: NotesSchema,
  employeeNumber: EmployeeNumberSchema,
  // N:M REFACTORING: departmentId removed - root users have has_full_access=1
  isActive: z.boolean().default(true),
});

/**
 * Update Root User Schema
 * IMPORTANT: When email is updated, username is also updated to match (handled in service)
 */
export const UpdateRootUserSchema = z.object({
  firstName: NameSchema.optional(),
  lastName: NameSchema.optional(),
  email: EmailSchema.optional(), // Already has .toLowerCase().trim()
  password: PasswordSchema.optional(),
  position: PositionSchema,
  notes: NotesSchema,
  employeeNumber: EmployeeNumberSchema,
  // N:M REFACTORING: departmentId removed - root users have has_full_access=1
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
