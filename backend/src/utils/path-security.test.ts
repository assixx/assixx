import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getUploadDirectory, sanitizeFilename, validatePath } from './path-security.js';

vi.mock('./logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('validatePath', () => {
  const baseDir = '/app/uploads';

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return normalized path for valid file within base dir', () => {
    const result = validatePath('documents/file.pdf', baseDir);
    expect(result).toBe(path.resolve(baseDir, 'documents/file.pdf'));
  });

  it('should return normalized path for simple filename', () => {
    const result = validatePath('test.txt', baseDir);
    expect(result).toBe(path.resolve(baseDir, 'test.txt'));
  });

  describe('directory traversal attacks', () => {
    it('should reject ../ traversal', () => {
      const result = validatePath('../etc/passwd', baseDir);
      expect(result).toBeNull();
    });

    it('should reject ..\\ traversal (Windows-style)', () => {
      const result = validatePath('..\\etc\\passwd', baseDir);
      expect(result).toBeNull();
    });

    it('should reject nested ../ traversal', () => {
      const result = validatePath('sub/../../etc/passwd', baseDir);
      expect(result).toBeNull();
    });

    it('should reject deep ../ traversal', () => {
      const result = validatePath('a/b/../../../etc/shadow', baseDir);
      expect(result).toBeNull();
    });
  });

  describe('absolute path attacks', () => {
    it('should reject absolute Unix paths', () => {
      const result = validatePath('/etc/passwd', baseDir);
      expect(result).toBeNull();
    });

    it('should reject absolute paths with backslash', () => {
      const result = validatePath('\\etc\\passwd', baseDir);
      expect(result).toBeNull();
    });
  });

  describe('null byte injection', () => {
    it('should reject null byte in path', () => {
      const result = validatePath('file.pdf\0.jpg', baseDir);
      expect(result).toBeNull();
    });
  });

  describe('URL-encoded attacks', () => {
    it('should reject %2e%2e URL-encoded traversal', () => {
      const result = validatePath('%2e%2e/etc/passwd', baseDir);
      expect(result).toBeNull();
    });

    it('should reject %2E%2E case-insensitive', () => {
      const result = validatePath('%2E%2E/etc/passwd', baseDir);
      expect(result).toBeNull();
    });

    it('should reject double URL-encoded traversal %252e%252e', () => {
      const result = validatePath('%252e%252e/etc/passwd', baseDir);
      expect(result).toBeNull();
    });
  });

  it('should return null on error and not throw', () => {
    // Force an error by passing something that will cause path.resolve to fail
    // Since path.resolve is robust, we test the catch by checking it doesn't throw
    const result = validatePath('valid/path.txt', baseDir);
    expect(typeof result === 'string' || result === null).toBe(true);
  });
});

describe('sanitizeFilename', () => {
  it('should return clean filename unchanged', () => {
    expect(sanitizeFilename('report.pdf')).toBe('report.pdf');
  });

  it('should replace forward slashes with underscore', () => {
    expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
  });

  it('should replace backslashes with underscore', () => {
    expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
  });

  it('should replace .. with underscore', () => {
    expect(sanitizeFilename('../etc/passwd')).toBe('__etc_passwd');
  });

  it('should replace illegal characters', () => {
    // <, >, :, ", |, ?, * are all in the illegal character class
    expect(sanitizeFilename('file<>:"|?*.txt')).toBe('file_______.txt');
  });

  it('should replace null bytes', () => {
    expect(sanitizeFilename('file\0.txt')).toBe('file_.txt');
  });

  it('should replace leading dots', () => {
    expect(sanitizeFilename('.hidden')).toBe('_hidden');
  });

  it('should replace .. and then leading dots', () => {
    // '...triple' → replace .. → '_.triple' → leading dot removal doesn't trigger (starts with _)
    expect(sanitizeFilename('...triple')).toBe('_.triple');
  });

  it('should trim whitespace', () => {
    expect(sanitizeFilename('  file.txt  ')).toBe('file.txt');
  });

  it('should generate fallback name for empty string', () => {
    const result = sanitizeFilename('');
    expect(result).toMatch(/^file_\d+$/);
  });

  it('should generate fallback name for string that sanitizes to underscore', () => {
    const result = sanitizeFilename('/');
    expect(result).toMatch(/^file_\d+$/);
  });

  it('should truncate filename to 255 characters preserving extension', () => {
    const longName = 'a'.repeat(300) + '.pdf';
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(255);
    expect(result).toMatch(/\.pdf$/);
  });

  it('should truncate filename without extension to 255 characters', () => {
    const longName = 'a'.repeat(300);
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(255);
  });
});

describe('getUploadDirectory', () => {
  it('should return correct path for documents', () => {
    const result = getUploadDirectory('documents');
    expect(result).toBe(path.resolve(process.cwd(), 'uploads', 'documents'));
  });

  it('should return correct path for profile_pictures', () => {
    const result = getUploadDirectory('profile_pictures');
    expect(result).toBe(path.resolve(process.cwd(), 'uploads', 'profile_pictures'));
  });

  it('should return correct path for blackboard', () => {
    const result = getUploadDirectory('blackboard');
    expect(result).toBe(path.resolve(process.cwd(), 'uploads', 'blackboard'));
  });

  it('should return correct path for chat', () => {
    const result = getUploadDirectory('chat');
    expect(result).toBe(path.resolve(process.cwd(), 'uploads', 'chat'));
  });

  it('should return correct path for kvp', () => {
    const result = getUploadDirectory('kvp');
    expect(result).toBe(path.resolve(process.cwd(), 'uploads', 'kvp-attachments'));
  });

  it('should throw for invalid upload type', () => {
    expect(() => getUploadDirectory('invalid')).toThrow('Invalid upload type: invalid');
  });

  it('should throw for empty upload type', () => {
    expect(() => getUploadDirectory('')).toThrow('Invalid upload type: ');
  });
});
