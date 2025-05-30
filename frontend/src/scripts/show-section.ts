/**
 * Global showSection function for navigation
 * Used by admin-dashboard and unified-navigation
 */

/**
 * Show a specific section and hide all others
 */
export function showSection(sectionName: string): void {
  console.log(`[ShowSection] Navigating to section: ${sectionName}`);

  // Hide all sections
  const allSections = document.querySelectorAll<HTMLElement>('.content-section, .dashboard-section');
  allSections.forEach((section: HTMLElement) => {
    section.style.display = 'none';
    section.classList.remove('active');
  });

  // Show requested section
  const targetSection = document.getElementById(sectionName);
  if (targetSection) {
    targetSection.style.display = 'block';
    targetSection.classList.add('active');

    // Update navigation active state
    const navItems = document.querySelectorAll<HTMLElement>('.nav-item');
    navItems.forEach((item: HTMLElement) => {
      item.classList.remove('active');
      if (item.getAttribute('data-section') === sectionName) {
        item.classList.add('active');
      }
    });

    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set('section', sectionName);
    window.history.pushState({ section: sectionName }, '', url);

    console.log(`[ShowSection] Section ${sectionName} displayed`);
  } else {
    console.error(`[ShowSection] Section ${sectionName} not found`);
  }
}

// Check URL on page load and show appropriate section
export function initSectionFromURL(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section');

  if (section) {
    // Use setTimeout to ensure all other scripts have initialized
    setTimeout(() => {
      showSection(section);
    }, 100);
  }
}

// Initialize on DOM load with a delay to ensure all content is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit to ensure all dynamic content is loaded
  setTimeout(() => {
    initSectionFromURL();
  }, 200);
});

// Make showSection globally available
if (typeof window !== 'undefined') {
  (window as any).showSection = showSection;
  (window as any).initSectionFromURL = initSectionFromURL;
}
