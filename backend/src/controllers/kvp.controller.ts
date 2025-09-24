/**
 * KVP Controller
 * Main export point - re-exports from extended controller for backward compatibility
 */

// Re-export everything from the extended controller
export { KvpExtendedController as KvpController } from './kvp-extended.controller.js';
export type {
  TenantRequest,
  KvpCreateRequest,
  KvpUpdateRequest,
  KvpGetRequest,
  KvpQueryRequest,
  KvpShareRequest,
  DepartmentStat,
} from './kvp-core.controller.js';

// Re-export the default instance
export { default } from './kvp-extended.controller.js';
