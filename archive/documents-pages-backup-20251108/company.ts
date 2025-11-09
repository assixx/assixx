/**
 * Company Documents Page
 * Shows documents with scope='company'
 */

import { DocumentBase } from './base';

// Initialize company documents page
document.addEventListener('DOMContentLoaded', () => {
  const companyPage = new DocumentBase(
    'company',
    'Firmendokumente',
    'Dokumente die für alle Mitarbeiter sichtbar sind',
    false,
  );
  void companyPage.initialize();
});
