const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixEmployeeDocIssue() {
  try {
    console.log('Verbindung zur Datenbank wird hergestellt...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('Verbindung erfolgreich hergestellt!');
    
    // Lösung 1: Dokumente zu allen Mitarbeitern kopieren/zuweisen
    // Erst holen wir alle Mitarbeiter-IDs
    const [employees] = await connection.query(
      'SELECT id, username FROM users WHERE role = "employee"'
    );
    
    console.log(`Gefundene Mitarbeiter: ${employees.length}`);
    
    if (employees.length === 0) {
      console.log('Keine Mitarbeiter gefunden!');
      return;
    }
    
    // Für alle Dokumente, die es gibt
    const [docs] = await connection.query('SELECT * FROM documents');
    console.log(`Gefundene Dokumente: ${docs.length}`);
    
    // Für jeden Mitarbeiter sicherstellen, dass es mindestens ein Dokument gibt
    for (const emp of employees) {
      console.log(`Überprüfe Dokumente für Mitarbeiter ${emp.username} (ID: ${emp.id})`);
      
      const [empDocs] = await connection.query(
        'SELECT COUNT(*) AS count FROM documents WHERE user_id = ?',
        [emp.id]
      );
      
      if (empDocs[0].count === 0 && docs.length > 0) {
        console.log(`  Keine Dokumente für Mitarbeiter ${emp.username}. Erstelle Beispieldokumente...`);
        
        // Beispieldokumente aus den vorhandenen Dokumenten kopieren
        for (let i = 0; i < Math.min(docs.length, 3); i++) {
          const doc = docs[i];
          
          // Neues Dokument mit Bezug auf diesen Mitarbeiter erstellen
          const [result] = await connection.query(
            `INSERT INTO documents 
             (user_id, file_name, file_content, category, description, upload_date, year, month) 
             VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)`,
            [
              emp.id,
              `Dokument_${i+1}_für_${emp.username}.pdf`,
              doc.file_content, // Inhalt vom bestehenden Dokument übernehmen
              doc.category || 'other',
              `Ein Beispieldokument für ${emp.username}`,
              doc.year || new Date().getFullYear(),
              doc.month || 'Januar'
            ]
          );
          
          console.log(`    Dokument erstellt mit ID: ${result.insertId}`);
        }
      } else {
        console.log(`  Mitarbeiter hat bereits ${empDocs[0].count} Dokumente`);
      }
    }
    
    await connection.end();
    console.log('Datenbankverbindung geschlossen');
    console.log('Bitte melden Sie sich als Mitarbeiter erneut an, um die Dokumente zu sehen.');
  } catch (error) {
    console.error('Fehler:', error);
  }
}

fixEmployeeDocIssue();