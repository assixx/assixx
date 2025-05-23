const mysql = require('mysql2/promise');
require('dotenv').config();

async function addProfilePictureColumn() {
  let connection;
  
  try {
    console.log('Verbindung zur Datenbank wird hergestellt...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'lohnabrechnung'
    });

    console.log('Datenbankverbindung erfolgreich hergestellt');

    // Prüfen ob profile_picture_url Spalte existiert
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'profile_picture_url'
    `, [process.env.DB_NAME]);

    if (columns.length === 0) {
      console.log('Füge profile_picture_url Spalte hinzu...');
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN profile_picture_url VARCHAR(255) NULL 
        AFTER email
      `);
      console.log('✓ profile_picture_url Spalte erfolgreich hinzugefügt');
    } else {
      console.log('✓ profile_picture_url Spalte existiert bereits');
    }

    // Prüfen ob tenant_id Spalte existiert
    const [tenantColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'tenant_id'
    `, [process.env.DB_NAME]);

    if (tenantColumns.length === 0) {
      console.log('Füge tenant_id Spalte hinzu...');
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN tenant_id INT DEFAULT 1 
        AFTER id
      `);
      console.log('✓ tenant_id Spalte erfolgreich hinzugefügt');
    } else {
      console.log('✓ tenant_id Spalte existiert bereits');
    }

    // Aktualisiere alle bestehenden Users mit tenant_id = 1
    await connection.execute(`
      UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL
    `);
    console.log('✓ Alle Benutzer haben jetzt tenant_id = 1');

    console.log('\n✅ User-Tabelle erfolgreich aktualisiert!');
    
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

addProfilePictureColumn()
  .then(() => {
    console.log('\n🎉 User-Tabelle Update erfolgreich!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 User-Tabelle Update fehlgeschlagen:', error);
    process.exit(1);
  });