/**
 * Change Password DTO
 *
 * Validation schema for password change requests.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Change password request body schema
 */
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .max(72, 'Password cannot exceed 72 characters'),
    confirmPassword: z.string(),
  })
  .refine(
    (data: { newPassword: string; currentPassword: string }) =>
      data.newPassword !== data.currentPassword,
    {
      message: 'New password must be different from current password',
      path: ['newPassword'],
    },
  )
  .refine(
    (data: { newPassword: string; confirmPassword: string }) =>
      data.newPassword === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    },
  );

/**
 * Change Password DTO class
 */
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
