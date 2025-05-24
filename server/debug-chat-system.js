const db = require('./database');
const chalk = require('chalk');

console.log(chalk.bgBlue.white('\n=== ASSIXX CHAT SYSTEM DEBUG TOOL ===\n'));

async function runDiagnostics() {
  try {
    // 1. Check database tables
    console.log(chalk.yellow('1. Checking database tables...'));
    await checkDatabaseTables();
    
    // 2. Check missing columns
    console.log(chalk.yellow('\n2. Checking for missing columns...'));
    await checkMissingColumns();
    
    // 3. Check chat permissions
    console.log(chalk.yellow('\n3. Checking chat permissions...'));
    await checkChatPermissions();
    
    // 4. Check existing conversations
    console.log(chalk.yellow('\n4. Checking existing conversations...'));
    await checkConversations();
    
    // 5. Check messages table
    console.log(chalk.yellow('\n5. Checking messages...'));
    await checkMessages();
    
    // 6. Fix database issues
    console.log(chalk.yellow('\n6. Fixing database issues...'));
    await fixDatabaseIssues();
    
    console.log(chalk.green('\n✅ Diagnostics complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('Error during diagnostics:'), error);
  } finally {
    process.exit();
  }
}

async function checkDatabaseTables() {
  const requiredTables = [
    'conversations',
    'conversation_participants',
    'messages',
    'message_attachments',
    'chat_permissions',
    'message_delivery_queue',
    'work_schedules'
  ];
  
  for (const table of requiredTables) {
    try {
      const [result] = await db.query(`SHOW TABLES LIKE '${table}'`);
      if (result.length > 0) {
        console.log(chalk.green(`✓ Table ${table} exists`));
      } else {
        console.log(chalk.red(`✗ Table ${table} is missing`));
      }
    } catch (error) {
      console.log(chalk.red(`✗ Error checking table ${table}:`, error.message));
    }
  }
}

async function checkMissingColumns() {
  // Check if messages table has all required columns
  try {
    const [columns] = await db.query(`SHOW COLUMNS FROM messages`);
    const columnNames = columns.map(col => col.Field);
    
    const requiredColumns = [
      'id', 'conversation_id', 'sender_id', 'content', 
      'message_type', 'is_read', 'scheduled_delivery', 
      'delivery_status', 'tenant_id', 'created_at', 'updated_at'
    ];
    
    // Check for soft delete columns
    const softDeleteColumns = ['is_deleted', 'deleted_at'];
    
    console.log(chalk.cyan('Messages table columns:'));
    for (const col of requiredColumns) {
      if (columnNames.includes(col)) {
        console.log(chalk.green(`  ✓ ${col}`));
      } else {
        console.log(chalk.red(`  ✗ ${col} is missing`));
      }
    }
    
    console.log(chalk.cyan('\nOptional columns:'));
    for (const col of softDeleteColumns) {
      if (columnNames.includes(col)) {
        console.log(chalk.green(`  ✓ ${col}`));
      } else {
        console.log(chalk.yellow(`  ⚠ ${col} is missing (optional)`));
      }
    }
    
    // Check conversations table
    const [convColumns] = await db.query(`SHOW COLUMNS FROM conversations`);
    const convColumnNames = convColumns.map(col => col.Field);
    
    if (!convColumnNames.includes('is_active')) {
      console.log(chalk.yellow('  ⚠ conversations.is_active is missing (optional)'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error checking columns:'), error.message);
  }
}

async function checkChatPermissions() {
  try {
    const [permissions] = await db.query('SELECT * FROM chat_permissions');
    
    console.log(chalk.cyan(`Found ${permissions.length} permission rules:`));
    
    const expectedPermissions = [
      { from: 'admin', to: 'employee', can_send: true },
      { from: 'admin', to: 'admin', can_send: true },
      { from: 'admin', to: 'root', can_send: true },
      { from: 'employee', to: 'admin', can_send: true },
      { from: 'employee', to: 'employee', can_send: false },
      { from: 'root', to: 'admin', can_send: true },
      { from: 'root', to: 'employee', can_send: true },
      { from: 'root', to: 'root', can_send: true }
    ];
    
    for (const expected of expectedPermissions) {
      const found = permissions.find(p => 
        p.from_role === expected.from && 
        p.to_role === expected.to
      );
      
      if (found) {
        if (found.can_send === expected.can_send) {
          console.log(chalk.green(`  ✓ ${expected.from} → ${expected.to}: can_send=${expected.can_send}`));
        } else {
          console.log(chalk.yellow(`  ⚠ ${expected.from} → ${expected.to}: can_send=${found.can_send} (expected ${expected.can_send})`));
        }
      } else {
        console.log(chalk.red(`  ✗ Missing permission: ${expected.from} → ${expected.to}`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('Error checking permissions:'), error.message);
  }
}

async function checkConversations() {
  try {
    const [conversations] = await db.query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) as participant_count,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      ORDER BY c.created_at DESC
      LIMIT 10
    `);
    
    console.log(chalk.cyan(`Found ${conversations.length} recent conversations:`));
    
    for (const conv of conversations) {
      console.log(chalk.white(`  - ID: ${conv.id}, Participants: ${conv.participant_count}, Messages: ${conv.message_count}, Group: ${conv.is_group ? 'Yes' : 'No'}`));
    }
    
    // Check for orphaned participants
    const [orphaned] = await db.query(`
      SELECT COUNT(*) as count FROM conversation_participants cp
      WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = cp.conversation_id)
    `);
    
    if (orphaned[0].count > 0) {
      console.log(chalk.red(`  ✗ Found ${orphaned[0].count} orphaned participants`));
    }
    
  } catch (error) {
    console.error(chalk.red('Error checking conversations:'), error.message);
  }
}

async function checkMessages() {
  try {
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_messages,
        SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as read_messages,
        SUM(CASE WHEN delivery_status = 'failed' THEN 1 ELSE 0 END) as failed_messages,
        SUM(CASE WHEN scheduled_delivery IS NOT NULL THEN 1 ELSE 0 END) as scheduled_messages
      FROM messages
    `);
    
    console.log(chalk.cyan('Message statistics:'));
    console.log(chalk.white(`  Total messages: ${stats[0].total_messages}`));
    console.log(chalk.white(`  Read messages: ${stats[0].read_messages}`));
    console.log(chalk.yellow(`  Failed messages: ${stats[0].failed_messages}`));
    console.log(chalk.white(`  Scheduled messages: ${stats[0].scheduled_messages}`));
    
    // Check message delivery queue
    const [queueStats] = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM message_delivery_queue 
      GROUP BY status
    `);
    
    if (queueStats.length > 0) {
      console.log(chalk.cyan('\nMessage delivery queue:'));
      for (const stat of queueStats) {
        const color = stat.status === 'failed' ? chalk.red : 
                     stat.status === 'pending' ? chalk.yellow : 
                     chalk.white;
        console.log(color(`  ${stat.status}: ${stat.count}`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('Error checking messages:'), error.message);
  }
}

async function fixDatabaseIssues() {
  try {
    // 1. Add missing soft delete columns to messages
    console.log(chalk.cyan('Adding missing columns...'));
    
    try {
      await db.query(`
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL
      `);
      console.log(chalk.green('  ✓ Added soft delete columns to messages'));
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log(chalk.yellow('  ⚠ Could not add soft delete columns:', error.message));
      }
    }
    
    // 2. Add is_active column to conversations
    try {
      await db.query(`
        ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
      `);
      console.log(chalk.green('  ✓ Added is_active column to conversations'));
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.log(chalk.yellow('  ⚠ Could not add is_active column:', error.message));
      }
    }
    
    // 3. Create message_read_receipts table if needed
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS message_read_receipts (
          message_id INT NOT NULL,
          user_id INT NOT NULL,
          read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (message_id, user_id),
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log(chalk.green('  ✓ Created message_read_receipts table'));
    } catch (error) {
      console.log(chalk.yellow('  ⚠ Could not create message_read_receipts table:', error.message));
    }
    
    // 4. Fix any missing indexes
    console.log(chalk.cyan('\nChecking indexes...'));
    
    const indexQueries = [
      `CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(is_deleted)`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_active ON conversations(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)`
    ];
    
    for (const query of indexQueries) {
      try {
        await db.query(query);
        console.log(chalk.green(`  ✓ Index created/verified`));
      } catch (error) {
        console.log(chalk.yellow(`  ⚠ Index issue:`, error.message));
      }
    }
    
    // 5. Clean up failed messages in delivery queue
    const [failedMessages] = await db.query(`
      SELECT COUNT(*) as count FROM message_delivery_queue 
      WHERE status = 'failed' AND attempts >= 3
    `);
    
    if (failedMessages[0].count > 0) {
      console.log(chalk.yellow(`\nFound ${failedMessages[0].count} permanently failed messages in queue`));
      // Don't auto-delete, just report
    }
    
  } catch (error) {
    console.error(chalk.red('Error fixing database issues:'), error.message);
  }
}

// Run diagnostics
runDiagnostics();