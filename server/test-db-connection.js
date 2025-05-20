const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('Teste Datenbankverbindung mit folgenden Parametern:');
  console.log(`Host: ${process.env.DB_HOST}`);
  console.log(`User: ${process.env.DB_USER}`);
  console.log(`Passwort: ${'*'.repeat(process.env.DB_PASSWORD.length)}`);
  console.log(`Datenbank: ${process.env.DB_NAME}`);
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('Verbindung erfolgreich hergestellt!');
    
    // Teste eine einfache Abfrage
    const [rows] = await connection.query('SELECT 1 as test');
    console.log('Abfrage erfolgreich durchgeführt:', rows);
    
    await connection.end();
    console.log('Verbindung erfolgreich geschlossen.');
  } catch (error) {
    console.error('Fehler bei der Verbindung zur Datenbank:', error);
  }
}

testConnection();