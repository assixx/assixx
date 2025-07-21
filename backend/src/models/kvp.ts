/**
 * KVP (Kontinuierlicher Verbesserungsprozess) Model
 * Handles all database operations for the KVP system
 */

import * as fs from "fs/promises";
import * as path from "path";

import * as dotenv from "dotenv";
import * as mysql from "mysql2/promise";
import { RowDataPacket, ResultSetHeader, Connection } from "mysql2/promise";

// Get project root directory
const projectRoot = process.cwd();

dotenv.config({ path: path.join(projectRoot, "backend", ".env") });

// Database configuration
const dbConfig: mysql.ConnectionOptions = {
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "lohnabrechnung",
  charset: "utf8mb4",
};

// Database interfaces
interface DbCategory extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface DbSuggestion extends RowDataPacket {
  id: number;
  tenant_id: number;
  title: string;
  description: string;
  category_id: number;
  org_level: "company" | "department" | "team";
  org_id: number;
  submitted_by: number;
  priority: "low" | "normal" | "high" | "urgent";
  expected_benefit?: string;
  estimated_cost?: number;
  status: "new" | "in_progress" | "implemented" | "rejected";
  assigned_to?: number;
  actual_savings?: number;
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  submitted_by_name?: string;
  submitted_by_lastname?: string;
  submitted_by_email?: string;
  assigned_to_name?: string;
  assigned_to_lastname?: string;
  attachment_count?: number;
  comment_count?: number;
  avg_rating?: number;
}

interface DbAttachment extends RowDataPacket {
  id: number;
  suggestion_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: number;
  uploaded_at: Date;
  // Extended fields from joins
  first_name?: string;
  last_name?: string;
  submitted_by?: number;
  tenant_id?: number;
}

interface DbComment extends RowDataPacket {
  id: number;
  suggestion_id: number;
  user_id: number;
  comment: string;
  is_internal: boolean;
  created_at: Date;
  // Extended fields from joins
  first_name?: string;
  last_name?: string;
  role?: string;
}

interface DbPointsSummary extends RowDataPacket {
  total_points: number;
  total_awards: number;
  suggestions_awarded: number;
}

interface DbDashboardStats extends RowDataPacket {
  total_suggestions: number;
  new_suggestions: number;
  in_progress: number;
  implemented: number;
  rejected: number;
  avg_savings: number | null;
}

interface SuggestionCreateData {
  tenant_id: number;
  title: string;
  description: string;
  category_id: number;
  org_level: "company" | "department" | "team";
  org_id: number;
  submitted_by: number;
  priority?: "low" | "normal" | "high" | "urgent";
  expected_benefit?: string;
  estimated_cost?: number;
}

interface SuggestionFilters {
  status?: string;
  category_id?: number;
  priority?: string;
  org_level?: string;
}

interface FileData {
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: number;
}

export class KVPModel {
  // Helper method to get database connection
  static async getConnection(): Promise<Connection> {
    try {
      const connection = await mysql.createConnection(dbConfig);
      return connection;
    } catch (error) {
      console.error("Database connection error in KVP model:", error);
      throw error;
    }
  }

  // Get all categories for a tenant
  static async getCategories(tenant_id: number): Promise<DbCategory[]> {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute<DbCategory[]>(
        "SELECT * FROM kvp_categories WHERE tenant_id = ? ORDER BY name ASC",
        [tenant_id],
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  // Create new suggestion
  static async createSuggestion(
    data: SuggestionCreateData,
  ): Promise<SuggestionCreateData & { id: number }> {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        `
        INSERT INTO kvp_suggestions 
        (tenant_id, title, description, category_id, org_level, org_id, submitted_by, priority, expected_benefit, estimated_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          data.tenant_id,
          data.title,
          data.description,
          data.category_id,
          data.org_level,
          data.org_id,
          data.submitted_by,
          data.priority ?? "normal",
          data.expected_benefit ?? null,
          data.estimated_cost ?? null,
        ],
      );

      return { id: result.insertId, ...data };
    } finally {
      await connection.end();
    }
  }

  // Get suggestions with filters
  static async getSuggestions(
    tenant_id: number,
    userId: number,
    userRole: string,
    filters: SuggestionFilters = {},
  ): Promise<DbSuggestion[]> {
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

      const params: unknown[] = [tenant_id];

      // If employee, only show their own suggestions and implemented ones
      if (userRole === "employee") {
        query += ' AND (s.submitted_by = ? OR s.status = "implemented")';
        params.push(userId);
      }

      // Apply filters
      if (filters.status) {
        query += " AND s.status = ?";
        params.push(filters.status);
      }

      if (filters.category_id) {
        query += " AND s.category_id = ?";
        params.push(filters.category_id);
      }

      if (filters.priority) {
        query += " AND s.priority = ?";
        params.push(filters.priority);
      }

      if (filters.org_level) {
        query += " AND s.org_level = ?";
        params.push(filters.org_level);
      }

      query += " ORDER BY s.created_at DESC";

      const [rows] = await connection.execute<DbSuggestion[]>(query, params);
      return rows;
    } finally {
      await connection.end();
    }
  }

  // Get single suggestion by ID
  static async getSuggestionById(
    id: number,
    tenant_id: number,
    userId: number,
    userRole: string,
  ): Promise<DbSuggestion | null> {
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

      const params: unknown[] = [id, tenant_id];

      // If employee, only allow access to their own suggestions or implemented ones
      if (userRole === "employee") {
        query += ' AND (s.submitted_by = ? OR s.status = "implemented")';
        params.push(userId);
      }

      const [rows] = await connection.execute<DbSuggestion[]>(query, params);
      return rows[0] ?? null;
    } finally {
      await connection.end();
    }
  }

  // Update suggestion status (Admin only)
  static async updateSuggestionStatus(
    id: number,
    tenant_id: number,
    status: string,
    userId: number,
    changeReason: string | null = null,
  ): Promise<boolean> {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();

      // Get current status for history
      const [currentRows] = await connection.execute<DbSuggestion[]>(
        "SELECT status FROM kvp_suggestions WHERE id = ? AND tenant_id = ?",
        [id, tenant_id],
      );

      if (currentRows.length === 0) {
        throw new Error("Suggestion not found");
      }

      const oldStatus = currentRows[0].status;

      // Update suggestion
      const [result] = await connection.execute<ResultSetHeader>(
        `
        UPDATE kvp_suggestions 
        SET status = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `,
        [status, userId, id, tenant_id],
      );

      // Add to history
      await connection.execute(
        `
        INSERT INTO kvp_status_history 
        (suggestion_id, old_status, new_status, changed_by, change_reason)
        VALUES (?, ?, ?, ?, ?)
      `,
        [id, oldStatus, status, userId, changeReason],
      );

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
  static async addAttachment(
    suggestionId: number,
    fileData: FileData,
  ): Promise<FileData & { id: number }> {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        `
        INSERT INTO kvp_attachments 
        (suggestion_id, file_name, file_path, file_type, file_size, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          suggestionId,
          fileData.file_name,
          fileData.file_path,
          fileData.file_type,
          fileData.file_size,
          fileData.uploaded_by,
        ],
      );

      return { id: result.insertId, ...fileData };
    } finally {
      await connection.end();
    }
  }

  // Get attachments for suggestion
  static async getAttachments(suggestionId: number): Promise<DbAttachment[]> {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute<DbAttachment[]>(
        `
        SELECT a.*, u.first_name, u.last_name
        FROM kvp_attachments a
        LEFT JOIN users u ON a.uploaded_by = u.id
        WHERE a.suggestion_id = ?
        ORDER BY a.uploaded_at DESC
      `,
        [suggestionId],
      );

      return rows;
    } finally {
      await connection.end();
    }
  }

  // Add comment to suggestion
  static async addComment(
    suggestionId: number,
    userId: number,
    comment: string,
    isInternal = false,
  ): Promise<number> {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        `
        INSERT INTO kvp_comments 
        (suggestion_id, user_id, comment, is_internal)
        VALUES (?, ?, ?, ?)
      `,
        [suggestionId, userId, comment, isInternal],
      );

      return result.insertId;
    } finally {
      await connection.end();
    }
  }

  // Get comments for suggestion
  static async getComments(
    suggestionId: number,
    userRole: string,
  ): Promise<DbComment[]> {
    const connection = await this.getConnection();
    try {
      let query = `
        SELECT c.*, u.first_name, u.last_name, u.role
        FROM kvp_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.suggestion_id = ?
      `;

      // Hide internal comments from employees
      if (userRole === "employee") {
        query += " AND c.is_internal = FALSE";
      }

      query += " ORDER BY c.created_at ASC";

      const [rows] = await connection.execute<DbComment[]>(query, [
        suggestionId,
      ]);
      return rows;
    } finally {
      await connection.end();
    }
  }

  // Get user points summary
  static async getUserPoints(
    tenant_id: number,
    userId: number,
  ): Promise<DbPointsSummary> {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute<DbPointsSummary[]>(
        `
        SELECT 
          SUM(points) as total_points,
          COUNT(*) as total_awards,
          COUNT(DISTINCT suggestion_id) as suggestions_awarded
        FROM kvp_points 
        WHERE tenant_id = ? AND user_id = ?
      `,
        [tenant_id, userId],
      );

      return (rows[0] ?? {
        total_points: 0,
        total_awards: 0,
        suggestions_awarded: 0,
      }) as DbPointsSummary;
    } finally {
      await connection.end();
    }
  }

  // Award points to user
  static async awardPoints(
    tenant_id: number,
    userId: number,
    suggestionId: number,
    points: number,
    reason: string,
    awardedBy: number,
  ): Promise<number> {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        `
        INSERT INTO kvp_points 
        (tenant_id, user_id, suggestion_id, points, reason, awarded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [tenant_id, userId, suggestionId, points, reason, awardedBy],
      );

      return result.insertId;
    } finally {
      await connection.end();
    }
  }

  // Get dashboard statistics
  static async getDashboardStats(tenant_id: number): Promise<DbDashboardStats> {
    const connection = await this.getConnection();
    try {
      const [stats] = await connection.execute<DbDashboardStats[]>(
        `
        SELECT 
          COUNT(*) as total_suggestions,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_suggestions,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'implemented' THEN 1 END) as implemented,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          AVG(CASE WHEN actual_savings IS NOT NULL THEN actual_savings END) as avg_savings
        FROM kvp_suggestions 
        WHERE tenant_id = ?
      `,
        [tenant_id],
      );

      return stats[0];
    } finally {
      await connection.end();
    }
  }

  // Delete suggestion and all related data (only by owner)
  static async deleteSuggestion(
    suggestionId: number,
    tenant_id: number,
    userId: number,
  ): Promise<boolean> {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();

      // Verify ownership
      const [ownerCheck] = await connection.execute<DbSuggestion[]>(
        `
        SELECT submitted_by FROM kvp_suggestions 
        WHERE id = ? AND tenant_id = ? AND submitted_by = ?
      `,
        [suggestionId, tenant_id, userId],
      );

      if (ownerCheck.length === 0) {
        throw new Error("Suggestion not found or not owned by user");
      }

      // Get all attachment file paths for deletion
      const [attachments] = await connection.execute<DbAttachment[]>(
        `
        SELECT file_path FROM kvp_attachments WHERE suggestion_id = ?
      `,
        [suggestionId],
      );

      // Delete database records (cascading will handle related records)
      await connection.execute(
        "DELETE FROM kvp_suggestions WHERE id = ? AND tenant_id = ?",
        [suggestionId, tenant_id],
      );

      await connection.commit();

      // Delete attachment files from filesystem
      for (const attachment of attachments) {
        try {
          // file_path is already absolute, use it directly
          await fs.unlink(attachment.file_path);
        } catch {
          // Silently ignore file deletion errors
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
  static async getAttachment(
    attachmentId: number,
    tenant_id: number,
    userId: number,
    userRole: string,
  ): Promise<DbAttachment | null> {
    const connection = await this.getConnection();
    try {
      const [attachments] = await connection.execute<DbAttachment[]>(
        `
        SELECT a.*, s.submitted_by, s.tenant_id
        FROM kvp_attachments a
        JOIN kvp_suggestions s ON a.suggestion_id = s.id
        WHERE a.id = ? AND s.tenant_id = ?
      `,
        [attachmentId, tenant_id],
      );

      if (attachments.length === 0) {
        return null;
      }

      const attachment = attachments[0];

      // Verify access: admins can access all, employees only their own
      if (
        userRole !== "admin" &&
        userRole !== "root" &&
        attachment.submitted_by !== userId
      ) {
        return null;
      }

      return attachment;
    } finally {
      await connection.end();
    }
  }
}

// Default export
export default KVPModel;

// CommonJS compatibility
