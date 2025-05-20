const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTestDocuments() {
  try {
    console.log('Verbindung zur Datenbank wird hergestellt...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('Verbindung erfolgreich hergestellt!');
    
    // Hole die ID des Mitarbeiters
    const [users] = await connection.query('SELECT id FROM users WHERE role = "employee" LIMIT 1');
    
    if (users.length === 0) {
      console.log('Kein Mitarbeiter gefunden. Dokumente können nicht erstellt werden.');
      return;
    }
    
    const userId = users[0].id;
    console.log(`Erstelle Dokumente für Mitarbeiter mit ID: ${userId}`);
    
    // Prüfe, ob Dokumente-Tabelle existiert
    const [tables] = await connection.query('SHOW TABLES LIKE "documents"');
    
    if (tables.length === 0) {
      console.log('Tabelle "documents" existiert nicht. Erstelle sie...');
      
      // Erstelle die documents-Tabelle
      await connection.query(`
        CREATE TABLE documents (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_content LONGBLOB,
          category VARCHAR(50) DEFAULT 'other',
          description TEXT,
          upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          year INT,
          month VARCHAR(20),
          download_count INT DEFAULT 0,
          last_downloaded TIMESTAMP NULL,
          is_archived BOOLEAN DEFAULT false,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      
      console.log('Tabelle "documents" erfolgreich erstellt');
    }
    
    // Beispiel-Dokumente erstellen
    const documents = [
      { 
        user_id: userId, 
        file_name: 'Arbeitsvertrag.pdf',
        file_content: Buffer.from('Beispielinhalt für Arbeitsvertrag'),
        category: 'Vertrag',
        description: 'Arbeitsvertrag des Mitarbeiters'
      },
      { 
        user_id: userId, 
        file_name: 'Gehaltsabrechnung_Januar2025.pdf',
        file_content: Buffer.from('Beispielinhalt für Gehaltsabrechnung'),
        category: 'Gehaltsabrechnung',
        description: 'Gehaltsabrechnung für Januar 2025',
        year: 2025,
        month: 'Januar'
      },
      { 
        user_id: userId, 
        file_name: 'Reisekostenabrechnung.pdf',
        file_content: Buffer.from('Beispielinhalt für Reisekostenabrechnung'),
        category: 'Abrechnung',
        description: 'Abrechnung für Dienstreise'
      }
    ];
    
    // Dokumente in die Datenbank einfügen
    for (const doc of documents) {
      // Prüfen, ob das Dokument bereits existiert
      const [existing] = await connection.query(
        'SELECT id FROM documents WHERE user_id = ? AND file_name = ?',
        [doc.user_id, doc.file_name]
      );
      
      if (existing.length > 0) {
        console.log(`Dokument "${doc.file_name}" existiert bereits. Überspringe...`);
        continue;
      }
      
      // Felder und Werte für die Abfrage erstellen
      const fields = Object.keys(doc).join(', ');
      const placeholders = Object.keys(doc).map(() => '?').join(', ');
      const values = Object.values(doc);
      
      // Dokument einfügen
      const [result] = await connection.query(
        `INSERT INTO documents (${fields}) VALUES (${placeholders})`,
        values
      );
      
      console.log(`Dokument "${doc.file_name}" erfolgreich erstellt mit ID: ${result.insertId}`);
    }
    
    await connection.end();
    console.log('Datenbankverbindung geschlossen');
  } catch (error) {
    console.error('Fehler:', error);
  }
}

createTestDocuments();