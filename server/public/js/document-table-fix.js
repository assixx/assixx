/**
 * Fix für die Dokumententabelle, um Event-Listener korrekt zu registrieren
 * Dieses Script umgeht die CSP-Beschränkungen, indem es die
 * Event-Listener direkt an die Tabellenzellen anhängt
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Document Fix] Document table fix script loaded');
    
    // Funktion zum Hinzufügen der Event-Listener zur Dokumententabelle
    function setupDocumentTableListeners() {
        console.log('[Document Fix] Setting up document table listeners');
        
        const tableBody = document.getElementById('documents-table-body');
        if (!tableBody) {
            console.warn('[Document Fix] documents-table-body not found, will try again later');
            return false;
        }
        
        // Vermeiden von doppelten Event-Aufrufen
        let lastClickTime = 0;
        let lastClickedButtonId = null;
        
        // Event-Delegation für die gesamte Tabelle
        tableBody.addEventListener('click', function(event) {
            // Verhindern von Doppelklicks (Debouncing)
            const now = Date.now();
            
            // Finde den nächsten Button-Vorfahren vom geklickten Element
            const button = event.target.closest('button');
            if (!button) return; // Wenn kein Button geklickt wurde, nichts tun
            
            // Versuche, die Dokument-ID aus dem Button zu extrahieren
            let documentId = button.getAttribute('data-document-id');
            
            // Wenn keine ID im data-Attribut, versuche sie aus dem onclick-Attribut zu extrahieren
            if (!documentId && button.getAttribute('onclick')) {
                const onclickValue = button.getAttribute('onclick');
                const match = onclickValue.match(/\((\d+)/);
                if (match && match[1]) {
                    documentId = match[1];
                }
            }
            
            if (!documentId) {
                console.error('[Document Fix] Could not determine document ID');
                return;
            }
            
            // Generiere eine eindeutige ID für den Button
            const buttonId = documentId + '-' + 
                         (button.classList.contains('btn-danger') ? 'delete' : 
                          button.classList.contains('btn-primary') ? 'download' : 
                          button.classList.contains('btn-warning') || button.classList.contains('btn-info') ? 'toggle' : 'unknown');
            
            // Debouncing: Ignoriere Klicks, die zu schnell hintereinander erfolgen
            if (now - lastClickTime < 1000 && buttonId === lastClickedButtonId) {
                console.log('[Document Fix] Debouncing: ignoring too fast click');
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            
            lastClickTime = now;
            lastClickedButtonId = buttonId;
            
            // Verhindere Standardverhalten (z.B. Form-Submit)
            event.preventDefault();
            
            console.log(`[Document Fix] Button clicked for document ID: ${documentId}`);
            
            // Temporär Button deaktivieren, um Mehrfachklicks zu verhindern
            button.disabled = true;
            button.classList.add('processing');
            
            setTimeout(() => {
                // Bestimme Aktion basierend auf Button-Klasse oder Text
                if (button.classList.contains('btn-danger') || button.textContent.trim() === 'Löschen') {
                    console.log(`[Document Fix] Delete button clicked for document ID: ${documentId}`);
                    
                    // Nur einmal bestätigen, ohne ID
                    if (confirm(`Dokument wirklich löschen?`)) {
                        // Button deaktiviert lassen und Lock setzen, um weitere Anfragen zu verhindern
                        if (!deleteInProgress[documentId]) {
                            deleteDocumentById(documentId);
                        } else {
                            console.log('[Document Fix] Delete operation already in progress');
                        }
                    } else {
                        // Wenn abgebrochen, Button wieder aktivieren
                        button.disabled = false;
                        button.classList.remove('processing');
                    }
                } 
                else if (button.classList.contains('btn-primary') || button.textContent.trim() === 'Download') {
                    console.log(`[Document Fix] Download button clicked for document ID: ${documentId}`);
                    downloadDocument(documentId);
                    
                    // Download deaktiviert nicht die Tabelle, also Button wieder aktivieren
                    button.disabled = false;
                    button.classList.remove('processing');
                }
                else if (button.classList.contains('btn-warning') || button.classList.contains('btn-info')) {
                    console.log(`[Document Fix] Toggle archive button clicked for document ID: ${documentId}`);
                    const isArchived = button.textContent.trim().includes('Wiederherstellen');
                    toggleDocumentArchive(documentId, isArchived);
                    
                    // Button wird nach erfolgreicher Aktion in toggleDocumentArchive wieder aktiviert
                }
            }, 100); // kleine Verzögerung, um sicherzustellen, dass der UI-Thread die Deaktivierung zeigt
        });
        
        console.log('[Document Fix] Document table listeners set up successfully');
        return true;
    }
    
    // Verhindern von mehrfachen Delete-Anfragen
    let deleteInProgress = {};
    
    // Spezifische Implementierungen der Dokument-Aktionen
    function deleteDocumentById(documentId) {
        console.log(`[Document Fix] Deleting document with ID: ${documentId}`);
        
        // Prüfen, ob bereits eine Löschanfrage für dieses Dokument läuft
        if (deleteInProgress[documentId]) {
            console.log(`[Document Fix] Delete already in progress for document ${documentId}`);
            return;
        }
        
        // Markieren, dass eine Löschanfrage für dieses Dokument läuft
        deleteInProgress[documentId] = true;
        
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Bitte melden Sie sich an, um diese Aktion durchzuführen.");
            deleteInProgress[documentId] = false;
            return;
        }
        
        fetch(`/documents/${documentId}`, {
            method: "DELETE",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        })
        .then(response => {
            const responseStatus = response.status; // Status speichern für späteren Zugriff
            if (!response.ok && responseStatus !== 404) { // 404 behandeln wir als success
                throw new Error(`Server returned ${responseStatus}`);
            }
            return { responseStatus, data: response.json() };
        })
        .then(async ({ responseStatus, data }) => {
            const resolvedData = await data;
            console.log('[Document Fix] Delete response:', resolvedData);
            
            if (resolvedData.success || responseStatus === 404) {
                alert("Dokument erfolgreich gelöscht!");
                // Tabelle neu laden
                if (typeof loadDocumentsTable === 'function') {
                    loadDocumentsTable('reload');
                } else {
                    location.reload();
                }
            } else {
                alert(`Fehler: ${resolvedData.message || 'Unbekannter Fehler beim Löschen'}`);
            }
            
            // Löschanfrage ist abgeschlossen
            deleteInProgress[documentId] = false;
        })
        .catch(error => {
            console.error('[Document Fix] Error deleting document:', error);
            alert(`Fehler beim Löschen des Dokuments: ${error.message}`);
            
            // Löschanfrage ist abgeschlossen
            deleteInProgress[documentId] = false;
        });
    }
    
    function downloadDocument(documentId) {
        console.log(`[Document Fix] Downloading document with ID: ${documentId}`);
        
        try {
            // Öffne das Dokument in einem neuen Tab
            window.open(`/documents/${documentId}?inline=true`, '_blank');
        } catch (error) {
            console.error('[Document Fix] Error downloading document:', error);
            alert('Fehler beim Herunterladen des Dokuments');
        }
    }
    
    function toggleDocumentArchive(documentId, isCurrentlyArchived) {
        console.log(`[Document Fix] Toggling archive status of document ${documentId}, currently archived: ${isCurrentlyArchived}`);
        
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Bitte melden Sie sich an, um diese Aktion durchzuführen.");
            return;
        }
        
        fetch(`/documents/${documentId}/archive`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ archived: !isCurrentlyArchived })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('[Document Fix] Toggle archive response:', data);
            
            if (data.success) {
                alert(`Dokument erfolgreich ${isCurrentlyArchived ? 'wiederhergestellt' : 'archiviert'}`);
                // Tabelle neu laden
                if (typeof loadDocumentsTable === 'function') {
                    loadDocumentsTable('reload');
                } else {
                    location.reload();
                }
            } else {
                alert(`Fehler: ${data.message || 'Unbekannter Fehler beim Ändern des Archivstatus'}`);
            }
        })
        .catch(error => {
            console.error('[Document Fix] Error toggling document archive status:', error);
            alert(`Fehler beim Ändern des Archivstatus: ${error.message}`);
        });
    }
    
    // Überschreibe die loadDocumentsTable-Funktion, um die Buttons anzupassen
    const originalLoadDocumentsTable = window.loadDocumentsTable;
    
    window.loadDocumentsTable = function(filter = '') {
        console.log(`[Document Fix] Overridden loadDocumentsTable called with filter: ${filter}`);
        
        if (typeof originalLoadDocumentsTable === 'function') {
            // Original-Funktion aufrufen
            originalLoadDocumentsTable(filter);
            
            // Warten, bis die Tabelle erstellt wurde
            setTimeout(() => {
                console.log('[Document Fix] Adding data attributes to buttons');
                
                // Buttons mit data-Attributen versehen
                const tbody = document.getElementById('documents-table-body');
                if (tbody) {
                    const rows = tbody.querySelectorAll('tr');
                    
                    rows.forEach(row => {
                        // Versuche, die ID aus der Button-Click-Funktion zu bekommen
                        const buttons = row.querySelectorAll('button');
                        buttons.forEach(button => {
                            const onclickValue = button.getAttribute('onclick');
                            if (onclickValue) {
                                const match = onclickValue.match(/\((\d+)/);
                                if (match && match[1]) {
                                    const id = match[1];
                                    // Setze data-Attribute und entferne onclick
                                    button.setAttribute('data-document-id', id);
                                    
                                    // Status für Toggle-Button speichern
                                    if (button.textContent.includes('Wiederherstellen')) {
                                        button.setAttribute('data-archived', 'true');
                                    } else if (button.textContent.includes('Archivieren')) {
                                        button.setAttribute('data-archived', 'false');
                                    }
                                    
                                    // Entferne onclick-Attribut, um CSP-Warnungen zu vermeiden
                                    button.removeAttribute('onclick');
                                }
                            }
                        });
                    });
                }
                
                // Event-Listener für Tabelle hinzufügen
                setupDocumentTableListeners();
            }, 200);
        } else {
            console.error('[Document Fix] Original loadDocumentsTable function not found');
        }
    };
    
    // Beobachte DOM-Änderungen, um die Tabelle zu finden, wenn sie dynamisch erstellt wird
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Prüfe, ob der documents-section angezeigt wird
                const documentsSection = document.getElementById('documents-section');
                if (documentsSection && getComputedStyle(documentsSection).display !== 'none') {
                    // Versuche die Tabelle zu finden und Event-Listener hinzuzufügen
                    if (setupDocumentTableListeners()) {
                        console.log('[Document Fix] Document table found and listeners added via MutationObserver');
                    }
                }
            }
        }
    });
    
    // Beobachte den Body auf Änderungen
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Beobachte auch, wenn die Dokumente-Sektion angezeigt wird
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === '#documents') {
            link.addEventListener('click', () => {
                console.log('[Document Fix] Documents section clicked in sidebar');
                // Warte kurz, bis die Tabelle geladen ist
                setTimeout(() => {
                    setupDocumentTableListeners();
                }, 300);
            });
        }
    });
    
    // Initiale Setup-Versuche
    setTimeout(() => {
        // Versuche das Setup beim ersten Laden
        setupDocumentTableListeners();
    }, 500);
    
    console.log('[Document Fix] Document table fix script initialized');
});