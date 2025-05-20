/**
 * Fix für die Mitarbeitertabelle, um Event-Listener korrekt zu registrieren
 * Dieses Script umgeht die CSP-Beschränkungen, indem es die
 * Event-Listener direkt an die Tabellenzellen anhängt
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Table Fix] Employee table fix script loaded');
    
    // Funktion zum Hinzufügen der Event-Listener zur Mitarbeitertabelle
    function setupEmployeeTableListeners() {
        console.log('[Table Fix] Setting up employee table listeners');
        
        const tableBody = document.getElementById('employees-table-body');
        if (!tableBody) {
            console.warn('[Table Fix] employees-table-body not found, will try again later');
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
            
            // Generiere eine eindeutige ID für den Button
            const buttonId = button.getAttribute('data-employee-id') + '-' + 
                             (button.classList.contains('btn-danger') ? 'delete' : 
                              button.classList.contains('btn-primary') ? 'edit' : 
                              button.classList.contains('btn-warning') ? 'toggle' : 'unknown');
            
            // Debouncing: Ignoriere Klicks, die zu schnell hintereinander erfolgen
            if (now - lastClickTime < 1000 && buttonId === lastClickedButtonId) {
                console.log('[Table Fix] Debouncing: ignoring too fast click');
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            
            lastClickTime = now;
            lastClickedButtonId = buttonId;
            
            // Verhindere Standardverhalten (z.B. Form-Submit)
            event.preventDefault();
            
            // Hole die Mitarbeiter-ID aus dem data-Attribut oder aus dem Elternelement
            let employeeId = button.getAttribute('data-employee-id');
            
            // Wenn keine ID im data-Attribut, versuche sie aus dem onclick-Attribut zu extrahieren
            if (!employeeId && button.getAttribute('onclick')) {
                const onclickValue = button.getAttribute('onclick');
                const match = onclickValue.match(/\((\d+)/);
                if (match && match[1]) {
                    employeeId = match[1];
                }
            }
            
            if (!employeeId) {
                console.error('[Table Fix] Could not determine employee ID');
                return;
            }
            
            console.log(`[Table Fix] Button clicked for employee ID: ${employeeId}`);
            
            // Temporär Button deaktivieren, um Mehrfachklicks zu verhindern
            button.disabled = true;
            button.classList.add('processing');
            
            setTimeout(() => {
                // Bestimme Aktion basierend auf Button-Klasse oder Text
                if (button.classList.contains('btn-danger') || button.textContent.trim() === 'Löschen') {
                    console.log(`[Table Fix] Delete button clicked for employee ID: ${employeeId}`);
                    
                    // Nur einmal bestätigen, ohne ID
                    if (confirm(`Mitarbeiter wirklich löschen?`)) {
                        // Button deaktiviert lassen und Lock setzen, um weitere Anfragen zu verhindern
                        if (!deleteInProgress[employeeId]) {
                            deleteEmployeeById(employeeId);
                        } else {
                            console.log('[Table Fix] Delete operation already in progress');
                        }
                    } else {
                        // Wenn abgebrochen, Button wieder aktivieren
                        button.disabled = false;
                        button.classList.remove('processing');
                    }
                } 
                else if (button.classList.contains('btn-primary') || button.textContent.trim() === 'Bearbeiten') {
                    console.log(`[Table Fix] Edit button clicked for employee ID: ${employeeId}`);
                    editEmployeeById(employeeId);
                    
                    // Bearbeiten deaktiviert nicht die Tabelle, also Button wieder aktivieren
                    button.disabled = false;
                    button.classList.remove('processing');
                }
                else if (button.classList.contains('btn-warning')) {
                    console.log(`[Table Fix] Toggle status button clicked for employee ID: ${employeeId}`);
                    const currentStatus = button.getAttribute('data-status') || 'active';
                    toggleEmployeeStatusById(employeeId, currentStatus);
                    
                    // Button wird nach erfolgreicher Aktion in den toggleEmployeeStatusById wieder aktiviert
                }
            }, 100); // kleine Verzögerung, um sicherzustellen, dass der UI-Thread die Deaktivierung zeigt
        });
        
        console.log('[Table Fix] Employee table listeners set up successfully');
        return true;
    }
    
    // Spezifische Implementierungen der Mitarbeiter-Aktionen
    // Verhindern von mehrfachen Delete-Anfragen
    let deleteInProgress = {};
    
    function deleteEmployeeById(employeeId) {
        console.log(`[Table Fix] Deleting employee with ID: ${employeeId}`);
        
        // Prüfen, ob bereits eine Löschanfrage für diesen Mitarbeiter läuft
        if (deleteInProgress[employeeId]) {
            console.log(`[Table Fix] Delete already in progress for employee ${employeeId}`);
            return;
        }
        
        // Markieren, dass eine Löschanfrage für diesen Mitarbeiter läuft
        deleteInProgress[employeeId] = true;
        
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Bitte melden Sie sich an, um diese Aktion durchzuführen.");
            deleteInProgress[employeeId] = false;
            return;
        }
        
        fetch(`/admin/delete-employee/${employeeId}`, {
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
            console.log('[Table Fix] Delete response:', resolvedData);
            
            if (resolvedData.success || responseStatus === 404) {
                alert("Mitarbeiter erfolgreich gelöscht!");
                // Tabelle neu laden
                if (typeof loadEmployeesTable === 'function') {
                    loadEmployeesTable('reload');
                } else {
                    location.reload();
                }
            } else {
                alert(`Fehler: ${data.message || 'Unbekannter Fehler beim Löschen'}`);
            }
            
            // Löschanfrage ist abgeschlossen
            deleteInProgress[employeeId] = false;
        })
        .catch(error => {
            console.error('[Table Fix] Error deleting employee:', error);
            alert(`Fehler beim Löschen des Mitarbeiters: ${error.message}`);
            
            // Löschanfrage ist abgeschlossen
            deleteInProgress[employeeId] = false;
        });
    }
    
    function editEmployeeById(employeeId) {
        console.log(`[Table Fix] Editing employee with ID: ${employeeId}`);
        
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Bitte melden Sie sich an, um diese Aktion durchzuführen.");
            return;
        }
        
        // Mitarbeiterdaten laden
        fetch(`/admin/employees/${employeeId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(employee => {
            console.log('[Table Fix] Employee data loaded:', employee);
            
            // Modal erstellen und anzeigen
            const modalHTML = `
                <div class="modal" id="edit-employee-modal" style="display: flex;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title">Mitarbeiter bearbeiten</h3>
                            <button type="button" class="modal-close">&times;</button>
                        </div>
                        <form id="edit-employee-form">
                            <div class="form-group">
                                <label class="form-label">Benutzername</label>
                                <input type="text" name="username" class="form-control" value="${employee.username}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">E-Mail</label>
                                <input type="email" name="email" class="form-control" value="${employee.email}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Vorname</label>
                                <input type="text" name="first_name" class="form-control" value="${employee.first_name}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Nachname</label>
                                <input type="text" name="last_name" class="form-control" value="${employee.last_name}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Alter</label>
                                <input type="number" name="age" class="form-control" min="18" max="100" value="${employee.age || ''}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Position</label>
                                <input type="text" name="position" class="form-control" value="${employee.position || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Abteilung</label>
                                <select name="department_id" class="form-control" id="edit-employee-department-select">
                                    <option value="">Keine Abteilung</option>
                                    <!-- Wird dynamisch gefüllt -->
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select name="status" class="form-control">
                                    <option value="active" ${employee.status === 'active' ? 'selected' : ''}>Aktiv</option>
                                    <option value="inactive" ${employee.status === 'inactive' ? 'selected' : ''}>Inaktiv</option>
                                </select>
                            </div>
                            <div class="button-group">
                                <button type="button" class="btn btn-primary save-button">Änderungen speichern</button>
                                <button type="button" class="btn btn-secondary cancel-button">Abbrechen</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            // Prüfen, ob ein altes Modal existiert und dieses entfernen
            const oldModal = document.getElementById('edit-employee-modal');
            if (oldModal) {
                oldModal.remove();
            }
            
            // Modal zum Body hinzufügen
            document.body.insertAdjacentHTML("beforeend", modalHTML);
            
            // Event-Listener für Modal-Aktionen hinzufügen
            const modal = document.getElementById('edit-employee-modal');
            
            // Close button
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => modal.remove());
            }
            
            // Cancel button
            const cancelBtn = modal.querySelector('.cancel-button');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => modal.remove());
            }
            
            // Save button
            const saveBtn = modal.querySelector('.save-button');
            if (saveBtn) {
                saveBtn.addEventListener('click', function() {
                    // Formular-Daten sammeln
                    const form = document.getElementById('edit-employee-form');
                    const formData = new FormData(form);
                    const data = Object.fromEntries(formData.entries());
                    
                    // Bei leerer Abteilung setzen wir null statt leeren String
                    if (data.department_id === "") {
                        data.department_id = null;
                    }
                    
                    // Daten an API senden
                    fetch(`/admin/employees/${employeeId}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify(data)
                    })
                    .then(response => response.json())
                    .then(result => {
                        if (result.success) {
                            alert("Mitarbeiter erfolgreich aktualisiert");
                            modal.remove();
                            // Tabelle neu laden
                            if (typeof loadEmployeesTable === 'function') {
                                loadEmployeesTable('reload');
                            }
                        } else {
                            alert(`Fehler: ${result.message || 'Unbekannter Fehler beim Aktualisieren'}`);
                        }
                    })
                    .catch(error => {
                        console.error('[Table Fix] Error updating employee:', error);
                        alert(`Fehler beim Aktualisieren: ${error.message}`);
                    });
                });
            }
            
            // Abteilungen für das Select-Feld laden
            fetch('/departments', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(response => response.json())
            .then(departments => {
                const departmentSelect = document.getElementById('edit-employee-department-select');
                if (departmentSelect) {
                    departmentSelect.innerHTML = '<option value="">Keine Abteilung</option>' +
                        departments.map(dept => `
                            <option value="${dept.id}" ${dept.id == employee.department_id ? 'selected' : ''}>
                                ${dept.name}
                            </option>
                        `).join('');
                }
            })
            .catch(error => console.error('[Table Fix] Error loading departments:', error));
        })
        .catch(error => {
            console.error('[Table Fix] Error loading employee data:', error);
            alert(`Fehler beim Laden der Mitarbeiterdaten: ${error.message}`);
        });
    }
    
    function toggleEmployeeStatusById(employeeId, currentStatus) {
        console.log(`[Table Fix] Toggling status of employee ${employeeId} from ${currentStatus}`);
        
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Bitte melden Sie sich an, um diese Aktion durchzuführen.");
            return;
        }
        
        const newStatus = currentStatus === "inactive" ? "active" : "inactive";
        
        fetch(`/admin/toggle-employee-status/${employeeId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        })
        .then(response => response.json())
        .then(data => {
            console.log('[Table Fix] Toggle status response:', data);
            
            if (data.success) {
                alert(`Mitarbeiterstatus wurde zu "${newStatus}" geändert`);
                // Tabelle neu laden
                if (typeof loadEmployeesTable === 'function') {
                    loadEmployeesTable('reload');
                } else {
                    location.reload();
                }
            } else {
                alert(`Fehler: ${data.message || 'Unbekannter Fehler beim Statuswechsel'}`);
            }
        })
        .catch(error => {
            console.error('[Table Fix] Error toggling employee status:', error);
            alert(`Fehler beim Ändern des Status: ${error.message}`);
        });
    }
    
    // Überschreibe die loadEmployeesTable-Funktion, um die Buttons anzupassen
    const originalLoadEmployeesTable = window.loadEmployeesTable;
    
    window.loadEmployeesTable = function(filter = '') {
        console.log(`[Table Fix] Overridden loadEmployeesTable called with filter: ${filter}`);
        
        if (typeof originalLoadEmployeesTable === 'function') {
            // Original-Funktion aufrufen
            originalLoadEmployeesTable(filter);
            
            // Warten, bis die Tabelle erstellt wurde
            setTimeout(() => {
                console.log('[Table Fix] Adding data attributes to buttons');
                
                // Buttons mit data-Attributen versehen
                const tbody = document.getElementById('employees-table-body');
                if (tbody) {
                    const rows = tbody.querySelectorAll('tr');
                    
                    rows.forEach(row => {
                        // Die erste Spalte enthält oft die ID als Text oder Attribut
                        const employeeId = row.getAttribute('data-id');
                        if (!employeeId) {
                            // Versuche, die ID aus der Button-Click-Funktion zu bekommen
                            const buttons = row.querySelectorAll('button');
                            buttons.forEach(button => {
                                const onclickValue = button.getAttribute('onclick');
                                if (onclickValue) {
                                    const match = onclickValue.match(/\((\d+)/);
                                    if (match && match[1]) {
                                        const id = match[1];
                                        // Setze data-Attribute und entferne onclick
                                        button.setAttribute('data-employee-id', id);
                                        
                                        // Status für Toggle-Button speichern
                                        if (button.textContent.includes('Deaktivieren')) {
                                            button.setAttribute('data-status', 'active');
                                        } else if (button.textContent.includes('Aktivieren')) {
                                            button.setAttribute('data-status', 'inactive');
                                        }
                                        
                                        // Entferne onclick-Attribut
                                        button.removeAttribute('onclick');
                                    }
                                }
                            });
                        } else {
                            // Wenn die ID direkt in der Zeile gefunden wurde
                            const buttons = row.querySelectorAll('button');
                            buttons.forEach(button => {
                                button.setAttribute('data-employee-id', employeeId);
                                // Status für Toggle-Button speichern
                                if (button.textContent.includes('Deaktivieren')) {
                                    button.setAttribute('data-status', 'active');
                                } else if (button.textContent.includes('Aktivieren')) {
                                    button.setAttribute('data-status', 'inactive');
                                }
                                // Entferne onclick-Attribut
                                button.removeAttribute('onclick');
                            });
                        }
                    });
                }
                
                // Event-Listener für Tabelle hinzufügen
                setupEmployeeTableListeners();
            }, 200);
        } else {
            console.error('[Table Fix] Original loadEmployeesTable function not found');
        }
    };
    
    // Beobachte DOM-Änderungen, um die Tabelle zu finden, wenn sie dynamisch erstellt wird
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Prüfe, ob der employees-section angezeigt wird
                const employeesSection = document.getElementById('employees-section');
                if (employeesSection && getComputedStyle(employeesSection).display !== 'none') {
                    // Versuche die Tabelle zu finden und Event-Listener hinzuzufügen
                    if (setupEmployeeTableListeners()) {
                        console.log('[Table Fix] Employee table found and listeners added via MutationObserver');
                    }
                }
            }
        }
    });
    
    // Beobachte den Body auf Änderungen
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Beobachte auch, wenn die Mitarbeiter-Sektion angezeigt wird
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === '#employees') {
            link.addEventListener('click', () => {
                console.log('[Table Fix] Employees section clicked in sidebar');
                // Warte kurz, bis die Tabelle geladen ist
                setTimeout(() => {
                    setupEmployeeTableListeners();
                }, 300);
            });
        }
    });
    
    // Initiale Setup-Versuche
    setTimeout(() => {
        // Versuche das Setup beim ersten Laden
        setupEmployeeTableListeners();
    }, 500);
    
    console.log('[Table Fix] Employee table fix script initialized');
});