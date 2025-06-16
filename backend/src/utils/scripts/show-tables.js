const mysql = require("mysql2/promise");
require("dotenv").config();

async function showTablesAndColumns() {
  try {
    console.log("Verbindung zur Datenbank wird hergestellt...");

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log("Verbindung erfolgreich hergestellt!");

    // Zeige alle Tabellen
    console.log("Tabellen in der Datenbank:");
    const [tables] = await connection.query("SHOW TABLES");
    console.log(tables.map((t) => Object.values(t)[0]).join(", "));

    // Zeige users-Tabelle-Struktur
    console.log("\nStruktur der users-Tabelle:");
    const [usersColumns] = await connection.query("DESCRIBE users");
    console.log("Field\t\tType\t\tNull\tKey\tDefault\tExtra");
    usersColumns.forEach((col) => {
      console.log(
        `${col.Field}\t\t${col.Type}\t\t${col.Null}\t${col.Key}\t${col.Default || "NULL"}\t${col.Extra}`,
      );
    });

    // Zeige departments-Tabelle-Struktur
    try {
      console.log("\nStruktur der departments-Tabelle:");
      const [deptColumns] = await connection.query("DESCRIBE departments");
      console.log("Field\t\tType\t\tNull\tKey\tDefault\tExtra");
      deptColumns.forEach((col) => {
        console.log(
          `${col.Field}\t\t${col.Type}\t\t${col.Null}\t${col.Key}\t${col.Default || "NULL"}\t${col.Extra}`,
        );
      });
    } catch (e) {
      console.log("departments-Tabelle existiert nicht");
    }

    // Überprüfe, ob Daten in der users-Tabelle existieren
    console.log("\nAnzahl der Benutzer in der Datenbank:");
    const [userCount] = await connection.query(
      "SELECT role, COUNT(*) as count FROM users GROUP BY role",
    );
    console.log(userCount);

    await connection.end();
    console.log("\nDatenbankverbindung geschlossen");
  } catch (error) {
    console.error("Fehler:", error);
  }
}

showTablesAndColumns();
