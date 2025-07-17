require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs").promises;
const path = require("path");

async function createFeatureTables() {
  let connection;

  try {
    // Verbindung zur Datenbank
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    });

    console.log("Verbunden mit Datenbank:", process.env.DB_NAME);

    // SQL-Script einlesen
    const sqlPath = path.join(
      __dirname,
      "..",
      "database",
      "feature_management_schema.sql"
    );
    const sql = await fs.readFile(sqlPath, "utf8");

    // Script ausführen
    console.log("Erstelle Feature-Management Tabellen...");
    await connection.query(sql);

    console.log("Feature-Management Tabellen erfolgreich erstellt!");

    // Zeige vorhandene Features
    const [features] = await connection.query("SELECT * FROM features");
    console.log(`\n${features.length} Features hinzugefügt:`);
    features.forEach((feature) => {
      console.log(
        `- ${feature.name} (${feature.code}) - ${feature.category} - €${feature.base_price}`
      );
    });

    // Zeige verfügbare Plans
    const [plans] = await connection.query("SELECT * FROM subscription_plans");
    console.log(`\n${plans.length} Subscription Plans hinzugefügt:`);
    plans.forEach((plan) => {
      console.log(`- ${plan.name} - €${plan.price}/${plan.billing_period}`);
    });
  } catch (error) {
    console.error("Fehler beim Erstellen der Feature-Tabellen:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Script ausführen
createFeatureTables()
  .then(() => {
    console.log("\nFeature-Management System erfolgreich eingerichtet!");
    console.log(
      "Sie können jetzt Features über /feature-management.html verwalten"
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("Setup fehlgeschlagen:", error);
    process.exit(1);
  });
