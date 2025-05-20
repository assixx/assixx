// Modal-Debug-Helfer

// Bei DOMContentLoaded ausführen
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Modal Debug] Script geladen');
    
    // Alle Modals erfassen
    const modals = document.querySelectorAll('.modal');
    console.log(`[Modal Debug] ${modals.length} Modals gefunden`);
    
    // Für jedes Modal Event-Listener für direkte Schließelemente hinzufügen
    modals.forEach(modal => {
        console.log(`[Modal Debug] Modal gefunden: ${modal.id}`);
        
        // X-Button oben rechts
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            console.log(`[Modal Debug] Schließen-Button für ${modal.id} gefunden`);
            closeBtn.addEventListener('click', function() {
                console.log(`[Modal Debug] Schließen-Button für ${modal.id} geklickt`);
                modal.style.display = 'none';
            });
        } else {
            console.warn(`[Modal Debug] Kein Schließen-Button für ${modal.id} gefunden`);
        }
        
        // Abbrechen-Buttons im Modal
        const cancelBtns = modal.querySelectorAll('button.btn-secondary');
        cancelBtns.forEach(btn => {
            if (btn.textContent.trim() === 'Abbrechen') {
                console.log(`[Modal Debug] Abbrechen-Button in ${modal.id} gefunden`);
                btn.addEventListener('click', function() {
                    console.log(`[Modal Debug] Abbrechen-Button in ${modal.id} geklickt`);
                    modal.style.display = 'none';
                });
            }
        });
        
        // Klick außerhalb des Modals
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                console.log(`[Modal Debug] Außerhalb von ${modal.id} geklickt`);
                modal.style.display = 'none';
            }
        });
    });
    
    // Modal-Test-Funktionen im globalen Scope verfügbar machen
    window.debugShowModal = function(modalId) {
        console.log(`[Modal Debug] Zeige Modal ${modalId}`);
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        } else {
            console.error(`[Modal Debug] Modal ${modalId} nicht gefunden`);
        }
    };
    
    window.debugHideModal = function(modalId) {
        console.log(`[Modal Debug] Verstecke Modal ${modalId}`);
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        } else {
            console.error(`[Modal Debug] Modal ${modalId} nicht gefunden`);
        }
    };
});