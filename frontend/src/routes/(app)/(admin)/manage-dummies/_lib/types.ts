// =============================================================================
// Manage Dummies — TYPE DEFINITIONS
// =============================================================================

// =============================================================================
// DOMAIN ENTITIES
// =============================================================================

/** Dummy user as returned by the API (camelCase) */
export interface DummyUser {
  uuid: string;
  email: string;
  displayName: string;
  employeeNumber: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  teamIds: number[];
  teamNames: string[];
  departmentIds: number[];
  departmentNames: string[];
  areaIds: number[];
  areaNames: string[];
}

/** Team for multi-select dropdown */
export interface Team {
  id: number;
  name: string;
  departmentName: string | null;
}

// =============================================================================
// FORM DATA
// =============================================================================

/** Form state for create/edit modal */
export interface DummyFormData {
  displayName: string;
  password: string;
  passwordConfirm: string;
  teamIds: number[];
  isActive: number;
}

/** Validation result from form validation */
export interface ValidationErrors {
  displayName?: string;
  password?: string;
  passwordConfirm?: string;
}

// =============================================================================
// API PAYLOADS
// =============================================================================

/** Payload for POST /dummy-users */
export interface CreateDummyPayload {
  displayName: string;
  password: string;
  teamIds?: number[];
}

/** Payload for PUT /dummy-users/:uuid */
export interface UpdateDummyPayload {
  displayName?: string;
  password?: string;
  teamIds?: number[];
  isActive?: number;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/** Paginated list response */
export interface PaginatedDummies {
  data: DummyUser[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}
