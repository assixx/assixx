/**
 * Validation Utilities
 * Common validation functions with TypeScript type safety
 */

// Validation result interfaces
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface UsernameValidationResult {
  isValid: boolean;
  errors: string[];
}

interface SubdomainValidationResult {
  isValid: boolean;
  errors: string[];
}

interface RequiredFieldsValidationResult {
  isValid: boolean;
  missingFields: string[];
}

// Data object interface for required fields validation
type DataObject = Record<string, unknown>;

/**
 * Validate email format
 * @param email - Email to validate
 * @returns True if valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (German format)
 * @param phone - Phone number to validate
 * @returns True if valid
 */
export function isValidPhone(phone: string): boolean {
  // Remove spaces and special characters
  const cleaned = phone.replace(/[\s()-]/g, '');
  // Check for German phone number format
  const phoneRegex = /^(\+49|0049|0)[1-9]\d{1,14}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Validation result with message
 */
export function validatePassword(password: string): ValidationResult {
  const minLength = 8;
  const errors: string[] = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!#$%&*@^]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate username
 * @param username - Username to validate
 * @returns Validation result
 */
export function validateUsername(username: string): UsernameValidationResult {
  const errors: string[] = [];

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  if (username.length > 30) {
    errors.push('Username must not exceed 30 characters');
  }
  if (!/^[\w-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param date - Date string to validate
 * @returns True if valid
 */
export function isValidDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const d = new Date(date);
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/**
 * Validate file type
 * @param filename - Filename to check
 * @param allowedTypes - Array of allowed extensions
 * @returns True if valid
 */
export function isValidFileType(filename: string, allowedTypes: string[]): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext != null && ext !== '' ? allowedTypes.includes(ext) : false;
}

/**
 * Validate subdomain
 * @param subdomain - Subdomain to validate
 * @returns Validation result
 */
export function validateSubdomain(subdomain: string): SubdomainValidationResult {
  const errors: string[] = [];

  if (subdomain.length < 3) {
    errors.push('Subdomain must be at least 3 characters long');
  }
  if (subdomain.length > 63) {
    errors.push('Subdomain must not exceed 63 characters');
  }
  if (!/^[0-9a-z]+(-[0-9a-z]+)*$/.test(subdomain)) {
    errors.push(
      'Subdomain can only contain lowercase letters, numbers, and hyphens (not at start or end)',
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate required fields
 * @param data - Data object to validate
 * @param requiredFields - Array of required field names
 * @returns Validation result
 */
export function validateRequiredFields(
  data: DataObject,
  requiredFields: string[],
): RequiredFieldsValidationResult {
  const missingFields: string[] = [];

  requiredFields.forEach((field: string) => {
    const value = data[field];
    if (value == null || value === '' || (typeof value === 'string' && value.trim() === '')) {
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
 * @param value - Value to validate
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns True if valid
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate positive integer
 * @param value - Value to validate
 * @returns True if valid
 */
export function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

// Default export for CommonJS compatibility
const validators = {
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

export default validators;
