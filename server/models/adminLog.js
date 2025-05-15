const db = require('../database');

class AdminLog {
  static async create(logData) {
    const { user_id, action, ip_address, status, details } = logData;
    
    const query = `INSERT INTO admin_logs (user_id, action, ip_address, status, details) 
                   VALUES (?, ?, ?, ?, ?)`;
                   
    try {
      const [result] = await db.query(query, [user_id, action, ip_address, status, details]);
      return result.insertId;
    } catch (error) {
      console.error(`Error creating admin log: ${error.message}`);
      throw error;
    }
  }

  static async getByUserId(userId, days = 0) {
    let query = `SELECT * FROM admin_logs WHERE user_id = ?`;
    const params = [userId];
    
    // Wenn days > 0, dann nur Logs der letzten X Tage abrufen
    if (days > 0) {
      query += ` AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      params.push(days);
    }
    
    // Nach Zeitstempel absteigend sortieren (neueste zuerst)
    query += ` ORDER BY timestamp DESC`;
    
    try {
      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      console.error(`Error fetching admin logs for user ${userId}: ${error.message}`);
      throw error;
    }
  }
  
  static async getLastLogin(userId) {
    const query = `SELECT * FROM admin_logs 
                   WHERE user_id = ? AND action = 'login' AND status = 'success' 
                   ORDER BY timestamp DESC LIMIT 1`;
                   
    try {
      const [rows] = await db.query(query, [userId]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error(`Error fetching last login for user ${userId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AdminLog;