const db = require('../database');
const logger = require('../utils/logger');

class Document {
  static async create({ userId, fileName, fileContent }) {
    logger.info(`Creating new document for user ${userId}`);
    const query = 'INSERT INTO documents (user_id, file_name, file_content) VALUES (?, ?, ?)';
    try {
      const [result] = await db.query(query, [userId, fileName, fileContent]);
      logger.info(`Document created successfully with ID ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating document: ${error.message}`);
      throw error;
    }
  }

  static async findByUserId(userId) {
    logger.info(`Fetching documents for user ${userId}`);
    const query = 'SELECT id, file_name, upload_date FROM documents WHERE user_id = ?';
    try {
      const [rows] = await db.query(query, [userId]);
      logger.info(`Retrieved ${rows.length} documents for user ${userId}`);
      return rows;
    } catch (error) {
      logger.error(`Error fetching documents for user ${userId}: ${error.message}`);
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

  static async update(id, { fileName, fileContent }) {
    logger.info(`Updating document ${id}`);
    const query = 'UPDATE documents SET file_name = ?, file_content = ? WHERE id = ?';
    try {
      const [result] = await db.query(query, [fileName, fileContent, id]);
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

static async findAll() {
  logger.info('Fetching all documents');
  const query = `
    SELECT d.*, u.first_name, u.last_name, 
           CONCAT(u.first_name, ' ', u.last_name) AS employee_name
    FROM documents d
    LEFT JOIN users u ON d.user_id = u.id
    ORDER BY d.upload_date DESC`;
  
  try {
    const [rows] = await db.query(query);
    logger.info(`Retrieved ${rows.length} documents`);
    return rows;
  } catch (error) {
    logger.error(`Error fetching all documents: ${error.message}`);
    throw error;
  }
}

  static async search(userId, searchTerm) {
    logger.info(`Searching documents for user ${userId} with term: ${searchTerm}`);
    const query = 'SELECT id, file_name, upload_date FROM documents WHERE user_id = ? AND file_name LIKE ?';
    try {
      const [rows] = await db.query(query, [userId, `%${searchTerm}%`]);
      logger.info(`Found ${rows.length} documents matching search for user ${userId}`);
      return rows;
    } catch (error) {
      logger.error(`Error searching documents for user ${userId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Document;