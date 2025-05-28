/**
 * Validation Utilities
 * Common validation functions
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (German format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhone(phone) {
  // Remove spaces and special characters
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Check for German phone number format
  const phoneRegex = /^(\+49|0049|0)[1-9]\d{1,14}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with message
 */
function validatePassword(password) {
  const minLength = 8;
  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push(
      'Password must contain at least one special character (!@#$%^&*)'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate username
 * @param {string} username - Username to validate
 * @returns {Object} Validation result
 */
function validateUsername(username) {
  const errors = [];

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  if (username.length > 30) {
    errors.push('Username must not exceed 30 characters');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push(
      'Username can only contain letters, numbers, underscores, and hyphens'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} date - Date string to validate
 * @returns {boolean} True if valid
 */
function isValidDate(date) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const d = new Date(date);
  return d instanceof Date && !isNaN(d);
}

/**
 * Validate file type
 * @param {string} filename - Filename to check
 * @param {Array} allowedTypes - Array of allowed extensions
 * @returns {boolean} True if valid
 */
function isValidFileType(filename, allowedTypes) {
  const ext = filename.split('.').pop().toLowerCase();
  return allowedTypes.includes(ext);
}

/**
 * Validate subdomain
 * @param {string} subdomain - Subdomain to validate
 * @returns {Object} Validation result
 */
function validateSubdomain(subdomain) {
  const errors = [];

  if (subdomain.length < 3) {
    errors.push('Subdomain must be at least 3 characters long');
  }
  if (subdomain.length > 63) {
    errors.push('Subdomain must not exceed 63 characters');
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(subdomain)) {
    errors.push(
      'Subdomain can only contain lowercase letters, numbers, and hyphens (not at start or end)'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate required fields
 * @param {Object} data - Data object to validate
 * @param {Array} requiredFields - Array of required field names
 * @returns {Object} Validation result
 */
function validateRequiredFields(data, requiredFields) {
  const missingFields = [];

  requiredFields.forEach((field) => {
    if (
      !data[field] ||
      (typeof data[field] === 'string' && data[field].trim() === '')
    ) {
      missingFields.push(field);
    }
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Validate number range
 * @param {number} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if valid
 */
function isInRange(value, min, max) {
  return value >= min && value <= max;
}

/**
 * Validate positive integer
 * @param {any} value - Value to validate
 * @returns {boolean} True if valid
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

module.exports = {
  isValidEmail,
  isValidPhone,
  validatePassword,
  validateUsername,
  isValidDate,
  isValidFileType,
  validateSubdomain,
  validateRequiredFields,
  isInRange,
  isPositiveInteger,
};
