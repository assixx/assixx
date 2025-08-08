const mysql = require("mysql2/promise");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

async function runMigration() {
  let connection;

  try {
    // Verbindung zur Datenbank herstellen
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    });

    console.info("📊 Starting survey feature migration...");

    // SQL-Datei lesen
    const sqlPath = path.join(__dirname, "survey_schema.sql");
    const sql = await fs.readFile(sqlPath, "utf8");

    // Migration ausführen
    await connection.query(sql);

    console.info("✅ Survey tables created successfully");

    // Prüfen ob Feature bereits existiert
    const [features] = await connection.query(
      "SELECT id FROM features WHERE code = ?",
      ["surveys"],
    );

    if (features.length === 0) {
      // Feature hinzufügen
      await connection.query(
        `
        INSERT INTO features (code, name, description, category, base_price, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          "surveys",
          "Umfrage-Tool",
          "Umfrage-Tool für Mitarbeiterbefragungen mit anonymen Optionen",
          "premium",
          29.99,
          1,
        ],
      );
      console.info("✅ Survey feature added to features table");
    } else {
      console.info("ℹ️ Survey feature already exists in features table");
    }

    // Beispiel-Template erstellen
    const [templates] = await connection.query(
      "SELECT id FROM survey_templates WHERE name = ?",
      ["Mitarbeiterzufriedenheit"],
    );

    if (templates.length === 0) {
      const templateData = {
        title: "Mitarbeiterzufriedenheit",
        description: "Regelmäßige Befragung zur Mitarbeiterzufriedenheit",
        questions: [
          {
            question_text: "Wie zufrieden sind Sie insgesamt mit Ihrer Arbeit?",
            question_type: "rating",
            is_required: true,
            order_position: 1,
          },
          {
            question_text:
              "Würden Sie das Unternehmen als Arbeitgeber weiterempfehlen?",
            question_type: "yes_no",
            is_required: true,
            order_position: 2,
          },
          {
            question_text: "Was gefällt Ihnen am besten an Ihrer Arbeit?",
            question_type: "text",
            is_required: false,
            order_position: 3,
          },
          {
            question_text:
              "In welchen Bereichen sehen Sie Verbesserungspotenzial?",
            question_type: "multiple_choice",
            is_required: false,
            order_position: 4,
            options: [
              "Arbeitsumgebung",
              "Work-Life-Balance",
              "Kommunikation",
              "Weiterbildungsmöglichkeiten",
              "Vergütung",
              "Teamarbeit",
              "Führung",
            ],
          },
        ],
      };

      // Get first admin user for template creation
      const [adminUsers] = await connection.query(
        'SELECT id FROM users WHERE role IN ("admin", "root") LIMIT 1',
      );

      const adminUserId = adminUsers.length > 0 ? adminUsers[0].id : 16; // Fallback to known admin

      await connection.query(
        `
        INSERT INTO survey_templates (tenant_id, name, description, template_data, created_by, is_public)
        VALUES (1, ?, ?, ?, ?, true)
      `,
        [
          "Mitarbeiterzufriedenheit",
          "Vorlage für regelmäßige Mitarbeiterbefragungen",
          JSON.stringify(templateData),
          adminUserId,
        ],
      );

      console.info("✅ Sample survey template created");
    }

    console.info("🎉 Survey feature migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Migration ausführen
runMigration();
