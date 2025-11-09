/**
 * Documents Search Page
 * Global search across all documents
 */

import { initialize } from './search/index';

// Initialize search page
document.addEventListener('DOMContentLoaded', () => {
  void initialize();
});
