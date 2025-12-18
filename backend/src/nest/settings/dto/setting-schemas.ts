/**
 * Shared Setting Schemas
 *
 * Common schemas used across setting DTOs.
 */
import { z } from 'zod';

export const ValueTypeEnum = z.enum(['string', 'number', 'boolean', 'json']);
export const CategoryEnum = z.enum([
  'general',
  'appearance',
  'notifications',
  'security',
  'workflow',
  'integration',
  'other',
]);

/** Base setting value schema (accepts any JSON value) */
export const SettingValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.string(), z.unknown()),
]);
