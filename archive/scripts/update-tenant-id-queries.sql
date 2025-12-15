-- Update Script für chat.service.ts
-- Diese Queries müssen im Code angepasst werden um tenant_id zu nutzen

-- Line 362: Add tenant_id check
-- ALT: WHERE cp.conversation_id IN (...)
-- NEU: WHERE cp.conversation_id IN (...) AND cp.tenant_id = ?

-- Line 456-465: Add tenant_id to EXISTS checks  
-- ALT: WHERE cp1.conversation_id = c.id AND cp1.user_id = ?
-- NEU: WHERE cp1.conversation_id = c.id AND cp1.user_id = ? AND cp1.tenant_id = ?

-- Line 571-572: Add tenant_id check
-- ALT: WHERE conversation_id = ? AND user_id = ?
-- NEU: WHERE conversation_id = ? AND user_id = ? AND tenant_id = ?

-- Line 713-714: Add tenant_id check
-- ALT: WHERE conversation_id = ? AND user_id = ?
-- NEU: WHERE conversation_id = ? AND user_id = ? AND tenant_id = ?

-- Line 861-862: Add tenant_id check
-- ALT: WHERE conversation_id = ${conversationId} AND user_id = ${userId}
-- NEU: WHERE conversation_id = ${conversationId} AND user_id = ${userId} AND tenant_id = ${tenantId}

-- Line 921-922: Add tenant_id check
-- ALT: WHERE conversation_id = ? AND user_id = ?
-- NEU: WHERE conversation_id = ? AND user_id = ? AND tenant_id = ?

-- Line 936-937: Add tenant_id check
-- ALT: WHERE conversation_id = ?
-- NEU: WHERE conversation_id = ? AND tenant_id = ?

-- Line 967: Add tenant_id check for DELETE
-- ALT: DELETE FROM conversation_participants WHERE conversation_id = ?
-- NEU: DELETE FROM conversation_participants WHERE conversation_id = ? AND tenant_id = ?

-- Line 994-995: Add tenant_id check
-- ALT: WHERE conversation_id = ${conversationId} AND user_id = ${userId}
-- NEU: WHERE conversation_id = ${conversationId} AND user_id = ${userId} AND tenant_id = ${tenantId}

-- Line 1030-1032: Add tenant_id check
-- ALT: WHERE cp.conversation_id = ${conversationId}
-- NEU: WHERE cp.conversation_id = ${conversationId} AND cp.tenant_id = ${tenantId}

-- WICHTIG: Bei INSERT INTO conversation_participants muss jetzt auch tenant_id mitgegeben werden!
-- Line 501-514: Add tenant_id to INSERT
-- ALT: INSERT INTO conversation_participants (conversation_id, user_id, joined_at, is_admin)
-- NEU: INSERT INTO conversation_participants (tenant_id, conversation_id, user_id, joined_at, is_admin)