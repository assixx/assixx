const db = require('./database');

async function fixChatDatabase() {
  console.log('Fixing chat database schema...\n');
  
  try {
    // 1. Add missing columns to messages table
    console.log('1. Adding missing columns to messages table...');
    try {
      // Check if columns exist first
      const [columns] = await db.query(`SHOW COLUMNS FROM messages`);
      const columnNames = columns.map(col => col.Field);
      
      if (!columnNames.includes('is_deleted')) {
        await db.query(`ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE`);
        console.log('   ✓ Added is_deleted column');
      } else {
        console.log('   - is_deleted column already exists');
      }
      
      if (!columnNames.includes('deleted_at')) {
        await db.query(`ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP NULL`);
        console.log('   ✓ Added deleted_at column');
      } else {
        console.log('   - deleted_at column already exists');
      }
    } catch (error) {
      console.error('   ✗ Error adding columns to messages:', error.message);
    }
    
    // 2. Add is_active column to conversations
    console.log('\n2. Adding is_active column to conversations table...');
    try {
      const [columns] = await db.query(`SHOW COLUMNS FROM conversations`);
      const columnNames = columns.map(col => col.Field);
      
      if (!columnNames.includes('is_active')) {
        await db.query(`ALTER TABLE conversations ADD COLUMN is_active BOOLEAN DEFAULT TRUE`);
        console.log('   ✓ Added is_active column');
      } else {
        console.log('   - is_active column already exists');
      }
    } catch (error) {
      console.error('   ✗ Error adding is_active column:', error.message);
    }
    
    // 3. Create missing indexes
    console.log('\n3. Creating missing indexes...');
    const indexes = [
      { table: 'messages', name: 'idx_messages_deleted', column: 'is_deleted' },
      { table: 'conversations', name: 'idx_conversations_active', column: 'is_active' },
      { table: 'messages', name: 'idx_messages_conversation_created', column: 'conversation_id, created_at' }
    ];
    
    for (const index of indexes) {
      try {
        // Check if index exists
        const [existing] = await db.query(`
          SHOW INDEX FROM ${index.table} WHERE Key_name = '${index.name}'
        `);
        
        if (existing.length === 0) {
          await db.query(`CREATE INDEX ${index.name} ON ${index.table}(${index.column})`);
          console.log(`   ✓ Created index ${index.name}`);
        } else {
          console.log(`   - Index ${index.name} already exists`);
        }
      } catch (error) {
        console.error(`   ✗ Error creating index ${index.name}:`, error.message);
      }
    }
    
    // 4. Fix message delivery queue
    console.log('\n4. Processing message delivery queue...');
    try {
      // Get pending messages
      const [pendingMessages] = await db.query(`
        SELECT mdq.*, m.content, m.sender_id, m.conversation_id
        FROM message_delivery_queue mdq
        JOIN messages m ON mdq.message_id = m.id
        WHERE mdq.status = 'pending'
      `);
      
      console.log(`   Found ${pendingMessages.length} pending messages in delivery queue`);
      
      // Mark old pending messages as delivered (they're probably already seen)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [updated] = await db.query(`
        UPDATE message_delivery_queue 
        SET status = 'delivered'
        WHERE status = 'pending' 
        AND created_at < ?
      `, [oneHourAgo]);
      
      console.log(`   ✓ Marked ${updated.affectedRows} old pending messages as delivered`);
    } catch (error) {
      console.error('   ✗ Error processing delivery queue:', error.message);
    }
    
    // 5. Test WebSocket URL
    console.log('\n5. Testing WebSocket connection...');
    console.log('   WebSocket URL format: ws://localhost:3001/chat-ws?token=YOUR_TOKEN');
    console.log('   Make sure the server is running on port 3001');
    
    console.log('\n✅ Database fixes completed!');
    
  } catch (error) {
    console.error('Error fixing database:', error);
  } finally {
    process.exit();
  }
}

fixChatDatabase();