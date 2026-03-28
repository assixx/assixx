/**
 * Migration: Add E2E encryption columns to messages table
 *
 * Purpose: Store encrypted message content alongside E2E metadata.
 * - encrypted_content: base64 ciphertext (replaces plaintext content for E2E messages)
 * - e2e_nonce: base64 24-byte XChaCha20 nonce
 * - is_e2e: whether this message is end-to-end encrypted
 * - e2e_key_version: sender's key version at time of encryption
 * - e2e_key_epoch: HKDF epoch (Math.floor(Date.now()/86400000)) stored for decryption
 * - content DROP NOT NULL: E2E messages store NULL in content (server cannot read)
 *
 * @see docs/plans/IMPLEMENT-E2E-ENCRYPTION.md (Section 7.1)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- E2E encrypted content (base64 ciphertext)
    ALTER TABLE messages ADD COLUMN encrypted_content TEXT;

    -- XChaCha20-Poly1305 nonce (base64, 24 bytes)
    ALTER TABLE messages ADD COLUMN e2e_nonce TEXT;

    -- Whether this message is E2E encrypted
    -- DEFAULT false: safe during deployment (system messages, legacy code paths remain plaintext)
    ALTER TABLE messages ADD COLUMN is_e2e BOOLEAN NOT NULL DEFAULT false;

    -- Sender's key version at time of encryption (for key version validation)
    ALTER TABLE messages ADD COLUMN e2e_key_version INTEGER;

    -- HKDF epoch: Math.floor(Date.now() / 86_400_000), stored for decryption key derivation
    ALTER TABLE messages ADD COLUMN e2e_key_epoch INTEGER;

    -- Allow NULL content for E2E messages (server stores ciphertext in encrypted_content instead)
    ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;

    -- Partial index for efficient E2E message queries
    CREATE INDEX IF NOT EXISTS idx_messages_e2e ON messages(is_e2e) WHERE is_e2e = true;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_messages_e2e;

    ALTER TABLE messages DROP COLUMN IF EXISTS e2e_key_epoch;
    ALTER TABLE messages DROP COLUMN IF EXISTS e2e_key_version;
    ALTER TABLE messages DROP COLUMN IF EXISTS is_e2e;
    ALTER TABLE messages DROP COLUMN IF EXISTS e2e_nonce;
    ALTER TABLE messages DROP COLUMN IF EXISTS encrypted_content;

    -- Restore NOT NULL on content (set NULL rows to empty string first)
    UPDATE messages SET content = '' WHERE content IS NULL;
    ALTER TABLE messages ALTER COLUMN content SET NOT NULL;
  `);
}
