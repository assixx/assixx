const db = require('./database');

async function cleanupUndefinedChats() {
  console.log('🧹 Cleaning up undefined/invalid chats...\n');
  
  try {
    // 1. Find conversations with no valid participants
    console.log('1. Finding orphaned conversations...');
    const [orphaned] = await db.query(`
      SELECT c.id, c.name, c.is_group, c.created_at
      FROM conversations c
      WHERE NOT EXISTS (
        SELECT 1 FROM conversation_participants cp 
        WHERE cp.conversation_id = c.id
      )
    `);
    
    console.log(`   Found ${orphaned.length} orphaned conversations`);
    
    if (orphaned.length > 0) {
      // Delete orphaned conversations
      const ids = orphaned.map(c => c.id).join(',');
      await db.query(`DELETE FROM conversations WHERE id IN (${ids})`);
      console.log(`   ✓ Deleted ${orphaned.length} orphaned conversations`);
    }
    
    // 2. Find conversations with only one participant (invalid for non-group chats)
    console.log('\n2. Finding invalid single-participant conversations...');
    const [invalid] = await db.query(`
      SELECT c.id, c.name, c.is_group, COUNT(cp.user_id) as participant_count
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE c.is_group = 0
      GROUP BY c.id
      HAVING participant_count < 2
    `);
    
    console.log(`   Found ${invalid.length} invalid conversations`);
    
    if (invalid.length > 0) {
      // Mark as inactive instead of deleting
      const ids = invalid.map(c => c.id).join(',');
      await db.query(`UPDATE conversations SET is_active = 0 WHERE id IN (${ids})`);
      console.log(`   ✓ Marked ${invalid.length} conversations as inactive`);
    }
    
    // 3. Find duplicate conversations between same users
    console.log('\n3. Finding duplicate conversations...');
    const [duplicates] = await db.query(`
      SELECT 
        MIN(c.id) as keep_id,
        GROUP_CONCAT(c.id) as all_ids,
        COUNT(*) as duplicate_count
      FROM (
        SELECT 
          c.id,
          GROUP_CONCAT(cp.user_id ORDER BY cp.user_id) as participants
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.is_group = 0
        GROUP BY c.id
      ) as conv_participants
      JOIN conversations c ON conv_participants.id = c.id
      GROUP BY participants
      HAVING duplicate_count > 1
    `);
    
    console.log(`   Found ${duplicates.length} sets of duplicate conversations`);
    
    for (const dup of duplicates) {
      const allIds = dup.all_ids.split(',').map(id => parseInt(id));
      const idsToDeactivate = allIds.filter(id => id !== dup.keep_id);
      
      if (idsToDeactivate.length > 0) {
        await db.query(
          `UPDATE conversations SET is_active = 0 WHERE id IN (${idsToDeactivate.join(',')})`
        );
        console.log(`   ✓ Deactivated ${idsToDeactivate.length} duplicate conversations`);
      }
    }
    
    // 4. Clean up conversations with null display names
    console.log('\n4. Fixing conversations with missing names...');
    const [nameless] = await db.query(`
      SELECT c.id, c.is_group
      FROM conversations c
      WHERE c.name IS NULL OR c.name = ''
    `);
    
    console.log(`   Found ${nameless.length} conversations without names`);
    
    // For group chats, set a default name
    const groupChats = nameless.filter(c => c.is_group);
    if (groupChats.length > 0) {
      const ids = groupChats.map(c => c.id).join(',');
      await db.query(
        `UPDATE conversations SET name = 'Gruppenchat' WHERE id IN (${ids})`
      );
      console.log(`   ✓ Fixed ${groupChats.length} group chat names`);
    }
    
    console.log('\n✅ Cleanup completed!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    process.exit();
  }
}

cleanupUndefinedChats();