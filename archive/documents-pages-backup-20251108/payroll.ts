/**
 * Payroll Documents Page
 * Shows documents with category='salary'
 */

import { DocumentBase } from './base';

// Initialize payroll documents page
document.addEventListener('DOMContentLoaded', () => {
  const payrollPage = new DocumentBase(
    'payroll',
    'Gehaltsabrechnungen',
    'Ihre persönlichen Gehaltsabrechnungen',
    false,
  );
  void payrollPage.initialize();
});
