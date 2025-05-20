/**
 * Dashboard-Navigation Fix
 * 
 * Dieses Script behebt Probleme mit den Navigationslinks im Admin-Dashboard
 * und stellt sicher, dass alle "Verwalten"-Links korrekt funktionieren.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Fix] Dashboard-Navigation Fix geladen');
    
    // 1. Referenzen auf die Verwaltungs-Links
    const manageEmployeesLink = document.getElementById('manage-employees-link');
    const manageDocumentsLink = document.getElementById('manage-documents-link');
    const manageDepartmentsLink = document.getElementById('manage-departments-link');
    
    // Logging der gefundenen Elemente
    console.log('[Fix] Verwaltungs-Links gefunden:', {
        manageEmployeesLink: !!manageEmployeesLink,
        manageDocumentsLink: !!manageDocumentsLink,
        manageDepartmentsLink: !!manageDepartmentsLink
    });
    
    // 2. Event-Listener für Mitarbeiter-Verwaltung
    if (manageEmployeesLink) {
        manageEmployeesLink.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('[Fix] Mitarbeiter-Verwaltungslink geklickt');
            
            // Zeige die Mitarbeiter-Sektion
            showSection('employees');
            
            // Lade die Mitarbeitertabelle
            if (typeof loadEmployeesTable === 'function') {
                loadEmployeesTable('all');
            }
            
            // Aktiviere den Mitarbeiter-Tab in der Sidebar
            updateSidebarActiveState('employees');
        });
    }
    
    // 3. Event-Listener für Dokumente-Verwaltung
    if (manageDocumentsLink) {
        manageDocumentsLink.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('[Fix] Dokumente-Verwaltungslink geklickt');
            
            // Zeige die Dokumente-Sektion
            showSection('documents');
            
            // Lade die Dokumententabelle
            if (typeof loadDocumentsTable === 'function') {
                loadDocumentsTable('all');
            }
            
            // Aktiviere den Dokumente-Tab in der Sidebar
            updateSidebarActiveState('documents');
        });
    }
    
    // 4. Hilfsfunktion zum Aktualisieren des aktiven Status in der Sidebar
    function updateSidebarActiveState(sectionName) {
        console.log(`[Fix] Aktualisiere Sidebar-Status für ${sectionName}`);
        
        // Entferne aktiven Status von allen Elementen
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Setze aktiven Status für das entsprechende Element
        document.querySelectorAll('.sidebar-link').forEach(link => {
            if (link.getAttribute('href') === `#${sectionName}`) {
                link.parentElement.classList.add('active');
            }
        });
    }
    
    console.log('[Fix] Dashboard-Navigation Fix vollständig installiert');
});