/**
 * KVP (Kontinuierlicher Verbesserungsprozess) Model
 * Handles all database operations for the KVP system
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lohnabrechnung',
  charset: 'utf8mb4'
};

console.log("KVP Model geladen - Benutze DB:", process.env.DB_NAME);

class KVPModel {
  // Helper method to get database connection
  static async getConnection() {
    try {
      const connection = await mysql.createConnection(dbConfig);
      return connection;
    } catch (error) {
      console.error('Database connection error in KVP model:', error);
      throw error;
    }
  }

  // Get all categories for a tenant
  static async getCategories(tenantId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM kvp_categories WHERE tenant_id = ? ORDER BY name ASC',
        [tenantId]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  // Create new suggestion
  static async createSuggestion(data) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(`
        INSERT INTO kvp_suggestions 
        (tenant_id, title, description, category_id, org_level, org_id, submitted_by, priority, expected_benefit, estimated_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.tenant_id,
        data.title,
        data.description,
        data.category_id,
        data.org_level,
        data.org_id,
        data.submitted_by,
        data.priority || 'normal',
        data.expected_benefit,
        data.estimated_cost
      ]);
      
      return { id: result.insertId, ...data };
    } finally {
      await connection.end();
    }
  }

  // Get suggestions with filters
  static async getSuggestions(tenantId, userId, userRole, filters = {}) {
    const connection = await this.getConnection();
    try {
      let query = `
        SELECT 
          s.*,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          u.first_name as submitted_by_name,
          u.last_name as submitted_by_lastname,
          admin.first_name as assigned_to_name,
          admin.last_name as assigned_to_lastname,
          (SELECT COUNT(*) FROM kvp_attachments WHERE suggestion_id = s.id) as attachment_count,
          (SELECT COUNT(*) FROM kvp_comments WHERE suggestion_id = s.id) as comment_count,
          (SELECT AVG(rating) FROM kvp_ratings WHERE suggestion_id = s.id) as avg_rating
        FROM kvp_suggestions s
        LEFT JOIN kvp_categories c ON s.category_id = c.id
        LEFT JOIN users u ON s.submitted_by = u.id
        LEFT JOIN users admin ON s.assigned_to = admin.id
        WHERE s.tenant_id = ?
      `;
      
      let params = [tenantId];
      
      // If employee, only show their own suggestions and implemented ones
      if (userRole === 'employee') {
        query += ' AND (s.submitted_by = ? OR s.status = "implemented")';
        params.push(userId);
      }
      
      // Apply filters
      if (filters.status) {
        query += ' AND s.status = ?';
        params.push(filters.status);
      }
      
      if (filters.category_id) {
        query += ' AND s.category_id = ?';
        params.push(filters.category_id);
      }
      
      if (filters.priority) {
        query += ' AND s.priority = ?';
        params.push(filters.priority);
      }
      
      if (filters.org_level) {
        query += ' AND s.org_level = ?';
        params.push(filters.org_level);
      }
      
      query += ' ORDER BY s.created_at DESC';
      
      const [rows] = await connection.execute(query, params);
      return rows;
    } finally {
      await connection.end();
    }
  }

  // Get single suggestion by ID
  static async getSuggestionById(id, tenantId, userId, userRole) {
    const connection = await this.getConnection();
    try {
      let query = `
        SELECT 
          s.*,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          u.first_name as submitted_by_name,
          u.last_name as submitted_by_lastname,
          u.email as submitted_by_email,
          admin.first_name as assigned_to_name,
          admin.last_name as assigned_to_lastname
        FROM kvp_suggestions s
        LEFT JOIN kvp_categories c ON s.category_id = c.id
        LEFT JOIN users u ON s.submitted_by = u.id
        LEFT JOIN users admin ON s.assigned_to = admin.id
        WHERE s.id = ? AND s.tenant_id = ?
      `;
      
      let params = [id, tenantId];
      
      // If employee, only allow access to their own suggestions or implemented ones
      if (userRole === 'employee') {
        query += ' AND (s.submitted_by = ? OR s.status = "implemented")';
        params.push(userId);
      }
      
      const [rows] = await connection.execute(query, params);
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  // Update suggestion status (Admin only)
  static async updateSuggestionStatus(id, tenantId, status, userId, changeReason = null) {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      
      // Get current status for history
      const [currentRows] = await connection.execute(
        'SELECT status FROM kvp_suggestions WHERE id = ? AND tenant_id = ?',
        [id, tenantId]
      );
      
      if (currentRows.length === 0) {
        throw new Error('Suggestion not found');
      }
      
      const oldStatus = currentRows[0].status;
      
      // Update suggestion
      const [result] = await connection.execute(`
        UPDATE kvp_suggestions 
        SET status = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `, [status, userId, id, tenantId]);
      
      // Add to history
      await connection.execute(`
        INSERT INTO kvp_status_history 
        (tenant_id, suggestion_id, old_status, new_status, changed_by, change_reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [tenantId, id, oldStatus, status, userId, changeReason]);
      
      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  }

  // Add attachment to suggestion
  static async addAttachment(suggestionId, fileData) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(`
        INSERT INTO kvp_attachments 
        (suggestion_id, file_name, file_path, file_type, file_size, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        suggestionId,
        fileData.file_name,
        fileData.file_path,
        fileData.file_type,
        fileData.file_size,
        fileData.uploaded_by
      ]);
      
      return { id: result.insertId, ...fileData };
    } finally {
      await connection.end();
    }
  }

  // Get attachments for suggestion
  static async getAttachments(suggestionId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT a.*, u.first_name, u.last_name
        FROM kvp_attachments a
        LEFT JOIN users u ON a.uploaded_by = u.id
        WHERE a.suggestion_id = ?
        ORDER BY a.uploaded_at DESC
      `, [suggestionId]);
      
      return rows;
    } finally {
      await connection.end();
    }
  }

  // Add comment to suggestion
  static async addComment(suggestionId, userId, comment, isInternal = false) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(`
        INSERT INTO kvp_comments 
        (suggestion_id, user_id, comment, is_internal)
        VALUES (?, ?, ?, ?)
      `, [suggestionId, userId, comment, isInternal]);
      
      return result.insertId;
    } finally {
      await connection.end();
    }
  }

  // Get comments for suggestion
  static async getComments(suggestionId, userRole) {
    const connection = await this.getConnection();
    try {
      let query = `
        SELECT c.*, u.first_name, u.last_name, u.role
        FROM kvp_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.suggestion_id = ?
      `;
      
      // Hide internal comments from employees
      if (userRole === 'employee') {
        query += ' AND c.is_internal = FALSE';
      }
      
      query += ' ORDER BY c.created_at ASC';
      
      const [rows] = await connection.execute(query, [suggestionId]);
      return rows;
    } finally {
      await connection.end();
    }
  }

  // Get user points summary
  static async getUserPoints(tenantId, userId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT 
          SUM(points) as total_points,
          COUNT(*) as total_awards,
          COUNT(DISTINCT suggestion_id) as suggestions_awarded
        FROM kvp_points 
        WHERE tenant_id = ? AND user_id = ?
      `, [tenantId, userId]);
      
      return rows[0] || { total_points: 0, total_awards: 0, suggestions_awarded: 0 };
    } finally {
      await connection.end();
    }
  }

  // Award points to user
  static async awardPoints(tenantId, userId, suggestionId, points, reason, awardedBy) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(`
        INSERT INTO kvp_points 
        (tenant_id, user_id, suggestion_id, points, reason, awarded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [tenantId, userId, suggestionId, points, reason, awardedBy]);
      
      return result.insertId;
    } finally {
      await connection.end();
    }
  }

  // Get dashboard statistics
  static async getDashboardStats(tenantId) {
    const connection = await this.getConnection();
    try {
      const [stats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_suggestions,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_suggestions,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'implemented' THEN 1 END) as implemented,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          AVG(CASE WHEN actual_savings IS NOT NULL THEN actual_savings END) as avg_savings
        FROM kvp_suggestions 
        WHERE tenant_id = ?
      `, [tenantId]);
      
      return stats[0];
    } finally {
      await connection.end();
    }
  }

  // Delete suggestion and all related data (only by owner)
  static async deleteSuggestion(suggestionId, tenantId, userId) {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      
      // Verify ownership
      const [ownerCheck] = await connection.execute(`
        SELECT submitted_by FROM kvp_suggestions 
        WHERE id = ? AND tenant_id = ? AND submitted_by = ?
      `, [suggestionId, tenantId, userId]);
      
      if (ownerCheck.length === 0) {
        throw new Error('Suggestion not found or not owned by user');
      }
      
      // Get all attachment file paths for deletion
      const [attachments] = await connection.execute(`
        SELECT file_path FROM kvp_attachments WHERE suggestion_id = ?
      `, [suggestionId]);
      
      // Delete database records (cascading will handle related records)
      await connection.execute('DELETE FROM kvp_suggestions WHERE id = ? AND tenant_id = ?', [suggestionId, tenantId]);
      
      await connection.commit();
      
      // Delete attachment files from filesystem
      const fs = require('fs').promises;
      const path = require('path');
      
      for (const attachment of attachments) {
        try {
          // file_path is already absolute, use it directly
          await fs.unlink(attachment.file_path);
          console.log(`Deleted attachment file: ${attachment.file_path}`);
        } catch (fileError) {
          console.warn(`Could not delete attachment file: ${attachment.file_path}`, fileError.message);
        }
      }
      
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  }

  // Get single attachment with access verification
  static async getAttachment(attachmentId, tenantId, userId, userRole) {
    const connection = await this.getConnection();
    try {
      const [attachments] = await connection.execute(`
        SELECT a.*, s.submitted_by, s.tenant_id
        FROM kvp_attachments a
        JOIN kvp_suggestions s ON a.suggestion_id = s.id
        WHERE a.id = ? AND s.tenant_id = ?
      `, [attachmentId, tenantId]);
      
      if (attachments.length === 0) {
        return null;
      }
      
      const attachment = attachments[0];
      
      // Verify access: admins can access all, employees only their own
      if (userRole !== 'admin' && userRole !== 'root' && attachment.submitted_by !== userId) {
        return null;
      }
      
      return attachment;
    } finally {
      await connection.end();
    }
  }
}

module.exports = KVPModel;