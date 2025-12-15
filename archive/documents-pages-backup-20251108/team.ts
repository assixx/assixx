/**
 * Team Documents Page
 * Shows documents with scope='team'
 */

import { DocumentBase } from './base';

// Initialize team documents page
document.addEventListener('DOMContentLoaded', () => {
  const teamPage = new DocumentBase('team', 'Teamdokumente', 'Dokumente für Ihr Team', false);
  void teamPage.initialize();
});
