const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function executeChatSchema() {
  let connection;
  
  try {
    console.log('Verbindung zur Datenbank wird hergestellt...');
    console.log(`Host: ${process.env.DB_HOST}, User: ${process.env.DB_USER}, Database: ${process.env.DB_NAME}`);
    
    // Datenbankverbindung erstellen
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'lohnabrechnung',
      multipleStatements: true
    });

    console.log('Datenbankverbindung erfolgreich hergestellt');

    // Chat-Schema-Datei lesen
    const schemaPath = path.join(__dirname, 'chat_schema_fixed.sql');
    const schemaSQL = await fs.readFile(schemaPath, 'utf8');
    
    console.log('Chat-Schema wird ausgeführt...');
    console.log('Schema-Inhalt Länge:', schemaSQL.length, 'Zeichen');

    // Ganzes Schema auf einmal ausführen (MySQL unterstützt multipleStatements)
    console.log('Führe komplettes Chat-Schema aus...');
    
    try {
      await connection.query(schemaSQL);
      console.log('✓ Chat-Schema erfolgreich ausgeführt');
    } catch (error) {
      console.error('✗ Fehler beim Ausführen des Chat-Schemas:', error.message);
      throw error;
    }

    // Überprüfen ob Tabellen erstellt wurden
    console.log('\nÜberprüfung der erstellten Chat-Tabellen:');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME LIKE 'chat_%' 
      OR TABLE_NAME LIKE 'conversations%'
      OR TABLE_NAME LIKE 'messages%'
      OR TABLE_NAME LIKE 'work_schedules%'
    `, [process.env.DB_NAME]);

    console.log('Gefundene Chat-Tabellen:');
    tables.forEach(table => {
      console.log(`- ${table.TABLE_NAME}`);
    });

    console.log('\n✅ Chat-Schema erfolgreich ausgeführt!');
    
  } catch (error) {
    console.error('❌ Fehler beim Ausführen des Chat-Schemas:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Datenbankverbindung geschlossen');
    }
  }
}

// Script ausführen
executeChatSchema()
  .then(() => {
    console.log('\n🎉 Chat-Datenbank-Setup erfolgreich abgeschlossen!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Chat-Datenbank-Setup fehlgeschlagen:', error);
    process.exit(1);
  });