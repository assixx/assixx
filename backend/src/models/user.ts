/**
 * User Model - Wrapper for backward compatibility
 * This file re-exports everything from the modular user directory
 * Ensures all existing imports continue to work without changes
 */

// Re-export everything from the modular user directory
export * from './user/index.js';
export { default } from './user/index.js';
