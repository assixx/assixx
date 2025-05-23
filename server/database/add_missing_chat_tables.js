const mysql = require('mysql2/promise');
require('dotenv').config();

async function addMissingTables() {
  let connection;
  
  try {
    console.log('Verbindung zur Datenbank wird hergestellt...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'lohnabrechnung',
      multipleStatements: true
    });

    console.log('Datenbankverbindung erfolgreich hergestellt');

    // Fehlende Tabellen hinzufügen
    const additionalTables = `
      -- Conversation Participants Table (falls nicht vorhanden)
      CREATE TABLE IF NOT EXISTS conversation_participants (
          id INT AUTO_INCREMENT PRIMARY KEY,
          conversation_id INT NOT NULL,
          user_id INT NOT NULL,
          tenant_id INT NOT NULL DEFAULT 1,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          left_at TIMESTAMP NULL,
          UNIQUE KEY unique_participant (conversation_id, user_id),
          INDEX idx_conversation_id (conversation_id),
          INDEX idx_user_id (user_id),
          INDEX idx_tenant_id (tenant_id),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Message Attachments Table (falls nicht vorhanden)
      CREATE TABLE IF NOT EXISTS message_attachments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          message_id INT NOT NULL,
          filename VARCHAR(255) NOT NULL,
          original_filename VARCHAR(255) NOT NULL,
          file_size BIGINT NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          tenant_id INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_message_id (message_id),
          INDEX idx_tenant_id (tenant_id),
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      );

      -- Message Delivery Queue Table (falls nicht vorhanden)
      CREATE TABLE IF NOT EXISTS message_delivery_queue (
          id INT AUTO_INCREMENT PRIMARY KEY,
          message_id INT NOT NULL,
          recipient_id INT NOT NULL,
          status ENUM('pending', 'processing', 'delivered', 'failed') DEFAULT 'pending',
          attempts INT DEFAULT 0,
          last_attempt TIMESTAMP NULL,
          tenant_id INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_message_id (message_id),
          INDEX idx_recipient_id (recipient_id),
          INDEX idx_status (status),
          INDEX idx_tenant_id (tenant_id),
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
          FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;

    console.log('Füge fehlende Chat-Tabellen hinzu...');
    await connection.query(additionalTables);
    console.log('✓ Fehlende Tabellen erfolgreich hinzugefügt');

    // Alle Chat-Tabellen anzeigen
    console.log('\nAlle Chat-bezogenen Tabellen:');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND (TABLE_NAME LIKE 'chat_%' 
           OR TABLE_NAME LIKE 'conversation%'
           OR TABLE_NAME LIKE 'message%'
           OR TABLE_NAME LIKE 'work_schedules%')
      ORDER BY TABLE_NAME
    `, [process.env.DB_NAME]);

    tables.forEach(table => {
      console.log(`✓ ${table.TABLE_NAME}`);
    });

    console.log('\n✅ Chat-Datenbank-Setup vollständig!');
    
  } catch (error) {
    console.error('❌ Fehler:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Datenbankverbindung geschlossen');
    }
  }
}

addMissingTables()
  .then(() => {
    console.log('\n🎉 Alle Chat-Tabellen erfolgreich erstellt!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fehler beim Erstellen der Tabellen:', error);
    process.exit(1);
  });