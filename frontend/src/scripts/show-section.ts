/**
 * Global showSection function for navigation
 * Used by admin-dashboard and unified-navigation
 */

/**
 * Show a specific section and hide all others
 */
export function showSection(sectionName: string): void {
  console.info(`[ShowSection] Navigating to section: ${sectionName}`);

  // Hide all sections
  const allSections = document.querySelectorAll<HTMLElement>('.content-section, .dashboard-section');
  allSections.forEach((section: HTMLElement) => {
    section.style.display = 'none';
    section.classList.remove('active');
  });

  // Show requested section
  // Check if sectionName already contains '-section'
  let sectionId = sectionName;
  if (!sectionName.endsWith('-section')) {
    sectionId = `${sectionName}-section`;
  }

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.style.display = 'block';
    targetSection.classList.add('active');

    // Update navigation active state
    const navItems = document.querySelectorAll<HTMLElement>('.nav-item');
    navItems.forEach((item: HTMLElement) => {
      item.classList.remove('active');
      // Compare with original sectionName (without -section)
      const itemSection = item.getAttribute('data-section');
      if (itemSection === sectionName || itemSection === sectionId) {
        item.classList.add('active');
      }
    });

    // Update URL with query parameter
    const url = new URL(window.location.href);
    url.searchParams.set('section', sectionName);
    window.history.replaceState({ section: sectionId }, '', url.toString());

    console.info(`[ShowSection] Section ${sectionId} displayed`);

    // Load section-specific data (with small delay to ensure functions are loaded)
    setTimeout(() => {
      const sectionBaseName = sectionName.replace('-section', '');
      switch (sectionBaseName) {
        case 'employees':
          if (typeof (window as any).loadEmployeesTable === 'function') {
            console.info('[ShowSection] Calling loadEmployeesTable');
            (window as any).loadEmployeesTable();
          } else {
            console.warn('[ShowSection] loadEmployeesTable function not found');
          }
          break;
        case 'documents':
          if (typeof (window as any).loadDocumentsTable === 'function') {
            (window as any).loadDocumentsTable();
          }
          break;
        case 'payslips':
          if (typeof (window as any).loadPayslipsTable === 'function') {
            (window as any).loadPayslipsTable();
          }
          if (typeof (window as any).loadEmployeesForPayslipSelect === 'function') {
            (window as any).loadEmployeesForPayslipSelect();
          }
          break;
        case 'departments':
          if (typeof (window as any).loadDepartmentsTable === 'function') {
            (window as any).loadDepartmentsTable();
          }
          break;
        case 'teams':
          if (typeof (window as any).loadTeamsTable === 'function') {
            (window as any).loadTeamsTable();
          }
          break;
      }
    }, 100);
  } else {
    console.error(`[ShowSection] Section ${sectionId} not found`);
  }
}

// Check URL on page load and show appropriate section
export function initSectionFromURL(): void {
  // Check query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section');

  if (section) {
    showSection(section);
  }
}

// Initialize on DOM load with a delay to ensure all content is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit to ensure all dynamic content is loaded
  setTimeout(() => {
    initSectionFromURL();
  }, 50);
});

// Extend window for show section functions
declare global {
  interface Window {
    showSection: typeof showSection;
    initSectionFromURL: typeof initSectionFromURL;
  }
}

// Make showSection globally available
if (typeof window !== 'undefined') {
  window.showSection = showSection;
  window.initSectionFromURL = initSectionFromURL;
}
