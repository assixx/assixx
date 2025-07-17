require("dotenv").config();
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs").promises;

async function setupTenants() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    });

    console.log("Verbunden mit Datenbank:", process.env.DB_NAME);

    // Lese SQL-Datei
    const sqlPath = path.join(
      __dirname,
      "..",
      "database",
      "create_tenants_table.sql"
    );
    const sql = await fs.readFile(sqlPath, "utf8");

    // Führe SQL aus
    console.log("Erstelle Tenant-Tabellen...");
    await connection.query(sql);

    console.log("Tenant-Tabellen erfolgreich erstellt!");
  } catch (error) {
    console.error("Fehler beim Erstellen der Tenant-Tabellen:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Script ausführen
setupTenants()
  .then(() => {
    console.log("Tenant-Setup abgeschlossen!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Setup fehlgeschlagen:", error);
    process.exit(1);
  });
