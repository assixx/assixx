const mysql = require('mysql2/promise');
require('dotenv').config();

// Prüfe, ob wir den Mock-Modus verwenden sollen
const USE_MOCK_DB = process.env.USE_MOCK_DB === 'true';

let pool;

if (USE_MOCK_DB) {
  console.log('VERWENDE MOCK-DATENBANK FÜR ENTWICKLUNG');
  
  // Mock-Implementierung
  const mockDb = {
    async query(sql, params) {
      console.log('MOCK DB QUERY:', sql);
      
      // Einfache Mock-Daten für Entwicklung
      if (sql.includes('SELECT * FROM users WHERE role = "employee"')) {
        return [[
          { id: 1, username: 'mitarbeiter1', first_name: 'Max', last_name: 'Mustermann', email: 'max@example.com', role: 'employee', status: 'active', department_id: 1, position: 'Entwickler' },
          { id: 2, username: 'mitarbeiter2', first_name: 'Anna', last_name: 'Schmidt', email: 'anna@example.com', role: 'employee', status: 'active', department_id: 1, position: 'Designerin' },
          { id: 3, username: 'mitarbeiter3', first_name: 'Thomas', last_name: 'Müller', email: 'thomas@example.com', role: 'employee', status: 'inactive', department_id: 2, position: 'Manager' }
        ]];
      } 
      else if (sql.includes('SELECT * FROM departments')) {
        return [[
          { id: 1, name: 'Entwicklung', description: 'Software-Entwicklung', status: 'active' },
          { id: 2, name: 'Marketing', description: 'Marketing und Verkauf', status: 'active' }
        ]];
      }
      else if (sql.includes('SELECT * FROM documents')) {
        return [[
          { id: 1, user_id: 1, file_name: 'Arbeitsvertrag.pdf', category: 'Vertrag', upload_date: new Date() },
          { id: 2, user_id: 2, file_name: 'Gehaltsabrechnung.pdf', category: 'Gehaltsabrechnung', upload_date: new Date() }
        ]];
      }
      else if (sql.includes('COUNT(*) as count FROM users')) {
        return [[{ count: 3 }]];
      }
      else if (sql.includes('COUNT(*) as count FROM departments')) {
        return [[{ count: 2 }]];
      }
      else if (sql.includes('COUNT(*) as count FROM documents')) {
        return [[{ count: 2 }]];
      }
      else if (sql.includes('SELECT * FROM users WHERE username = ?')) {
        if (params[0] === 'admin') {
          return [[{ id: 999, username: 'admin', password: '$2b$10$0h85p.WVUvyRJ1taW9vEvehv7Lz.GcMRkRdSOWLG.GaOSydbE8u3a', first_name: 'Admin', last_name: 'User', email: 'admin@example.com', role: 'admin' }]];
        }
        return [[]];
      }
      else if (sql.includes('SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?')) {
        // Mock für findById
        const userId = params[0];
        if (userId == 999) {
          return [[{ id: 999, username: 'admin', first_name: 'Admin', last_name: 'User', email: 'admin@example.com', role: 'admin', department_id: null, department_name: null }]];
        } else if (userId == 1) {
          return [[{ id: 1, username: 'mitarbeiter1', first_name: 'Max', last_name: 'Mustermann', email: 'max@example.com', role: 'employee', status: 'active', department_id: 1, department_name: 'Entwicklung', position: 'Entwickler' }]];
        } else if (userId == 2) {
          return [[{ id: 2, username: 'mitarbeiter2', first_name: 'Anna', last_name: 'Schmidt', email: 'anna@example.com', role: 'employee', status: 'active', department_id: 1, department_name: 'Entwicklung', position: 'Designerin' }]];
        } else if (userId == 3) {
          return [[{ id: 3, username: 'mitarbeiter3', first_name: 'Thomas', last_name: 'Müller', email: 'thomas@example.com', role: 'employee', status: 'inactive', department_id: 2, department_name: 'Marketing', position: 'Manager' }]];
        }
        return [[]];
      }
      else if (sql.includes('UPDATE users SET') && sql.includes('WHERE id = ?')) {
        // Mock für update
        console.log('MOCK DB: Updating user', params);
        return [{ affectedRows: 1 }];
      }
      else if (sql.includes('INSERT INTO users')) {
        // Mock für create
        console.log('MOCK DB: Creating user', params);
        return [{ insertId: 4 }];
      }
      else if (sql.includes('DELETE FROM users WHERE id = ?')) {
        // Mock für delete
        console.log('MOCK DB: Deleting user', params);
        return [{ affectedRows: 1 }];
      }
      
      // Standardantwort für nicht implementierte Abfragen
      console.warn('MOCK DB: Unimplementierte Abfrage:', sql);
      return [[]];
    }
  };
  
  pool = mockDb;
} else {
  // Echte Datenbankverbindung
  try {
    console.log('Verbindung zur Datenbank wird hergestellt...');
    console.log(`Host: ${process.env.DB_HOST}, User: ${process.env.DB_USER}, Database: ${process.env.DB_NAME}`);
    
    const config = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: false, // Sicherheitsverbesserung
      typeCast: function (field, next) {
        // Spezielle Behandlung für BLOB/BINARY Felder, um sie als Buffer zurückzugeben
        if (field.type === 'BLOB' || field.type === 'BINARY') {
          return field.buffer();
        }
        return next();
      }
    };
    
    pool = mysql.createPool(config);
    console.log('Datenbank-Verbindung hergestellt');
  } catch (error) {
    console.error('Fehler beim Verbinden mit der Datenbank:', error);
  }
}

module.exports = pool;