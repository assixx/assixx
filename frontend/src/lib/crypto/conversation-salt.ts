/**
 * Conversation Salt Generator
 *
 * Computes a deterministic, unique salt for each 1:1 conversation.
 * Used as HKDF salt to derive per-conversation encryption keys.
 *
 * Salt = SHA-256("assixx:" + tenantId + ":" + conversationId + ":" + sort([userA, userB]).join(":"))
 *
 * Sorted user IDs prevent salt collision if conversation IDs are reused after TRUNCATE.
 *
 * @see docs/plans/IMPLEMENT-E2E-ENCRYPTION.md (Section 4)
 */
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * Compute conversation salt as base64-encoded SHA-256 hash.
 * Both users in a 1:1 conversation compute the same salt regardless of who is sender/recipient.
 */
export function computeConversationSalt(
  tenantId: number,
  conversationId: number,
  userIdA: number,
  userIdB: number,
): string {
  const sortedIds = [userIdA, userIdB].sort((a, b) => a - b);
  const input = `assixx:${tenantId}:${conversationId}:${sortedIds.join(':')}`;
  const hashBytes = sha256(new TextEncoder().encode(input));

  // Base64 encode
  let binary = '';
  for (const byte of hashBytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
