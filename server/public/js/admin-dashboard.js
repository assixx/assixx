// Global token variable
let token;

document.addEventListener('DOMContentLoaded', () => {
    token = localStorage.getItem('token');
    console.log('Token from localStorage:', token);
    
    if (!token) {
        console.log('No token found, redirecting to login');
        window.location.href = '/';
        return;
    }

    // Event Listeners for forms
    const createEmployeeForm = document.getElementById('create-employee-form');
    const uploadDocumentForm = document.getElementById('document-upload-form');
    const departmentForm = document.getElementById('department-form');
    const teamForm = document.getElementById('team-form');
    const logoutBtn = document.getElementById('logout-btn');

    if (createEmployeeForm) createEmployeeForm.addEventListener('submit', createEmployee);
    if (uploadDocumentForm) uploadDocumentForm.addEventListener('submit', uploadDocument);
    if (departmentForm) departmentForm.addEventListener('submit', createDepartment);
    if (teamForm) teamForm.addEventListener('submit', createTeam);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Initial loads - add slight delay to ensure DOM is ready
    setTimeout(() => {
        loadDashboardStats();
        loadRecentEmployees();
        loadRecentDocuments();
        loadDepartments();
        loadTeams();
    }, 100);

    // Load Dashboard Statistics
    async function loadDashboardStats() {
        // Lade jeden Zähler einzeln, um Fehler zu isolieren
        
        // Mitarbeiter
        try {
            const employeesRes = await fetch('/admin/employees', { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (employeesRes.ok) {
                const employees = await employeesRes.json();
                document.getElementById('employee-count').textContent = employees.length;
            }
        } catch (error) {
            console.error('Error loading employees:', error);
        }
        
        // Dokumente
        try {
            const documentsRes = await fetch('/documents', { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (documentsRes.ok) {
                const documents = await documentsRes.json();
                document.getElementById('document-count').textContent = documents.length;
            }
        } catch (error) {
            console.error('Error loading documents:', error);
        }
        
        // Abteilungen
        try {
            const departmentsRes = await fetch('/departments', { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (departmentsRes.ok) {
                const departments = await departmentsRes.json();
                const deptCountElement = document.getElementById('department-count');
                if (deptCountElement) {
                    deptCountElement.textContent = departments.length;
                }
            }
        } catch (error) {
            console.error('Error loading departments:', error);
        }
        
        // Teams
        try {
            const teamsRes = await fetch('/teams', { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (teamsRes.ok) {
                const teams = await teamsRes.json();
                document.getElementById('team-count').textContent = teams.length;
            }
        } catch (error) {
            console.error('Error loading teams:', error);
        }
    }

    // Create Employee
    async function createEmployee(e) {
        e.preventDefault();
        const formData = new FormData(createEmployeeForm);
        const employeeData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/admin/create-employee', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(employeeData)
            });

            if (response.ok) {
                alert('Mitarbeiter erfolgreich erstellt');
                createEmployeeForm.reset();
                hideModal('employee-modal');
                loadRecentEmployees();
                loadDashboardStats();
                loadEmployeesForSelect();
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Fehler beim Erstellen des Mitarbeiters:', error);
            alert('Ein Fehler ist aufgetreten.');
        }
    }

    // Load Recent Employees
    async function loadRecentEmployees() {
        try {
            const response = await fetch('/admin/employees', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const employees = await response.json();
                const recentEmployees = employees.slice(-5).reverse();
                const container = document.getElementById('recent-employees');
                
                if (container) {
                    container.innerHTML = recentEmployees.map(emp => `
                        <div class="compact-list-item">
                            <span>${emp.first_name} ${emp.last_name}</span>
                            <small>${emp.position || emp.role}</small>
                        </div>
                    `).join('');
                }

                // Also update the recent employees list
                const recentList = document.getElementById('recent-employees-list');
                if (recentList) {
                    recentList.innerHTML = recentEmployees.map(emp => `
                        <li>${emp.first_name} ${emp.last_name} - ${new Date(emp.created_at).toLocaleDateString()}</li>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('Error loading recent employees:', error);
        }
    }

    // Load Recent Documents  
    async function loadRecentDocuments() {
        try {
            const response = await fetch('/documents', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const documents = await response.json();
                const recentDocuments = documents.slice(-5).reverse();
                const container = document.getElementById('recent-documents');
                
                if (container) {
                    container.innerHTML = recentDocuments.map(doc => `
                        <div class="compact-list-item">
                            <span>${doc.file_name}</span>
                            <small>${doc.category}</small>
                        </div>
                    `).join('');
                }

                // Also update the recent documents list
                const recentList = document.getElementById('recent-documents-list');
                if (recentList) {
                    recentList.innerHTML = recentDocuments.map(doc => `
                        <li>${doc.file_name} - ${new Date(doc.upload_date).toLocaleDateString()}</li>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('Error loading recent documents:', error);
        }
    }

    // Load Departments
    async function loadDepartments() {
        try {
            const response = await fetch('/departments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const departments = await response.json();
                
                const container = document.getElementById('department-list');
                
                if (container) {
                    if (departments.length === 0) {
                        container.innerHTML = '<div class="compact-list-item">Keine Abteilungen vorhanden</div>';
                    } else {
                        container.innerHTML = departments.map(dept => `
                            <div class="compact-list-item">
                                <span>${dept.name}</span>
                                <small>${dept.employee_count || 0} Mitarbeiter</small>
                            </div>
                        `).join('');
                    }
                }
            }
        } catch (error) {
            console.error('Error loading departments:', error);
        }
    }

    // Load Teams
    async function loadTeams() {
        try {
            const response = await fetch('/teams', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const teams = await response.json();
                const container = document.getElementById('team-list');
                
                if (container) {
                    container.innerHTML = teams.map(team => `
                        <div class="compact-list-item">
                            <span>${team.name}</span>
                            <small>${team.member_count || 0} Mitglieder</small>
                        </div>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('Error loading teams:', error);
        }
    }

    // Load Employees for Select
    async function loadEmployeesForSelect() {
        try {
            const response = await fetch('/admin/employees', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const employees = await response.json();
                const select = document.getElementById('upload-employee-select');
                
                if (select) {
                    select.innerHTML = '<option value="">Bitte wählen...</option>' +
                        employees.map(emp => `
                            <option value="${emp.id}">${emp.first_name} ${emp.last_name}</option>
                        `).join('');
                }
            }
        } catch (error) {
            console.error('Error loading employees for select:', error);
        }
    }

    // Load Departments for Select
    async function loadDepartmentsForSelect() {
        try {
            const response = await fetch('/departments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const departments = await response.json();
                const select = document.querySelector('#team-form select[name="department_id"]');
                
                if (select) {
                    select.innerHTML = '<option value="">Keine Abteilung</option>' +
                        departments.map(dept => `
                            <option value="${dept.id}">${dept.name}</option>
                        `).join('');
                }
            }
        } catch (error) {
            console.error('Error loading departments for select:', error);
        }
    }

    // Upload Document
    async function uploadDocument(e) {
        e.preventDefault();
        const formData = new FormData(uploadDocumentForm);

        try {
            const response = await fetch('/documents/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                alert('Dokument erfolgreich hochgeladen');
                uploadDocumentForm.reset();
                hideModal('document-modal');
                loadRecentDocuments();
                loadDashboardStats();
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Fehler beim Hochladen des Dokuments:', error);
            alert('Ein Fehler ist aufgetreten.');
        }
    }

    // Create Department
    async function createDepartment(e) {
        e.preventDefault();
        
        const formData = new FormData(departmentForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/departments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('Abteilung erfolgreich erstellt');
                departmentForm.reset();
                hideModal('department-modal');
                
                // Reload all department lists
                await loadDepartments();
                await loadDashboardStats();
                if (typeof loadDepartmentsTable === 'function') {
                    await loadDepartmentsTable();
                }
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Exception beim Erstellen der Abteilung:', error);
            alert('Ein Fehler ist aufgetreten: ' + error.message);
        }
    }

    // Create Team
    async function createTeam(e) {
        e.preventDefault();
        const formData = new FormData(teamForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('Team erfolgreich erstellt');
                teamForm.reset();
                hideModal('team-modal');
                loadTeams();
                loadDashboardStats();
            } else {
                const error = await response.json();
                alert(`Fehler: ${error.message}`);
            }
        } catch (error) {
            console.error('Fehler beim Erstellen des Teams:', error);
            alert('Ein Fehler ist aufgetreten.');
        }
    }

    // Logout
    function logout() {
        if (confirm('Möchten Sie sich wirklich abmelden?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            window.location.href = '/';
        }
    }
});

// Global functions for modals
function loadEmployeesForSelect() {
    const token = localStorage.getItem('token');
    const select = document.getElementById('upload-employee-select');
    if (select) {
        loadEmployeesForSelectElement(select, token);
    }
}

function loadDepartmentsForSelect() {
    const token = localStorage.getItem('token');
    const select = document.querySelector('#team-form select[name="department_id"]');
    if (select) {
        loadDepartmentsForSelectElement(select, token);
    }
}

// Load employees for payslip select
async function loadEmployeesForPayslipSelect() {
    const token = localStorage.getItem('token');
    const select = document.getElementById('payslip-employee-select');
    
    if (select) {
        try {
            const response = await fetch('/admin/employees', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const employees = await response.json();
                select.innerHTML = '<option value="">Bitte wählen...</option>' +
                    employees.map(emp => `
                        <option value="${emp.id}">${emp.first_name} ${emp.last_name}</option>
                    `).join('');
            }
        } catch (error) {
            console.error('Error loading employees for payslip select:', error);
        }
    }
}

// Load data for tables
async function loadEmployeesTable() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/admin/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const employees = await response.json();
            const tbody = document.getElementById('employees-table-body');
            
            if (tbody) {
                tbody.innerHTML = employees.map(emp => `
                    <tr>
                        <td>${emp.first_name} ${emp.last_name}</td>
                        <td>${emp.email}</td>
                        <td>${emp.position || '-'}</td>
                        <td>${emp.department_name || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="editEmployee(${emp.id})">Bearbeiten</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${emp.id})">Löschen</button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading employees table:', error);
    }
}

async function loadDocumentsTable() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/documents', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const documents = await response.json();
            const tbody = document.getElementById('documents-table-body');
            
            if (tbody) {
                tbody.innerHTML = documents.map(doc => `
                    <tr>
                        <td>${doc.file_name}</td>
                        <td>${doc.employee_name || '-'}</td>
                        <td>${doc.category}</td>
                        <td>${new Date(doc.upload_date).toLocaleDateString()}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="downloadDocument(${doc.id})">Download</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteDocument(${doc.id})">Löschen</button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading documents table:', error);
    }
}

async function loadPayslipsTable() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/documents?category=payslip', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const payslips = await response.json();
            const tbody = document.getElementById('payslips-table-body');
            
            if (tbody) {
                tbody.innerHTML = payslips.map(doc => `
                    <tr>
                        <td>${doc.employee_name || '-'}</td>
                        <td>${doc.month || '-'}</td>
                        <td>${new Date(doc.upload_date).toLocaleDateString()}</td>
                        <td>${doc.file_name}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="downloadDocument(${doc.id})">Download</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteDocument(${doc.id})">Löschen</button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading payslips table:', error);
    }
}

async function loadDepartmentsTable() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const departments = await response.json();
            const tbody = document.getElementById('departments-table-body');
            
            if (tbody) {
                tbody.innerHTML = departments.map(dept => `
                    <tr>
                        <td>${dept.name}</td>
                        <td>${dept.description || '-'}</td>
                        <td>
                            <span class="badge ${dept.status === 'active' ? 'badge-success' : 'badge-warning'}">
                                ${dept.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                            </span>
                        </td>
                        <td>
                            <span class="badge ${dept.visibility === 'public' ? 'badge-primary' : 'badge-secondary'}">
                                ${dept.visibility === 'public' ? 'Öffentlich' : 'Privat'}
                            </span>
                        </td>
                        <td>${dept.manager_name || '-'}</td>
                        <td>${dept.employee_count || 0}</td>
                        <td>${dept.team_count || 0}</td>
                        <td>
                            <button class="btn btn-sm btn-warning" onclick="toggleDepartmentStatus(${dept.id}, '${dept.status}')">
                                ${dept.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="editDepartment(${dept.id})">Bearbeiten</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteDepartment(${dept.id})">Löschen</button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading departments table:', error);
    }
}

async function loadTeamsTable() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/teams', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const teams = await response.json();
            const tbody = document.getElementById('teams-table-body');
            
            if (tbody) {
                tbody.innerHTML = teams.map(team => `
                    <tr>
                        <td>${team.name}</td>
                        <td>${team.department_name || '-'}</td>
                        <td>${team.description || '-'}</td>
                        <td>${team.member_count || 0}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="editTeam(${team.id})">Bearbeiten</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteTeam(${team.id})">Löschen</button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading teams table:', error);
    }
}

// Helper functions for select elements
async function loadEmployeesForSelectElement(selectElement, token) {
    try {
        const response = await fetch('/admin/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const employees = await response.json();
            selectElement.innerHTML = '<option value="">Bitte wählen...</option>' +
                employees.map(emp => `
                    <option value="${emp.id}">${emp.first_name} ${emp.last_name}</option>
                `).join('');
        }
    } catch (error) {
        console.error('Error loading employees for select:', error);
    }
}

async function loadDepartmentsForSelectElement(selectElement, token) {
    try {
        const response = await fetch('/departments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const departments = await response.json();
            selectElement.innerHTML = '<option value="">Keine Abteilung</option>' +
                departments.map(dept => `
                    <option value="${dept.id}">${dept.name}</option>
                `).join('');
        }
    } catch (error) {
        console.error('Error loading departments for select:', error);
    }
}

// Department management functions
async function toggleDepartmentStatus(departmentId, currentStatus) {
    const token = localStorage.getItem("token");
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    
    try {
        const response = await fetch(`/departments/${departmentId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            alert(`Abteilung wurde ${newStatus === "active" ? "aktiviert" : "deaktiviert"}`);
            loadDepartmentsTable();
            loadDashboardStats();
        } else {
            const error = await response.json();
            alert(`Fehler: ${error.message}`);
        }
    } catch (error) {
        console.error("Error toggling department status:", error);
        alert("Ein Fehler ist aufgetreten.");
    }
}

async function editDepartment(departmentId) {
    const token = localStorage.getItem("token");
    
    try {
        const response = await fetch(`/departments/${departmentId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const department = await response.json();
            
            // Create edit modal content
            const modalContent = `
                <div class="modal" id="edit-department-modal" style="display: flex;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title">Abteilung bearbeiten</h3>
                            <button class="modal-close" onclick="hideModal(\"edit-department-modal\")">&times;</button>
                        </div>
                        <form id="edit-department-form" onsubmit="updateDepartment(event, ${departmentId})">
                            <div class="form-group">
                                <label class="form-label">Name</label>
                                <input type="text" name="name" class="form-control" value="${department.name}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Beschreibung</label>
                                <textarea name="description" class="form-control" rows="3">${department.description || ""}</textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select name="status" class="form-control">
                                    <option value="active" ${department.status === "active" ? "selected" : ""}>Aktiv</option>
                                    <option value="inactive" ${department.status === "inactive" ? "selected" : ""}>Inaktiv</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Sichtbarkeit</label>
                                <select name="visibility" class="form-control">
                                    <option value="public" ${department.visibility === "public" ? "selected" : ""}>Öffentlich</option>
                                    <option value="private" ${department.visibility === "private" ? "selected" : ""}>Privat</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary">Änderungen speichern</button>
                        </form>
                    </div>
                </div>
            `;
            
            // Add modal to body
            document.body.insertAdjacentHTML("beforeend", modalContent);
        }
    } catch (error) {
        console.error("Error loading department:", error);
        alert("Fehler beim Laden der Abteilung.");
    }
}

async function updateDepartment(event, departmentId) {
    event.preventDefault();
    const token = localStorage.getItem("token");
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch(`/departments/${departmentId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert("Abteilung erfolgreich aktualisiert");
            hideModal("edit-department-modal");
            loadDepartmentsTable();
            loadDashboardStats();
        } else {
            const error = await response.json();
            alert(`Fehler: ${error.message}`);
        }
    } catch (error) {
        console.error("Error updating department:", error);
        alert("Ein Fehler ist aufgetreten.");
    }
}

async function deleteDepartment(departmentId) {
    if (!confirm("Sind Sie sicher, dass Sie diese Abteilung löschen möchten?")) {
        return;
    }
    
    const token = localStorage.getItem("token");
    
    try {
        const response = await fetch(`/departments/${departmentId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            alert("Abteilung erfolgreich gelöscht");
            loadDepartmentsTable();
            loadDashboardStats();
        } else {
            const error = await response.json();
            alert(`Fehler: ${error.message}`);
        }
    } catch (error) {
        console.error("Error deleting department:", error);
        alert("Ein Fehler ist aufgetreten.");
    }
}

// Global hideModal function
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "none";
    }
}
