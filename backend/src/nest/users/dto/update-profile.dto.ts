/**
 * Update Profile DTO
 *
 * Validation schema for self-updating user profile.
 * Limited fields compared to admin update.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

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
  .regex(
    /^[-0-9A-Za-z]{1,10}$/,
    'Employee number: max 10 characters (letters, numbers, hyphen)',
  )
  .optional();

/**
 * Update profile request body schema (limited fields for self-update)
 */
export const UpdateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name cannot be empty').optional(),
  lastName: z.string().trim().min(1, 'Last name cannot be empty').optional(),
  phone: PhoneSchema,
  address: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
  emergencyPhone: PhoneSchema,
  employeeNumber: EmployeeNumberSchema,
});

/**
 * Update Profile DTO class
 */
export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
