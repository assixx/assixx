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
      profile_picture,
      status = 'active',
      is_archived = false
    } = userData;
    
    // Default-IBAN, damit der Server nicht abstürzt, wenn keine IBAN übergeben wird
    const iban = userData.iban || "";

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (
        username, email, password, role, company, notes, 
        first_name, last_name, age, employee_id, iban,
        department_id, position, phone, address, birthday,
        hire_date, emergency_contact, profile_picture,
        status, is_archived, tenant_id
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await db.query(query, [
        username, email, hashedPassword, role, company, notes, 
        first_name, last_name, age, employee_id, iban,
        department_id, position, phone, address, birthday,
        hire_date, emergency_contact, profile_picture,
        status, is_archived, userData.tenant_id
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
  
  static async findByRole(role, includeArchived = false, tenant_id = null) {
    try {
      let query = `
        SELECT u.id, u.username, u.email, u.role, u.company, 
        u.first_name, u.last_name, u.created_at, u.department_id, 
        u.position, u.phone, u.profile_picture, u.status, u.is_archived,
        d.name as department_name 
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.role = ?
        ${tenant_id ? 'AND u.tenant_id = ?' : ''}
      `;
      
      const params = [role];
      if (tenant_id) params.push(tenant_id);
      
      if (!includeArchived) {
        query += ` AND u.is_archived = false`;
      }
      
      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      logger.error(`Error finding users by role: ${error.message}`);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_archived = false', [email]);
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
        u.department_id, u.position, u.phone, u.status, u.is_archived,
        d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE 1=1
      `;
      
      const values = [];

      // Filter für archivierte Benutzer
      if (filters.is_archived !== undefined) {
        query += ` AND u.is_archived = ?`;
        values.push(filters.is_archived);
      } else {
        // Standardmäßig nur nicht-archivierte Benutzer anzeigen
        query += ` AND u.is_archived = false`;
      }
      
      // Weitere Filter hinzufügen
      if (filters.role) {
        query += ` AND u.role = ?`;
        values.push(filters.role);
      }
      
      if (filters.department_id) {
        query += ` AND u.department_id = ?`;
        values.push(filters.department_id);
      }
      
      if (filters.status) {
        query += ` AND u.status = ?`;
        values.push(filters.status);
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
          'created_at', 'employee_id', 'position', 'status'
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
      
      // Filter für archivierte Benutzer
      if (filters.is_archived !== undefined) {
        query += ` AND u.is_archived = ?`;
        values.push(filters.is_archived);
      } else {
        // Standardmäßig nur nicht-archivierte Benutzer anzeigen
        query += ` AND u.is_archived = false`;
      }
      
      if (filters.role) {
        query += ` AND u.role = ?`;
        values.push(filters.role);
      }
      
      if (filters.department_id) {
        query += ` AND u.department_id = ?`;
        values.push(filters.department_id);
      }
      
      if (filters.status) {
        query += ` AND u.status = ?`;
        values.push(filters.status);
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

  // Neue Methode: Benutzer archivieren
  static async archiveUser(userId) {
    logger.info(`Archiving user ${userId}`);
    return this.update(userId, { is_archived: true });
  }

  // Neue Methode: Benutzer aus dem Archiv wiederherstellen
  static async unarchiveUser(userId) {
    logger.info(`Unarchiving user ${userId}`);
    return this.update(userId, { is_archived: false });
  }

  // Neue Methode: Alle archivierten Benutzer auflisten
  static async findArchivedUsers(role = null) {
    try {
      let query = `
        SELECT u.id, u.username, u.email, u.role, u.company, 
        u.first_name, u.last_name, u.created_at, u.department_id, 
        u.position, u.phone, u.profile_picture, u.status,
        d.name as department_name 
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.is_archived = true
      `;
      
      const params = [];
      
      if (role) {
        query += ` AND u.role = ?`;
        params.push(role);
      }
      
      query += ` ORDER BY u.last_name, u.first_name`;
      
      const [rows] = await db.query(query, params);
      
      return rows;
    } catch (error) {
      logger.error(`Error finding archived users: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get user's role, department and team information
   * @param {number} userId - The user ID to retrieve information for
   * @returns {Promise<Object>} Object containing role, departmentId, and teamId
   */
  static async getUserDepartmentAndTeam(userId) {
    try {
      logger.info(`Getting department and team for user ${userId}`);
      
      // First, get the user's role and department_id
      const [userRows] = await db.query(
        'SELECT role, department_id FROM users WHERE id = ?',
        [userId]
      );
      
      if (userRows.length === 0) {
        logger.warn(`User ${userId} not found`);
        return { role: null, departmentId: null, teamId: null };
      }
      
      const { role, department_id } = userRows[0];
      
      // Now, find the user's team (if any)
      // We'll return the first team if user belongs to multiple teams
      const [teamRows] = await db.query(
        'SELECT team_id FROM user_teams WHERE user_id = ? LIMIT 1',
        [userId]
      );
      
      const teamId = teamRows.length > 0 ? teamRows[0].team_id : null;
      
      logger.info(`User ${userId} - Role: ${role}, Department: ${department_id}, Team: ${teamId}`);
      
      return {
        role,
        departmentId: department_id,
        teamId
      };
    } catch (error) {
      logger.error(`Error getting department and team for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  // Neue Methode: Überprüfen, ob ein Benutzer Dokumente hat
  static async hasDocuments(userId) {
    try {
      const query = `
        SELECT COUNT(*) as document_count 
        FROM documents 
        WHERE user_id = ?
      `;
      
      const [rows] = await db.query(query, [userId]);
      
      return rows[0].document_count > 0;
    } catch (error) {
      logger.error(`Error checking if user ${userId} has documents: ${error.message}`);
      throw error;
    }
  }

  // Neue Methode: Dokumente eines Benutzers zählen
  static async getDocumentCount(userId) {
    try {
      const query = `
        SELECT COUNT(*) as document_count 
        FROM documents 
        WHERE user_id = ?
      `;
      
      const [rows] = await db.query(query, [userId]);
      
      return rows[0].document_count;
    } catch (error) {
      logger.error(`Error counting documents for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's department and team information
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Object with role, departmentId, and teamId
   */
  static async getUserDepartmentAndTeam(userId) {
    try {
      const query = `
        SELECT 
          u.role,
          u.department_id,
          u.team_id,
          d.name as department_name,
          t.name as team_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.id = ?
      `;
      
      const [rows] = await db.query(query, [userId]);
      
      if (rows.length === 0) {
        return {
          role: null,
          departmentId: null,
          teamId: null,
          departmentName: null,
          teamName: null
        };
      }

      const user = rows[0];
      return {
        role: user.role,
        departmentId: user.department_id,
        teamId: user.team_id,
        departmentName: user.department_name,
        teamName: user.team_name
      };
    } catch (error) {
      logger.error(`Error getting user department and team: ${error.message}`);
      throw error;
    }
  }

  // Passwort ändern
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      // Aktuellen Benutzer abrufen
      const user = await this.findById(userId);
      if (!user) {
        return { success: false, message: 'Benutzer nicht gefunden' };
      }

      // Aktuelles Passwort überprüfen
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return { success: false, message: 'Aktuelles Passwort ist incorrect' };
      }

      // Neues Passwort hashen
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Passwort in der Datenbank aktualisieren
      const query = 'UPDATE users SET password = ? WHERE id = ?';
      const [result] = await db.query(query, [hashedNewPassword, userId]);

      if (result.affectedRows > 0) {
        logger.info(`Password changed successfully for user ${userId}`);
        return { success: true, message: 'Passwort erfolgreich geändert' };
      } else {
        return { success: false, message: 'Fehler beim Ändern des Passworts' };
      }
    } catch (error) {
      logger.error(`Error changing password for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  // Profil-Update erweitern für allgemeine Felder
  static async updateOwnProfile(userId, userData) {
    try {
      const user = await this.findById(userId);
      
      if (!user) {
        return { success: false, message: 'Benutzer nicht gefunden' };
      }
      
      // Erlaubte Felder für Profil-Updates (erweitert)
      const allowedFields = [
        'email', 'first_name', 'last_name', 'age', 'employee_id', 
        'iban', 'company', 'notes', 'phone', 'address', 'emergency_contact'
      ];
      
      // Nur erlaubte Felder übernehmen
      const updates = {};
      Object.keys(userData).forEach(key => {
        if (allowedFields.includes(key) && userData[key] !== undefined) {
          updates[key] = userData[key];
        }
      });
      
      if (Object.keys(updates).length === 0) {
        return { success: false, message: 'Keine gültigen Felder zum Aktualisieren' };
      }
      
      // SQL-Query dynamisch erstellen
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      
      const query = `UPDATE users SET ${setClause} WHERE id = ?`;
      values.push(userId);
      
      const [result] = await db.query(query, values);
      
      if (result.affectedRows > 0) {
        logger.info(`Profile updated successfully for user ${userId}`);
        return { success: true, message: 'Profil erfolgreich aktualisiert' };
      } else {
        return { success: false, message: 'Fehler beim Aktualisieren des Profils' };
      }
    } catch (error) {
      logger.error(`Error updating profile for user ${userId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = User;
