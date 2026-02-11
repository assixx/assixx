/**
 * E2E Keys Types
 *
 * Database row types (snake_case) and API response types (camelCase)
 * for the end-to-end encryption key management module.
 */

// =============================================================================
// DATABASE TYPES (internal — match PostgreSQL column names)
// =============================================================================

/** Raw database row from `e2e_user_keys` table */
export interface E2eUserKeyRow {
  id: string;
  tenant_id: number;
  user_id: number;
  public_key: string;
  fingerprint: string;
  key_version: number;
  created_at: Date;
  is_active: number;
}

// =============================================================================
// API RESPONSE TYPES (external — camelCase for JSON responses)
// =============================================================================

/** Full key data returned to the key owner */
export interface E2eKeyResponse {
  id: string;
  publicKey: string;
  fingerprint: string;
  keyVersion: number;
  createdAt: string;
}

/** Public key data returned when looking up another user's key */
export interface E2ePublicKeyResponse {
  publicKey: string;
  fingerprint: string;
  keyVersion: number;
}
