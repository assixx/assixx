/**
 * Storage Service for Assixx
 * Handles localStorage with type safety and expiration
 */

import type { StorageItem } from '../../types/utils.types';

export class StorageService {
  private prefix: string;

  constructor(prefix: string = 'assixx_') {
    this.prefix = prefix;
  }

  /**
   * Get item from storage
   */
  get<T = any>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const parsed: StorageItem<T> = JSON.parse(item);

      // Check if item has expired
      if (parsed.expiry && Date.now() > parsed.expiry) {
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
   */
  set<T = any>(key: string, value: T, expiryMinutes?: number): void {
    try {
      const item: StorageItem<T> = {
        key: this.prefix + key,
        value,
      };

      if (expiryMinutes) {
        item.expiry = Date.now() + expiryMinutes * 60 * 1000;
      }

      localStorage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (error) {
      console.error('Error setting in storage:', error);
    }
  }

  /**
   * Remove item from storage
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
      if (item) {
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
        if (item) {
          const parsed: StorageItem = JSON.parse(item);
          if (parsed.expiry && Date.now() > parsed.expiry) {
            this.remove(key);
          }
        }
      } catch (error) {
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

// Export for backwards compatibility
if (typeof window !== 'undefined') {
  (window as any).StorageService = StorageService;
  (window as any).storageService = storageService;
}
