// Debug-Script für den "Neuer Mitarbeiter"-Button
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Debug] Debug-Script für Mitarbeiter-Button geladen');
    
    // Prüfen ob showModal definiert ist
    if (typeof showModal === 'function') {
        console.log('[Debug] showModal-Funktion ist im globalen Scope verfügbar');
    } else {
        console.log('[Debug] showModal-Funktion ist NICHT im globalen Scope verfügbar');
    }
    
    // Prüfen ob loadDepartmentsForEmployeeSelect definiert ist
    if (typeof loadDepartmentsForEmployeeSelect === 'function') {
        console.log('[Debug] loadDepartmentsForEmployeeSelect-Funktion ist im globalen Scope verfügbar');
    } else {
        console.log('[Debug] loadDepartmentsForEmployeeSelect-Funktion ist NICHT im globalen Scope verfügbar');
    }
    
    // Prüfen ob das Modal existiert
    const employeeModal = document.getElementById('employee-modal');
    if (employeeModal) {
        console.log('[Debug] employee-modal Element gefunden');
    } else {
        console.log('[Debug] employee-modal Element NICHT gefunden');
    }
    
    // Direkter Event-Listener für den Button im Dashboard
    const newEmployeeBtn = document.getElementById('new-employee-button');
    if (newEmployeeBtn) {
        console.log('[Debug] new-employee-button gefunden, füge Debug-Event-Listener hinzu');
        
        // Eigenen Event-Listener hinzufügen
        newEmployeeBtn.addEventListener('click', function(event) {
            console.log('[Debug] new-employee-button wurde geklickt!');
        });
    } else {
        console.log('[Debug] new-employee-button NICHT gefunden');
    }
    
    // Direkter Event-Listener für den Button in der Mitarbeiter-Sektion
    const employeesSectionNewBtn = document.getElementById('employees-section-new-button');
    if (employeesSectionNewBtn) {
        console.log('[Debug] employees-section-new-button gefunden');
    } else {
        console.log('[Debug] employees-section-new-button NICHT gefunden');
    }
});