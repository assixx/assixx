/**
 * Helper Functions
 * Common utility functions used across the application
 */

const crypto = require('crypto');
const { PAGINATION } = require('./constants');

/**
 * Generate a random string
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Parse pagination parameters
 * @param {Object} query - Query parameters
 * @returns {Object} Parsed pagination object
 */
function parsePagination(query) {
  const page = parseInt(query.page) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(
    parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Format pagination response
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
function formatPaginationResponse(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

/**
 * Sanitize user input
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
}

/**
 * Generate slug from string
 * @param {string} text - Text to slugify
 * @returns {string} Slug
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces with -
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing -
}

/**
 * Format date for display
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format datetime for display
 * @param {Date} date - Date object
 * @returns {string} Formatted datetime string
 */
function formatDateTime(date) {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calculate percentage
 * @param {number} value - Current value
 * @param {number} total - Total value
 * @returns {number} Percentage
 */
function calculatePercentage(value, total) {
  if (!total || total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Deep clone object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} True if empty
 */
function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

/**
 * Group array by key
 * @param {Array} array - Array to group
 * @param {string} key - Key to group by
 * @returns {Object} Grouped object
 */
function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}

/**
 * Remove duplicate objects from array
 * @param {Array} array - Array with potential duplicates
 * @param {string} key - Key to check for duplicates
 * @returns {Array} Array without duplicates
 */
function removeDuplicates(array, key) {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

module.exports = {
  generateRandomString,
  parsePagination,
  formatPaginationResponse,
  sanitizeInput,
  generateSlug,
  formatDate,
  formatDateTime,
  calculatePercentage,
  deepClone,
  isEmpty,
  groupBy,
  removeDuplicates
};