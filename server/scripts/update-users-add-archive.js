const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateUsersTable() {
  let connection;
  
  try {
    console.log('Starting database update process...');
    
    // Verbindung zur Datenbank herstellen
    const config = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_NAME
    };
    
    // Füge Passwort nur hinzu, wenn es gesetzt ist
    if (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim() !== '') {
      config.password = process.env.DB_PASSWORD;
    }
    
    console.log(`Connecting to database: ${config.database} at ${config.host}`);
    connection = await mysql.createConnection(config);
    console.log('Database connection established.');
    
    // SQL-Datei lesen
    const sqlFilePath = path.join(__dirname, '..', 'database', 'add_archive_column_to_users.sql');
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    
    // SQL-Befehle aufteilen (an Semikolon und Zeilenumbruch)
    const sqlCommands = sqlContent
      .split(';')
      .map(command => command.trim())
      .filter(command => command.length > 0);
    
    console.log(`Found ${sqlCommands.length} SQL commands to execute.`);
    
    // Jeden SQL-Befehl ausführen
    for (const [index, command] of sqlCommands.entries()) {
      try {
        console.log(`Executing command ${index + 1}/${sqlCommands.length}:`);
        console.log(command);
        
        await connection.query(command);
        console.log('Command executed successfully.');
      } catch (error) {
        // Wenn der Fehler "Duplicate column" oder "Duplicate key" ist, ignorieren und weitermachen
        if (error.message.includes('Duplicate column') || error.message.includes('Duplicate key')) {
          console.log(`Warning: ${error.message}`);
          console.log('Continuing with next command...');
        } else {
          throw error; // Andere Fehler werden weitergereicht
        }
      }
    }
    
    console.log('Database update completed successfully!');
    
  } catch (error) {
    console.error('Error updating database:', error);
    process.exit(1);
  } finally {
    if (connection) {
      console.log('Closing database connection...');
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Skript ausführen
updateUsersTable().then(() => {
  console.log('Update script completed.');
  process.exit(0);
});