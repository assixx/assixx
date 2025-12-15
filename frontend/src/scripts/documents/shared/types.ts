/**
 * Documents Shared Types
 * Common type definitions for all document pages
 */

import type { Document } from '../../../types/api.types';

/**
 * Document scope filter
 */
export type DocumentScope = 'all' | 'company' | 'department' | 'team' | 'personal' | 'payroll';

/**
 * Sort options for documents
 */
export type SortOption = 'newest' | 'oldest' | 'name' | 'size';

/**
 * View mode for documents (active/archived/all)
 */
export type ViewMode = 'active' | 'archived' | 'all';

/**
 * Re-export Document type from api.types
 */
export type { Document };
