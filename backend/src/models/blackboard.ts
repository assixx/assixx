/**
 * Blackboard Model
 * Handles database operations for the blackboard entries and confirmations
 */

import pool from "../database";
import User from "./user";
import { logger } from "../utils/logger";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

// Helper function to handle both real pool and mock database
async function executeQuery<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[],
): Promise<[T, any]> {
  const result = await (pool as any).query(sql, params);
  if (Array.isArray(result) && result.length === 2) {
    return result as [T, any];
  }
  return [result as T, null];
}

// Database interfaces
interface DbBlackboardEntry extends RowDataPacket {
  id: number;
  tenant_id: number;
  title: string;
  content: string | Buffer | { type: "Buffer"; data: number[] };
  org_level: "company" | "department" | "team";
  org_id: number;
  author_id: number;
  expires_at?: Date | null;
  priority: "low" | "normal" | "high" | "urgent";
  color: string;
  requires_confirmation: boolean | number;
  status: "active" | "archived";
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  author_name?: string;
  is_confirmed?: number;
}

interface DbBlackboardTag extends RowDataPacket {
  id: number;
  name: string;
  tenant_id: number;
  color: string;
}

interface DbBlackboardAttachment extends RowDataPacket {
  id: number;
  entry_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  uploaded_by: number;
  uploaded_at: Date;
  uploader_name?: string;
}

interface DbConfirmationUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  confirmed: number;
  confirmed_at?: Date;
}

interface EntryQueryOptions {
  status?: "active" | "archived";
  filter?: "all" | "company" | "department" | "team";
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
}

interface EntryCreateData {
  tenant_id: number;
  title: string;
  content: string;
  org_level: "company" | "department" | "team";
  org_id: number | null;
  author_id: number;
  expires_at?: Date | null;
  priority?: "low" | "normal" | "high" | "urgent";
  color?: string;
  tags?: string[];
  requires_confirmation?: boolean;
}

interface EntryUpdateData {
  title?: string;
  content?: string;
  org_level?: "company" | "department" | "team";
  org_id?: number;
  expires_at?: Date | null;
  priority?: "low" | "normal" | "high" | "urgent";
  color?: string;
  status?: "active" | "archived";
  requires_confirmation?: boolean;
  tags?: string[];
  author_id?: number;
}

interface CountResult extends RowDataPacket {
  total: number;
}

export class Blackboard {
  /**
   * Get all blackboard entries visible to the user
   */
  static async getAllEntries(
    tenantId: number,
    userId: number,
    options: EntryQueryOptions = {},
  ) {
    try {
      const {
        status = "active",
        filter = "all",
        search = "",
        page = 1,
        limit = 10,
        sortBy = "created_at",
        sortDir = "DESC",
      } = options;

      // Determine user's department and team for access control
      const { role, departmentId, teamId } =
        await User.getUserDepartmentAndTeam(userId);

      // Build base query
      let query = `
        SELECT e.*, 
               u.username as author_name,
               CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_confirmed
        FROM blackboard_entries e
        LEFT JOIN users u ON e.author_id = u.id
        LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = ?
        WHERE e.tenant_id = ? AND e.status = ?
      `;

      const queryParams: any[] = [userId, tenantId, status];

      // Apply org level filter
      if (filter !== "all") {
        query += " AND e.org_level = ?";
        queryParams.push(filter);
      }

      // Apply access control for non-admin users
      if (role !== "admin" && role !== "root") {
        query += ` AND (
          e.org_level = 'company' OR 
          (e.org_level = 'department' AND e.org_id = ?) OR
          (e.org_level = 'team' AND e.org_id = ?)
        )`;
        queryParams.push(departmentId || 0, teamId || 0);
      }

      // Apply search filter
      if (search) {
        query += " AND (e.title LIKE ? OR e.content LIKE ?)";
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
      }

      // Apply sorting
      query += ` ORDER BY e.priority = 'urgent' DESC, e.priority = 'high' DESC, e.${sortBy} ${sortDir}`;

      // Apply pagination
      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      queryParams.push(parseInt(limit.toString(), 10), offset);

      // Execute query
      const [entries] = await executeQuery<DbBlackboardEntry[]>(
        query,
        queryParams,
      );

      // Konvertiere Buffer-Inhalte zu Strings
      entries.forEach((entry) => {
        if (entry.content && Buffer.isBuffer(entry.content)) {
          entry.content = entry.content.toString("utf8");
        } else if (
          entry.content &&
          typeof entry.content === "object" &&
          "type" in entry.content &&
          entry.content.type === "Buffer" &&
          Array.isArray(entry.content.data)
        ) {
          entry.content = Buffer.from(entry.content.data).toString("utf8");
        }
      });

      // Count total entries for pagination
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM blackboard_entries e
        WHERE e.tenant_id = ? AND e.status = ?
      `;

      const countParams: any[] = [tenantId, status];

      // Apply org level filter for count
      if (filter !== "all") {
        countQuery += " AND e.org_level = ?";
        countParams.push(filter);
      }

      // Apply access control for non-admin users for count
      if (role !== "admin" && role !== "root") {
        countQuery += ` AND (
          e.org_level = 'company' OR 
          (e.org_level = 'department' AND e.org_id = ?) OR
          (e.org_level = 'team' AND e.org_id = ?)
        )`;
        countParams.push(departmentId || 0, teamId || 0);
      }

      // Apply search filter for count
      if (search) {
        countQuery += " AND (e.title LIKE ? OR e.content LIKE ?)";
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm);
      }

      const [countResult] = await executeQuery<CountResult[]>(
        countQuery,
        countParams,
      );
      const totalEntries = countResult[0].total;

      return {
        entries,
        pagination: {
          total: totalEntries,
          page: parseInt(page.toString(), 10),
          limit: parseInt(limit.toString(), 10),
          totalPages: Math.ceil(totalEntries / limit),
        },
      };
    } catch (error) {
      logger.error("Error in getAllEntries:", error);
      throw error;
    }
  }

  /**
   * Get a specific blackboard entry by ID
   */
  static async getEntryById(
    id: number,
    tenantId: number,
    userId: number,
  ): Promise<DbBlackboardEntry | null> {
    try {
      // Determine user's department and team for access control
      const { role, departmentId, teamId } =
        await User.getUserDepartmentAndTeam(userId);

      // Query the entry with confirmation status
      const query = `
        SELECT e.*, 
               u.username as author_name,
               CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_confirmed
        FROM blackboard_entries e
        LEFT JOIN users u ON e.author_id = u.id
        LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = ?
        WHERE e.id = ? AND e.tenant_id = ?
      `;

      const [entries] = await executeQuery<DbBlackboardEntry[]>(query, [
        userId,
        id,
        tenantId,
      ]);

      if (entries.length === 0) {
        return null;
      }

      const entry = entries[0];

      // Konvertiere Buffer-Inhalte zu Strings
      if (entry.content && Buffer.isBuffer(entry.content)) {
        entry.content = entry.content.toString("utf8");
      } else if (
        entry.content &&
        typeof entry.content === "object" &&
        "type" in entry.content &&
        entry.content.type === "Buffer" &&
        Array.isArray(entry.content.data)
      ) {
        entry.content = Buffer.from(entry.content.data).toString("utf8");
      }

      // Check access control for non-admin users
      if (role !== "admin" && role !== "root") {
        const hasAccess =
          entry.org_level === "company" ||
          (entry.org_level === "department" && entry.org_id === departmentId) ||
          (entry.org_level === "team" && entry.org_id === teamId);

        if (!hasAccess) {
          return null; // User doesn't have access to this entry
        }
      }

      return entry;
    } catch (error) {
      logger.error("Error in getEntryById:", error);
      throw error;
    }
  }

  /**
   * Create a new blackboard entry
   */
  static async createEntry(
    entryData: EntryCreateData,
  ): Promise<DbBlackboardEntry | null> {
    try {
      const {
        tenant_id,
        title,
        content,
        org_level,
        org_id,
        author_id,
        expires_at = null,
        priority = "normal",
        color = "blue",
        tags = [],
        requires_confirmation = false,
      } = entryData;

      // Validate required fields
      if (!tenant_id || !title || !content || !org_level || !author_id) {
        throw new Error("Missing required fields");
      }

      // Validate org_id based on org_level
      if (org_level !== "company" && !org_id) {
        throw new Error(
          "org_id is required for department or team level entries",
        );
      }

      // Insert new entry
      const query = `
        INSERT INTO blackboard_entries 
        (tenant_id, title, content, org_level, org_id, author_id, expires_at, priority, color, requires_confirmation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await executeQuery<ResultSetHeader>(query, [
        tenant_id,
        title,
        content,
        org_level,
        org_id,
        author_id,
        expires_at,
        priority,
        color,
        requires_confirmation ? 1 : 0,
      ]);

      // Handle tags if provided
      if (tags && tags.length > 0) {
        await this.addTagsToEntry(result.insertId, tags, tenant_id);
      }

      // Get the created entry
      const createdEntry = await this.getEntryById(
        result.insertId,
        tenant_id,
        author_id,
      );
      return createdEntry;
    } catch (error) {
      logger.error("Error in createEntry:", error);
      throw error;
    }
  }

  /**
   * Update a blackboard entry
   */
  static async updateEntry(
    id: number,
    entryData: EntryUpdateData,
    tenantId: number,
  ): Promise<DbBlackboardEntry | null> {
    try {
      const {
        title,
        content,
        org_level,
        org_id,
        expires_at,
        priority,
        color,
        status,
        requires_confirmation,
      } = entryData;

      // Build query dynamically based on provided fields
      let query = "UPDATE blackboard_entries SET updated_at = NOW()";
      const queryParams: any[] = [];

      if (title !== undefined) {
        query += ", title = ?";
        queryParams.push(title);
      }

      if (content !== undefined) {
        query += ", content = ?";
        queryParams.push(content);
      }

      if (org_level !== undefined) {
        query += ", org_level = ?";
        queryParams.push(org_level);
      }

      if (org_id !== undefined) {
        query += ", org_id = ?";
        queryParams.push(org_id);
      }

      if (expires_at !== undefined) {
        query += ", expires_at = ?";
        queryParams.push(expires_at);
      }

      if (priority !== undefined) {
        query += ", priority = ?";
        queryParams.push(priority);
      }

      if (color !== undefined) {
        query += ", color = ?";
        queryParams.push(color);
      }

      if (status !== undefined) {
        query += ", status = ?";
        queryParams.push(status);
      }

      if (requires_confirmation !== undefined) {
        query += ", requires_confirmation = ?";
        queryParams.push(requires_confirmation ? 1 : 0);
      }

      // Finish query
      query += " WHERE id = ? AND tenant_id = ?";
      queryParams.push(id, tenantId);

      // Execute update
      await executeQuery(query, queryParams);

      // Handle tags if provided
      if (entryData.tags !== undefined) {
        // Remove existing tags
        await executeQuery(
          "DELETE FROM blackboard_entry_tags WHERE entry_id = ?",
          [id],
        );

        // Add new tags if any
        if (entryData.tags && entryData.tags.length > 0) {
          await this.addTagsToEntry(id, entryData.tags, tenantId);
        }
      }

      // Get the updated entry
      const updatedEntry = await this.getEntryById(
        id,
        tenantId,
        entryData.author_id || 0,
      );
      return updatedEntry;
    } catch (error) {
      logger.error("Error in updateEntry:", error);
      throw error;
    }
  }

  /**
   * Delete a blackboard entry
   */
  static async deleteEntry(id: number, tenantId: number): Promise<boolean> {
    try {
      // Delete entry
      const query =
        "DELETE FROM blackboard_entries WHERE id = ? AND tenant_id = ?";
      const [result] = await executeQuery<ResultSetHeader>(query, [
        id,
        tenantId,
      ]);

      return result.affectedRows > 0;
    } catch (error) {
      logger.error("Error in deleteEntry:", error);
      throw error;
    }
  }

  /**
   * Confirm a blackboard entry as read
   */
  static async confirmEntry(entryId: number, userId: number): Promise<boolean> {
    try {
      // Check if entry exists and requires confirmation
      const [entries] = await executeQuery<DbBlackboardEntry[]>(
        "SELECT * FROM blackboard_entries WHERE id = ? AND requires_confirmation = 1",
        [entryId],
      );

      if (entries.length === 0) {
        return false; // Entry doesn't exist or doesn't require confirmation
      }

      // Check if already confirmed
      const [confirmations] = await executeQuery<RowDataPacket[]>(
        "SELECT * FROM blackboard_confirmations WHERE entry_id = ? AND user_id = ?",
        [entryId, userId],
      );

      if (confirmations.length > 0) {
        return true; // Already confirmed
      }

      // Add confirmation
      await executeQuery(
        "INSERT INTO blackboard_confirmations (entry_id, user_id) VALUES (?, ?)",
        [entryId, userId],
      );

      return true;
    } catch (error) {
      logger.error("Error in confirmEntry:", error);
      throw error;
    }
  }

  /**
   * Get confirmation status for an entry
   */
  static async getConfirmationStatus(
    entryId: number,
    tenantId: number,
  ): Promise<DbConfirmationUser[]> {
    try {
      // Get the entry first
      const [entries] = await executeQuery<DbBlackboardEntry[]>(
        "SELECT * FROM blackboard_entries WHERE id = ? AND tenant_id = ?",
        [entryId, tenantId],
      );

      if (entries.length === 0 || !entries[0].requires_confirmation) {
        return [];
      }

      const entry = entries[0];

      // Get all users who should see this entry
      let usersQuery = `
        SELECT u.id, u.username, u.email, u.first_name, u.last_name,
               CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as confirmed,
               c.confirmed_at
        FROM users u
        LEFT JOIN blackboard_confirmations c ON u.id = c.user_id AND c.entry_id = ?
        WHERE u.tenant_id = ?
      `;

      const queryParams: any[] = [entryId, tenantId];

      // Filter by org level
      if (entry.org_level === "department") {
        usersQuery += " AND u.department_id = ?";
        queryParams.push(entry.org_id);
      } else if (entry.org_level === "team") {
        usersQuery += " AND u.team_id = ?";
        queryParams.push(entry.org_id);
      }

      const [users] = await executeQuery<DbConfirmationUser[]>(
        usersQuery,
        queryParams,
      );

      return users;
    } catch (error) {
      logger.error("Error in getConfirmationStatus:", error);
      throw error;
    }
  }

  /**
   * Get dashboard entries for a user
   */
  static async getDashboardEntries(
    tenantId: number,
    userId: number,
    limit = 3,
  ): Promise<DbBlackboardEntry[]> {
    try {
      // Get user info for access control
      const { role, departmentId, teamId } =
        await User.getUserDepartmentAndTeam(userId);

      // Build query for dashboard entries
      let query = `
        SELECT e.*, 
               u.username as author_name,
               CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_confirmed
        FROM blackboard_entries e
        LEFT JOIN users u ON e.author_id = u.id
        LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = ?
        WHERE e.tenant_id = ? AND e.status = 'active'
      `;

      const queryParams: any[] = [userId, tenantId];

      // Apply access control for non-admin users
      if (role !== "admin" && role !== "root") {
        query += ` AND (
          e.org_level = 'company' OR 
          (e.org_level = 'department' AND e.org_id = ?) OR
          (e.org_level = 'team' AND e.org_id = ?)
        )`;
        queryParams.push(departmentId || 0, teamId || 0);
      }

      // Prioritize unconfirmed entries that require confirmation
      query += `
        ORDER BY 
          (e.requires_confirmation = 1 AND c.id IS NULL) DESC,
          e.priority = 'urgent' DESC, 
          e.priority = 'high' DESC, 
          e.created_at DESC
        LIMIT ?
      `;
      queryParams.push(parseInt(limit.toString(), 10));

      const [entries] = await executeQuery<DbBlackboardEntry[]>(
        query,
        queryParams,
      );

      // Konvertiere Buffer-Inhalte zu Strings (wie in getAllEntries)
      entries.forEach((entry) => {
        if (entry.content && Buffer.isBuffer(entry.content)) {
          entry.content = entry.content.toString("utf8");
        } else if (
          entry.content &&
          typeof entry.content === "object" &&
          "type" in entry.content &&
          entry.content.type === "Buffer" &&
          Array.isArray(entry.content.data)
        ) {
          entry.content = Buffer.from(entry.content.data).toString("utf8");
        }
      });

      return entries;
    } catch (error) {
      logger.error("Error in getDashboardEntries:", error);
      throw error;
    }
  }

  /**
   * Add tags to an entry
   */
  static async addTagsToEntry(
    entryId: number,
    tagNames: string[],
    tenantId: number,
  ): Promise<void> {
    try {
      for (const tagName of tagNames) {
        // Get or create tag
        const tagId = await this.getOrCreateTag(tagName.trim(), tenantId);

        // Link tag to entry
        await executeQuery(
          "INSERT IGNORE INTO blackboard_entry_tags (entry_id, tag_id) VALUES (?, ?)",
          [entryId, tagId],
        );
      }
    } catch (error) {
      logger.error("Error adding tags to entry:", error);
      throw error;
    }
  }

  /**
   * Get or create a tag
   */
  static async getOrCreateTag(
    tagName: string,
    tenantId: number,
  ): Promise<number> {
    try {
      // Check if tag exists
      const [existingTags] = await executeQuery<DbBlackboardTag[]>(
        "SELECT id FROM blackboard_tags WHERE name = ? AND tenant_id = ?",
        [tagName, tenantId],
      );

      if (existingTags.length > 0) {
        return existingTags[0].id;
      }

      // Create new tag
      const [result] = await executeQuery<ResultSetHeader>(
        "INSERT INTO blackboard_tags (name, tenant_id, color) VALUES (?, ?, ?)",
        [tagName, tenantId, "blue"],
      );

      return result.insertId;
    } catch (error) {
      logger.error("Error getting or creating tag:", error);
      throw error;
    }
  }

  /**
   * Get all available tags for a tenant
   */
  static async getAllTags(tenantId: number): Promise<DbBlackboardTag[]> {
    try {
      const [tags] = await executeQuery<DbBlackboardTag[]>(
        "SELECT * FROM blackboard_tags WHERE tenant_id = ? ORDER BY name",
        [tenantId],
      );
      return tags;
    } catch (error) {
      logger.error("Error getting tags:", error);
      throw error;
    }
  }

  /**
   * Get tags for a specific entry
   */
  static async getEntryTags(entryId: number): Promise<DbBlackboardTag[]> {
    try {
      const [tags] = await executeQuery<DbBlackboardTag[]>(
        `
        SELECT t.* FROM blackboard_tags t
        JOIN blackboard_entry_tags et ON t.id = et.tag_id
        WHERE et.entry_id = ?
        ORDER BY t.name
      `,
        [entryId],
      );
      return tags;
    } catch (error) {
      logger.error("Error getting entry tags:", error);
      throw error;
    }
  }

  /**
   * Add attachment to blackboard entry
   */
  static async addAttachment(
    entryId: number,
    attachment: {
      filename: string;
      originalName: string;
      fileSize: number;
      mimeType: string;
      filePath: string;
      uploadedBy: number;
    },
  ): Promise<number> {
    try {
      const [result] = await executeQuery<ResultSetHeader>(
        `INSERT INTO blackboard_attachments 
         (entry_id, filename, original_name, file_size, mime_type, file_path, uploaded_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entryId,
          attachment.filename,
          attachment.originalName,
          attachment.fileSize,
          attachment.mimeType,
          attachment.filePath,
          attachment.uploadedBy,
        ],
      );

      // Update attachment count manually
      await executeQuery(
        `UPDATE blackboard_entries 
         SET attachment_count = (SELECT COUNT(*) FROM blackboard_attachments WHERE entry_id = ?) 
         WHERE id = ?`,
        [entryId, entryId],
      );

      return result.insertId;
    } catch (error) {
      logger.error("Error adding attachment:", error);
      throw error;
    }
  }

  /**
   * Get attachments for an entry
   */
  static async getEntryAttachments(
    entryId: number,
  ): Promise<DbBlackboardAttachment[]> {
    try {
      const [attachments] = await executeQuery<DbBlackboardAttachment[]>(
        `SELECT a.*, u.username as uploader_name 
         FROM blackboard_attachments a
         LEFT JOIN users u ON a.uploaded_by = u.id
         WHERE a.entry_id = ?
         ORDER BY a.uploaded_at DESC`,
        [entryId],
      );
      return attachments;
    } catch (error) {
      logger.error("Error getting attachments:", error);
      throw error;
    }
  }

  /**
   * Get single attachment by ID
   */
  static async getAttachmentById(
    attachmentId: number,
    tenantId: number,
  ): Promise<DbBlackboardAttachment | null> {
    try {
      const [attachments] = await executeQuery<DbBlackboardAttachment[]>(
        `SELECT a.* 
         FROM blackboard_attachments a
         INNER JOIN blackboard_entries e ON a.entry_id = e.id
         WHERE a.id = ? AND e.tenant_id = ?`,
        [attachmentId, tenantId],
      );
      return attachments[0] || null;
    } catch (error) {
      logger.error("Error getting attachment by ID:", error);
      throw error;
    }
  }

  /**
   * Delete attachment
   */
  static async deleteAttachment(
    attachmentId: number,
    tenantId: number,
  ): Promise<boolean> {
    try {
      // First get the attachment to ensure it belongs to the tenant
      const attachment = await this.getAttachmentById(attachmentId, tenantId);
      if (!attachment) {
        return false;
      }

      // Delete from database
      const [result] = await executeQuery<ResultSetHeader>(
        "DELETE FROM blackboard_attachments WHERE id = ?",
        [attachmentId],
      );

      // Update attachment count manually
      if (result.affectedRows > 0 && attachment.entry_id) {
        await executeQuery(
          `UPDATE blackboard_entries 
           SET attachment_count = (SELECT COUNT(*) FROM blackboard_attachments WHERE entry_id = ?) 
           WHERE id = ?`,
          [attachment.entry_id, attachment.entry_id],
        );
      }

      return result.affectedRows > 0;
    } catch (error) {
      logger.error("Error deleting attachment:", error);
      throw error;
    }
  }
}

// Export individual functions for backward compatibility
export const {
  getAllEntries,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
  confirmEntry,
  getConfirmationStatus,
  getDashboardEntries,
  getAllTags,
  getEntryTags,
  addTagsToEntry,
  addAttachment,
  getEntryAttachments,
  getAttachmentById,
  deleteAttachment,
} = Blackboard;

// Default export
export default Blackboard;
