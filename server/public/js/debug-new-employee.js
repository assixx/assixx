// Debug script for testing the New Employee button
console.log('Debug script loaded');

// Check if the button exists
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded in debug script');
    
    // Look for the button
    const newEmployeeBtn = document.getElementById('new-employee-button');
    console.log('newEmployeeBtn found:', newEmployeeBtn);
    
    if (newEmployeeBtn) {
        // Add a debug click handler
        newEmployeeBtn.addEventListener('click', (e) => {
            console.log('DEBUG: New employee button clicked');
            
            // Check if modal exists 
            const modal = document.getElementById('employee-modal');
            console.log('employee-modal element:', modal);
            
            // Look for the function
            console.log('showModal function exists:', typeof window.showModal);
            
            // Check loadDepartmentsForEmployeeSelect
            console.log('loadDepartmentsForEmployeeSelect exists:', 
                typeof window.loadDepartmentsForEmployeeSelect);
        });
    }
    
    // Create a breakpoint function we can call
    window.testButtonClick = function() {
        const newEmployeeBtn = document.getElementById('new-employee-button');
        if (newEmployeeBtn) {
            console.log('Simulating click on new employee button');
            newEmployeeBtn.click();
        } else {
            console.error('Button not found for simulated click');
        }
    };
    
    // Also set a breakpoint on line 36 of admin-dashboard.js
    const originalShowModal = window.showModal;
    if (typeof originalShowModal === 'function') {
        window.showModal = function(modalId) {
            console.log('showModal called with:', modalId);
            return originalShowModal(modalId);
        };
    }
});