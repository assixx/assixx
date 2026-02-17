// =============================================================================
// DOCUMENTS EXPLORER - FILTER FUNCTIONS (Pure Functions)
// =============================================================================

import type {
  Document,
  DocumentCategory,
  SortOption,
  CategoryCounts,
} from './types';

/**
 * Filter documents by category
 * Direct 1:1 mapping with accessScope
 */
export function filterByCategory(
  documents: Document[],
  category: DocumentCategory,
): Document[] {
  if (category === 'all') {
    return documents;
  }
  return documents.filter((doc) => doc.accessScope === category);
}

/**
 * Get search score for document (Windows Explorer style)
 * Higher score = better match
 *
 * Scoring:
 * - 100: Filename starts with query (highest priority)
 * - 50: Filename contains query
 * - 25: Category/uploader/metadata contains query
 * - 0: No match
 */
function getSearchScore(doc: Document, query: string): number {
  const filenameLower = doc.filename.toLowerCase();
  const categoryLower = doc.category.toLowerCase();
  const uploaderLower = doc.uploaderName.toLowerCase();

  // Highest priority: Filename starts with query
  if (filenameLower.startsWith(query)) {
    return 100;
  }

  // High priority: Filename contains query
  if (filenameLower.includes(query)) {
    return 50;
  }

  // Medium priority: Category or uploader contains query
  if (categoryLower.includes(query) || uploaderLower.includes(query)) {
    return 25;
  }

  // No match
  return 0;
}

/**
 * Filter documents by search query (Windows Explorer style with scoring)
 * Searches in: filename, category, uploader
 * Results are sorted by relevance score
 */
export function filterBySearch(
  documents: Document[],
  query: string,
): Document[] {
  const term = query.toLowerCase().trim();
  if (!term) return documents;

  // Score each document and filter out non-matches (score = 0)
  const scoredDocs = documents
    .map((doc) => ({
      doc,
      score: getSearchScore(doc, term),
    }))
    .filter((item) => item.score > 0);

  // Sort by score (highest first)
  scoredDocs.sort((a, b) => b.score - a.score);

  return scoredDocs.map((item) => item.doc);
}

/**
 * Sort documents by specified option
 */
export function sortDocuments(
  documents: Document[],
  sortOption: SortOption,
): Document[] {
  const sorted = [...documents];

  switch (sortOption) {
    case 'newest':
      sorted.sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      );
      break;
    case 'oldest':
      sorted.sort(
        (a, b) =>
          new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
      );
      break;
    case 'name':
      sorted.sort((a, b) => a.filename.localeCompare(b.filename, 'de'));
      break;
    case 'size':
      sorted.sort((a, b) => b.size - a.size);
      break;
  }

  return sorted;
}

/** Apply all filters in sequence */
export function applyAllFilters(
  documents: Document[],
  category: DocumentCategory,
  searchQuery: string,
  sortOption: SortOption,
): Document[] {
  let result = filterByCategory(documents, category);
  result = filterBySearch(result, searchQuery);
  result = sortDocuments(result, sortOption);
  return result;
}

/**
 * Calculate document counts per category
 * Direct 1:1 mapping with accessScope
 */
export function calculateCategoryCounts(documents: Document[]): CategoryCounts {
  const counts: CategoryCounts = {
    all: documents.length,
    personal: 0,
    team: 0,
    department: 0,
    company: 0,
    payroll: 0,
    blackboard: 0,
    chat: 0,
  };

  documents.forEach((doc) => {
    switch (doc.accessScope) {
      case 'personal':
        counts.personal++;
        break;
      case 'team':
        counts.team++;
        break;
      case 'department':
        counts.department++;
        break;
      case 'company':
        counts.company++;
        break;
      case 'payroll':
        counts.payroll++;
        break;
      case 'blackboard':
        counts.blackboard++;
        break;
      case 'chat':
        counts.chat++;
        break;
    }
  });

  return counts;
}

/**
 * Calculate document stats (total, unread, this week)
 */
export function calculateStats(documents: Document[]): {
  total: number;
  unread: number;
  thisWeek: number;
} {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let unread = 0;
  let thisWeek = 0;

  documents.forEach((doc) => {
    if (!doc.isRead) unread++;
    if (new Date(doc.uploadedAt) >= weekAgo) thisWeek++;
  });

  return {
    total: documents.length,
    unread,
    thisWeek,
  };
}
