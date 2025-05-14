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
    const [rows] = await db.query('SELECT id, username, email, role, company, first_name, last_name FROM users WHERE role = ?', [role]);
    return rows;
  }
  
  // Neue delete-Methode hinzufügen - hier
  static async delete(id) {
    try {
      const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`Error deleting user with ID ${id}:`, error);
      throw error;
    }
  }
}

module.exports = User;