/**
 * Debug-Skript für Mitarbeiter-Aktionen
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Debug] Employee action debug script loaded');
    
    // Globale Funktionen für Mitarbeiter-Aktionen überschreiben
    window.deleteEmployee = function(employeeId) {
        console.log(`[Debug] deleteEmployee called with ID: ${employeeId}`);
        alert(`Delete employee debug - ID: ${employeeId}`);
        
        // Hier können wir die Funktion implementieren
        const token = localStorage.getItem("token");
        
        if (!token) {
            console.error("[Debug] No token found!");
            alert("Kein Authentifizierungstoken gefunden. Bitte melden Sie sich erneut an.");
            return;
        }
        
        if (confirm(`Mitarbeiter mit ID ${employeeId} wirklich löschen?`)) {
            console.log("[Debug] Confirmed deletion");
            
            // API-Aufruf zum Löschen
            fetch(`/admin/delete-employee/${employeeId}`, {
                method: "DELETE",
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            })
            .then(response => {
                console.log(`[Debug] Delete response status: ${response.status}`);
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("[Debug] Delete response data:", data);
                alert(`Mitarbeiter (ID: ${employeeId}) erfolgreich gelöscht!`);
                // Tabelle neu laden
                if (typeof loadEmployeesTable === 'function') {
                    loadEmployeesTable('reload');
                } else {
                    console.error('[Debug] loadEmployeesTable is not a function');
                    location.reload(); // Fallback: Seite neu laden
                }
            })
            .catch(error => {
                console.error('[Debug] Error deleting employee:', error);
                alert(`Fehler beim Löschen des Mitarbeiters: ${error.message}`);
            });
        }
    };
    
    // Mitarbeiter bearbeiten Debug-Funktion
    window.editEmployee = function(employeeId) {
        console.log(`[Debug] editEmployee called with ID: ${employeeId}`);
        alert(`Edit employee debug - ID: ${employeeId}`);
        
        // Original-Funktion aufrufen, falls definiert
        if (typeof window.originalEditEmployee === 'function') {
            window.originalEditEmployee(employeeId);
        }
    };
    
    // Status umschalten Debug-Funktion
    window.toggleEmployeeStatus = function(employeeId, currentStatus) {
        console.log(`[Debug] toggleEmployeeStatus called with ID: ${employeeId}, status: ${currentStatus}`);
        alert(`Toggle status debug - ID: ${employeeId}, current status: ${currentStatus}`);
        
        // Original-Funktion aufrufen, falls definiert
        if (typeof window.originalToggleEmployeeStatus === 'function') {
            window.originalToggleEmployeeStatus(employeeId, currentStatus);
        }
    };
    
    console.log('[Debug] Employee action debug script completed setup');
});