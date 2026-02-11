/**
 * Migration: Add E2E encryption columns to scheduled_messages table
 *
 * Purpose: Extend E2E encryption to scheduled messages.
 * When a user schedules an encrypted 1:1 message, the ciphertext + metadata
 * are stored in scheduled_messages. When the cron processor fires, it copies
 * these fields directly into the messages table — the server never decrypts.
 *
 * Changes:
 * - encrypted_content: base64 ciphertext (same as messages table)
 * - e2e_nonce: base64 24-byte XChaCha20-Poly1305 nonce
 * - is_e2e: whether this scheduled message is end-to-end encrypted
 * - e2e_key_version: sender's key version at time of encryption
 * - e2e_key_epoch: HKDF epoch for decryption key derivation
 * - content: DROP NOT NULL, allow NULL for E2E messages
 * - chk_content_not_empty: updated to allow empty/NULL content when is_e2e=true
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- E2E encrypted content (base64 ciphertext)
    ALTER TABLE scheduled_messages ADD COLUMN encrypted_content TEXT;

    -- XChaCha20-Poly1305 nonce (base64, 24 bytes)
    ALTER TABLE scheduled_messages ADD COLUMN e2e_nonce TEXT;

    -- Whether this scheduled message is E2E encrypted
    ALTER TABLE scheduled_messages ADD COLUMN is_e2e BOOLEAN NOT NULL DEFAULT false;

    -- Sender's key version at time of encryption
    ALTER TABLE scheduled_messages ADD COLUMN e2e_key_version INTEGER;

    -- HKDF epoch for decryption key derivation
    ALTER TABLE scheduled_messages ADD COLUMN e2e_key_epoch INTEGER;

    -- Allow NULL content for E2E messages (ciphertext stored in encrypted_content)
    ALTER TABLE scheduled_messages ALTER COLUMN content DROP NOT NULL;

    -- Update constraint: content can be empty/NULL when is_e2e is true
    ALTER TABLE scheduled_messages DROP CONSTRAINT chk_content_not_empty;
    ALTER TABLE scheduled_messages ADD CONSTRAINT chk_content_not_empty
      CHECK (is_e2e = true OR (content IS NOT NULL AND content <> ''));
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Restore original constraint
    ALTER TABLE scheduled_messages DROP CONSTRAINT IF EXISTS chk_content_not_empty;

    -- Set NULL content rows to placeholder before restoring NOT NULL
    UPDATE scheduled_messages SET content = '[encrypted]' WHERE content IS NULL;
    ALTER TABLE scheduled_messages ALTER COLUMN content SET NOT NULL;

    ALTER TABLE scheduled_messages ADD CONSTRAINT chk_content_not_empty
      CHECK (content <> '');

    -- Drop E2E columns
    ALTER TABLE scheduled_messages DROP COLUMN IF EXISTS e2e_key_epoch;
    ALTER TABLE scheduled_messages DROP COLUMN IF EXISTS e2e_key_version;
    ALTER TABLE scheduled_messages DROP COLUMN IF EXISTS is_e2e;
    ALTER TABLE scheduled_messages DROP COLUMN IF EXISTS e2e_nonce;
    ALTER TABLE scheduled_messages DROP COLUMN IF EXISTS encrypted_content;
  `);
}
