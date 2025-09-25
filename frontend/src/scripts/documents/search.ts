/**
 * Documents Search Page
 * Global search across all documents
 */

import { DocumentBase } from './base';

// Initialize search page
document.addEventListener('DOMContentLoaded', () => {
  const searchPage = new DocumentBase('all', 'Dokumente suchen', 'Durchsuchen Sie alle verfügbaren Dokumente', true);
  void searchPage.initialize();
});
