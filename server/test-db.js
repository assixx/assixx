const db = require('./database');

async function testConnection() {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    console.log('Datenbankverbindung erfolgreich!');
    console.log('Ergebnis:', rows[0].result);
    
    const [users] = await db.query('SELECT id, username, role FROM users');
    console.log('Gefundene Benutzer:', users);
  } catch (error) {
    console.error('Fehler bei der Datenbankverbindung:', error);
  } finally {
    process.exit();
  }
}

testConnection();