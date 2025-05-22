/**
 * Calendar Model
 * Handles database operations for the calendar events and attendees
 */

const db = require('../database');
const User = require('./user');

/**
 * Format datetime strings for MySQL (remove 'Z' and convert to local format)
 */
function formatDateForMysql(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Get all calendar events visible to the user
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {string} options.status - Event status (active, cancelled)
 * @param {string} options.filter - Filter by org_level (company, department, team)
 * @param {string} options.search - Search term for title/description
 * @param {string} options.start_date - Start date for events filter
 * @param {string} options.end_date - End date for events filter
 * @param {number} options.page - Page number for pagination
 * @param {number} options.limit - Items per page
 * @returns {Promise<Array>} Array of calendar events
 */
async function getAllEvents(tenantId, userId, options = {}) {
  try {
    const {
      status = 'active',
      filter = 'all',
      search = '',
      start_date,
      end_date,
      page = 1,
      limit = 50,
      sortBy = 'start_time',
      sortDir = 'ASC'
    } = options;

    // Determine user's department and team for access control
    const { role, departmentId, teamId } = await User.getUserDepartmentAndTeam(userId);
    
    // Build base query
    let query = `
      SELECT e.*, 
             u.username as creator_name,
             CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
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
        (e.org_level = 'team' AND e.org_id = ?) OR
        EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
      )`;
      queryParams.push(departmentId || 0, teamId || 0, userId);
    }
    
    // Apply date range filter
    if (start_date) {
      query += ' AND e.end_time >= ?';
      queryParams.push(start_date);
    }
    
    if (end_date) {
      query += ' AND e.start_time <= ?';
      queryParams.push(end_date);
    }
    
    // Apply search filter
    if (search) {
      query += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Apply sorting
    query += ` ORDER BY e.${sortBy} ${sortDir}`;
    
    // Apply pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit, 10), offset);
    
    // Execute query
    const [events] = await db.query(query, queryParams);
    
    console.log(`Found ${events.length} calendar events`);
    
    // Convert Buffer description to String if needed
    events.forEach(event => {
      if (event.description && Buffer.isBuffer(event.description)) {
        console.log("Converting Buffer description to string");
        event.description = event.description.toString('utf8');
      } else if (event.description && typeof event.description === 'object' && 
                event.description.type === 'Buffer' && Array.isArray(event.description.data)) {
        console.log("Converting Buffer object to string");
        event.description = Buffer.from(event.description.data).toString('utf8');
      }
    });
    
    // Count total events for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM calendar_events e
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
        (e.org_level = 'team' AND e.org_id = ?) OR
        EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
      )`;
      countParams.push(departmentId || 0, teamId || 0, userId);
    }
    
    // Apply date range filter for count
    if (start_date) {
      countQuery += ' AND e.end_time >= ?';
      countParams.push(start_date);
    }
    
    if (end_date) {
      countQuery += ' AND e.start_time <= ?';
      countParams.push(end_date);
    }
    
    // Apply search filter for count
    if (search) {
      countQuery += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    const totalEvents = countResult[0].total;
    
    return {
      events,
      pagination: {
        total: totalEvents,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(totalEvents / limit)
      }
    };
  } catch (error) {
    console.error('Error in getAllEvents:', error);
    throw error;
  }
}

/**
 * Get a specific calendar event by ID
 * @param {number} id - Event ID
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID checking the event
 * @returns {Promise<Object>} Calendar event
 */
async function getEventById(id, tenantId, userId) {
  try {
    // Determine user's department and team for access control
    const { role, departmentId, teamId } = await User.getUserDepartmentAndTeam(userId);
    
    // Query the event with user response status
    const query = `
      SELECT e.*, 
             u.username as creator_name,
             CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
      WHERE e.id = ? AND e.tenant_id = ?
    `;
    
    const [events] = await db.query(query, [userId, id, tenantId]);
    
    if (events.length === 0) {
      return null;
    }
    
    const event = events[0];
    
    // Convert Buffer description to String if needed
    if (event.description && Buffer.isBuffer(event.description)) {
      event.description = event.description.toString('utf8');
    } else if (event.description && typeof event.description === 'object' && 
              event.description.type === 'Buffer' && Array.isArray(event.description.data)) {
      event.description = Buffer.from(event.description.data).toString('utf8');
    }
    
    // Check access control for non-admin users
    if (role !== 'admin' && role !== 'root') {
      // Check if user is an attendee
      const [attendeeRows] = await db.query(
        'SELECT 1 FROM calendar_attendees WHERE event_id = ? AND user_id = ?',
        [id, userId]
      );
      
      const isAttendee = attendeeRows.length > 0;
      
      const hasAccess = 
        event.org_level === 'company' || 
        (event.org_level === 'department' && event.org_id === departmentId) ||
        (event.org_level === 'team' && event.org_id === teamId) ||
        isAttendee;
      
      if (!hasAccess) {
        return null; // User doesn't have access to this event
      }
    }
    
    return event;
  } catch (error) {
    console.error('Error in getEventById:', error);
    throw error;
  }
}

/**
 * Create a new calendar event
 * @param {Object} eventData - Event data
 * @returns {Promise<Object>} Created event
 */
async function createEvent(eventData) {
  try {
    const {
      tenant_id,
      title,
      description,
      location,
      start_time,
      end_time,
      all_day,
      org_level,
      org_id,
      created_by,
      reminder_time,
      color
    } = eventData;
    
    // Validate required fields
    if (!tenant_id || !title || !start_time || !end_time || !org_level || !org_id || !created_by) {
      throw new Error('Missing required fields');
    }
    
    // Ensure dates are valid
    if (new Date(start_time) > new Date(end_time)) {
      throw new Error('Start time must be before end time');
    }
    
    // Insert new event
    const query = `
      INSERT INTO calendar_events 
      (tenant_id, title, description, location, start_time, end_time, all_day, 
       org_level, org_id, created_by, reminder_time, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await db.query(query, [
      tenant_id,
      title,
      description || null,
      location || null,
      formatDateForMysql(start_time),
      formatDateForMysql(end_time),
      all_day ? 1 : 0,
      org_level,
      org_id,
      created_by,
      reminder_time || null,
      color || '#3498db'
    ]);
    
    // Get the created event
    const createdEvent = await getEventById(result.insertId, tenant_id, created_by);
    
    // Add the creator as an attendee with 'accepted' status
    if (createdEvent) {
      await addEventAttendee(createdEvent.id, created_by, 'accepted');
    }
    
    return createdEvent;
  } catch (error) {
    console.error('Error in createEvent:', error);
    throw error;
  }
}

/**
 * Update a calendar event
 * @param {number} id - Event ID
 * @param {Object} eventData - Updated event data
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object>} Updated event
 */
async function updateEvent(id, eventData, tenantId) {
  try {
    const {
      title,
      description,
      location,
      start_time,
      end_time,
      all_day,
      org_level,
      org_id,
      status,
      reminder_time,
      color
    } = eventData;
    
    // Build query dynamically based on provided fields
    let query = 'UPDATE calendar_events SET updated_at = NOW()';
    const queryParams = [];
    
    if (title !== undefined) {
      query += ', title = ?';
      queryParams.push(title);
    }
    
    if (description !== undefined) {
      query += ', description = ?';
      queryParams.push(description);
    }
    
    if (location !== undefined) {
      query += ', location = ?';
      queryParams.push(location);
    }
    
    if (start_time !== undefined) {
      query += ', start_time = ?';
      queryParams.push(formatDateForMysql(start_time));
    }
    
    if (end_time !== undefined) {
      query += ', end_time = ?';
      queryParams.push(formatDateForMysql(end_time));
    }
    
    if (all_day !== undefined) {
      query += ', all_day = ?';
      queryParams.push(all_day ? 1 : 0);
    }
    
    if (org_level !== undefined) {
      query += ', org_level = ?';
      queryParams.push(org_level);
    }
    
    if (org_id !== undefined) {
      query += ', org_id = ?';
      queryParams.push(org_id);
    }
    
    if (status !== undefined) {
      query += ', status = ?';
      queryParams.push(status);
    }
    
    if (reminder_time !== undefined) {
      query += ', reminder_time = ?';
      // Convert empty string to null for integer field
      const reminderValue = reminder_time === '' ? null : parseInt(reminder_time) || null;
      queryParams.push(reminderValue);
    }
    
    if (color !== undefined) {
      query += ', color = ?';
      queryParams.push(color);
    }
    
    // Finish query
    query += ' WHERE id = ? AND tenant_id = ?';
    queryParams.push(id, tenantId);
    
    // Execute update
    await db.query(query, queryParams);
    
    // Get the updated event
    const updatedEvent = await getEventById(id, tenantId, eventData.created_by);
    return updatedEvent;
  } catch (error) {
    console.error('Error in updateEvent:', error);
    throw error;
  }
}

/**
 * Delete a calendar event
 * @param {number} id - Event ID
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteEvent(id, tenantId) {
  try {
    // Delete event
    const query = 'DELETE FROM calendar_events WHERE id = ? AND tenant_id = ?';
    const [result] = await db.query(query, [id, tenantId]);
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in deleteEvent:', error);
    throw error;
  }
}

/**
 * Add an attendee to a calendar event
 * @param {number} eventId - Event ID
 * @param {number} userId - User ID
 * @param {string} responseStatus - Response status (pending, accepted, declined, tentative)
 * @returns {Promise<boolean>} Success status
 */
async function addEventAttendee(eventId, userId, responseStatus = 'pending') {
  try {
    // Check if already an attendee
    const [attendees] = await db.query(
      'SELECT * FROM calendar_attendees WHERE event_id = ? AND user_id = ?',
      [eventId, userId]
    );
    
    if (attendees.length > 0) {
      // Update existing attendee status
      await db.query(
        'UPDATE calendar_attendees SET response_status = ?, responded_at = NOW() WHERE event_id = ? AND user_id = ?',
        [responseStatus, eventId, userId]
      );
    } else {
      // Add new attendee
      await db.query(
        'INSERT INTO calendar_attendees (event_id, user_id, response_status, responded_at) VALUES (?, ?, ?, NOW())',
        [eventId, userId, responseStatus]
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error in addEventAttendee:', error);
    throw error;
  }
}

/**
 * Remove an attendee from a calendar event
 * @param {number} eventId - Event ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
async function removeEventAttendee(eventId, userId) {
  try {
    // Remove attendee
    const query = 'DELETE FROM calendar_attendees WHERE event_id = ? AND user_id = ?';
    const [result] = await db.query(query, [eventId, userId]);
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in removeEventAttendee:', error);
    throw error;
  }
}

/**
 * User responds to a calendar event
 * @param {number} eventId - Event ID
 * @param {number} userId - User ID
 * @param {string} response - Response (accepted, declined, tentative)
 * @returns {Promise<boolean>} Success status
 */
async function respondToEvent(eventId, userId, response) {
  try {
    // Validate response
    const validResponses = ['accepted', 'declined', 'tentative'];
    if (!validResponses.includes(response)) {
      throw new Error('Invalid response status');
    }
    
    // Update response
    return addEventAttendee(eventId, userId, response);
  } catch (error) {
    console.error('Error in respondToEvent:', error);
    throw error;
  }
}

/**
 * Get attendees for a calendar event
 * @param {number} eventId - Event ID
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Array>} Attendees with their response status
 */
async function getEventAttendees(eventId, tenantId) {
  try {
    const query = `
      SELECT a.user_id, a.response_status, a.responded_at,
             u.username, u.first_name, u.last_name, u.email, u.profile_picture
      FROM calendar_attendees a
      JOIN users u ON a.user_id = u.id
      JOIN calendar_events e ON a.event_id = e.id
      WHERE a.event_id = ? AND e.tenant_id = ?
      ORDER BY u.first_name, u.last_name
    `;
    
    const [attendees] = await db.query(query, [eventId, tenantId]);
    return attendees;
  } catch (error) {
    console.error('Error in getEventAttendees:', error);
    throw error;
  }
}

/**
 * Get upcoming events for a user's dashboard
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID
 * @param {number} days - Number of days to look ahead
 * @param {number} limit - Maximum number of events to return
 * @returns {Promise<Array>} Array of upcoming calendar events
 */
async function getDashboardEvents(tenantId, userId, days = 7, limit = 5) {
  try {
    // Get user info for access control
    const { role, departmentId, teamId } = await User.getUserDepartmentAndTeam(userId);
    
    // Calculate date range
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + days);
    
    // Format dates for MySQL
    const todayStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Build query for dashboard events
    let query = `
      SELECT e.*, 
             u.username as creator_name,
             CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
      WHERE e.tenant_id = ? AND e.status = 'active'
      AND e.start_time >= ? AND e.start_time <= ?
    `;
    
    const queryParams = [userId, tenantId, todayStr, endDateStr];
    
    // Apply access control for non-admin users
    if (role !== 'admin' && role !== 'root') {
      query += ` AND (
        e.org_level = 'company' OR 
        (e.org_level = 'department' AND e.org_id = ?) OR
        (e.org_level = 'team' AND e.org_id = ?) OR
        EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
      )`;
      queryParams.push(departmentId || 0, teamId || 0, userId);
    }
    
    // Sort by start time, limited to the next few events
    query += `
      ORDER BY e.start_time ASC
      LIMIT ?
    `;
    queryParams.push(parseInt(limit, 10));
    
    const [events] = await db.query(query, queryParams);
    
    // Convert Buffer description to String if needed
    events.forEach(event => {
      if (event.description && Buffer.isBuffer(event.description)) {
        event.description = event.description.toString('utf8');
      } else if (event.description && typeof event.description === 'object' && 
                event.description.type === 'Buffer' && Array.isArray(event.description.data)) {
        event.description = Buffer.from(event.description.data).toString('utf8');
      }
    });
    
    return events;
  } catch (error) {
    console.error('Error in getDashboardEvents:', error);
    throw error;
  }
}

/**
 * Check if a user can manage an event
 * @param {number} eventId - Event ID
 * @param {number} userId - User ID
 * @param {Object} userInfo - User info with role, departmentId, teamId
 * @returns {Promise<boolean>} True if user can manage the event
 */
async function canManageEvent(eventId, userId, userInfo = null) {
  try {
    // Get event details
    const [events] = await db.query(
      'SELECT * FROM calendar_events WHERE id = ?',
      [eventId]
    );
    
    if (events.length === 0) {
      return false;
    }
    
    const event = events[0];
    
    // Get user info if not provided
    const userRole = userInfo ? userInfo.role : null;
    const userDeptId = userInfo ? userInfo.departmentId : null;
    const userTeamId = userInfo ? userInfo.teamId : null;
    
    // If already have user info, use it
    let role, departmentId, teamId;
    
    if (userRole && (userDeptId !== undefined) && (userTeamId !== undefined)) {
      role = userRole;
      departmentId = userDeptId;
      teamId = userTeamId;
    } else {
      // Otherwise get it from the database
      const userDetails = await User.getUserDepartmentAndTeam(userId);
      role = userDetails.role;
      departmentId = userDetails.departmentId;
      teamId = userDetails.teamId;
    }
    
    // Admins can manage all events
    if (role === 'admin' || role === 'root') {
      return true;
    }
    
    // Event creator can manage their events
    if (event.created_by === userId) {
      return true;
    }
    
    // Department managers can manage department events
    if (role === 'manager' && event.org_level === 'department' && event.org_id === departmentId) {
      return true;
    }
    
    // Team leads can manage team events
    if (role === 'team_lead' && event.org_level === 'team' && event.org_id === teamId) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in canManageEvent:', error);
    throw error;
  }
}

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  addEventAttendee,
  removeEventAttendee,
  respondToEvent,
  getEventAttendees,
  getDashboardEvents,
  canManageEvent
};