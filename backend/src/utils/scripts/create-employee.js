/**
 * ACHTUNG: Dieses Script ist primär für Test-Zwecke!
 * Employee_id wird automatisch vom User Model generiert im Format:
 * DOMAINROLEIDDDMMYYYYHHMM (z.B. SCSEMP21120620251758)
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createEmployee() {
  try {
    console.log('Verbindung zur Datenbank wird hergestellt...');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('Verbindung erfolgreich hergestellt!');

    // Erstelle einen Testmitarbeiter
    const password = await bcrypt.hash('password123', 10);

    // Erstelle einen Test-Mitarbeiter
    const employeeData = {
      username: 'mitarbeiter1',
      email: 'mitarbeiter1@example.com',
      password,
      role: 'employee',
      first_name: 'Max',
      last_name: 'Mustermann',
      age: 30,
      // employee_id wird automatisch vom User Model generiert!
      position: 'Entwickler',
      tenant_id: 8, // SCS tenant
    };

    // SQL-Abfrage erstellen
    const fields = Object.keys(employeeData).join(', ');
    const placeholders = Object.keys(employeeData)
      .map(() => '?')
      .join(', ');
    const values = Object.values(employeeData);

    const query = `INSERT INTO users (${fields}) VALUES (${placeholders})`;

    try {
      const [result] = await connection.query(query, values);
      console.log(
        `Mitarbeiter erfolgreich erstellt mit ID: ${result.insertId}`
      );
    } catch (error) {
      // Wenn der Mitarbeiter bereits existiert, aktualisieren wir ihn stattdessen
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(
          'Mitarbeiter existiert bereits. Aktualisiere stattdessen...'
        );

        // Aktualisierungsabfrage ohne Passwort und Benutzername (eindeutige Felder)
        const { username, email, password, ...updateData } = employeeData;

        const updateFields = Object.entries(updateData)
          .map(([key, _]) => `${key} = ?`)
          .join(', ');

        const updateQuery = `UPDATE users SET ${updateFields} WHERE username = ?`;
        const updateValues = [...Object.values(updateData), username];

        const [updateResult] = await connection.query(
          updateQuery,
          updateValues
        );
        console.log(
          `Mitarbeiter erfolgreich aktualisiert. Betroffene Zeilen: ${updateResult.affectedRows}`
        );
      } else {
        throw error;
      }
    }

    await connection.end();
    console.log('Datenbankverbindung geschlossen');
  } catch (error) {
    console.error('Fehler:', error);
  }
}

createEmployee();
