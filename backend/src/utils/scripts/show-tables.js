const mysql = require('mysql2/promise');
require('dotenv').config();

async function showTablesAndColumns() {
  try {
    console.info('Verbindung zur Datenbank wird hergestellt...');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.info('Verbindung erfolgreich hergestellt!');

    // Zeige alle Tabellen
    console.info('Tabellen in der Datenbank:');
    const [tables] = await connection.query('SHOW TABLES');
    console.info(tables.map((t) => Object.values(t)[0]).join(', '));

    // Zeige users-Tabelle-Struktur
    console.info('\nStruktur der users-Tabelle:');
    const [usersColumns] = await connection.query('DESCRIBE users');
    console.info('Field\t\tType\t\tNull\tKey\tDefault\tExtra');
    usersColumns.forEach((col) => {
      console.info(
        `${col.Field}\t\t${col.Type}\t\t${col.Null}\t${col.Key}\t${col.Default || 'NULL'}\t${col.Extra}`,
      );
    });

    // Zeige departments-Tabelle-Struktur
    try {
      console.info('\nStruktur der departments-Tabelle:');
      const [deptColumns] = await connection.query('DESCRIBE departments');
      console.info('Field\t\tType\t\tNull\tKey\tDefault\tExtra');
      deptColumns.forEach((col) => {
        console.info(
          `${col.Field}\t\t${col.Type}\t\t${col.Null}\t${col.Key}\t${col.Default || 'NULL'}\t${col.Extra}`,
        );
      });
    } catch (e) {
      console.info('departments-Tabelle existiert nicht');
    }

    // Überprüfe, ob Daten in der users-Tabelle existieren
    console.info('\nAnzahl der Benutzer in der Datenbank:');
    const [userCount] = await connection.query(
      'SELECT role, COUNT(*) as count FROM users GROUP BY role',
    );
    console.info(userCount);

    await connection.end();
    console.info('\nDatenbankverbindung geschlossen');
  } catch (error) {
    console.error('Fehler:', error);
  }
}

showTablesAndColumns();
