/**
 * Blackboard Model
 * Handles database operations for the blackboard entries and confirmations
 */

const db = require('../database');
const User = require('./user');

/**
 * Get all blackboard entries visible to the user
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {string} options.status - Entry status (active, archived)
 * @param {string} options.filter - Filter by org_level (company, department, team)
 * @param {string} options.search - Search term for title/content
 * @param {number} options.page - Page number for pagination
 * @param {number} options.limit - Items per page
 * @returns {Promise<Array>} Array of blackboard entries
 */
async function getAllEntries(tenantId, userId, options = {}) {
  try {
    const {
      status = 'active',
      filter = 'all',
      search = '',
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortDir = 'DESC'
    } = options;

    // Determine user's department and team for access control
    const { role, departmentId, teamId } = await User.getUserDepartmentAndTeam(userId);
    
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
    
    const queryParams = [userId, tenantId, status];
    
    // Apply org level filter
    if (filter !== 'all') {
      query += ' AND e.org_level = ?';
      queryParams.push(filter);
    }
    
    // Apply access control for non-admin users
    if (role !== 'admin' && role !== 'root') {
      query += ` AND (
        e.org_level = 'company' OR 
        (e.org_level = 'department' AND e.org_id = ?) OR
        (e.org_level = 'team' AND e.org_id = ?)
      )`;
      queryParams.push(departmentId || 0, teamId || 0);
    }
    
    // Debug-Ausgabe der SQL-Abfrage

    // Apply search filter
    if (search) {
      query += ' AND (e.title LIKE ? OR e.content LIKE ?)';
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }
    
    // Apply sorting
    query += ` ORDER BY e.priority = 'urgent' DESC, e.priority = 'high' DESC, e.${sortBy} ${sortDir}`;
    
    // Apply pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit, 10), offset);
    
    // Execute query
    const [entries] = await db.query(query, queryParams);
    
    // Debug der Ergebnisse

    if (entries.length > 0) {

    }
    
    // Konvertiere Buffer-Inhalte zu Strings
    entries.forEach(entry => {
      if (entry.content && Buffer.isBuffer(entry.content)) {

        entry.content = entry.content.toString('utf8');
      } else if (entry.content && typeof entry.content === 'object' && entry.content.type === 'Buffer' && Array.isArray(entry.content.data)) {

        entry.content = Buffer.from(entry.content.data).toString('utf8');
      }
    });
    
    // Count total entries for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM blackboard_entries e
      WHERE e.tenant_id = ? AND e.status = ?
    `;
    
    const countParams = [tenantId, status];
    
    // Apply org level filter for count
    if (filter !== 'all') {
      countQuery += ' AND e.org_level = ?';
      countParams.push(filter);
    }
    
    // Apply access control for non-admin users for count
    if (role !== 'admin' && role !== 'root') {
      countQuery += ` AND (
        e.org_level = 'company' OR 
        (e.org_level = 'department' AND e.org_id = ?) OR
        (e.org_level = 'team' AND e.org_id = ?)
      )`;
      countParams.push(departmentId || 0, teamId || 0);
    }
    
    // Apply search filter for count
    if (search) {
      countQuery += ' AND (e.title LIKE ? OR e.content LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    const totalEntries = countResult[0].total;
    
    return {
      entries,
      pagination: {
        total: totalEntries,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(totalEntries / limit)
      }
    };
  } catch (error) {
    console.error('Error in getAllEntries:', error);
    throw error;
  }
}

/**
 * Get a specific blackboard entry by ID
 * @param {number} id - Entry ID
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID checking the entry
 * @returns {Promise<Object>} Blackboard entry
 */
async function getEntryById(id, tenantId, userId) {
  try {
    // Determine user's department and team for access control
    const { role, departmentId, teamId } = await User.getUserDepartmentAndTeam(userId);
    
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
    
    const [entries] = await db.query(query, [userId, id, tenantId]);
    
    if (entries.length === 0) {
      return null;
    }
    
    const entry = entries[0];
    
    // Konvertiere Buffer-Inhalte zu Strings
    if (entry.content && Buffer.isBuffer(entry.content)) {

      entry.content = entry.content.toString('utf8');
    } else if (entry.content && typeof entry.content === 'object' && entry.content.type === 'Buffer' && Array.isArray(entry.content.data)) {

      entry.content = Buffer.from(entry.content.data).toString('utf8');
    }
    
    // Check access control for non-admin users
    if (role !== 'admin' && role !== 'root') {
      const hasAccess = 
        entry.org_level === 'company' || 
        (entry.org_level === 'department' && entry.org_id === departmentId) ||
        (entry.org_level === 'team' && entry.org_id === teamId);
      
      if (!hasAccess) {
        return null; // User doesn't have access to this entry
      }
    }
    
    return entry;
  } catch (error) {
    console.error('Error in getEntryById:', error);
    throw error;
  }
}

/**
 * Create a new blackboard entry
 * @param {Object} entryData - Entry data
 * @returns {Promise<Object>} Created entry
 */
async function createEntry(entryData) {
  try {
    const {
      tenant_id,
      title,
      content,
      org_level,
      org_id,
      author_id,
      expires_at = null,
      priority = 'normal',
      color = 'blue',
      tags = [],
      requires_confirmation = false
    } = entryData;
    
    // Validate required fields
    if (!tenant_id || !title || !content || !org_level || !org_id || !author_id) {
      throw new Error('Missing required fields');
    }
    
    // Insert new entry
    const query = `
      INSERT INTO blackboard_entries 
      (tenant_id, title, content, org_level, org_id, author_id, expires_at, priority, color, requires_confirmation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await db.query(query, [
      tenant_id,
      title,
      content,
      org_level,
      org_id,
      author_id,
      expires_at,
      priority,
      color,
      requires_confirmation ? 1 : 0
    ]);
    
    // Handle tags if provided
    if (tags && tags.length > 0) {
      await addTagsToEntry(result.insertId, tags, tenant_id);
    }
    
    // Get the created entry
    const createdEntry = await getEntryById(result.insertId, tenant_id, author_id);
    return createdEntry;
  } catch (error) {
    console.error('Error in createEntry:', error);
    throw error;
  }
}

/**
 * Update a blackboard entry
 * @param {number} id - Entry ID
 * @param {Object} entryData - Updated entry data
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object>} Updated entry
 */
async function updateEntry(id, entryData, tenantId) {
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
      requires_confirmation
    } = entryData;
    
    // Build query dynamically based on provided fields
    let query = 'UPDATE blackboard_entries SET updated_at = NOW()';
    const queryParams = [];
    
    if (title !== undefined) {
      query += ', title = ?';
      queryParams.push(title);
    }
    
    if (content !== undefined) {
      query += ', content = ?';
      queryParams.push(content);
    }
    
    if (org_level !== undefined) {
      query += ', org_level = ?';
      queryParams.push(org_level);
    }
    
    if (org_id !== undefined) {
      query += ', org_id = ?';
      queryParams.push(org_id);
    }
    
    if (expires_at !== undefined) {
      query += ', expires_at = ?';
      queryParams.push(expires_at);
    }
    
    if (priority !== undefined) {
      query += ', priority = ?';
      queryParams.push(priority);
    }
    
    if (color !== undefined) {
      query += ', color = ?';
      queryParams.push(color);
    }
    
    if (status !== undefined) {
      query += ', status = ?';
      queryParams.push(status);
    }
    
    if (requires_confirmation !== undefined) {
      query += ', requires_confirmation = ?';
      queryParams.push(requires_confirmation ? 1 : 0);
    }
    
    // Finish query
    query += ' WHERE id = ? AND tenant_id = ?';
    queryParams.push(id, tenantId);
    
    // Execute update
    await db.query(query, queryParams);
    
    // Handle tags if provided
    if (entryData.tags !== undefined) {
      // Remove existing tags
      await db.query('DELETE FROM blackboard_entry_tags WHERE entry_id = ?', [id]);
      
      // Add new tags if any
      if (entryData.tags && entryData.tags.length > 0) {
        await addTagsToEntry(id, entryData.tags, tenantId);
      }
    }
    
    // Get the updated entry
    const updatedEntry = await getEntryById(id, tenantId, entryData.author_id);
    return updatedEntry;
  } catch (error) {
    console.error('Error in updateEntry:', error);
    throw error;
  }
}

/**
 * Delete a blackboard entry
 * @param {number} id - Entry ID
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteEntry(id, tenantId) {
  try {
    // Delete entry
    const query = 'DELETE FROM blackboard_entries WHERE id = ? AND tenant_id = ?';
    const [result] = await db.query(query, [id, tenantId]);
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in deleteEntry:', error);
    throw error;
  }
}

/**
 * Confirm a blackboard entry as read
 * @param {number} entryId - Entry ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function confirmEntry(entryId, userId) {
  try {
    // Check if entry exists and requires confirmation
    const [entries] = await db.query(
      'SELECT * FROM blackboard_entries WHERE id = ? AND requires_confirmation = 1',
      [entryId]
    );
    
    if (entries.length === 0) {
      return false; // Entry doesn't exist or doesn't require confirmation
    }
    
    // Check if already confirmed
    const [confirmations] = await db.query(
      'SELECT * FROM blackboard_confirmations WHERE entry_id = ? AND user_id = ?',
      [entryId, userId]
    );
    
    if (confirmations.length > 0) {
      return true; // Already confirmed
    }
    
    // Add confirmation
    await db.query(
      'INSERT INTO blackboard_confirmations (entry_id, user_id) VALUES (?, ?)',
      [entryId, userId]
    );
    
    return true;
  } catch (error) {
    console.error('Error in confirmEntry:', error);
    throw error;
  }
}

/**
 * Get confirmation status for an entry
 * @param {number} entryId - Entry ID
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Array>} Confirmation status with user details
 */
async function getConfirmationStatus(entryId, tenantId) {
  try {
    // Get all users who should confirm this entry
    const entry = await getEntryById(entryId, tenantId);
    
    if (!entry || !entry.requires_confirmation) {
      return [];
    }
    
    // Get all users who should see this entry
    const usersQuery = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name,
             CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as confirmed,
             c.confirmed_at
      FROM users u
      LEFT JOIN blackboard_confirmations c ON u.id = c.user_id AND c.entry_id = ?
      WHERE u.tenant_id = ?
    `;
    
    let queryParams = [entryId, tenantId];
    
    // Filter by org level
    if (entry.org_level === 'department') {
      usersQuery += ' AND u.department_id = ?';
      queryParams.push(entry.org_id);
    } else if (entry.org_level === 'team') {
      usersQuery += ' AND u.team_id = ?';
      queryParams.push(entry.org_id);
    }
    
    const [users] = await db.query(usersQuery, queryParams);
    
    return users;
  } catch (error) {
    console.error('Error in getConfirmationStatus:', error);
    throw error;
  }
}

/**
 * Get dashboard entries for a user
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID
 * @param {number} limit - Maximum number of entries to return
 * @returns {Promise<Array>} Array of blackboard entries for dashboard
 */
async function getDashboardEntries(tenantId, userId, limit = 3) {
  try {
    // Get user info for access control
    const { role, departmentId, teamId } = await User.getUserDepartmentAndTeam(userId);
    
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
    
    const queryParams = [userId, tenantId];
    
    // Apply access control for non-admin users
    if (role !== 'admin' && role !== 'root') {
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
    queryParams.push(parseInt(limit, 10));
    
    const [entries] = await db.query(query, queryParams);
    return entries;
  } catch (error) {
    console.error('Error in getDashboardEntries:', error);
    throw error;
  }
}

/**
 * Add tags to an entry
 * @param {number} entryId - Entry ID
 * @param {Array} tagNames - Array of tag names
 * @param {number} tenantId - Tenant ID
 */
async function addTagsToEntry(entryId, tagNames, tenantId) {
  try {
    for (const tagName of tagNames) {
      // Get or create tag
      let tagId = await getOrCreateTag(tagName.trim(), tenantId);
      
      // Link tag to entry
      await db.query(
        'INSERT IGNORE INTO blackboard_entry_tags (entry_id, tag_id) VALUES (?, ?)',
        [entryId, tagId]
      );
    }
  } catch (error) {
    console.error('Error adding tags to entry:', error);
    throw error;
  }
}

/**
 * Get or create a tag
 * @param {string} tagName - Tag name
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<number>} Tag ID
 */
async function getOrCreateTag(tagName, tenantId) {
  try {
    // Check if tag exists
    const [existingTags] = await db.query(
      'SELECT id FROM blackboard_tags WHERE name = ? AND tenant_id = ?',
      [tagName, tenantId]
    );
    
    if (existingTags.length > 0) {
      return existingTags[0].id;
    }
    
    // Create new tag
    const [result] = await db.query(
      'INSERT INTO blackboard_tags (name, tenant_id, color) VALUES (?, ?, ?)',
      [tagName, tenantId, 'blue']
    );
    
    return result.insertId;
  } catch (error) {
    console.error('Error getting or creating tag:', error);
    throw error;
  }
}

/**
 * Get all available tags for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Array>} Array of tags
 */
async function getAllTags(tenantId) {
  try {
    const [tags] = await db.query(
      'SELECT * FROM blackboard_tags WHERE tenant_id = ? ORDER BY name',
      [tenantId]
    );
    return tags;
  } catch (error) {
    console.error('Error getting tags:', error);
    throw error;
  }
}

/**
 * Get tags for a specific entry
 * @param {number} entryId - Entry ID
 * @returns {Promise<Array>} Array of tags
 */
async function getEntryTags(entryId) {
  try {
    const [tags] = await db.query(`
      SELECT t.* FROM blackboard_tags t
      JOIN blackboard_entry_tags et ON t.id = et.tag_id
      WHERE et.entry_id = ?
      ORDER BY t.name
    `, [entryId]);
    return tags;
  } catch (error) {
    console.error('Error getting entry tags:', error);
    throw error;
  }
}

module.exports = {
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
  addTagsToEntry
};