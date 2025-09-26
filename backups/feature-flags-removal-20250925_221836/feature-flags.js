// Feature flags for API v2 migration
// This file is loaded before the main application
// DO NOT COMMIT THIS FILE - Add to .gitignore

window.FEATURE_FLAGS = {
  // Phase 1: Signup (Start here!)
  USE_API_V2_SIGNUP: true, // ✅ TESTED & WORKING - for new tenant registration

  // Phase 2: Authentication Core
  USE_API_V2_AUTH: true, // ✅ TESTED & WORKING - login/logout/validate

  // Phase 3: User Management
  USE_API_V2_USERS: true, // ✅ ENABLING for Post-Login UI Phase

  // Phase 4: Core Features
  USE_API_V2_DOCUMENTS: true, // ✅ ACTIVATED Phase 7 - Documents & Files (07.08.2025)
  USE_API_V2_BLACKBOARD: true, // ✅ ACTIVATED Phase 7 - Communication (08.08.2025)
  USE_API_V2_CALENDAR: true, // ✅ ACTIVATED Phase 8 - Planning & Organization (08.08.2025)
  USE_API_V2_CHAT: true, // ✅ ENABLED - Chat page migrated to v2 API (08.08.2025)

  // Phase 5: Business Features
  USE_API_V2_SHIFTS: true, // ✅ ENABLED - Shift planning with Teams & Drag&Drop (18.08.2025)
  USE_API_V2_KVP: true, // ✅ ENABLED - KVP migrated to v2 API (28.08.2025)
  USE_API_V2_DEPARTMENTS: true, // ✅ MIGRATED - departments.html updated to use apiClient
  USE_API_V2_TEAMS: true, // ✅ ENABLED for Teams management UI
  USE_API_V2_SURVEYS: true, // ✅ ENABLED - Survey pages migrated to v2 API (06.09.2025)

  // Phase 6: Admin Features
  USE_API_V2_ADMIN: true, // ✅ ACTIVATED for admin functionality
  USE_API_V2_REPORTS: true, // ✅ ENABLED - Reports API existiert nur in v2 (14.09.2025)
  USE_API_V2_LOGS: true, // ✅ ENABLING for root-dashboard activity logs
  USE_API_V2_ADMIN_PERMISSIONS: true, // ✅ ENABLING for department badge
  USE_API_V2_DEPARTMENT_GROUPS: true, // ✅ ENABLED - manage-department-groups.ts migrated to v2 API
  USE_API_V2_AREAS: true, // ✅ ACTIVATED for areas management

  // Phase 7: System Features
  USE_API_V2_NOTIFICATIONS: true,
  USE_API_V2_SETTINGS: true,
  USE_API_V2_FEATURES: true, // ✅ ENABLED - wenn Fehler auftreten, werden wir sie in Zukunft korrigieren
  USE_API_V2_PLANS: true, // ✅ ENABLED - wenn Fehler auftreten, werden wir sie in Zukunft korrigieren
  USE_API_V2_MACHINES: true, // ✅ ENABLED for Machines management UI
  USE_API_V2_AUDIT_TRAIL: true, // ✅ ENABLED - Audit-Trail API existiert nur in v2 (14.09.2025)
  USE_API_V2_ROLES: true, //ich habe es aktiviert
  USE_API_V2_ROOT: true, // ✅ ENABLING for storage-info in navigation
  USE_API_V2_ROLE_SWITCH: true, // ✅ ENABLING for role switching

  // Global flag to enable all v2 APIs at once (USE WITH CAUTION!)
  USE_API_V2_GLOBAL: true, // ✅ ACTIVATED - Alle APIs sind auf v2 migriert! (14.09.2025)
};

// Migration status tracking
window.MIGRATION_STATUS = {
  phase: '✅ MIGRATION COMPLETE!',
  completedApis: ['ALL APIs successfully migrated to v2'],
  currentApi: 'None - Migration finished',
  startDate: '2025-08-03T10:00:00.000Z',
  completionDate: '2025-09-14T20:00:00.000Z',
  lastUpdate: new Date().toISOString(),
};

// Helper functions for debugging
window.migrationHelpers = {
  // Enable a specific API
  enableApi: function (apiName) {
    const flagName = 'USE_API_V2_' + apiName.toUpperCase();
    if (window.FEATURE_FLAGS.hasOwnProperty(flagName)) {
      window.FEATURE_FLAGS[flagName] = true;
      console.log('✅ Enabled:', flagName);
      this.saveToLocalStorage();
    } else {
      console.error('❌ Unknown API:', apiName);
    }
  },

  // Disable a specific API
  disableApi: function (apiName) {
    const flagName = 'USE_API_V2_' + apiName.toUpperCase();
    if (window.FEATURE_FLAGS.hasOwnProperty(flagName)) {
      window.FEATURE_FLAGS[flagName] = false;
      console.log('🔴 Disabled:', flagName);
      this.saveToLocalStorage();
    } else {
      console.error('❌ Unknown API:', apiName);
    }
  },

  // Enable all APIs (careful!)
  enableAll: function () {
    Object.keys(window.FEATURE_FLAGS).forEach((key) => {
      if (key.startsWith('USE_API_V2_')) {
        window.FEATURE_FLAGS[key] = true;
      }
    });
    console.log('✅ All v2 APIs enabled');
    this.saveToLocalStorage();
  },

  // Disable all APIs
  disableAll: function () {
    Object.keys(window.FEATURE_FLAGS).forEach((key) => {
      if (key.startsWith('USE_API_V2_')) {
        window.FEATURE_FLAGS[key] = false;
      }
    });
    console.log('🔴 All v2 APIs disabled');
    this.saveToLocalStorage();
  },

  // Show current status
  status: function () {
    console.log('=== API v2 Migration Status ===');
    console.log('Phase:', window.MIGRATION_STATUS.phase);
    console.log('Current API:', window.MIGRATION_STATUS.currentApi);
    console.log('\nEnabled APIs:');
    Object.keys(window.FEATURE_FLAGS).forEach((key) => {
      if (key.startsWith('USE_API_V2_') && window.FEATURE_FLAGS[key]) {
        console.log('✅', key);
      }
    });
    console.log('\nDisabled APIs:');
    Object.keys(window.FEATURE_FLAGS).forEach((key) => {
      if (key.startsWith('USE_API_V2_') && !window.FEATURE_FLAGS[key]) {
        console.log('🔴', key);
      }
    });
  },

  // Save to localStorage for persistence
  saveToLocalStorage: function () {
    try {
      localStorage.setItem('featureFlags', JSON.stringify(window.FEATURE_FLAGS));
      localStorage.setItem('migrationStatus', JSON.stringify(window.MIGRATION_STATUS));
      console.log('💾 Saved to localStorage');
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  },

  // Load from localStorage
  loadFromLocalStorage: function () {
    try {
      const flags = localStorage.getItem('featureFlags');
      const status = localStorage.getItem('migrationStatus');

      if (flags) {
        window.FEATURE_FLAGS = JSON.parse(flags);
        console.log('📂 Loaded feature flags from localStorage');
      }

      if (status) {
        window.MIGRATION_STATUS = JSON.parse(status);
        console.log('📂 Loaded migration status from localStorage');
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
  },

  // Reset to defaults
  reset: function () {
    this.disableAll();
    window.MIGRATION_STATUS = {
      phase: 'Phase 1: Signup',
      completedApis: [],
      currentApi: 'signup',
      startDate: new Date().toISOString(),
    };
    this.saveToLocalStorage();
    console.log('🔄 Reset to defaults');
  },
};

// Auto-load from localStorage on page load - DISABLED since v2 is globally active
// window.migrationHelpers.loadFromLocalStorage();

// Log status on load - simplified since migration is complete
console.log('🚀 API v2 Migration Complete - All APIs using v2');
console.log('Use window.migrationHelpers for control:');
console.log('  .status()        - Show current status');
console.log('  .enableApi(name) - Enable specific API');
console.log('  .disableApi(name)- Disable specific API');
console.log('  .enableAll()     - Enable all APIs');
console.log('  .disableAll()    - Disable all APIs');
console.log('  .reset()         - Reset to defaults');
