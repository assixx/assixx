/**
 * Reparatur für das Mitarbeiter-Modal
 * 
 * Dieses Script behebt das Problem mit dem "Neuer Mitarbeiter"-Button
 * und stellt sicher, dass das Modal korrekt angezeigt wird.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Fix] Mitarbeiter-Modal Fix geladen');
    
    // 1. Direkten Zugriff auf die relevanten Elemente
    const employeeModal = document.getElementById('employee-modal');
    const newEmployeeBtn = document.getElementById('new-employee-button');
    const employeesSectionNewBtn = document.getElementById('employees-section-new-button');
    const closeEmployeeModalBtn = document.getElementById('close-employee-modal');
    const cancelEmployeeBtn = document.getElementById('cancel-employee-button');
    
    // Logging der gefundenen Elemente
    console.log('[Fix] Elemente gefunden:', {
        employeeModal: !!employeeModal,
        newEmployeeBtn: !!newEmployeeBtn,
        employeesSectionNewBtn: !!employeesSectionNewBtn,
        closeEmployeeModalBtn: !!closeEmployeeModalBtn,
        cancelEmployeeBtn: !!cancelEmployeeBtn
    });
    
    // 2. Definiere eine einzelne, klare Funktion zum Anzeigen des Modals
    function openEmployeeModal() {
        console.log('[Fix] openEmployeeModal aufgerufen');
        if (employeeModal) {
            console.log('[Fix] Zeige Modal an');
            employeeModal.style.display = 'flex';
            
            // Formular zurücksetzen, falls es bereits benutzt wurde
            const form = document.getElementById('create-employee-form');
            if (form) {
                form.reset();
                
                // Fehler-Anzeigen zurücksetzen
                const emailError = document.getElementById('email-error');
                const passwordError = document.getElementById('password-error');
                
                if (emailError) emailError.style.display = 'none';
                if (passwordError) passwordError.style.display = 'none';
            }
            
            // Abteilungen für das Formular laden
            if (typeof loadDepartmentsForEmployeeSelect === 'function') {
                loadDepartmentsForEmployeeSelect();
            }
        } else {
            console.error('[Fix] employee-modal nicht gefunden!');
        }
    }
    
    // 3. Funktion zum Schließen des Modals
    function closeEmployeeModal() {
        console.log('[Fix] closeEmployeeModal aufgerufen');
        if (employeeModal) {
            console.log('[Fix] Schließe Modal');
            employeeModal.style.display = 'none';
        }
    }
    
    // 4. Event-Listener für alle relevanten Elemente hinzufügen
    
    // Öffnen-Buttons
    if (newEmployeeBtn) {
        console.log('[Fix] Event-Listener für newEmployeeBtn hinzugefügt');
        newEmployeeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Fix] newEmployeeBtn geklickt');
            openEmployeeModal();
        });
    }
    
    if (employeesSectionNewBtn) {
        console.log('[Fix] Event-Listener für employeesSectionNewBtn hinzugefügt');
        employeesSectionNewBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Fix] employeesSectionNewBtn geklickt');
            openEmployeeModal();
        });
    }
    
    // Schließen-Elemente
    if (closeEmployeeModalBtn) {
        console.log('[Fix] Event-Listener für closeEmployeeModalBtn hinzugefügt');
        closeEmployeeModalBtn.addEventListener('click', closeEmployeeModal);
    }
    
    if (cancelEmployeeBtn) {
        console.log('[Fix] Event-Listener für cancelEmployeeBtn hinzugefügt');
        cancelEmployeeBtn.addEventListener('click', closeEmployeeModal);
    }
    
    // Klick außerhalb des Modals
    if (employeeModal) {
        console.log('[Fix] Event-Listener für Klick außerhalb hinzugefügt');
        employeeModal.addEventListener('click', function(e) {
            if (e.target === employeeModal) {
                closeEmployeeModal();
            }
        });
    }
    
    // 5. Globale Funktion für den direkten HTML-onclick-Aufruf
    window.showEmployeeModal = function() {
        console.log('[Fix] Globale showEmployeeModal aufgerufen');
        openEmployeeModal();
    };
    
    // 6. Andere Funktionen überschreiben
    window.showNewEmployeeModal = function() {
        console.log('[Fix] showNewEmployeeModal-Überschreibung aufgerufen');
        openEmployeeModal();
    };
    
    console.log('[Fix] Mitarbeiter-Modal Fix vollständig installiert');
});