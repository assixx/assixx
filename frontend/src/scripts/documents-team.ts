/**
 * Team Documents Page
 * Shows documents with scope='team'
 */

import { DocumentBase } from './document-base';

// Initialize team documents page
document.addEventListener('DOMContentLoaded', () => {
  const teamPage = new DocumentBase('team', 'Teamdokumente', 'Dokumente für Ihr Team', false);
  teamPage.initialize();
});
