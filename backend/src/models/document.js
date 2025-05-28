const db = require('../database');
const { logger } = require('../utils/logger');

class Document {
  static async create({
    userId,
    fileName,
    fileContent,
    category = 'other',
    description = '',
    year = null,
    month = null,
    tenant_id,
  }) {
    logger.info(
      `Creating new document for user ${userId} in category ${category}`
    );
    const query =
      'INSERT INTO documents (user_id, file_name, file_content, category, description, year, month, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    try {
      const [result] = await db.query(query, [
        userId,
        fileName,
        fileContent,
        category,
        description,
        year,
        month,
        tenant_id,
      ]);
      logger.info(`Document created successfully with ID ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating document: ${error.message}`);
      throw error;
    }
  }

  static async findByUserId(userId) {
    logger.info(`Fetching documents for user ${userId}`);
    const query =
      'SELECT id, file_name, upload_date, category, description, year, month, is_archived FROM documents WHERE user_id = ? ORDER BY upload_date DESC';
    try {
      const [rows] = await db.query(query, [userId]);
      logger.info(`Retrieved ${rows.length} documents for user ${userId}`);
      return rows;
    } catch (error) {
      logger.error(
        `Error fetching documents for user ${userId}: ${error.message}`
      );
      throw error;
    }
  }

  static async findByUserIdAndCategory(userId, category, archived = false) {
    logger.info(
      `Fetching ${category} documents for user ${userId} (archived: ${archived})`
    );
    const query =
      'SELECT id, file_name, upload_date, category, description, year, month FROM documents WHERE user_id = ? AND category = ? AND is_archived = ? ORDER BY year DESC, CASE month WHEN "Januar" THEN 1 WHEN "Februar" THEN 2 WHEN "März" THEN 3 WHEN "April" THEN 4 WHEN "Mai" THEN 5 WHEN "Juni" THEN 6 WHEN "Juli" THEN 7 WHEN "August" THEN 8 WHEN "September" THEN 9 WHEN "Oktober" THEN 10 WHEN "November" THEN 11 WHEN "Dezember" THEN 12 ELSE 13 END DESC';
    try {
      const [rows] = await db.query(query, [userId, category, archived]);
      logger.info(
        `Retrieved ${rows.length} ${category} documents for user ${userId}`
      );
      return rows;
    } catch (error) {
      logger.error(
        `Error fetching ${category} documents for user ${userId}: ${error.message}`
      );
      throw error;
    }
  }

  static async findById(id) {
    logger.info(`Fetching document with ID ${id}`);
    const query = 'SELECT * FROM documents WHERE id = ?';
    try {
      const [rows] = await db.query(query, [id]);
      if (rows.length === 0) {
        logger.warn(`Document with ID ${id} not found`);
        return null;
      }
      logger.info(`Document ${id} retrieved successfully`);
      return rows[0];
    } catch (error) {
      logger.error(`Error fetching document ${id}: ${error.message}`);
      throw error;
    }
  }

  static async incrementDownloadCount(id) {
    logger.info(`Incrementing download count for document ${id}`);
    const query =
      'UPDATE documents SET download_count = COALESCE(download_count, 0) + 1, last_downloaded = NOW() WHERE id = ?';
    try {
      const [result] = await db.query(query, [id]);
      if (result.affectedRows === 0) {
        logger.warn(`No document found with ID ${id} for download tracking`);
        return false;
      }
      logger.info(`Download count incremented for document ${id}`);
      return true;
    } catch (error) {
      logger.error(
        `Error incrementing download count for document ${id}: ${error.message}`
      );
      throw error;
    }
  }

  static async update(
    id,
    { fileName, fileContent, category, description, year, month, isArchived }
  ) {
    logger.info(`Updating document ${id}`);
    let query = 'UPDATE documents SET ';
    const params = [];
    const updates = [];

    if (fileName !== undefined) {
      updates.push('file_name = ?');
      params.push(fileName);
    }
    if (fileContent !== undefined) {
      updates.push('file_content = ?');
      params.push(fileContent);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (year !== undefined) {
      updates.push('year = ?');
      params.push(year);
    }
    if (month !== undefined) {
      updates.push('month = ?');
      params.push(month);
    }
    if (isArchived !== undefined) {
      updates.push('is_archived = ?');
      params.push(isArchived);
    }

    if (updates.length === 0) {
      logger.warn(`No updates provided for document ${id}`);
      return false;
    }

    query += `${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    try {
      const [result] = await db.query(query, params);
      if (result.affectedRows === 0) {
        logger.warn(`No document found with ID ${id} for update`);
        return false;
      }
      logger.info(`Document ${id} updated successfully`);
      return true;
    } catch (error) {
      logger.error(`Error updating document ${id}: ${error.message}`);
      throw error;
    }
  }

  // eslint-disable-next-line require-await
  static async archiveDocument(id) {
    logger.info(`Archiving document ${id}`);
    return this.update(id, { isArchived: true });
  }

  // eslint-disable-next-line require-await
  static async unarchiveDocument(id) {
    logger.info(`Unarchiving document ${id}`);
    return this.update(id, { isArchived: false });
  }

  static async delete(id) {
    logger.info(`Deleting document ${id}`);
    const query = 'DELETE FROM documents WHERE id = ?';
    try {
      const [result] = await db.query(query, [id]);
      if (result.affectedRows === 0) {
        logger.warn(`No document found with ID ${id} for deletion`);
        return false;
      }
      logger.info(`Document ${id} deleted successfully`);
      return true;
    } catch (error) {
      logger.error(`Error deleting document ${id}: ${error.message}`);
      throw error;
    }
  }

  static async findAll(category = null) {
    logger.info(
      `Fetching all documents${category ? ` of category ${category}` : ''}`
    );
    let query = `
      SELECT d.*, u.first_name, u.last_name, 
             CONCAT(u.first_name, ' ', u.last_name) AS employee_name
      FROM documents d
      LEFT JOIN users u ON d.user_id = u.id`;

    const params = [];

    if (category) {
      query += ' WHERE d.category = ?';
      params.push(category);
    }

    query += ' ORDER BY d.upload_date DESC';

    try {
      const [rows] = await db.query(query, params);
      logger.info(
        `Retrieved ${rows.length} documents${category ? ` of category ${category}` : ''}`
      );
      return rows;
    } catch (error) {
      logger.error(`Error fetching documents: ${error.message}`);
      throw error;
    }
  }

  static async search(userId, searchTerm) {
    logger.info(
      `Searching documents for user ${userId} with term: ${searchTerm}`
    );
    const query =
      'SELECT id, file_name, upload_date, category, description FROM documents WHERE user_id = ? AND (file_name LIKE ? OR description LIKE ?)';
    try {
      const [rows] = await db.query(query, [
        userId,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
      ]);
      logger.info(
        `Found ${rows.length} documents matching search for user ${userId}`
      );
      return rows;
    } catch (error) {
      logger.error(
        `Error searching documents for user ${userId}: ${error.message}`
      );
      throw error;
    }
  }

  static async count(filters = {}) {
    logger.info('Counting documents with filters');
    let query = 'SELECT COUNT(*) as total FROM documents WHERE 1=1';
    const params = [];

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }
    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters.isArchived !== undefined) {
      query += ' AND is_archived = ?';
      params.push(filters.isArchived);
    }

    try {
      const [rows] = await db.query(query, params);
      return rows[0].total;
    } catch (error) {
      logger.error(`Error counting documents: ${error.message}`);
      throw error;
    }
  }

  // Legacy compatibility methods
  static async findAll() {
    logger.info('Finding all documents');
    const query = 'SELECT * FROM documents ORDER BY upload_date DESC';
    try {
      const [rows] = await db.query(query);
      return rows;
    } catch (error) {
      logger.error(`Error finding all documents: ${error.message}`);
      throw error;
    }
  }

  static async findByUser(userId) {
    // Alias for findByUserId for legacy compatibility
    return this.findByUserId(userId);
  }
}

module.exports = Document;
