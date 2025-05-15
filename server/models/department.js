const db = require('../database');
const logger = require('../utils/logger');

class Department {
  static async create(departmentData) {
    const { name, description, manager_id, parent_id } = departmentData;
    logger.info(`Creating new department: ${name}`);
    
    const query = `
      INSERT INTO departments (name, description, manager_id, parent_id) 
      VALUES (?, ?, ?, ?)
    `;
    
    try {
      const [result] = await db.query(query, [name, description, manager_id, parent_id]);
      logger.info(`Department created successfully with ID ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      logger.error(`Error creating department: ${error.message}`);
      throw error;
    }
  }

  static async findAll() {
    logger.info('Fetching all departments');
    const query = 'SELECT * FROM departments ORDER BY name';
    
    try {
      const [rows] = await db.query(query);
      logger.info(`Retrieved ${rows.length} departments`);
      return rows;
    } catch (error) {
      logger.error(`Error fetching departments: ${error.message}`);
      throw error;
    }
  }

  static async findById(id) {
    logger.info(`Fetching department with ID ${id}`);
    const query = 'SELECT * FROM departments WHERE id = ?';
    
    try {
      const [rows] = await db.query(query, [id]);
      if (rows.length === 0) {
        logger.warn(`Department with ID ${id} not found`);
        return null;
      }
      logger.info(`Department ${id} retrieved successfully`);
      return rows[0];
    } catch (error) {
      logger.error(`Error fetching department ${id}: ${error.message}`);
      throw error;
    }
  }

  static async update(id, departmentData) {
    logger.info(`Updating department ${id}`);
    const { name, description, manager_id, parent_id } = departmentData;
    
    const query = `
      UPDATE departments 
      SET name = ?, description = ?, manager_id = ?, parent_id = ? 
      WHERE id = ?
    `;
    
    try {
      const [result] = await db.query(query, [name, description, manager_id, parent_id, id]);
      if (result.affectedRows === 0) {
        logger.warn(`No department found with ID ${id} for update`);
        return false;
      }
      logger.info(`Department ${id} updated successfully`);
      return true;
    } catch (error) {
      logger.error(`Error updating department ${id}: ${error.message}`);
      throw error;
    }
  }

  static async delete(id) {
    logger.info(`Deleting department ${id}`);
    const query = 'DELETE FROM departments WHERE id = ?';
    
    try {
      const [result] = await db.query(query, [id]);
      if (result.affectedRows === 0) {
        logger.warn(`No department found with ID ${id} for deletion`);
        return false;
      }
      logger.info(`Department ${id} deleted successfully`);
      return true;
    } catch (error) {
      logger.error(`Error deleting department ${id}: ${error.message}`);
      throw error;
    }
  }

  static async getUsersByDepartment(departmentId) {
    logger.info(`Fetching users for department ${departmentId}`);
    const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.position, u.employee_id 
      FROM users u 
      WHERE u.department_id = ?
    `;
    
    try {
      const [rows] = await db.query(query, [departmentId]);
      logger.info(`Retrieved ${rows.length} users for department ${departmentId}`);
      return rows;
    } catch (error) {
      logger.error(`Error fetching users for department ${departmentId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Department;