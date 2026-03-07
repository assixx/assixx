import { IS_ACTIVE } from '@assixx/shared/constants';
import { describe, expect, it } from 'vitest';

import { apiToDb, dbToApi } from './fieldMapper.js';

describe('dbToApi', () => {
  it('should convert snake_case keys to camelCase', () => {
    const input = { first_name: 'John', last_name: 'Doe' };

    const result = dbToApi(input);

    expect(result).toEqual({ firstName: 'John', lastName: 'Doe' });
  });

  it('should convert is_* fields to boolean', () => {
    expect(dbToApi({ is_admin: 1 })).toEqual({ isAdmin: true });
    expect(dbToApi({ is_admin: 0 })).toEqual({ isAdmin: false });
  });

  it('should convert has_* fields to boolean', () => {
    expect(dbToApi({ has_access: 1 })).toEqual({ hasAccess: true });
    expect(dbToApi({ has_access: 0 })).toEqual({ hasAccess: false });
  });

  it('should convert "active" key to boolean', () => {
    expect(dbToApi({ active: 1 })).toEqual({ active: true });
    expect(dbToApi({ active: 0 })).toEqual({ active: false });
  });

  it('should NOT convert is_active to boolean (multi-state: 0/1/3/4)', () => {
    expect(dbToApi({ is_active: IS_ACTIVE.INACTIVE })).toEqual({ isActive: 0 });
    expect(dbToApi({ is_active: IS_ACTIVE.ACTIVE })).toEqual({ isActive: 1 });
    expect(dbToApi({ is_active: IS_ACTIVE.ARCHIVED })).toEqual({ isActive: 3 });
    expect(dbToApi({ is_active: IS_ACTIVE.DELETED })).toEqual({ isActive: 4 });
  });

  it('should convert Date objects to ISO string', () => {
    const date = new Date('2025-06-15T10:30:00.000Z');

    const result = dbToApi({ created_at: date });

    expect(result.createdAt).toBe('2025-06-15T10:30:00.000Z');
  });

  it('should preserve null values', () => {
    expect(dbToApi({ first_name: null })).toEqual({ firstName: null });
  });

  it('should handle nested objects recursively', () => {
    const input = {
      user_name: 'test',
      user_profile: {
        first_name: 'John',
        is_verified: 1,
      },
    };

    const result = dbToApi(input);

    expect(result).toEqual({
      userName: 'test',
      userProfile: {
        firstName: 'John',
        isVerified: true,
      },
    });
  });

  it('should handle arrays of objects', () => {
    const input = {
      user_list: [{ first_name: 'John' }, { first_name: 'Jane' }],
    };

    const result = dbToApi(input);

    expect(result).toEqual({
      userList: [{ firstName: 'John' }, { firstName: 'Jane' }],
    });
  });

  it('should return empty object for empty input', () => {
    expect(dbToApi({})).toEqual({});
  });
});

describe('apiToDb', () => {
  it('should convert camelCase keys to snake_case', () => {
    const input = { firstName: 'John', lastName: 'Doe' };

    const result = apiToDb(input);

    expect(result).toEqual({ first_name: 'John', last_name: 'Doe' });
  });

  it('should preserve null values', () => {
    expect(apiToDb({ firstName: null })).toEqual({ first_name: null });
  });

  it('should handle nested objects recursively', () => {
    const input = {
      userName: 'test',
      userProfile: {
        firstName: 'John',
      },
    };

    const result = apiToDb(input);

    expect(result).toEqual({
      user_name: 'test',
      user_profile: {
        first_name: 'John',
      },
    });
  });

  it('should handle arrays of objects', () => {
    const input = {
      userList: [{ firstName: 'John' }, { firstName: 'Jane' }],
    };

    const result = apiToDb(input);

    expect(result).toEqual({
      user_list: [{ first_name: 'John' }, { first_name: 'Jane' }],
    });
  });

  it('should preserve primitive values in arrays', () => {
    const input = { tags: ['alpha', 'beta', 'gamma'] };

    const result = apiToDb(input);

    expect(result).toEqual({ tags: ['alpha', 'beta', 'gamma'] });
  });

  it('should return empty object for empty input', () => {
    expect(apiToDb({})).toEqual({});
  });
});
