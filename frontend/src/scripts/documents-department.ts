/**
 * Department Documents Page
 * Shows documents with scope='department'
 */

import { DocumentBase } from './document-base';

// Initialize department documents page
document.addEventListener('DOMContentLoaded', () => {
  const departmentPage = new DocumentBase('department', 'Abteilungsdokumente', 'Dokumente für Ihre Abteilung', false);
  departmentPage.initialize();
});
