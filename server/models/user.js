const db = require('../database');
const bcrypt = require('bcrypt');

class User {
  static async create(userData) {
    const { username, email, password, role, company, notes, first_name, last_name, age, employee_id, iban } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `INSERT INTO users (username, email, password, role, company, notes, first_name, last_name, age, employee_id, iban) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await db.query(query, [username, email, hashedPassword, role, company, notes, first_name, last_name, age, employee_id, iban]);
    return result.insertId;
  }

  static async findByUsername(username) {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  }
  
  static async findByRole(role) {
    const [rows] = await db.query('SELECT id, username, email, role, company, first_name, last_name, created_at FROM users WHERE role = ?', [role]);
    return rows;
  }

  static async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  }
  
  static async delete(id) {
    try {
      const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`Error deleting user with ID ${id}:`, error);
      throw error;
    }
  }

  // Neue Methode zum Aktualisieren eines Benutzers
  static async update(id, userData) {
    try {
      // Abfrage dynamisch aufbauen basierend auf den zu aktualisierenden Feldern
      const fields = [];
      const values = [];
      
      // Für jedes übergebene Feld Query vorbereiten
      Object.entries(userData).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });
      
      // Wenn keine Felder zum Aktualisieren vorhanden sind, abbrechen
      if (fields.length === 0) {
        return false;
      }
      
      // ID für die WHERE-Klausel anhängen
      values.push(id);
      
      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      
      const [result] = await db.query(query, values);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`Error updating user with ID ${id}:`, error);
      throw error;
    }
  }
}

module.exports = User;