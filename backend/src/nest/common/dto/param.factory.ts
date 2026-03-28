/* eslint-disable max-classes-per-file -- DTO factory: 2 pre-built classes for :id numeric + :id UUID routes */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Shared numeric ID field for route params.
 * Uses z.coerce — converts string route params to numbers.
 * Single source of truth for all `*-param.dto.ts` files.
 */
export const idField = z.coerce.number().int().positive('ID must be a positive integer');

/** Shared UUID field for route params */
export const uuidField = z.uuid('Must be a valid UUID');

/** Standard `:id` numeric param schema */
export const IdParamSchema = z.object({ id: idField });
export class IdParamDto extends createZodDto(IdParamSchema) {}

/** Standard `:id` UUID param schema */
export const UuidIdParamSchema = z.object({ id: uuidField });
export class UuidIdParamDto extends createZodDto(UuidIdParamSchema) {}

/**
 * Factory: creates a typed Zod schema for a single numeric ID route param.
 *
 * @example
 * export const AdminIdParamSchema = createIdParamSchema('adminId');
 * export class AdminIdParamDto extends createZodDto(AdminIdParamSchema) {}
 */
export function createIdParamSchema<K extends string>(
  paramName: K,
): z.ZodObject<Record<K, typeof idField>> {
  return z.object({ [paramName]: idField }) as z.ZodObject<Record<K, typeof idField>>;
}

/**
 * Factory: creates a typed Zod schema for a single UUID route param.
 *
 * @example
 * export const FileUuidParamSchema = createUuidParamSchema('fileUuid');
 * export class FileUuidParamDto extends createZodDto(FileUuidParamSchema) {}
 */
export function createUuidParamSchema<K extends string>(
  paramName: K,
): z.ZodObject<Record<K, typeof uuidField>> {
  return z.object({ [paramName]: uuidField }) as z.ZodObject<Record<K, typeof uuidField>>;
}
