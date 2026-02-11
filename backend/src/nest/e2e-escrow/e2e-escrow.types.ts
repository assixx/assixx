/**
 * E2E Key Escrow Types
 *
 * Database row types (snake_case) and API response types (camelCase)
 * for the zero-knowledge encrypted private key backup module.
 *
 * @see ADR-022 (E2E Key Escrow)
 */

// =============================================================================
// DATABASE TYPES (internal — match PostgreSQL column names)
// =============================================================================

/** Raw database row from `e2e_key_escrow` table */
export interface E2eEscrowRow {
  id: string;
  tenant_id: number;
  user_id: number;
  encrypted_blob: string;
  argon2_salt: string;
  xchacha_nonce: string;
  argon2_params: Argon2Params;
  blob_version: number;
  created_at: Date;
  updated_at: Date;
  is_active: number;
}

// =============================================================================
// SHARED TYPES
// =============================================================================

/** Argon2id parameters stored per-blob for future parameter upgrades */
export interface Argon2Params {
  memory: number;
  iterations: number;
  parallelism: number;
}

// =============================================================================
// API RESPONSE TYPES (external — camelCase for JSON responses)
// =============================================================================

/** Escrow data returned for key recovery */
export interface E2eEscrowResponse {
  encryptedBlob: string;
  argon2Salt: string;
  xchachaNonce: string;
  argon2Params: Argon2Params;
  blobVersion: number;
}
