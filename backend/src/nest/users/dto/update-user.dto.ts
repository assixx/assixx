/**
 * Update User DTO
 *
 * Validation schema for updating users.
 * All fields are optional for partial updates.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailSchema, PasswordSchema } from '../../../schemas/common.schema.js';

/**
 * Phone number validation schema
 */
const PhoneSchema = z
  .string()
  .regex(
    /^\+[0-9]{7,29}$/,
    'Invalid phone number format (must start with + and contain 7-29 digits)',
  )
  .nullable()
  .optional();

/**
 * Employee number validation schema
 */
const EmployeeNumberSchema = z
  .string()
  .regex(/^[-0-9A-Za-z]{1,10}$/, 'Employee number: max 10 characters (letters, numbers, hyphen)')
  .optional();

/**
 * Availability status enum
 */
const AvailabilityStatusSchema = z.enum([
  'available',
  'vacation',
  'sick',
  'unavailable',
  'training',
  'other',
]);

/**
 * Update user request body schema
 */
export const UpdateUserSchema = z.object({
  email: EmailSchema.optional(),
  firstName: z.string().trim().min(1, 'First name cannot be empty').optional(),
  lastName: z.string().trim().min(1, 'Last name cannot be empty').optional(),
  password: PasswordSchema.optional(),
  role: z.enum(['employee', 'admin']).optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  departmentIds: z.array(z.number().int().positive()).optional(),
  teamIds: z.array(z.number().int().positive()).optional(),
  hasFullAccess: z.boolean().optional(),
  position: z.string().trim().optional(),
  positionIds: z
    .array(z.uuid('Jede positionId muss eine gültige UUID sein'))
    .min(1, 'Mindestens eine Position erforderlich')
    .optional(),
  phone: PhoneSchema,
  address: z.string().trim().optional(),
  isActive: z.union([z.literal(0), z.literal(1), z.literal(3)]).optional(), // 0=inactive, 1=active, 3=archived
  employeeNumber: EmployeeNumberSchema,
  dateOfBirth: z.string().trim().optional(),
  availabilityStatus: AvailabilityStatusSchema.optional(),
  availabilityStart: z.string().nullable().optional(),
  availabilityEnd: z.string().nullable().optional(),
  availabilityReason: z
    .string()
    .trim()
    .max(255, 'Reason must not exceed 255 characters')
    .optional(),
  availabilityNotes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional(),
  notes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional(),
});

/**
 * Update User DTO class
 */
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
