/**
 * Shared Admin Schemas
 */
import { z } from 'zod';

export const EmailSchema = z
  .email('Invalid email address')
  .max(255, 'Email too long')
  .transform((val: string) => val.toLowerCase().trim());

export const UsernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(255, 'Username too long')
  .transform((val: string) => val.toLowerCase().trim());

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number');

export const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name too long')
  .regex(/^[a-zA-ZäöüÄÖÜß\s\-']+$/, 'Name contains invalid characters')
  .transform((val: string) => val.trim());

export const NotesSchema = z
  .string()
  .max(500, 'Notes too long')
  .optional()
  .transform((val: string | undefined) => val?.trim());

export const EmployeeNumberSchema = z
  .string()
  .max(50, 'Employee number too long')
  .optional()
  .transform((val: string | undefined) => val?.trim());

export const PositionSchema = z
  .string()
  .max(100, 'Position too long')
  .optional()
  .transform((val: string | undefined) => val?.trim());

export const PositionIdsSchema = z
  .array(z.uuid('Jede positionId muss eine gültige UUID sein'))
  .min(1, 'Mindestens eine Position erforderlich');
