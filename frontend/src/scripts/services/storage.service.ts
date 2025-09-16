/**
 * Storage Service for Assixx
 * Handles localStorage with type safety and expiration
 */

import type { StorageItem } from '../../types/utils.types';

/**
 *
 */
export class StorageService {
  private prefix: string;

  /**
   *
   * @param prefix
   */
  constructor(prefix = 'assixx_') {
    this.prefix = prefix;
  }

  /**
   * Get item from storage
   * @param key
   */
  get(key: string): unknown {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (item === null || item === '') return null;

      const parsed = JSON.parse(item) as StorageItem;

      // Check if item has expired
      if (parsed.expiry !== undefined && Date.now() > parsed.expiry) {
        this.remove(key);
        return null;
      }

      return parsed.value;
    } catch (error) {
      console.error('Error getting from storage:', error);
      return null;
    }
  }

  /**
   * Set item in storage with optional expiration
   * @param key
   * @param value
   * @param expiryMinutes
   */
  set(key: string, value: unknown, expiryMinutes?: number): void {
    try {
      const item: StorageItem = {
        key: this.prefix + key,
        value,
      };

      if (expiryMinutes !== undefined && expiryMinutes > 0) {
        const milliseconds = expiryMinutes * 60 * 1000;
        item.expiry = Date.now() + milliseconds;
      }

      localStorage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (error) {
      console.error('Error setting in storage:', error);
    }
  }

  /**
   * Remove item from storage
   * @param key
   */
  remove(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }

  /**
   * Clear all items with prefix
   */
  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Check if key exists
   * @param key
   */
  has(key: string): boolean {
    return localStorage.getItem(this.prefix + key) !== null;
  }

  /**
   * Get all keys with prefix
   */
  keys(): string[] {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(this.prefix))
      .map((key) => key.replace(this.prefix, ''));
  }

  /**
   * Get storage size (approximate)
   */
  getSize(): number {
    let size = 0;
    const keys = this.keys();

    keys.forEach((key) => {
      const item = localStorage.getItem(this.prefix + key);
      if (item !== null && item !== '') {
        size += item.length;
      }
    });

    return size;
  }

  /**
   * Clean expired items
   */
  cleanExpired(): void {
    const keys = this.keys();

    keys.forEach((key) => {
      try {
        const item = localStorage.getItem(this.prefix + key);
        if (item !== null && item !== '') {
          const parsed = JSON.parse(item) as StorageItem;
          if (parsed.expiry !== undefined && Date.now() > parsed.expiry) {
            this.remove(key);
          }
        }
      } catch {
        // Invalid item, remove it
        this.remove(key);
      }
    });
  }
}

// Create default instance
const storageService = new StorageService();

// Export default instance
export default storageService;

// Extend window for storage service
declare global {
  interface Window {
    StorageService: typeof StorageService;
    storageService: StorageService;
  }
}

// Export for backwards compatibility
if (typeof window !== 'undefined') {
  window.StorageService = StorageService;
  window.storageService = storageService;
}
