document.addEventListener('DOMContentLoaded', () => {
    const createEmployeeForm = document.getElementById('create-employee-form');
    const employeeTableBody = document.getElementById('employee-table-body');
    const uploadDocumentForm = document.getElementById('upload-document-form');
    const employeeSelect = document.getElementById('employee-select');
    const logoutBtn = document.getElementById('logout-btn');

    createEmployeeForm.addEventListener('submit', createEmployee);
    uploadDocumentForm.addEventListener('submit', uploadDocument);
    logoutBtn.addEventListener('click', logout);

    loadEmployees();

    async function createEmployee(e) {
        e.preventDefault();
        const formData = new FormData(createEmployeeForm);
        const employeeData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/admin/create-employee', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(employeeData)
            });

            if (response.ok) {
                alert('Mitarbeiter erfolgreich erstellt');
                createEmployeeForm.reset();
                loadEmployees();
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Fehler beim Erstellen des Mitarbeiters:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        }
    }

    async function loadEmployees() {
        try {
            const response = await fetch('/admin/employees', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const employees = await response.json();
                displayEmployees(employees);
                populateEmployeeSelect(employees);
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Mitarbeiter:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        }
    }

    // In server/public/js/admin-dashboard.js, modify the displayEmployees function:

function displayEmployees(employees) {
    employeeTableBody.innerHTML = '';
    employees.forEach(employee => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${employee.first_name} ${employee.last_name}</td>
            <td>${employee.email}</td>
            <td>${employee.employee_id}</td>
            <td>
                <button onclick="uploadDocumentFor('${employee.id}')">Dokument hochladen</button>
                <button class="delete-btn" 
                        data-id="${employee.id}" 
                        data-name="${employee.first_name} ${employee.last_name}"
                        style="background-color: #d9534f; margin-left: 5px;">
                    Löschen
                </button>
            </td>
        `;
        employeeTableBody.appendChild(row);
    });
    
    // Add event listeners for the delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', deleteEmployee);
    });
}

// Add the deleteEmployee function:
async function deleteEmployee(e) {
    const employeeId = e.target.getAttribute('data-id');
    const employeeName = e.target.getAttribute('data-name');
    
    if (!confirm(`Sind Sie sicher, dass Sie den Mitarbeiter "${employeeName}" löschen möchten?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/admin/delete-employee/${employeeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            alert(`Mitarbeiter "${employeeName}" wurde erfolgreich gelöscht.`);
            // Reload employee list
            loadEmployees();
        } else {
            const error = await response.json();
            alert(`Fehler: ${error.message}`);
        }
    } catch (error) {
        console.error('Fehler beim Löschen des Mitarbeiters:', error);
        alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
}

    function populateEmployeeSelect(employees) {
        employeeSelect.innerHTML = '<option value="">Mitarbeiter auswählen</option>';
        employees.forEach(employee => {
            const option = document.createElement('option');
            option.value = employee.id;
            option.textContent = `${employee.first_name} ${employee.last_name}`;
            employeeSelect.appendChild(option);
        });
    }

    async function uploadDocument(e) {
        e.preventDefault();
        const formData = new FormData(uploadDocumentForm);

        try {
            const response = await fetch(`/admin/upload-document/${formData.get('employeeId')}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (response.ok) {
                alert('Dokument erfolgreich hochgeladen');
                uploadDocumentForm.reset();
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Fehler beim Hochladen des Dokuments:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        }
    }

    function uploadDocumentFor(employeeId) {
        employeeSelect.value = employeeId;
        uploadDocumentForm.scrollIntoView({ behavior: 'smooth' });
    }

    function logout() {
        if (confirm('Möchten Sie sich wirklich abmelden?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            window.location.href = '/';
        }
    }
});

// Bestehende Funktionen zum Mitarbeiter anzeigen modifizieren
function displayEmployeesTable(employees) {
    const tableBody = document.getElementById('employee-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (employees.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Keine Mitarbeiter gefunden</td></tr>';
        return;
    }
    
    employees.forEach(employee => {
        const row = document.createElement('tr');
        
        // Profilbild oder Initialen
        let avatarContent;
        if (employee.profile_picture) {
            avatarContent = `<img src="/${employee.profile_picture}" alt="${employee.first_name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`;
        } else {
            const initials = getInitials(employee.first_name, employee.last_name);
            avatarContent = `<div style="width: 40px; height: 40px; border-radius: 50%; background-color: #1b8e01; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">${initials}</div>`;
        }
        
        // Abteilung und Team
        let deptTeamInfo = '';
        if (employee.department_name) {
            deptTeamInfo = `<span class="badge badge-primary">${employee.department_name}</span>`;
        }
        
        row.innerHTML = `
            <td>
                <div style="display: flex; align-items: center;">
                    <div style="margin-right: 10px;">${avatarContent}</div>
                    <div>
                        <div style="font-weight: bold;">${employee.first_name} ${employee.last_name}</div>
                        <div style="font-size: 12px; color: #666;">${employee.position || ''}</div>
                    </div>
                </div>
            </td>
            <td>${employee.email}</td>
            <td>${employee.employee_id}</td>
            <td>${employee.department_name || '-'} ${deptTeamInfo}</td>
            <td>
                <button class="primary" style="padding: 5px 10px; font-size: 12px; margin-right: 5px;" onclick="viewEmployee(${employee.id})">Details</button>
                <button class="secondary" style="padding: 5px 10px; font-size: 12px; margin-right: 5px;" onclick="editEmployee(${employee.id})">Bearbeiten</button>
                <button class="accent" style="padding: 5px 10px; font-size: 12px; margin-right: 5px; background-color: #17a2b8;" 
                        onclick="uploadSalaryForEmployee(${employee.id}, '${employee.first_name} ${employee.last_name}')">
                    Gehaltsabrechnung
                </button>
                <button class="danger" style="padding: 5px 10px; font-size: 12px;" onclick="deleteEmployee(${employee.id}, '${employee.first_name} ${employee.last_name}')">Löschen</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Auch für die Grid-Ansicht
function displayEmployeesGrid(employees) {
    const container = document.getElementById('employee-grid-view');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (employees.length === 0) {
        container.innerHTML = '<div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 20px;">Keine Mitarbeiter gefunden</div>';
        return;
    }
    
    employees.forEach(employee => {
        const card = document.createElement('div');
        card.className = 'employee-card';
        
        // Profilbild oder Initialen
        let avatarContent;
        if (employee.profile_picture) {
            avatarContent = `<img src="/${employee.profile_picture}" alt="${employee.first_name}">`;
        } else {
            const initials = getInitials(employee.first_name, employee.last_name);
            avatarContent = initials;
        }
        
        // Abteilung und Team
        let deptTeamInfo = '';
        if (employee.department_name) {
            deptTeamInfo += `<span class="badge badge-primary">${employee.department_name}</span>`;
        }
        
        card.innerHTML = `
            <div class="employee-header">
                <div class="employee-avatar">${avatarContent}</div>
                <div class="employee-info">
                    <h3 class="employee-name">${employee.first_name} ${employee.last_name}</h3>
                    <p class="employee-position">${employee.position || 'Keine Position'}</p>
                </div>
            </div>
            <div class="employee-details">
                <div class="employee-detail">
                    <span class="detail-label">E-Mail:</span>
                    <span class="detail-value">${employee.email}</span>
                </div>
                <div class="employee-detail">
                    <span class="detail-label">Mitarbeiter-ID:</span>
                    <span class="detail-value">${employee.employee_id}</span>
                </div>
                <div class="employee-detail">
                    <span class="detail-label">Telefon:</span>
                    <span class="detail-value">${employee.phone || '-'}</span>
                </div>
                <div class="employee-detail">
                    <span class="detail-label">Abteilung:</span>
                    <span class="detail-value">${employee.department_name || '-'} ${deptTeamInfo}</span>
                </div>
            </div>
            <div class="employee-actions">
                <button class="primary" onclick="viewEmployee(${employee.id})">Details</button>
                <button class="secondary" onclick="editEmployee(${employee.id})">Bearbeiten</button>
                <button class="accent" style="background-color: #17a2b8;" 
                        onclick="uploadSalaryForEmployee(${employee.id}, '${employee.first_name} ${employee.last_name}')">
                    Gehaltsabrechnung
                </button>
                <button class="danger" onclick="deleteEmployee(${employee.id}, '${employee.first_name} ${employee.last_name}')">Löschen</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Neue Funktion zum Aufrufen des Upload-Dialogs
function uploadSalaryForEmployee(employeeId, employeeName) {
    // Diese Funktion ruft das Salary-Upload-Modal auf
    showSalaryUploadModal(employeeId, employeeName);
}

// Bestehende viewEmployee Funktion erweitern, um Gehaltsabrechnungen anzuzeigen
async function viewEmployee(employeeId) {
    try {
        const response = await fetch(`/users/${employeeId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const employee = await response.json();
            
            // Bestehender Code bleibt erhalten...
            showEmployeeDetailModal(employee);
            
            // Zusätzlich: Gehaltsabrechnungen laden
            loadEmployeeSalaryDocuments(employeeId);
        } else {
            console.error('Fehler beim Laden der Mitarbeiterdaten');
            alert('Fehler beim Laden der Mitarbeiterdaten');
        }
    } catch (error) {
        console.error('Fehler beim Laden der Mitarbeiterdaten:', error);
        alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
}

// Funktion zum Laden der Gehaltsabrechnungen eines Mitarbeiters
async function loadEmployeeSalaryDocuments(employeeId) {
    const documentsContainer = document.getElementById('employee-salary-documents-body');
    if (!documentsContainer) return;
    
    try {
        documentsContainer.innerHTML = '<tr><td colspan="4" style="text-align: center;">Wird geladen...</td></tr>';
        
        const response = await fetch(`/admin/employee-salary-documents/${employeeId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const documents = await response.json();
            
            if (documents.length === 0) {
                documentsContainer.innerHTML = '<tr><td colspan="4" style="text-align: center;">Keine Gehaltsabrechnungen vorhanden</td></tr>';
                return;
            }
            
            documentsContainer.innerHTML = '';
            documents.forEach(doc => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${doc.file_name}</td>
                    <td>${doc.month} ${doc.year}</td>
                    <td>${doc.description || '-'}</td>
                    <td>
                        <button class="btn-small primary" onclick="downloadDocument('${doc.id}')">
                            <i class="icon download-icon"></i> Herunterladen
                        </button>
                        <button class="btn-small accent" onclick="archiveDocument('${doc.id}')">
                            <i class="icon archive-icon"></i> Archivieren
                        </button>
                    </td>
                `;
                
                documentsContainer.appendChild(row);
            });
        } else {
            documentsContainer.innerHTML = '<tr><td colspan="4" style="text-align: center;">Fehler beim Laden der Gehaltsabrechnungen</td></tr>';
        }
    } catch (error) {
        console.error('Fehler beim Laden der Gehaltsabrechnungen:', error);
        documentsContainer.innerHTML = '<tr><td colspan="4" style="text-align: center;">Fehler beim Laden der Gehaltsabrechnungen</td></tr>';
    }
}

// Dokument herunterladen
async function downloadDocument(documentId) {
    try {
        const response = await fetch(`/documents/${documentId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Dateinamen aus dem Content-Disposition-Header extrahieren
            const contentDisposition = response.headers.get('Content-Disposition');
            const fileName = contentDisposition ? 
                contentDisposition.split('filename=')[1].replace(/"/g, '') : 
                'dokument.pdf';
            
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            alert('Fehler beim Herunterladen des Dokuments');
        }
    } catch (error) {
        console.error('Fehler beim Herunterladen des Dokuments:', error);
        alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
}

// Dokument archivieren
async function archiveDocument(documentId) {
    if (confirm('Möchten Sie dieses Dokument wirklich archivieren?')) {
        try {
            const response = await fetch(`/admin/archive-document/${documentId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                alert('Dokument erfolgreich archiviert');
                
                // Dokumente neu laden, wenn wir die aktuell ausgewählte Mitarbeiter-ID kennen
                const employeeId = document.getElementById('employee-detail-id')?.value;
                if (employeeId) {
                    loadEmployeeSalaryDocuments(employeeId);
                }
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Fehler beim Archivieren des Dokuments:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        }
    }
}

// Mitarbeiterdetails-Modal erweitern
function showEmployeeDetailModal(employee) {
    const modal = document.getElementById('employee-detail-modal');
    const nameTitle = document.getElementById('employee-detail-name');
    const content = document.getElementById('employee-detail-content');
    const editBtn = document.getElementById('edit-employee-btn');
    
    // Verstecktes Feld für die Mitarbeiter-ID hinzufügen
    const employeeIdField = document.createElement('input');
    employeeIdField.type = 'hidden';
    employeeIdField.id = 'employee-detail-id';
    employeeIdField.value = employee.id;
    content.appendChild(employeeIdField);
    
    // Titel und Bearbeiten-Button
    nameTitle.textContent = `${employee.first_name} ${employee.last_name}`;
    editBtn.onclick = () => editEmployee(employee.id);
    
    // Inhalt erstellen
    let detailsHtml = `
        <div class="employee-header" style="margin-bottom: 20px;">
            <div class="employee-avatar" style="width: 80px; height: 80px; font-size: 30px;">
                ${employee.profile_picture ? 
                  `<img src="/${employee.profile_picture}" alt="${employee.first_name}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                  getInitials(employee.first_name, employee.last_name)}
            </div>
            <div class="employee-info">
                <h3 class="employee-name">${employee.first_name} ${employee.last_name}</h3>
                <p class="employee-position">${employee.position || 'Keine Position'}</p>
                <p>${employee.department_name ? `<span class="badge badge-primary">${employee.department_name}</span>` : ''}</p>
            </div>
        </div>
        
        <div class="tabs">
            <button class="tab active" data-detailtab="personal-details">Persönliche Daten</button>
            <button class="tab" data-detailtab="work-details">Arbeitsdaten</button>
            <button class="tab" data-detailtab="documents-list">Dokumente</button>
            <button class="tab" data-detailtab="salary-documents">Gehaltsabrechnungen</button>
        </div>
        
        <div id="personal-details" class="tab-content active" style="display: block;">
            <div class="detail-group">
                <div class="detail-row">
                    <div class="detail-label">Benutzername:</div>
                    <div class="detail-value">${employee.username}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">E-Mail:</div>
                    <div class="detail-value">${employee.email}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Telefon:</div>
                    <div class="detail-value">${employee.phone || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Adresse:</div>
                    <div class="detail-value">${employee.address || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Geburtstag:</div>
                    <div class="detail-value">${employee.birthday ? new Date(employee.birthday).toLocaleDateString() : '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Notfallkontakt:</div>
                    <div class="detail-value">${employee.emergency_contact || '-'}</div>
                </div>
            </div>
        </div>
        
        <div id="work-details" class="tab-content">
            <div class="detail-group">
                <div class="detail-row">
                    <div class="detail-label">Mitarbeiter-ID:</div>
                    <div class="detail-value">${employee.employee_id}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Position:</div>
                    <div class="detail-value">${employee.position || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Abteilung:</div>
                    <div class="detail-value">${employee.department_name || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Teams:</div>
                    <div class="detail-value" id="employee-teams">Wird geladen...</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Einstellungsdatum:</div>
                    <div class="detail-value">${employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">IBAN:</div>
                    <div class="detail-value">${employee.iban || '-'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Notizen:</div>
                    <div class="detail-value">${employee.notes || '-'}</div>
                </div>
            </div>
        </div>
        
        <div id="documents-list" class="tab-content">
            <table style="width: 100%;">
                <thead>
                    <tr>
                        <th>Dateiname</th>
                        <th>Hochgeladen am</th>
                        <th>Aktionen</th>
                    </tr>
                </thead>
                <tbody id="employee-documents-body">
                    <tr><td colspan="3" style="text-align: center;">Wird geladen...</td></tr>
                </tbody>
            </table>
        </div>
        
        <div id="salary-documents" class="tab-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0;">Gehaltsabrechnungen</h3>
                <button class="btn primary" onclick="uploadSalaryForEmployee(${employee.id}, '${employee.first_name} ${employee.last_name}')">
                    Neue Gehaltsabrechnung
                </button>
            </div>
            
            <table style="width: 100%;">
                <thead>
                    <tr>
                        <th>Titel</th>
                        <th>Zeitraum</th>
                        <th>Beschreibung</th>
                        <th>Aktionen</th>
                    </tr>
                </thead>
                <tbody id="employee-salary-documents-body">
                    <tr><td colspan="4" style="text-align: center;">Wird geladen...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    
    content.innerHTML = detailsHtml;
    
    // Event-Listener für Tabs
    content.querySelectorAll('[data-detailtab]').forEach(tab => {
        tab.addEventListener('click', function() {
            // Alle Tabs und Inhalte deaktivieren
            content.querySelectorAll('[data-detailtab]').forEach(t => t.classList.remove('active'));
            content.querySelectorAll('.tab-content').forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });
            
            // Ausgewählten Tab aktivieren
            this.classList.add('active');
            const tabId = this.getAttribute('data-detailtab');
            const tabContent = content.querySelector(`#${tabId}`);
            tabContent.classList.add('active');
            tabContent.style.display = 'block';
        });
    });
    
    // Teams laden
    loadEmployeeTeams(employee.id);
    
    // Dokumente laden
    loadEmployeeDocuments(employee.id);
    
    // Modal anzeigen
    modal.style.display = 'flex';
}