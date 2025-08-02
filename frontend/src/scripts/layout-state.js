/**
 * Layout State Manager
 * Prevents layout shift by setting sidebar state before CSS loads
 * This should be included inline in the <head> of all dashboard pages
 */

// This function is designed to be copied inline into HTML pages
// It sets CSS custom properties and data attributes based on sidebar state
function initLayoutState() {
  const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  const root = document.documentElement;

  // Set data attribute for CSS selectors
  root.setAttribute('data-sidebar', sidebarCollapsed ? 'collapsed' : 'expanded');

  // Set CSS custom properties for immediate use
  root.style.setProperty('--sidebar-width', sidebarCollapsed ? '60px' : '250px');
  root.style.setProperty('--content-margin', sidebarCollapsed ? '60px' : '250px');
  root.style.setProperty('--grid-columns', sidebarCollapsed ? '4' : '3');
  root.style.setProperty('--widget-columns', sidebarCollapsed ? '5' : '3');
  root.style.setProperty('--card-padding', sidebarCollapsed ? '2rem' : '1.5rem');
  root.style.setProperty('--container-max-width', sidebarCollapsed ? '100%' : 'calc(100% - 20px)');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initLayoutState };
}
