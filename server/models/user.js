const db = require('../database');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

class User {
  static async create(userData) {
    const { 
      username, 
      email, 
      password, 
      role, 
      company, 
      notes, 
      first_name, 
      last_name, 
      age, 
      employee_id, 
      department_id,
      position,
      phone,
      address,
      birthday,
      hire_date,
      emergency_contact,
      profile_picture
    } = userData;
    
    // Default-IBAN, damit der Server nicht abstürzt, wenn keine IBAN übergeben wird
    const iban = userData.iban || "";

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (
        username, email, password, role, company, notes, 
        first_name, last_name, age, employee_id, iban,
        department_id, position, phone, address, birthday,
        hire_date, emergency_contact, profile_picture
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await db.query(query, [
        username, email, hashedPassword, role, company, notes, 
        first_name, last_name, age, employee_id, iban,
        department_id, position, phone, address, birthday,
        hire_date, emergency_contact, profile_picture
      ]);
      
      logger.info(`User created successfully with ID: ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating user: ${error.message}`);
      throw error;
    }
  }

  static async findByUsername(username) {
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
      return rows[0];
    } catch (error) {
      logger.error(`Error finding user by username: ${error.message}`);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await db.query(`
        SELECT u.*, d.name as department_name 
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ?
      `, [id]);
      
      return rows[0];
    } catch (error) {
      logger.error(`Error finding user by ID: ${error.message}`);
      throw error;
    }
  }
  
  static async findByRole(role) {
    try {
      const [rows] = await db.query(`
        SELECT u.id, u.username, u.email, u.role, u.company, 
        u.first_name, u.last_name, u.created_at, u.department_id, 
        u.position, u.phone, u.profile_picture, d.name as department_name 
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.role = ?
      `, [role]);
      
      return rows;
    } catch (error) {
      logger.error(`Error finding users by role: ${error.message}`);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
      return rows[0];
    } catch (error) {
      logger.error(`Error finding user by email: ${error.message}`);
      throw error;
    }
  }
  
  static async delete(id) {
    try {
      const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error deleting user with ID ${id}: ${error.message}`);
      throw error;
    }
  }

  static async update(id, userData) {
    try {
      // Dynamisch Query aufbauen basierend auf den zu aktualisierenden Feldern
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
      logger.error(`Error updating user with ID ${id}: ${error.message}`);
      throw error;
    }
  }

  // Neue Methode: Benutzer suchen mit Filtern
  static async search(filters = {}) {
    try {
      let query = `
        SELECT u.id, u.username, u.email, u.role, u.company, 
        u.first_name, u.last_name, u.employee_id, u.created_at,
        u.department_id, u.position, u.phone, d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE 1=1
      `;
      
      const values = [];

      // Filter hinzufügen
      if (filters.role) {
        query += ` AND u.role = ?`;
        values.push(filters.role);
      }
      
      if (filters.department_id) {
        query += ` AND u.department_id = ?`;
        values.push(filters.department_id);
      }
      
      if (filters.search) {
        query += ` AND (
          u.username LIKE ? OR 
          u.email LIKE ? OR 
          u.first_name LIKE ? OR 
          u.last_name LIKE ? OR
          u.employee_id LIKE ?
        )`;
        const searchTerm = `%${filters.search}%`;
        values.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      // Sortierung hinzufügen
      if (filters.sort_by) {
        const validColumns = [
          'username', 'email', 'first_name', 'last_name', 
          'created_at', 'employee_id', 'position'
        ];
        
        if (validColumns.includes(filters.sort_by)) {
          const direction = filters.sort_dir === 'desc' ? 'DESC' : 'ASC';
          query += ` ORDER BY u.${filters.sort_by} ${direction}`;
        } else {
          query += ` ORDER BY u.username ASC`;
        }
      } else {
        query += ` ORDER BY u.username ASC`;
      }
      
      // Pagination hinzufügen
      if (filters.limit) {
        const limit = parseInt(filters.limit) || 20;
        const page = parseInt(filters.page) || 1;
        const offset = (page - 1) * limit;
        
        query += ` LIMIT ? OFFSET ?`;
        values.push(limit, offset);
      }
      
      const [rows] = await db.query(query, values);
      return rows;
    } catch (error) {
      logger.error(`Error searching users: ${error.message}`);
      throw error;
    }
  }

  // Neue Methode: Profilbild aktualisieren
  static async updateProfilePicture(userId, picturePath) {
    try {
      const query = `UPDATE users SET profile_picture = ? WHERE id = ?`;
      const [result] = await db.query(query, [picturePath, userId]);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error updating profile picture for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  // Neue Methode: Anzahl der Benutzer zählen (für Pagination)
  static async count(filters = {}) {
    try {
      let query = `SELECT COUNT(*) as total FROM users u WHERE 1=1`;
      const values = [];
      
      if (filters.role) {
        query += ` AND u.role = ?`;
        values.push(filters.role);
      }
      
      if (filters.department_id) {
        query += ` AND u.department_id = ?`;
        values.push(filters.department_id);
      }
      
      if (filters.search) {
        query += ` AND (
          u.username LIKE ? OR 
          u.email LIKE ? OR 
          u.first_name LIKE ? OR 
          u.last_name LIKE ? OR
          u.employee_id LIKE ?
        )`;
        const searchTerm = `%${filters.search}%`;
        values.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      const [rows] = await db.query(query, values);
      return rows[0].total;
    } catch (error) {
      logger.error(`Error counting users: ${error.message}`);
      throw error;
    }
  }

  // Neue Methode: Selbstständige Aktualisierung des eigenen Profils
  static async updateOwnProfile(userId, userData) {
    try {
      // Wir holen zuerst den Benutzer, um zu sehen, welche Felder er bearbeiten darf
      const user = await this.findById(userId);
      
      if (!user) {
        return { success: false, message: 'Benutzer nicht gefunden' };
      }
      
      // Bestimmen, welche Felder aktualisiert werden dürfen
      let editableFields = [];
      
      // Wenn das Feld editable_fields existiert und ein JSON-String ist, parsen wir es
      if (user.editable_fields) {
        try {
          editableFields = JSON.parse(user.editable_fields);
        } catch (e) {
          logger.error(`Error parsing editable_fields for user ${userId}: ${e.message}`);
          // Standard-editierbare Felder setzen
          editableFields = ['phone', 'address', 'emergency_contact'];
        }
      } else {
        // Standard-editierbare Felder, wenn nichts anderes definiert ist
        editableFields = ['phone', 'address', 'emergency_contact'];
      }
      
      // Nur die erlaubten Felder aktualisieren
      const allowedUpdates = {};
      
      for (const field of editableFields) {
        if (userData[field] !== undefined) {
          allowedUpdates[field] = userData[field];
        }
      }
      
      // Wenn keine erlaubten Updates vorliegen, abbrechen
      if (Object.keys(allowedUpdates).length === 0) {
        return { success: false, message: 'Keine erlaubten Felder zum Aktualisieren' };
      }
      
      // Update durchführen
      const success = await this.update(userId, allowedUpdates);
      
      if (success) {
        return { success: true, message: 'Profil erfolgreich aktualisiert' };
      } else {
        return { success: false, message: 'Fehler beim Aktualisieren des Profils' };
      }
    } catch (error) {
      logger.error(`Error in updateOwnProfile for user ${userId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = User;