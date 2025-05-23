/**
 * Global showSection function for navigation
 * Used by admin-dashboard and unified-navigation
 */

// Make showSection globally available
window.showSection = function(sectionName) {
    console.log(`[ShowSection] Navigating to section: ${sectionName}`);
    
    // Hide all sections
    const allSections = document.querySelectorAll('.dashboard-section');
    allSections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    
    // Show requested section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
        
        // Update navigation active state
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-section') === sectionName) {
                item.classList.add('active');
            }
        });
        
        // Update URL without page reload
        const url = new URL(window.location);
        url.searchParams.set('section', sectionName);
        window.history.pushState({section: sectionName}, '', url);
        
        console.log(`[ShowSection] Section ${sectionName} displayed`);
    } else {
        console.error(`[ShowSection] Section ${sectionName} not found`);
    }
};