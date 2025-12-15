/**
 * Navigation Utilities
 * Pure helper functions for formatting and calculations
 */

/**
 * Format seconds to MM:SS display format
 * @param seconds - Remaining seconds
 * @returns Formatted time string (e.g., "05:30")
 */
export function formatTokenTime(seconds: number): string {
  if (seconds <= 0) {
    return '00:00';
  }

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param text - Raw text to escape
 * @returns HTML-safe string
 */
export function escapeHtml(text: string): string {
  const escapeMap = new Map([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#039;'],
  ]);
  return text.replace(/["&'<>]/g, (m) => escapeMap.get(m) ?? m);
}

/**
 * Convert bytes to human-readable format
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 GB';

  const k = 1024;
  const sizesMap = new Map([
    [0, 'B'],
    [1, 'KB'],
    [2, 'MB'],
    [3, 'GB'],
    [4, 'TB'],
  ]);

  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), 4);
  const size = sizesMap.get(i) ?? 'B';
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${size}`;
}

/**
 * Get progress bar color based on percentage
 * @param percentage - Storage usage percentage (0-100)
 * @returns CSS color variable string
 */
export function getProgressBarColor(percentage: number): string {
  if (percentage >= 90) {
    return 'var(--error-color)';
  }
  if (percentage >= 70) {
    return 'var(--warning-color)';
  }
  return 'var(--success-color)';
}

/**
 * Parse JWT token payload from localStorage
 * @returns Decoded token payload or null if invalid
 */
export function parseTokenPayload(): unknown {
  const token = localStorage.getItem('token');
  if (token === null || token === '') {
    return null;
  }

  try {
    const tokenPart = token.split('.')[1];
    if (tokenPart === undefined) return null;
    return JSON.parse(atob(tokenPart)) as unknown;
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
}

/**
 * Check if token is in test mode
 * @returns True if token is test-mode or missing
 */
export function isTestMode(): boolean {
  const token = localStorage.getItem('token');
  return token === null || token === '' || token === 'test-mode';
}

/**
 * Get active role from localStorage with fallback
 * @returns Current active role
 */
export function getActiveRole(): 'admin' | 'employee' | 'root' {
  const activeRole = localStorage.getItem('activeRole');
  const userRole = localStorage.getItem('userRole');

  if (activeRole !== null && ['root', 'admin', 'employee'].includes(activeRole)) {
    return activeRole as 'admin' | 'employee' | 'root';
  }

  if (userRole !== null && ['root', 'admin', 'employee'].includes(userRole)) {
    return userRole as 'admin' | 'employee' | 'root';
  }

  return 'employee';
}

/**
 * Check if current path is a main dashboard page
 * @param path - URL pathname to check
 * @returns True if path is a dashboard
 */
export function isMainDashboardPage(path: string): boolean {
  return path.includes('admin-dashboard') || path.includes('employee-dashboard') || path.includes('root-dashboard');
}
