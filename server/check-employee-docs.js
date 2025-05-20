const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkEmployeeDocs() {
  try {
    console.log('Verbindung zur Datenbank wird hergestellt...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('Verbindung erfolgreich hergestellt!');
    
    // Mitarbeiter abfragen
    const [employees] = await connection.query(
      'SELECT id, username, first_name, last_name FROM users WHERE role = "employee"'
    );
    
    console.log('Gefundene Mitarbeiter:');
    for (const emp of employees) {
      console.log(`ID: ${emp.id}, Name: ${emp.first_name} ${emp.last_name}, Username: ${emp.username}`);
      
      // Dokumente für diesen Mitarbeiter abfragen
      const [docs] = await connection.query(
        'SELECT id, file_name, category, upload_date FROM documents WHERE user_id = ?',
        [emp.id]
      );
      
      if (docs.length === 0) {
        console.log(`  Keine Dokumente gefunden.`);
      } else {
        console.log(`  Dokumente (${docs.length}):`)
        docs.forEach(doc => {
          console.log(`    ID: ${doc.id}, Name: ${doc.file_name}, Kategorie: ${doc.category}, Datum: ${new Date(doc.upload_date).toISOString().split('T')[0]}`);
        });
      }
      console.log('-------------------');
    }
    
    await connection.end();
    console.log('Datenbankverbindung geschlossen');
  } catch (error) {
    console.error('Fehler:', error);
  }
}

checkEmployeeDocs();