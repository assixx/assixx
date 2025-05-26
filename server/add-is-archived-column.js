const mysql = require('mysql2/promise');
require('dotenv').config();

async function addIsArchivedColumn() {
  try {
    console.log('Verbindung zur Datenbank wird hergestellt...');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('Verbindung erfolgreich hergestellt!');

    // Überprüfen, ob die Spalte bereits existiert
    const [columns] = await connection.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_archived'
    `,
      [process.env.DB_NAME]
    );

    if (columns.length > 0) {
      console.log('Die Spalte "is_archived" existiert bereits');
    } else {
      // Spalte hinzufügen
      console.log('Füge Spalte "is_archived" zur Tabelle "users" hinzu...');
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN is_archived BOOLEAN DEFAULT false
      `);
      console.log('Spalte "is_archived" erfolgreich hinzugefügt!');
    }

    await connection.end();
    console.log('Datenbankverbindung geschlossen');
  } catch (error) {
    console.error('Fehler beim Hinzufügen der Spalte:', error);
  }
}

addIsArchivedColumn();
