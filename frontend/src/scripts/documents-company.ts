/**
 * Company Documents Page
 * Shows documents with scope='company'
 */

import { DocumentBase } from './document-base';

// Initialize company documents page
document.addEventListener('DOMContentLoaded', () => {
  const companyPage = new DocumentBase('company', 'Firmendokumente', 'Dokumente die für alle Mitarbeiter sichtbar sind', false);
  companyPage.initialize();
});