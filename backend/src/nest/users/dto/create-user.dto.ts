/**
 * Create User DTO
 *
 * Validation schema for creating new users.
 * Only admins and root users can create users.
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
 * Create user request body schema
 */
export const CreateUserSchema = z.object({
  email: EmailSchema,
  firstName: z.string().trim().min(1, 'First name required'),
  lastName: z.string().trim().min(1, 'Last name required'),
  password: PasswordSchema,
  role: z.enum(['employee', 'admin']).default('employee'),
  departmentId: z.number().int().positive().nullable().optional(),
  departmentIds: z.array(z.number().int().positive()).optional(),
  teamIds: z.array(z.number().int().positive()).optional(),
  hasFullAccess: z.boolean().optional(),
  position: z.string().trim().optional(),
  positionIds: z
    .array(z.uuid('Jede positionId muss eine gültige UUID sein'))
    .min(1, 'Mindestens eine Position erforderlich'),
  phone: PhoneSchema,
  address: z.string().trim().optional(),
  employeeNumber: EmployeeNumberSchema,
  dateOfBirth: z.string().trim().optional(),
  availabilityStatus: AvailabilityStatusSchema.optional(),
  availabilityStart: z.string().nullable().optional(),
  availabilityEnd: z.string().nullable().optional(),
  availabilityNotes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional(),
  notes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional(),
});

/**
 * Create User DTO class
 */
export class CreateUserDto extends createZodDto(CreateUserSchema) {}
