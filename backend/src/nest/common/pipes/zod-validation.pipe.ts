/**
 * Zod Validation Pipe
 *
 * Validates incoming request data against Zod schemas.
 * Transforms and validates body, query, and params.
 */
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { ZodError, z } from 'zod';

/**
 * Format Zod validation errors for API response
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

/**
 * Global validation pipe using Zod
 * Works with nestjs-zod DTOs automatically
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: z.ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // If a specific schema was provided in constructor, use it
    if (this.schema !== undefined) {
      return this.validate(value, this.schema);
    }

    // Check if the metatype has a Zod schema (from nestjs-zod)
    const metatype = metadata.metatype as { schema?: z.ZodType } | undefined;

    if (metatype?.schema !== undefined) {
      return this.validate(value, metatype.schema);
    }

    // No schema found, pass through
    return value;
  }

  private validate(value: unknown, schema: z.ZodType): unknown {
    try {
      // Parse validates and transforms the value
      return schema.parse(value);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const details = this.formatZodError(error);
        throw new BadRequestException({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
        });
      }
      throw error;
    }
  }

  private formatZodError(error: ZodError): ValidationErrorDetail[] {
    return error.issues.map((issue: ZodError['issues'][number]) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
  }
}

/**
 * Create a validation pipe for a specific Zod schema
 *
 * @example
 * ```typescript
 * \@Post()
 * \@UsePipes(zodPipe(CreateUserSchema))
 * create(\@Body() dto: CreateUserDto) {
 *   // dto is validated and typed
 * }
 * ```
 */
export function zodPipe(schema: z.ZodType): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}
