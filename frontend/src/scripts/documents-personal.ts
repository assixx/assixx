/**
 * Personal Documents Page
 * Shows documents with scope='personal'
 */

import { DocumentBase } from './document-base';

// Initialize personal documents page
document.addEventListener('DOMContentLoaded', () => {
  const personalPage = new DocumentBase('personal', 'Persönliche Dokumente', 'Dokumente nur für Sie sichtbar', false);
  void personalPage.initialize();
});
