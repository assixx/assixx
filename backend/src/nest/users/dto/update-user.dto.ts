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
const AvailabilityStatusSchema = z.enum(['available', 'vacation', 'sick', 'training', 'other']);

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
  phone: PhoneSchema,
  address: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  employeeNumber: EmployeeNumberSchema,
  dateOfBirth: z.string().trim().optional(),
  availabilityStatus: AvailabilityStatusSchema.optional(),
  availabilityStart: z.string().nullable().optional(),
  availabilityEnd: z.string().nullable().optional(),
  availabilityNotes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional(),
});

/**
 * Update User DTO class
 */
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
