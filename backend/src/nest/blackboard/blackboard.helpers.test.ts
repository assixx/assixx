/**
 * Unit tests for Blackboard Helpers
 *
 * Phase 6: Pure function tests — 1 test per function, no mocking needed.
 */
import { describe, expect, it } from 'vitest';

import {
  normalizeEntryFilters,
  processEntryContent,
  transformComment,
  transformEntry,
  validateSortColumn,
  validateSortDirection,
} from './blackboard.helpers.js';
import type { DbBlackboardComment, DbBlackboardEntry } from './blackboard.types.js';

describe('blackboard.helpers', () => {
  it('validateSortColumn should return default for invalid column', () => {
    expect(validateSortColumn('DROP TABLE')).toBe('created_at');
    expect(validateSortColumn('title')).toBe('title');
  });

  it('validateSortDirection should return DESC for invalid input', () => {
    expect(validateSortDirection('INVALID')).toBe('DESC');
    expect(validateSortDirection('asc')).toBe('ASC');
  });

  it('normalizeEntryFilters should apply defaults for undefined fields', () => {
    const result = normalizeEntryFilters({
      isActive: undefined,
      filter: undefined,
      search: undefined,
      page: undefined,
      limit: undefined,
      sortBy: undefined,
      sortDir: undefined,
      priority: undefined,
    });

    expect(result.isActive).toBe(1);
    expect(result.filter).toBe('all');
    expect(result.search).toBe('');
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.sortBy).toBe('created_at');
    expect(result.sortDir).toBe('DESC');
  });

  it('processEntryContent should convert Buffer to string', () => {
    const entry = {
      content: Buffer.from('Hello World', 'utf8'),
    } as DbBlackboardEntry;

    processEntryContent(entry);

    expect(entry.content).toBe('Hello World');
  });

  it('processEntryContent should convert JSON-serialized Buffer to string', () => {
    const entry = {
      content: { type: 'Buffer', data: [...Buffer.from('Hallo Welt', 'utf8')] },
    } as unknown as DbBlackboardEntry;

    processEntryContent(entry);

    expect(entry.content).toBe('Hallo Welt');
  });

  it('transformEntry should convert snake_case to camelCase and include author fields', () => {
    const entry = {
      id: 1,
      title: 'Test Entry',
      created_at: new Date('2025-01-01T00:00:00Z'),
      updated_at: new Date('2025-01-01T00:00:00Z'),
      author_full_name: 'John Doe',
      author_first_name: 'John',
      author_last_name: 'Doe',
    } as DbBlackboardEntry;

    const result = transformEntry(entry);

    expect(result['createdAt']).toBe('2025-01-01T00:00:00.000Z');
    expect(result['authorFullName']).toBe('John Doe');
    expect(result['authorFirstName']).toBe('John');
  });

  it('transformComment should map DB comment to API format', () => {
    const comment: DbBlackboardComment = {
      id: 1,
      tenant_id: 10,
      entry_id: 5,
      user_id: 3,
      comment: 'Great post',
      is_internal: 1,
      created_at: new Date('2025-02-01T12:00:00Z'),
      user_first_name: 'Jane',
      user_last_name: 'Smith',
    };

    const result = transformComment(comment);

    expect(result.id).toBe(1);
    expect(result.entryId).toBe(5);
    expect(result.isInternal).toBe(true);
    expect(result.createdAt).toBe('2025-02-01T12:00:00.000Z');
    expect(result.firstName).toBe('Jane');
  });
});
