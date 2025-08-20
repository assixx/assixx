/**
 * Simple test to verify Jest setup
 */
import { describe, expect, it } from '@jest/globals';

describe('Simple Test', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async test', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});
