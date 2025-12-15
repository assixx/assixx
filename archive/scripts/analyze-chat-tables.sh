#!/bin/bash
# Analyze Chat/Message Tables for Cleanup
# Author: SCS Team
# Date: 2025-08-08

echo "========================================="
echo "CHAT/MESSAGE TABLES ANALYSIS"
echo "========================================="
echo ""

# Database credentials
DB_USER="assixx_user"
DB_PASS="AssixxP@ss2025!"
DB_NAME="main"

echo "📊 ANALYZING ALL CHAT-RELATED TABLES..."
echo "-----------------------------------------"

docker exec assixx-mysql mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "
SELECT 
    table_name AS 'Table Name',
    table_rows AS 'Row Count',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
    CASE 
        WHEN table_rows = 0 THEN '🗑️ EMPTY - Can Delete'
        WHEN table_rows < 10 THEN '⚠️ Nearly Empty'
        ELSE '✅ In Use'
    END AS 'Status'
FROM information_schema.tables
WHERE table_schema = '$DB_NAME'
AND (
    table_name LIKE '%chat%' 
    OR table_name LIKE '%message%' 
    OR table_name LIKE '%conversation%'
)
ORDER BY table_rows DESC;
" 2>/dev/null | column -t

echo ""
echo "🔍 CHECKING FOR DUPLICATE/REDUNDANT STRUCTURES..."
echo "-----------------------------------------"

# Check which tables have similar structures
docker exec assixx-mysql mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "
SELECT 
    'messages' as 'Table Group',
    GROUP_CONCAT(table_name) as 'Tables with Similar Purpose'
FROM information_schema.tables
WHERE table_schema = '$DB_NAME'
AND table_name IN ('messages', 'chat_messages', 'message_status')

UNION ALL

SELECT 
    'conversations' as 'Table Group',
    GROUP_CONCAT(table_name) as 'Tables with Similar Purpose'
FROM information_schema.tables  
WHERE table_schema = '$DB_NAME'
AND table_name IN ('conversations', 'chat_channels', 'message_groups')

UNION ALL

SELECT 
    'participants' as 'Table Group',
    GROUP_CONCAT(table_name) as 'Tables with Similar Purpose'
FROM information_schema.tables
WHERE table_schema = '$DB_NAME'
AND table_name IN ('conversation_participants', 'chat_channel_members', 'message_group_members');
" 2>/dev/null | column -t

echo ""
echo "🎯 RECOMMENDATION SUMMARY"
echo "-----------------------------------------"
echo "KEEP:   conversations, conversation_participants (currently in use)"
echo "DELETE: All tables with 0 rows (see above)"
echo "REVIEW: Tables with <10 rows before deletion"
echo ""
echo "💡 Run 'bash scripts/safe-cleanup-chat-tables.sh' to proceed with cleanup"
echo "========================================="