/**
 * Critical Sidebar Initialization
 * MUST run synchronously before DOM render to prevent layout shift
 * This affects Core Web Vitals (CLS score)
 */
(function () {
  'use strict';

  // Get stored sidebar state
  const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

  // Set HTML attribute for CSS selectors
  document.documentElement.setAttribute('data-sidebar', sidebarCollapsed ? 'collapsed' : 'expanded');

  // Set CSS custom properties for immediate layout calculation
  // These MUST be set before first paint to prevent layout shift
  const root = document.documentElement.style;

  if (sidebarCollapsed) {
    // Collapsed state
    root.setProperty('--sidebar-width', '60px');
    root.setProperty('--content-margin', '60px');
    root.setProperty('--grid-columns', '4');
    root.setProperty('--widget-columns', '5');
    root.setProperty('--card-padding', '2rem');
  } else {
    // Expanded state
    root.setProperty('--sidebar-width', '250px');
    root.setProperty('--content-margin', '250px');
    root.setProperty('--grid-columns', '3');
    root.setProperty('--widget-columns', '3');
    root.setProperty('--card-padding', '1.5rem');
  }
})();
