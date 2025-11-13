/**
 * Documents Explorer - Permissions Module
 *
 * Document-specific permission checking logic
 * Builds on auth-helpers.ts with granular document access control
 *
 * @module explorer/permissions
 */

import type { Document, UserRole } from './types';
import { getUserRole, isAdmin } from '../../../utils/auth-helpers';

/**
 * Permissions Manager
 * Handles all document-level permission checks
 */
class PermissionsManager {
  /**
   * Check if user can view a specific document
   * Rules:
   * - Root/Admin can view all documents
   * - Employees can view documents where they are the recipient
   * - Company-wide documents are visible to all
   *
   * @param document - Document to check
   * @param userId - Current user's ID (optional, fetched from session if not provided)
   * @returns true if user can view document
   */
  public canViewDocument(document: Document, userId?: number): boolean {
    const role = getUserRole();

    // Not authenticated - cannot view
    if (role === null) {
      return false;
    }

    // Root and Admin can view all documents
    if (role === 'root' || role === 'admin') {
      return true;
    }

    // Company-wide documents are visible to all authenticated users
    if (document.accessScope === 'company') {
      return true;
    }

    // For personal/payroll documents, check if user is the owner
    // Note: This is a simplified check - backend should provide full access validation
    if (
      userId !== undefined &&
      (document.accessScope === 'personal' || document.accessScope === 'payroll') &&
      document.ownerUserId === userId
    ) {
      return true;
    }

    // For team/department, we would need additional context about user's memberships
    // This should be validated by the backend API
    // Frontend will rely on backend filtering for now

    // Default to true for employees - backend filters documents appropriately
    // This prevents hiding documents due to missing client-side context
    // At this point, role can only be 'employee' since we've handled null, 'root', and 'admin'
    return true;
  }

  /**
   * Check if user can delete a document
   * Rules:
   * - Only Root and Admin can delete documents
   * - Employees cannot delete any documents
   *
   * @returns true if user can delete documents
   */
  public canDeleteDocument(): boolean {
    return isAdmin();
  }

  /**
   * Check if user can upload documents
   * Rules:
   * - Only Root and Admin can upload documents
   * - Employees cannot upload documents
   *
   * @returns true if user can upload documents
   */
  public canUploadDocuments(): boolean {
    return isAdmin();
  }

  /**
   * Check if user can download a document
   * Rules:
   * - All authenticated users can download documents they can view
   *
   * @param document - Document to download
   * @param userId - Current user's ID (optional)
   * @returns true if user can download document
   */
  public canDownloadDocument(document: Document, userId?: number): boolean {
    // Download permission is same as view permission
    return this.canViewDocument(document, userId);
  }

  /**
   * Check if user can mark document as read
   * Rules:
   * - All authenticated users can mark documents as read
   * - Only for documents they can view
   *
   * @param document - Document to mark as read
   * @param userId - Current user's ID (optional)
   * @returns true if user can mark document as read
   */
  public canMarkAsRead(document: Document, userId?: number): boolean {
    // Mark as read permission is same as view permission
    return this.canViewDocument(document, userId);
  }

  /**
   * Validate upload recipient selection
   * Rules:
   * - Root can upload to any recipient type
   * - Admin can upload to any recipient type
   * - Validates that recipientId is provided for non-company uploads
   *
   * @param recipientType - Type of recipient (personal/team/department/company)
   * @param recipientId - ID of recipient (null for company-wide)
   * @returns Validation result with error message if invalid
   */
  public validateUploadRecipient(
    recipientType: string,
    recipientId: number | null,
  ): { valid: boolean; error?: string } {
    // Check upload permission
    if (!this.canUploadDocuments()) {
      return {
        valid: false,
        error: 'Sie haben keine Berechtigung, Dokumente hochzuladen',
      };
    }

    // Validate recipient type
    const validTypes = ['personal', 'team', 'department', 'company'];
    if (!validTypes.includes(recipientType)) {
      return {
        valid: false,
        error: 'Ungültiger Empfängertyp',
      };
    }

    // Company-wide uploads don't need a recipient ID
    if (recipientType === 'company') {
      return { valid: true };
    }

    // All other types require a recipient ID
    if (recipientId === null) {
      return {
        valid: false,
        error: 'Bitte wählen Sie einen Empfänger aus',
      };
    }

    // Validate that recipientId is a positive integer
    if (!Number.isInteger(recipientId) || recipientId <= 0) {
      return {
        valid: false,
        error: 'Ungültige Empfänger-ID',
      };
    }

    return { valid: true };
  }

  /**
   * Get allowed recipient types for current user
   * Rules:
   * - Root can upload to all types
   * - Admin can upload to all types
   * - Employees cannot upload (empty array)
   *
   * @returns Array of allowed recipient types
   */
  public getAllowedRecipientTypes(): string[] {
    const role = getUserRole();

    if (role === null) {
      return [];
    }

    // Root and Admin can upload to all recipient types
    if (role === 'root' || role === 'admin') {
      return ['personal', 'team', 'department', 'company'];
    }

    // Employees cannot upload
    return [];
  }

  /**
   * Check if user can access upload functionality
   * Alias for canUploadDocuments() for semantic clarity in UI code
   *
   * @returns true if user can access upload UI
   */
  public canAccessUploadUI(): boolean {
    return this.canUploadDocuments();
  }

  /**
   * Check if user can see admin action menus (delete, edit, etc.)
   * Rules:
   * - Only Root and Admin can see action menus
   *
   * @returns true if user can see action menus
   */
  public canSeeActionMenu(): boolean {
    return isAdmin();
  }

  /**
   * Get permission summary for current user
   * Useful for debugging and UI state management
   *
   * @returns Object with all permission flags
   */
  public getPermissionSummary(): {
    role: UserRole | null;
    canUpload: boolean;
    canDelete: boolean;
    canSeeActions: boolean;
    allowedRecipientTypes: string[];
  } {
    const role = getUserRole();

    return {
      role,
      canUpload: this.canUploadDocuments(),
      canDelete: this.canDeleteDocument(),
      canSeeActions: this.canSeeActionMenu(),
      allowedRecipientTypes: this.getAllowedRecipientTypes(),
    };
  }

  /**
   * Validate document category
   * Ensures category is valid before upload
   *
   * @param category - Document category
   * @returns Validation result with error message if invalid
   */
  public validateCategory(category: string): { valid: boolean; error?: string } {
    if (category === '') {
      return {
        valid: false,
        error: 'Bitte wählen Sie eine Kategorie aus',
      };
    }

    // Backend defines valid categories - this is a basic check
    // Full validation happens on backend
    const minLength = 1;
    const maxLength = 100;

    if (category.length < minLength || category.length > maxLength) {
      return {
        valid: false,
        error: `Kategorie muss zwischen ${minLength} und ${maxLength} Zeichen lang sein`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate year selection
   * Ensures year is reasonable for document upload
   *
   * @param year - Document year
   * @returns Validation result with error message if invalid
   */
  public validateYear(year: number): { valid: boolean; error?: string } {
    // Year is typed as number, so null/undefined check is not needed
    // Only check if it's an integer
    if (!Number.isInteger(year)) {
      return {
        valid: false,
        error: 'Bitte wählen Sie ein Jahr aus',
      };
    }

    // Allow documents from 1900 to 5 years in the future
    const currentYear = new Date().getFullYear();
    const minYear = 1900;
    const maxYear = currentYear + 5;

    if (year < minYear || year > maxYear) {
      return {
        valid: false,
        error: `Jahr muss zwischen ${minYear} und ${maxYear} liegen`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate month selection
   * Ensures month is valid (1-12) if provided
   *
   * @param month - Document month (1-12, or null for no month)
   * @returns Validation result with error message if invalid
   */
  public validateMonth(month: number | null): { valid: boolean; error?: string } {
    // Month is optional - null is valid
    if (month === null) {
      return { valid: true };
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return {
        valid: false,
        error: 'Monat muss zwischen 1 und 12 liegen',
      };
    }

    return { valid: true };
  }

  /**
   * Validate file for upload
   * Checks file type, size, and name
   *
   * @param file - File to validate
   * @param maxSizeMB - Maximum file size in MB (default: 5)
   * @returns Validation result with error message if invalid
   */
  public validateFile(file: File, maxSizeMB: number = 5): { valid: boolean; error?: string } {
    // File is typed as File, so it cannot be null/undefined due to TypeScript type checking
    // If we need to check for missing file, the parameter should be File | null | undefined

    // Check file type - only PDF allowed
    if (file.type !== 'application/pdf') {
      return {
        valid: false,
        error: 'Nur PDF-Dateien sind erlaubt',
      };
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `Datei ist zu groß. Maximale Größe: ${maxSizeMB} MB`,
      };
    }

    // Check file name - file.name is always a string in File objects
    if (file.name === '') {
      return {
        valid: false,
        error: 'Dateiname ist ungültig',
      };
    }

    // Check for potentially dangerous file names
    // Prevent path traversal and other injection attempts
    const dangerousChars = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*'];
    const hasDangerousChars = dangerousChars.some((char) => file.name.includes(char));

    if (hasDangerousChars) {
      return {
        valid: false,
        error: 'Dateiname enthält ungültige Zeichen',
      };
    }

    return { valid: true };
  }

  /**
   * Comprehensive upload validation
   * Validates all upload form data at once
   *
   * @param formData - Upload form data object
   * @returns Validation result with error message if invalid
   */
  public validateUpload(formData: {
    file: File;
    recipientType: string;
    recipientId: number | null;
    category: string;
    year: number;
    month: number | null;
  }): { valid: boolean; error?: string } {
    // Check upload permission
    if (!this.canUploadDocuments()) {
      return {
        valid: false,
        error: 'Sie haben keine Berechtigung, Dokumente hochzuladen',
      };
    }

    // Validate file
    const fileValidation = this.validateFile(formData.file);
    if (!fileValidation.valid) {
      return fileValidation;
    }

    // Validate recipient
    const recipientValidation = this.validateUploadRecipient(formData.recipientType, formData.recipientId);
    if (!recipientValidation.valid) {
      return recipientValidation;
    }

    // Validate category
    const categoryValidation = this.validateCategory(formData.category);
    if (!categoryValidation.valid) {
      return categoryValidation;
    }

    // Validate year
    const yearValidation = this.validateYear(formData.year);
    if (!yearValidation.valid) {
      return yearValidation;
    }

    // Validate month
    const monthValidation = this.validateMonth(formData.month);
    if (!monthValidation.valid) {
      return monthValidation;
    }

    return { valid: true };
  }
}

// Singleton instance
export const permissionsManager = new PermissionsManager();

// Export type for testing/mocking
export type { PermissionsManager };
