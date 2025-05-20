/**
 * Dashboard Fix Script
 * Dieses Skript behebt Probleme mit der Datenladung im Admin-Dashboard
 */

// Warte bis das Dokument geladen ist
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Dashboard Fix Script geladen');
    
    // Finde die relevanten Elemente
    const employeeCount = document.getElementById('employee-count');
    const documentCount = document.getElementById('document-count');
    const departmentCount = document.getElementById('department-count');
    const teamCount = document.getElementById('team-count');
    
    // Lade die Statistik-Daten direkt von den Test-Endpunkten
    try {
        console.log('Lade Dashboard-Daten...');
        const response = await fetch('/test/db/counts');
        
        if (response.ok) {
            const data = await response.json();
            console.log('Dashboard-Daten erfolgreich geladen:', data);
            
            // Update der Dashboard-Zahlen
            if (employeeCount) employeeCount.textContent = data.employees || '0';
            if (documentCount) documentCount.textContent = data.documents || '0';
            if (departmentCount) departmentCount.textContent = data.departments || '0';
            if (teamCount) teamCount.textContent = data.teams || '0';
            
            console.log('Dashboard-Zahlen aktualisiert');
        } else {
            console.error('Fehler beim Laden der Dashboard-Daten:', response.status);
        }
    } catch (error) {
        console.error('Fehler im Dashboard Fix Script:', error);
    }
    
    // Lade und zeige die Mitarbeiter an
    try {
        console.log('Lade Mitarbeiterdaten...');
        const employeesResponse = await fetch('/test/db/employees');
        
        if (employeesResponse.ok) {
            const employees = await employeesResponse.json();
            console.log(`${employees.length} Mitarbeiter geladen`);
            
            // Aktualisiere die Mitarbeiterliste im Dashboard
            const recentEmployees = document.getElementById('recent-employees');
            if (recentEmployees && employees.length > 0) {
                console.log('Aktualisiere Mitarbeiterliste');
                
                // Beschränke auf die neuesten 5 Mitarbeiter
                const latestEmployees = employees.slice(-5).reverse();
                
                recentEmployees.innerHTML = latestEmployees.map(emp => `
                    <div class="compact-list-item">
                        <span>${emp.first_name || ''} ${emp.last_name || ''}</span>
                        <small>${emp.position || emp.role || 'Keine Position'}</small>
                    </div>
                `).join('');
            }
            
            // Aktualisiere auch die "Kürzlich hinzugefügt"-Liste
            const recentEmployeesList = document.getElementById('recent-employees-list');
            if (recentEmployeesList && employees.length > 0) {
                console.log('Aktualisiere kürzlich hinzugefügte Mitarbeiter');
                
                // Beschränke auf die neuesten 5 Mitarbeiter
                const latestEmployees = employees.slice(-5).reverse();
                
                recentEmployeesList.innerHTML = latestEmployees.map(emp => `
                    <li>${emp.first_name || ''} ${emp.last_name || ''} - ${emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'Unbekanntes Datum'}</li>
                `).join('');
            }
            
            // Mitarbeitertabelle aktualisieren (für die Mitarbeiter-Sektion)
            const employeesTableBody = document.getElementById('employees-table-body');
            if (employeesTableBody) {
                console.log('Aktualisiere Mitarbeitertabelle');
                
                employeesTableBody.innerHTML = employees.map(emp => `
                    <tr class="${emp.status === 'inactive' ? 'table-row-inactive' : ''}">
                        <td>${emp.first_name || ''} ${emp.last_name || ''}</td>
                        <td>${emp.email || '-'}</td>
                        <td>${emp.employee_id || '-'}</td>
                        <td>${emp.position || '-'}</td>
                        <td>${emp.department_name || '-'}</td>
                        <td>
                            <span class="badge ${emp.status !== 'inactive' ? 'badge-success' : 'badge-warning'}">
                                ${emp.status !== 'inactive' ? 'Aktiv' : 'Inaktiv'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="editEmployee(${emp.id})">Bearbeiten</button>
                            <button class="btn btn-sm btn-warning" onclick="toggleEmployeeStatus(${emp.id}, '${emp.status || 'active'}')">
                                ${emp.status === 'inactive' ? 'Aktivieren' : 'Deaktivieren'}
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${emp.id})">Löschen</button>
                        </td>
                    </tr>
                `).join('');
            }
        } else {
            console.error('Fehler beim Laden der Mitarbeiterdaten:', employeesResponse.status);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Mitarbeiterdaten:', error);
    }
    
    // Lade und zeige die Abteilungen an
    try {
        console.log('Lade Abteilungsdaten...');
        const departmentsResponse = await fetch('/test/db/departments');
        
        if (departmentsResponse.ok) {
            const departments = await departmentsResponse.json();
            console.log(`${departments.length} Abteilungen geladen`);
            
            // Aktualisiere die Abteilungsliste im Dashboard
            const departmentList = document.getElementById('department-list');
            if (departmentList && departments.length > 0) {
                console.log('Aktualisiere Abteilungsliste');
                
                departmentList.innerHTML = departments.map(dept => `
                    <div class="compact-list-item">
                        <span>${dept.name || 'Unbenannte Abteilung'}</span>
                        <small>${dept.employee_count || 0} Mitarbeiter</small>
                    </div>
                `).join('');
            }
        } else {
            console.error('Fehler beim Laden der Abteilungsdaten:', departmentsResponse.status);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Abteilungsdaten:', error);
    }
    
    // Lade und zeige die Dokumente an
    try {
        console.log('Lade Dokumentdaten...');
        const documentsResponse = await fetch('/test/db/documents');
        
        if (documentsResponse.ok) {
            const documents = await documentsResponse.json();
            console.log(`${documents.length} Dokumente geladen`);
            
            // Aktualisiere die Dokumentliste im Dashboard
            const recentDocuments = document.getElementById('recent-documents');
            if (recentDocuments && documents.length > 0) {
                console.log('Aktualisiere Dokumentliste');
                
                // Beschränke auf die neuesten 5 Dokumente
                const latestDocuments = documents.slice(-5).reverse();
                
                recentDocuments.innerHTML = latestDocuments.map(doc => `
                    <div class="compact-list-item">
                        <span>${doc.file_name || 'Unbenanntes Dokument'}</span>
                        <small>${doc.category || 'Keine Kategorie'}</small>
                    </div>
                `).join('');
            }
            
            // Aktualisiere auch die "Kürzlich hinzugefügt"-Liste
            const recentDocumentsList = document.getElementById('recent-documents-list');
            if (recentDocumentsList && documents.length > 0) {
                console.log('Aktualisiere kürzlich hinzugefügte Dokumente');
                
                // Beschränke auf die neuesten 5 Dokumente
                const latestDocuments = documents.slice(-5).reverse();
                
                recentDocumentsList.innerHTML = latestDocuments.map(doc => `
                    <li>${doc.file_name || 'Unbenanntes Dokument'} - ${new Date(doc.upload_date || Date.now()).toLocaleDateString()}</li>
                `).join('');
            }
        } else {
            console.error('Fehler beim Laden der Dokumentdaten:', documentsResponse.status);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Dokumentdaten:', error);
    }
});