// Feature flags for API v2 migration
export interface FeatureFlags {
  // API Version Flags - Control which APIs use v2
  USE_API_V2_AUTH: boolean;
  USE_API_V2_USERS: boolean;
  USE_API_V2_CALENDAR: boolean;
  USE_API_V2_CHAT: boolean;
  USE_API_V2_DOCUMENTS: boolean;
  USE_API_V2_BLACKBOARD: boolean;
  USE_API_V2_SHIFTS: boolean;
  USE_API_V2_KVP: boolean;
  USE_API_V2_DEPARTMENTS: boolean;
  USE_API_V2_TEAMS: boolean;
  USE_API_V2_SURVEYS: boolean;
  USE_API_V2_ADMIN: boolean;
  USE_API_V2_REPORTS: boolean;
  USE_API_V2_NOTIFICATIONS: boolean;
  USE_API_V2_SETTINGS: boolean;
  USE_API_V2_MACHINES: boolean;
  USE_API_V2_LOGS: boolean;
  USE_API_V2_FEATURES: boolean;
  USE_API_V2_PLANS: boolean;
  USE_API_V2_AREAS: boolean;
  USE_API_V2_ROOT: boolean;
  USE_API_V2_ADMIN_PERMISSIONS: boolean;
  USE_API_V2_AUDIT_TRAIL: boolean;
  USE_API_V2_DEPARTMENT_GROUPS: boolean;
  USE_API_V2_ROLES: boolean;
  USE_API_V2_SIGNUP: boolean;
  USE_API_V2_ROLE_SWITCH: boolean;

  // Global flag to enable all v2 APIs at once
  USE_API_V2_GLOBAL: boolean;
}

// Default feature flags (all disabled initially)
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  USE_API_V2_AUTH: false,
  USE_API_V2_USERS: false,
  USE_API_V2_CALENDAR: false,
  USE_API_V2_CHAT: false,
  USE_API_V2_DOCUMENTS: false,
  USE_API_V2_BLACKBOARD: false,
  USE_API_V2_SHIFTS: false,
  USE_API_V2_KVP: false,
  USE_API_V2_DEPARTMENTS: false,
  USE_API_V2_TEAMS: false,
  USE_API_V2_SURVEYS: false,
  USE_API_V2_ADMIN: false,
  USE_API_V2_REPORTS: false,
  USE_API_V2_NOTIFICATIONS: false,
  USE_API_V2_SETTINGS: false,
  USE_API_V2_MACHINES: false,
  USE_API_V2_LOGS: false,
  USE_API_V2_FEATURES: false,
  USE_API_V2_PLANS: false,
  USE_API_V2_AREAS: false,
  USE_API_V2_ROOT: false,
  USE_API_V2_ADMIN_PERMISSIONS: false,
  USE_API_V2_AUDIT_TRAIL: false,
  USE_API_V2_DEPARTMENT_GROUPS: false,
  USE_API_V2_ROLES: false,
  USE_API_V2_SIGNUP: false,
  USE_API_V2_ROLE_SWITCH: false,
  USE_API_V2_GLOBAL: false,
};

// Feature flag manager class
export class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private flags: FeatureFlags;

  private constructor() {
    this.flags = { ...DEFAULT_FEATURE_FLAGS };
    this.loadFlags();
  }

  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  /**
   * Load feature flags from various sources
   */
  private loadFlags() {
    // 1. Load from window object (set by feature-flags.js)
    if (window.FEATURE_FLAGS) {
      Object.assign(this.flags, window.FEATURE_FLAGS);
    }

    // 2. Load from localStorage (for persistence)
    const savedFlags = localStorage.getItem('featureFlags');
    if (savedFlags) {
      try {
        const parsedFlags = JSON.parse(savedFlags);
        Object.assign(this.flags, parsedFlags);
      } catch (error) {
        console.error('[FeatureFlags] Failed to parse saved flags:', error);
      }
    }

    // 3. Apply global flag if enabled
    if (this.flags.USE_API_V2_GLOBAL) {
      this.enableAllV2Apis();
    }

    console.log('[FeatureFlags] Loaded flags:', this.flags);
  }

  /**
   * Check if a specific feature flag is enabled
   */
  isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags.USE_API_V2_GLOBAL ?? this.flags[flag] ?? false;
  }

  /**
   * Enable a specific feature flag
   */
  enable(flag: keyof FeatureFlags) {
    this.flags[flag] = true;
    this.saveFlags();
    console.log(`[FeatureFlags] Enabled: ${flag}`);
  }

  /**
   * Disable a specific feature flag
   */
  disable(flag: keyof FeatureFlags) {
    this.flags[flag] = false;
    this.saveFlags();
    console.log(`[FeatureFlags] Disabled: ${flag}`);
  }

  /**
   * Toggle a specific feature flag
   */
  toggle(flag: keyof FeatureFlags) {
    this.flags[flag] = !this.flags[flag];
    this.saveFlags();
    console.log(`[FeatureFlags] Toggled: ${flag} = ${this.flags[flag]}`);
  }

  /**
   * Enable all v2 APIs
   */
  enableAllV2Apis() {
    Object.keys(this.flags).forEach((key) => {
      if (key.startsWith('USE_API_V2_')) {
        (this.flags as unknown as Record<string, boolean>)[key] = true;
      }
    });
    this.saveFlags();
    console.log('[FeatureFlags] Enabled all v2 APIs');
  }

  /**
   * Disable all v2 APIs
   */
  disableAllV2Apis() {
    Object.keys(this.flags).forEach((key) => {
      if (key.startsWith('USE_API_V2_')) {
        (this.flags as unknown as Record<string, boolean>)[key] = false;
      }
    });
    this.saveFlags();
    console.log('[FeatureFlags] Disabled all v2 APIs');
  }

  /**
   * Get all current flag values
   */
  getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Save flags to localStorage
   */
  private saveFlags() {
    try {
      localStorage.setItem('featureFlags', JSON.stringify(this.flags));
      // Also update window object for compatibility
      window.FEATURE_FLAGS = { ...this.flags };
    } catch (error) {
      console.error('[FeatureFlags] Failed to save flags:', error);
    }
  }

  /**
   * Reset all flags to defaults
   */
  reset() {
    this.flags = { ...DEFAULT_FEATURE_FLAGS };
    this.saveFlags();
    console.log('[FeatureFlags] Reset to defaults');
  }

  /**
   * Load feature flags from server
   */
  async loadFromServer() {
    try {
      const response = await fetch('/api/v2/features/my-features');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          data.data.forEach((feature: { code: string; isActive: boolean }) => {
            const flagKey = `USE_API_V2_${feature.code.toUpperCase().replace(/-/g, '_')}`;
            if (flagKey in this.flags) {
              (this.flags as unknown as Record<string, boolean>)[flagKey] = feature.isActive;
            }
          });
          this.saveFlags();
          console.log('[FeatureFlags] Loaded from server');
        }
      }
    } catch (error) {
      console.warn('[FeatureFlags] Failed to load from server:', error);
    }
  }
}

// Export singleton instance
export const featureFlags = FeatureFlagManager.getInstance();

// Convenience function for checking if v2 is enabled for a specific API
export function isV2Enabled(feature: keyof FeatureFlags): boolean {
  return featureFlags.isEnabled(feature);
}

// Add debug utilities to window in development
// Add debug utilities to window in development
declare global {
  interface Window {
    featureFlags?: typeof featureFlags;
    enableV2?: (api?: string) => void;
    disableV2?: (api?: string) => void;
    FEATURE_FLAGS?: Record<string, boolean | undefined>;
  }
}

if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  window.featureFlags = featureFlags;
  window.enableV2 = (api?: string) => {
    if (api) {
      featureFlags.enable(`USE_API_V2_${api.toUpperCase()}` as keyof FeatureFlags);
    } else {
      featureFlags.enableAllV2Apis();
    }
  };
  window.disableV2 = (api?: string) => {
    if (api) {
      featureFlags.disable(`USE_API_V2_${api.toUpperCase()}` as keyof FeatureFlags);
    } else {
      featureFlags.disableAllV2Apis();
    }
  };

  console.log('[FeatureFlags] Debug utilities available:');
  console.log('- featureFlags.getFlags() - Show all flags');
  console.log('- enableV2("auth") - Enable specific API');
  console.log('- enableV2() - Enable all v2 APIs');
  console.log('- disableV2() - Disable all v2 APIs');
}
