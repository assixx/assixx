/**
 * Tests for ZodValidationPipe
 *
 * Phase 14C — Infrastructure tests
 * Tests schema validation, error formatting, metatype schema detection,
 * pass-through behavior, and zodPipe factory.
 */
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ZodValidationPipe, zodPipe } from './zod-validation.pipe.js';

/** Simple test schema */
const TestSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

describe('ZodValidationPipe', () => {
  describe('constructor schema', () => {
    it('should validate and return parsed data with valid input', () => {
      const pipe = new ZodValidationPipe(TestSchema);

      const result = pipe.transform(
        { name: 'Alice', age: 30 },
        {
          type: 'body',
        },
      );

      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('should apply Zod transformations', () => {
      const schema = z.object({
        email: z.string().trim().toLowerCase(),
      });
      const pipe = new ZodValidationPipe(schema);

      const result = pipe.transform(
        { email: '  FOO@BAR.COM  ' },
        {
          type: 'body',
        },
      );

      expect(result).toEqual({ email: 'foo@bar.com' });
    });

    it('should throw BadRequestException for invalid data', () => {
      const pipe = new ZodValidationPipe(TestSchema);

      expect(() =>
        pipe.transform({ name: '', age: -1 }, { type: 'body' }),
      ).toThrow(BadRequestException);
    });

    it('should include VALIDATION_ERROR code in thrown exception', () => {
      const pipe = new ZodValidationPipe(TestSchema);

      let thrown: BadRequestException | undefined;
      expect(() => {
        try {
          pipe.transform({ name: '' }, { type: 'body' });
        } catch (e: unknown) {
          thrown = e as BadRequestException;
          throw e;
        }
      }).toThrow(BadRequestException);

      const response = (thrown as BadRequestException).getResponse() as {
        code: string;
        message: string;
      };
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.message).toBe('Validation failed');
    });

    it('should format field errors with path, message, and code', () => {
      const pipe = new ZodValidationPipe(TestSchema);

      let thrown: BadRequestException | undefined;
      expect(() => {
        try {
          pipe.transform({ name: '', age: 'not-a-number' }, { type: 'body' });
        } catch (e: unknown) {
          thrown = e as BadRequestException;
          throw e;
        }
      }).toThrow(BadRequestException);

      const response = (thrown as BadRequestException).getResponse() as {
        details: Array<{ field: string; message: string; code: string }>;
      };
      expect(response.details.length).toBeGreaterThanOrEqual(2);

      const nameError = response.details.find((d) => d.field === 'name') as {
        field: string;
        message: string;
        code: string;
      };
      expect(nameError.message).toMatch(/>=?1|at least 1/i);
      expect(nameError.code).toBe('too_small');

      const ageError = response.details.find((d) => d.field === 'age') as {
        field: string;
        message: string;
        code: string;
      };
      expect(ageError.code).toBe('invalid_type');
    });

    it('should handle nested path fields (dot-joined)', () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            bio: z.string().min(1),
          }),
        }),
      });
      const pipe = new ZodValidationPipe(nestedSchema);

      let thrown: BadRequestException | undefined;
      expect(() => {
        try {
          pipe.transform({ user: { profile: { bio: '' } } }, { type: 'body' });
        } catch (e: unknown) {
          thrown = e as BadRequestException;
          throw e;
        }
      }).toThrow(BadRequestException);

      const response = (thrown as BadRequestException).getResponse() as {
        details: Array<{ field: string }>;
      };
      expect(response.details[0]!.field).toBe('user.profile.bio');
    });

    it('should ignore metatype schema when constructor schema is set', () => {
      const constructorSchema = z.object({ x: z.number() });
      const metatypeSchema = z.object({ y: z.string() });
      const pipe = new ZodValidationPipe(constructorSchema);

      // This should validate against constructorSchema (x: number), NOT metatypeSchema
      const result = pipe.transform(
        { x: 42 },
        {
          type: 'body',
          metatype: { schema: metatypeSchema } as never,
        },
      );

      expect(result).toEqual({ x: 42 });
    });
  });

  describe('metatype schema (nestjs-zod)', () => {
    it('should use metatype schema when no constructor schema', () => {
      const metatypeSchema = z.object({ email: z.string().email() });
      const pipe = new ZodValidationPipe();

      const result = pipe.transform(
        { email: 'test@example.com' },
        {
          type: 'body',
          metatype: { schema: metatypeSchema } as never,
        },
      );

      expect(result).toEqual({ email: 'test@example.com' });
    });

    it('should throw BadRequestException for invalid metatype data', () => {
      const metatypeSchema = z.object({ email: z.string().email() });
      const pipe = new ZodValidationPipe();

      expect(() =>
        pipe.transform(
          { email: 'not-an-email' },
          {
            type: 'body',
            metatype: { schema: metatypeSchema } as never,
          },
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('pass-through behavior', () => {
    it('should pass through when no constructor schema and no metatype schema', () => {
      const pipe = new ZodValidationPipe();

      const result = pipe.transform(
        { anything: 'goes' },
        {
          type: 'body',
        },
      );

      expect(result).toEqual({ anything: 'goes' });
    });

    it('should pass through when metatype has no schema property', () => {
      const pipe = new ZodValidationPipe();

      const result = pipe.transform('raw-value', {
        type: 'body',
        metatype: String as never,
      });

      expect(result).toBe('raw-value');
    });

    it('should pass through when metatype is undefined', () => {
      const pipe = new ZodValidationPipe();

      const result = pipe.transform(123, { type: 'body' });

      expect(result).toBe(123);
    });
  });

  describe('non-Zod error re-throwing', () => {
    it('should re-throw non-ZodError exceptions', () => {
      // Schema that throws a non-Zod error during parse
      const faultySchema = z.string().transform(() => {
        throw new TypeError('Unexpected parse failure');
      });
      const pipe = new ZodValidationPipe(faultySchema);

      expect(() => pipe.transform('valid-string', { type: 'body' })).toThrow(
        TypeError,
      );
    });
  });

  describe('zodPipe factory', () => {
    it('should return a ZodValidationPipe instance', () => {
      const pipe = zodPipe(TestSchema);

      expect(pipe).toBeInstanceOf(ZodValidationPipe);
    });

    it('should validate with the provided schema', () => {
      const pipe = zodPipe(z.object({ id: z.number().positive() }));

      const result = pipe.transform({ id: 5 }, { type: 'param' });
      expect(result).toEqual({ id: 5 });
    });

    it('should reject invalid data via the factory-created pipe', () => {
      const pipe = zodPipe(z.object({ id: z.number().positive() }));

      expect(() => pipe.transform({ id: -1 }, { type: 'param' })).toThrow(
        BadRequestException,
      );
    });
  });
});
