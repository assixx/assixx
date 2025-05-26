/**
 * Shift Model
 * Handles database operations for shift planning system
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
 * Format date only for MySQL
 */
function formatDateOnlyForMysql(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 10);
}

/**
 * Get all shift templates for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Array>} Array of shift templates
 */
async function getShiftTemplates(tenantId) {
  try {
    const query = `
      SELECT * FROM shift_templates
      WHERE tenant_id = ? AND is_active = TRUE
      ORDER BY name ASC
    `;

    const [templates] = await db.query(query, [tenantId]);
    return templates;
  } catch (error) {
    console.error('Error in getShiftTemplates:', error);
    throw error;
  }
}

/**
 * Create a new shift template
 * @param {Object} templateData - Template data
 * @returns {Promise<Object>} Created template
 */
async function createShiftTemplate(templateData) {
  try {
    const {
      tenant_id,
      name,
      description,
      start_time,
      end_time,
      duration_hours,
      break_duration_minutes,
      color,
      created_by,
    } = templateData;

    // Validate required fields
    if (
      !tenant_id ||
      !name ||
      !start_time ||
      !end_time ||
      !duration_hours ||
      !created_by
    ) {
      throw new Error('Missing required fields');
    }

    const query = `
      INSERT INTO shift_templates 
      (tenant_id, name, description, start_time, end_time, duration_hours, 
       break_duration_minutes, color, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      tenant_id,
      name,
      description || null,
      start_time,
      end_time,
      duration_hours,
      break_duration_minutes || 0,
      color || '#3498db',
      created_by,
    ]);

    // Get the created template
    const [created] = await db.query(
      'SELECT * FROM shift_templates WHERE id = ?',
      [result.insertId]
    );

    return created[0];
  } catch (error) {
    console.error('Error in createShiftTemplate:', error);
    throw error;
  }
}

/**
 * Get all shift plans for a tenant with optional filters
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID for access control
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Shift plans with pagination
 */
async function getShiftPlans(tenantId, userId, options = {}) {
  try {
    const {
      department_id,
      team_id,
      start_date,
      end_date,
      status = 'draft',
      page = 1,
      limit = 50,
    } = options;

    // Get user info for access control
    const { role, departmentId, teamId } =
      await User.getUserDepartmentAndTeam(userId);

    let query = `
      SELECT sp.*, u.username as created_by_name,
             d.name as department_name, t.name as team_name
      FROM shift_plans sp
      LEFT JOIN users u ON sp.created_by = u.id
      LEFT JOIN departments d ON sp.department_id = d.id
      LEFT JOIN teams t ON sp.team_id = t.id
      WHERE sp.tenant_id = ?
    `;

    const queryParams = [tenantId];

    // Apply access control for non-admin users
    if (role !== 'admin' && role !== 'root') {
      if (role === 'manager') {
        query += ' AND sp.department_id = ?';
        queryParams.push(departmentId);
      } else if (role === 'team_lead') {
        query += ' AND sp.team_id = ?';
        queryParams.push(teamId);
      } else {
        // Regular employees can only see published plans for their department/team
        query +=
          ' AND sp.status = "published" AND (sp.department_id = ? OR sp.team_id = ?)';
        queryParams.push(departmentId || 0, teamId || 0);
      }
    }

    // Apply filters
    if (department_id) {
      query += ' AND sp.department_id = ?';
      queryParams.push(department_id);
    }

    if (team_id) {
      query += ' AND sp.team_id = ?';
      queryParams.push(team_id);
    }

    if (start_date) {
      query += ' AND sp.end_date >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      query += ' AND sp.start_date <= ?';
      queryParams.push(end_date);
    }

    if (status) {
      query += ' AND sp.status = ?';
      queryParams.push(status);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query += ' ORDER BY sp.start_date DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit, 10), offset);

    const [plans] = await db.query(query, queryParams);

    // Count total for pagination
    let countQuery = `
      SELECT COUNT(*) as total FROM shift_plans sp
      WHERE sp.tenant_id = ?
    `;
    const countParams = [tenantId];

    // Apply same access control for count
    if (role !== 'admin' && role !== 'root') {
      if (role === 'manager') {
        countQuery += ' AND sp.department_id = ?';
        countParams.push(departmentId);
      } else if (role === 'team_lead') {
        countQuery += ' AND sp.team_id = ?';
        countParams.push(teamId);
      } else {
        countQuery +=
          ' AND sp.status = "published" AND (sp.department_id = ? OR sp.team_id = ?)';
        countParams.push(departmentId || 0, teamId || 0);
      }
    }

    // Apply same filters for count
    if (department_id) {
      countQuery += ' AND sp.department_id = ?';
      countParams.push(department_id);
    }

    if (team_id) {
      countQuery += ' AND sp.team_id = ?';
      countParams.push(team_id);
    }

    if (start_date) {
      countQuery += ' AND sp.end_date >= ?';
      countParams.push(start_date);
    }

    if (end_date) {
      countQuery += ' AND sp.start_date <= ?';
      countParams.push(end_date);
    }

    if (status) {
      countQuery += ' AND sp.status = ?';
      countParams.push(status);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    return {
      plans,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Error in getShiftPlans:', error);
    throw error;
  }
}

/**
 * Create a new shift plan
 * @param {Object} planData - Plan data
 * @returns {Promise<Object>} Created plan
 */
async function createShiftPlan(planData) {
  try {
    const {
      tenant_id,
      name,
      description,
      start_date,
      end_date,
      department_id,
      team_id,
      created_by,
    } = planData;

    // Validate required fields
    if (!tenant_id || !name || !start_date || !end_date || !created_by) {
      throw new Error('Missing required fields');
    }

    // Validate date range
    if (new Date(start_date) > new Date(end_date)) {
      throw new Error('Start date must be before end date');
    }

    const query = `
      INSERT INTO shift_plans 
      (tenant_id, name, description, start_date, end_date, department_id, team_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      tenant_id,
      name,
      description || null,
      formatDateOnlyForMysql(start_date),
      formatDateOnlyForMysql(end_date),
      department_id || null,
      team_id || null,
      created_by,
    ]);

    // Get the created plan
    const [created] = await db.query('SELECT * FROM shift_plans WHERE id = ?', [
      result.insertId,
    ]);

    return created[0];
  } catch (error) {
    console.error('Error in createShiftPlan:', error);
    throw error;
  }
}

/**
 * Get shifts for a specific plan
 * @param {number} planId - Plan ID
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID for access control
 * @returns {Promise<Array>} Array of shifts with assignments
 */
async function getShiftsByPlan(planId, tenantId, userId) {
  try {
    // Check if user can access this plan
    const planAccess = await canAccessShiftPlan(planId, userId);
    if (!planAccess) {
      throw new Error('Access denied to this shift plan');
    }

    const query = `
      SELECT s.*, st.name as template_name, st.color as template_color,
             GROUP_CONCAT(
               CONCAT(u.first_name, ' ', u.last_name, ':', sa.status)
               SEPARATOR '; '
             ) as assignments
      FROM shifts s
      LEFT JOIN shift_templates st ON s.template_id = st.id
      LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE s.plan_id = ? AND s.tenant_id = ?
      GROUP BY s.id
      ORDER BY s.date ASC, s.start_time ASC
    `;

    const [shifts] = await db.query(query, [planId, tenantId]);

    // Parse assignments string into array
    shifts.forEach((shift) => {
      if (shift.assignments) {
        shift.assignedEmployees = shift.assignments
          .split('; ')
          .map((assignment) => {
            const [name, status] = assignment.split(':');
            return { name, status };
          });
      } else {
        shift.assignedEmployees = [];
      }
      delete shift.assignments;
    });

    return shifts;
  } catch (error) {
    console.error('Error in getShiftsByPlan:', error);
    throw error;
  }
}

/**
 * Create a shift
 * @param {Object} shiftData - Shift data
 * @returns {Promise<Object>} Created shift
 */
async function createShift(shiftData) {
  try {
    const {
      tenant_id,
      plan_id,
      template_id,
      date,
      start_time,
      end_time,
      required_employees,
      created_by,
    } = shiftData;

    // Validate required fields
    if (
      !tenant_id ||
      !plan_id ||
      !date ||
      !start_time ||
      !end_time ||
      !created_by
    ) {
      throw new Error('Missing required fields');
    }

    const query = `
      INSERT INTO shifts 
      (tenant_id, plan_id, template_id, date, start_time, end_time, 
       required_employees, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      tenant_id,
      plan_id,
      template_id || null,
      formatDateOnlyForMysql(date),
      start_time,
      end_time,
      required_employees || 1,
      created_by,
    ]);

    // Get the created shift
    const [created] = await db.query('SELECT * FROM shifts WHERE id = ?', [
      result.insertId,
    ]);

    return created[0];
  } catch (error) {
    console.error('Error in createShift:', error);
    throw error;
  }
}

/**
 * Assign employee to a shift
 * @param {Object} assignmentData - Assignment data
 * @returns {Promise<Object>} Created assignment
 */
async function assignEmployeeToShift(assignmentData) {
  try {
    const {
      tenant_id,
      shift_id,
      user_id,
      // status = 'A',
      assigned_by,
    } = assignmentData;

    // Validate required fields
    if (!tenant_id || !shift_id || !user_id || !assigned_by) {
      throw new Error('Missing required fields');
    }

    // Check if already assigned to this specific shift
    const [existing] = await db.query(
      'SELECT * FROM shift_assignments WHERE shift_id = ? AND user_id = ?',
      [shift_id, user_id]
    );

    if (existing.length > 0) {
      throw new Error('Employee already assigned to this shift');
    }

    // Check if employee is already assigned to another shift on the same day
    const [shiftInfo] = await db.query('SELECT date FROM shifts WHERE id = ?', [
      shift_id,
    ]);

    if (shiftInfo.length > 0) {
      const shiftDate = shiftInfo[0].date;

      const [dayAssignments] = await db.query(
        `
        SELECT sa.*, s.start_time, s.end_time 
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.user_id = ? AND s.date = ? AND s.tenant_id = ?
      `,
        [user_id, shiftDate, tenant_id]
      );

      if (dayAssignments.length > 0) {
        throw new Error(
          'Employee is already assigned to another shift on this day'
        );
      }
    }

    const query = `
      INSERT INTO shift_assignments 
      (tenant_id, shift_id, user_id, assigned_by)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      tenant_id,
      shift_id,
      user_id,
      assigned_by,
    ]);

    // Get the created assignment with user details
    const [created] = await db.query(
      `
      SELECT sa.*, u.first_name, u.last_name, u.username
      FROM shift_assignments sa
      JOIN users u ON sa.user_id = u.id
      WHERE sa.id = ?
    `,
      [result.insertId]
    );

    return created[0];
  } catch (error) {
    console.error('Error in assignEmployeeToShift:', error);
    throw error;
  }
}

/**
 * Get employee availability for a date range
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {Promise<Array>} Array of availability records
 */
async function getEmployeeAvailability(tenantId, userId, startDate, endDate) {
  try {
    const query = `
      SELECT * FROM employee_availability
      WHERE tenant_id = ? AND user_id = ? 
      AND date >= ? AND date <= ?
      ORDER BY date ASC
    `;

    const [availability] = await db.query(query, [
      tenantId,
      userId,
      formatDateOnlyForMysql(startDate),
      formatDateOnlyForMysql(endDate),
    ]);

    return availability;
  } catch (error) {
    console.error('Error in getEmployeeAvailability:', error);
    throw error;
  }
}

/**
 * Set employee availability
 * @param {Object} availabilityData - Availability data
 * @returns {Promise<Object>} Created/updated availability
 */
async function setEmployeeAvailability(availabilityData) {
  try {
    const {
      tenant_id,
      user_id,
      date,
      availability_type,
      start_time,
      end_time,
      notes,
    } = availabilityData;

    // Validate required fields
    if (!tenant_id || !user_id || !date || !availability_type) {
      throw new Error('Missing required fields');
    }

    // Check if availability already exists for this date
    const [existing] = await db.query(
      'SELECT * FROM employee_availability WHERE tenant_id = ? AND user_id = ? AND date = ?',
      [tenant_id, user_id, formatDateOnlyForMysql(date)]
    );

    if (existing.length > 0) {
      // Update existing
      const query = `
        UPDATE employee_availability 
        SET availability_type = ?, start_time = ?, end_time = ?, notes = ?, updated_at = NOW()
        WHERE id = ?
      `;

      await db.query(query, [
        availability_type,
        start_time || null,
        end_time || null,
        notes || null,
        existing[0].id,
      ]);

      return { ...existing[0], availability_type, start_time, end_time, notes };
    } else {
      // Create new
      const query = `
        INSERT INTO employee_availability 
        (tenant_id, user_id, date, availability_type, start_time, end_time, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await db.query(query, [
        tenant_id,
        user_id,
        formatDateOnlyForMysql(date),
        availability_type,
        start_time || null,
        end_time || null,
        notes || null,
      ]);

      const [created] = await db.query(
        'SELECT * FROM employee_availability WHERE id = ?',
        [result.insertId]
      );

      return created[0];
    }
  } catch (error) {
    console.error('Error in setEmployeeAvailability:', error);
    throw error;
  }
}

/**
 * Get shift exchange requests
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID for filtering
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of exchange requests
 */
async function getShiftExchangeRequests(tenantId, userId, options = {}) {
  try {
    const { status = 'pending', limit = 50 } = options;

    const query = `
      SELECT ser.*, 
             s.date, s.start_time, s.end_time,
             st.name as shift_template_name,
             u1.first_name as requester_first_name, u1.last_name as requester_last_name,
             u2.first_name as target_first_name, u2.last_name as target_last_name
      FROM shift_exchange_requests ser
      JOIN shifts s ON ser.shift_id = s.id
      LEFT JOIN shift_templates st ON s.template_id = st.id
      JOIN users u1 ON ser.requester_id = u1.id
      LEFT JOIN users u2 ON ser.target_user_id = u2.id
      WHERE ser.tenant_id = ? AND (ser.requester_id = ? OR ser.target_user_id = ?)
      AND ser.status = ?
      ORDER BY ser.created_at DESC
      LIMIT ?
    `;

    const [requests] = await db.query(query, [
      tenantId,
      userId,
      userId,
      status,
      limit,
    ]);
    return requests;
  } catch (error) {
    console.error('Error in getShiftExchangeRequests:', error);
    throw error;
  }
}

/**
 * Create shift exchange request
 * @param {Object} requestData - Exchange request data
 * @returns {Promise<Object>} Created request
 */
async function createShiftExchangeRequest(requestData) {
  try {
    const {
      tenant_id,
      shift_id,
      requester_id,
      target_user_id,
      exchange_type,
      target_shift_id,
      message,
    } = requestData;

    // Validate required fields
    if (!tenant_id || !shift_id || !requester_id || !exchange_type) {
      throw new Error('Missing required fields');
    }

    const query = `
      INSERT INTO shift_exchange_requests 
      (tenant_id, shift_id, requester_id, target_user_id, exchange_type, target_shift_id, message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      tenant_id,
      shift_id,
      requester_id,
      target_user_id || null,
      exchange_type,
      target_shift_id || null,
      message || null,
    ]);

    // Get the created request
    const [created] = await db.query(
      'SELECT * FROM shift_exchange_requests WHERE id = ?',
      [result.insertId]
    );

    return created[0];
  } catch (error) {
    console.error('Error in createShiftExchangeRequest:', error);
    throw error;
  }
}

/**
 * Check if user can access a shift plan
 * @param {number} planId - Plan ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} Access permission
 */
async function canAccessShiftPlan(planId, userId) {
  try {
    // Get user info and plan info
    const { role, departmentId, teamId } =
      await User.getUserDepartmentAndTeam(userId);

    const [plans] = await db.query('SELECT * FROM shift_plans WHERE id = ?', [
      planId,
    ]);

    if (plans.length === 0) {
      return false;
    }

    const plan = plans[0];

    // Admins can access all plans
    if (role === 'admin' || role === 'root') {
      return true;
    }

    // Managers can access department plans
    if (role === 'manager' && plan.department_id === departmentId) {
      return true;
    }

    // Team leads can access team plans
    if (role === 'team_lead' && plan.team_id === teamId) {
      return true;
    }

    // Employees can access published plans for their department/team
    if (
      plan.status === 'published' &&
      (plan.department_id === departmentId || plan.team_id === teamId)
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error in canAccessShiftPlan:', error);
    throw error;
  }
}

/**
 * Get employee shifts for a date range
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User ID
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {Promise<Array>} Array of employee shifts
 */
async function getEmployeeShifts(tenantId, userId, startDate, endDate) {
  try {
    const query = `
      SELECT s.*, st.name as template_name, st.color as template_color,
             sa.status as assignment_status, sa.assigned_at,
             sp.name as plan_name
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      JOIN shift_plans sp ON s.plan_id = sp.id
      LEFT JOIN shift_templates st ON s.template_id = st.id
      WHERE sa.tenant_id = ? AND sa.user_id = ?
      AND s.date >= ? AND s.date <= ?
      ORDER BY s.date ASC, s.start_time ASC
    `;

    const [shifts] = await db.query(query, [
      tenantId,
      userId,
      formatDateOnlyForMysql(startDate),
      formatDateOnlyForMysql(endDate),
    ]);

    return shifts;
  } catch (error) {
    console.error('Error in getEmployeeShifts:', error);
    throw error;
  }
}

module.exports = {
  getShiftTemplates,
  createShiftTemplate,
  getShiftPlans,
  createShiftPlan,
  getShiftsByPlan,
  createShift,
  assignEmployeeToShift,
  getEmployeeAvailability,
  setEmployeeAvailability,
  getShiftExchangeRequests,
  createShiftExchangeRequest,
  canAccessShiftPlan,
  getEmployeeShifts,
  formatDateForMysql,
  formatDateOnlyForMysql,
};
