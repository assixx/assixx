/**
 * Unit tests for `buildEntryValuesSchema` — Plan §R7 validation parity.
 *
 * Covers each of the 8 custom-field types (happy + failure), required vs
 * optional handling, strict-mode unknown-key rejection, composition, and
 * the empty-template edge case. Backend (`updateDraft`/`submitEntry`)
 * runs `custom_values` through the same schema-builder used here.
 *
 * MOVED 2026-04-23 from `shared/src/shift-handover/field-validators.test.ts`
 * — see Spec Deviation #8 in the masterplan and ADR-030 §7. Frontend no
 * longer ships Zod; backend remains the authoritative validator.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Phase 3 — Field validators
 * @see docs/infrastructure/adr/ADR-030-zod-validation-architecture.md §7
 * @see ./field-validators.ts (source under test)
 */
import type { ShiftHandoverFieldDef } from '@assixx/shared/shift-handover';
import { describe, expect, it } from 'vitest';

import { buildEntryValuesSchema } from './field-validators.js';

describe('buildEntryValuesSchema', () => {
  describe('text field', () => {
    const fields: ShiftHandoverFieldDef[] = [
      { key: 'note', label: 'Note', type: 'text', required: true },
    ];

    it('accepts a string up to the 1000-character cap', () => {
      const schema = buildEntryValuesSchema(fields);
      expect(schema.safeParse({ note: 'hello world' }).success).toBe(true);
      expect(schema.safeParse({ note: 'a'.repeat(1000) }).success).toBe(true);
    });

    it('rejects strings longer than 1000 characters', () => {
      const schema = buildEntryValuesSchema(fields);
      expect(schema.safeParse({ note: 'a'.repeat(1001) }).success).toBe(false);
    });
  });

  describe('textarea field', () => {
    const fields: ShiftHandoverFieldDef[] = [
      { key: 'long_note', label: 'Long note', type: 'textarea', required: true },
    ];

    it('accepts up to 10 000 characters and rejects above', () => {
      const schema = buildEntryValuesSchema(fields);
      expect(schema.safeParse({ long_note: 'a'.repeat(10_000) }).success).toBe(true);
      expect(schema.safeParse({ long_note: 'a'.repeat(10_001) }).success).toBe(false);
    });
  });

  describe('integer field', () => {
    const fields: ShiftHandoverFieldDef[] = [
      { key: 'count', label: 'Count', type: 'integer', required: true },
    ];

    it('accepts integers and rejects non-integer numbers / NaN', () => {
      const schema = buildEntryValuesSchema(fields);
      expect(schema.safeParse({ count: 42 }).success).toBe(true);
      expect(schema.safeParse({ count: -5 }).success).toBe(true);
      expect(schema.safeParse({ count: 0 }).success).toBe(true);
      expect(schema.safeParse({ count: 3.14 }).success).toBe(false);
      expect(schema.safeParse({ count: Number.NaN }).success).toBe(false);
    });
  });

  describe('decimal field', () => {
    const fields: ShiftHandoverFieldDef[] = [
      { key: 'temp', label: 'Temperature', type: 'decimal', required: true },
    ];

    it('accepts any finite number, rejects strings and NaN', () => {
      const schema = buildEntryValuesSchema(fields);
      expect(schema.safeParse({ temp: 36.7 }).success).toBe(true);
      expect(schema.safeParse({ temp: -12.5 }).success).toBe(true);
      expect(schema.safeParse({ temp: '36.7' }).success).toBe(false);
      expect(schema.safeParse({ temp: Number.NaN }).success).toBe(false);
    });
  });

  describe('date field', () => {
    const fields: ShiftHandoverFieldDef[] = [
      { key: 'due', label: 'Due', type: 'date', required: true },
    ];

    it('accepts YYYY-MM-DD and rejects other formats', () => {
      const schema = buildEntryValuesSchema(fields);
      expect(schema.safeParse({ due: '2026-04-22' }).success).toBe(true);
      expect(schema.safeParse({ due: '22.04.2026' }).success).toBe(false);
      // Missing zero-padding — regex requires two-digit month/day.
      expect(schema.safeParse({ due: '2026-4-22' }).success).toBe(false);
      expect(schema.safeParse({ due: '' }).success).toBe(false);
    });
  });

  describe('time field', () => {
    const fields: ShiftHandoverFieldDef[] = [
      { key: 'at', label: 'Arrived at', type: 'time', required: true },
    ];

    it('accepts HH:MM and HH:MM:SS, rejects 24:00 and non-padded hours', () => {
      const schema = buildEntryValuesSchema(fields);
      expect(schema.safeParse({ at: '00:00' }).success).toBe(true);
      expect(schema.safeParse({ at: '06:30' }).success).toBe(true);
      expect(schema.safeParse({ at: '23:59:59' }).success).toBe(true);
      expect(schema.safeParse({ at: '24:00' }).success).toBe(false);
      expect(schema.safeParse({ at: '9:00' }).success).toBe(false);
    });
  });

  describe('boolean field', () => {
    const fields: ShiftHandoverFieldDef[] = [
      { key: 'done', label: 'Done', type: 'boolean', required: true },
    ];

    it('accepts true/false and rejects string/number coercions', () => {
      const schema = buildEntryValuesSchema(fields);
      expect(schema.safeParse({ done: true }).success).toBe(true);
      expect(schema.safeParse({ done: false }).success).toBe(true);
      // Strict boolean: no coercion from strings/numbers (prevents '0' as truthy).
      expect(schema.safeParse({ done: 'true' }).success).toBe(false);
      expect(schema.safeParse({ done: 1 }).success).toBe(false);
    });
  });

  describe('select field', () => {
    const fields: ShiftHandoverFieldDef[] = [
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        required: true,
        options: [
          { value: 'low', label: 'Low' },
          { value: 'high', label: 'High' },
        ],
      },
    ];

    it('accepts declared option values and rejects others', () => {
      const schema = buildEntryValuesSchema(fields);
      expect(schema.safeParse({ priority: 'low' }).success).toBe(true);
      expect(schema.safeParse({ priority: 'high' }).success).toBe(true);
      expect(schema.safeParse({ priority: 'medium' }).success).toBe(false);
      expect(schema.safeParse({ priority: '' }).success).toBe(false);
    });
  });

  describe('required vs optional', () => {
    it('rejects missing required fields', () => {
      const schema = buildEntryValuesSchema([
        { key: 'note', label: 'Note', type: 'text', required: true },
      ]);
      expect(schema.safeParse({}).success).toBe(false);
    });

    it('accepts an entry that omits optional fields', () => {
      const schema = buildEntryValuesSchema([
        { key: 'note', label: 'Note', type: 'text', required: false },
      ]);
      expect(schema.safeParse({}).success).toBe(true);
    });
  });

  describe('strict mode', () => {
    it('rejects keys that are not declared in the template', () => {
      // Strict-mode is the runtime guard that enforces schema_snapshot parity
      // (plan §R2 drift safety): an entry may only carry keys that the
      // snapshot declared at submit time, never ones the client bolted on.
      const schema = buildEntryValuesSchema([
        { key: 'note', label: 'Note', type: 'text', required: false },
      ]);
      expect(schema.safeParse({ note: 'ok', rogue: 'nope' }).success).toBe(false);
    });
  });

  describe('composition', () => {
    const fields: ShiftHandoverFieldDef[] = [
      { key: 'note', label: 'Note', type: 'text', required: true },
      { key: 'count', label: 'Count', type: 'integer', required: false },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        required: true,
        options: [
          { value: 'low', label: 'Low' },
          { value: 'high', label: 'High' },
        ],
      },
    ];

    it('validates a mix of required/optional fields together', () => {
      const schema = buildEntryValuesSchema(fields);
      expect(schema.safeParse({ note: 'ok', count: 5, priority: 'low' }).success).toBe(true);
      // Optional `count` may be absent; required ones are still present.
      expect(schema.safeParse({ note: 'ok', priority: 'high' }).success).toBe(true);
    });

    it('fails the whole entry when a single field is invalid', () => {
      const schema = buildEntryValuesSchema(fields);
      const result = schema.safeParse({ note: 'ok', count: 1.5, priority: 'low' });
      expect(result.success).toBe(false);
    });
  });

  describe('empty field list', () => {
    it('accepts `{}` and rejects any extraneous key via strict mode', () => {
      // A template with no custom fields still yields a usable schema — the
      // service always runs `custom_values` through Zod regardless of size.
      const schema = buildEntryValuesSchema([]);
      expect(schema.safeParse({}).success).toBe(true);
      expect(schema.safeParse({ any: 'thing' }).success).toBe(false);
    });
  });
});
