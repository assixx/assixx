// Global token variable
let token;

document.addEventListener('DOMContentLoaded', () => {
  token = localStorage.getItem('token');

  // Temporär deaktiviert: Auch ohne Token weitermachen (für Testzwecke)
  // if (!token) {
  //     console.log('No token found, redirecting to login');
  //     window.location.href = '/';
  //     return;
  // }

  // Für Testzwecke ohne Token
  if (!token) {
    token = 'test-mode';
  }

  // Load user info in header
  loadHeaderUserInfo();

  // Event Listeners for forms
  const createEmployeeForm = document.getElementById('create-employee-form');
  const uploadDocumentForm = document.getElementById('document-upload-form');
  const departmentForm = document.getElementById('department-form');
  const teamForm = document.getElementById('team-form');
  const logoutBtn = document.getElementById('logout-btn');

  // Buttons für Mitarbeiter-Modal
  const newEmployeeBtn = document.getElementById('new-employee-button');
  const employeesSectionNewBtn = document.getElementById(
    'employees-section-new-button'
  );

  // Event-Listener für Formulare
  if (createEmployeeForm) {
    createEmployeeForm.addEventListener('submit', createEmployee);

    // Live-Validierung für E-Mail und Passwort hinzufügen
    const emailInput = document.getElementById('email');
    const emailConfirmInput = document.getElementById('email_confirm');
    const emailError = document.getElementById('email-error');

    const passwordInput = document.getElementById('password');
    const passwordConfirmInput = document.getElementById('password_confirm');
    const passwordError = document.getElementById('password-error');

    // E-Mail-Validierung
    if (emailInput && emailConfirmInput && emailError) {
      const checkEmails = function () {
        if (
          emailConfirmInput.value &&
          emailInput.value !== emailConfirmInput.value
        ) {
          emailError.style.display = 'block';
        } else {
          emailError.style.display = 'none';
        }
      };

      emailInput.addEventListener('input', checkEmails);
      emailConfirmInput.addEventListener('input', checkEmails);
    }

    // Passwort-Validierung
    if (passwordInput && passwordConfirmInput && passwordError) {
      const checkPasswords = function () {
        if (
          passwordConfirmInput.value &&
          passwordInput.value !== passwordConfirmInput.value
        ) {
          passwordError.style.display = 'block';
        } else {
          passwordError.style.display = 'none';
        }
      };

      passwordInput.addEventListener('input', checkPasswords);
      passwordConfirmInput.addEventListener('input', checkPasswords);
    }
  }
  // TODO: uploadDocument function needs to be implemented
  // if (uploadDocumentForm) uploadDocumentForm.addEventListener('submit', uploadDocument);
  if (departmentForm)
    departmentForm.addEventListener('submit', createDepartment);
  if (teamForm) teamForm.addEventListener('submit', createTeam);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Event-Listener für Mitarbeiter-Buttons
  if (newEmployeeBtn) {
    newEmployeeBtn.addEventListener('click', function () {
      showNewEmployeeModal();
    });
  } else {
  }

  if (employeesSectionNewBtn) {
    employeesSectionNewBtn.addEventListener('click', function () {
      showNewEmployeeModal();
    });
  } else {
  }

  // Funktion zum Anzeigen des Mitarbeiter-Modals
  function showNewEmployeeModal() {
    const modal = document.getElementById('employee-modal');
    if (modal) {
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

      // Modal anzeigen
      modal.style.display = 'flex';

      // Abteilungen für das Formular laden
      loadDepartmentsForEmployeeSelect();
    } else {
      console.error('employee-modal element not found!');
      alert('Das Mitarbeiterformular konnte nicht geöffnet werden.');
    }
  }

  // Initial loads - add slight delay to ensure DOM is ready
  setTimeout(() => {
    loadDashboardStats();
    loadRecentEmployees();
    loadRecentDocuments();
    loadDepartments();
    loadTeams();
    loadDepartmentsForEmployeeSelect(); // Laden der Abteilungen für Mitarbeiterformular
  }, 100);

  // Load Dashboard Statistics
  async function loadDashboardStats() {
    try {
      // Direkt den Test-Endpunkt verwenden
      const statsRes = await fetch('/test/db/counts');

      if (statsRes.ok) {
        const stats = await statsRes.json();

        // Update UI mit den Statistiken aus dem Testendpunkt
        document.getElementById('employee-count').textContent =
          stats.employees || 0;
        document.getElementById('document-count').textContent =
          stats.documents || 0;

        const deptCountElement = document.getElementById('department-count');
        if (deptCountElement) {
          deptCountElement.textContent = stats.departments || 0;
        }

        document.getElementById('team-count').textContent = stats.teams || 0;
      } else {
        console.error('Failed to load dashboard stats', statsRes.statusText);

        // Fallback: Einzeln laden, wenn der stats-Endpunkt fehlschlägt
        await loadDashboardStatsIndividually();
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);

      // Fallback: Einzeln laden bei einem Fehler
      await loadDashboardStatsIndividually();
    }
  }

  // Fallback-Funktion, die Statistiken einzeln lädt
  async function loadDashboardStatsIndividually() {
    // Mitarbeiter
    try {
      const employeesRes = await fetch('/admin/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (employeesRes.ok) {
        const employees = await employeesRes.json();

        document.getElementById('employee-count').textContent =
          employees.length;
      } else {
        console.error('Failed to load employees', employeesRes.statusText);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }

    // Dokumente
    try {
      const documentsRes = await fetch('/documents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (documentsRes.ok) {
        const documents = await documentsRes.json();

        document.getElementById('document-count').textContent =
          documents.length;
      } else {
        console.error('Failed to load documents', documentsRes.statusText);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }

    // Abteilungen
    try {
      const departmentsRes = await fetch('/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (departmentsRes.ok) {
        const departments = await departmentsRes.json();

        const deptCountElement = document.getElementById('department-count');
        if (deptCountElement) {
          deptCountElement.textContent = departments.length;
        }
      } else {
        console.error('Failed to load departments', departmentsRes.statusText);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }

    // Teams
    try {
      const teamsRes = await fetch('/teams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (teamsRes.ok) {
        const teams = await teamsRes.json();

        document.getElementById('team-count').textContent = teams.length;
      } else {
        console.error('Failed to load teams', teamsRes.statusText);
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

    // E-Mail-Übereinstimmung prüfen
    if (employeeData.email !== employeeData.email_confirm) {
      document.getElementById('email-error').style.display = 'block';
      alert('Die E-Mail-Adressen stimmen nicht überein');
      return;
    } else {
      document.getElementById('email-error').style.display = 'none';
    }

    // Passwort-Übereinstimmung prüfen
    if (employeeData.password !== employeeData.password_confirm) {
      document.getElementById('password-error').style.display = 'block';
      alert('Die Passwörter stimmen nicht überein');
      return;
    } else {
      document.getElementById('password-error').style.display = 'none';
    }

    // Validierung auf Client-Seite, um bessere Fehlermeldungen zu geben
    if (!employeeData.username || employeeData.username.length < 3) {
      alert('Der Benutzername muss mindestens 3 Zeichen lang sein.');
      return;
    }

    if (!employeeData.email || !employeeData.email.includes('@')) {
      alert('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }

    if (!employeeData.password || employeeData.password.length < 6) {
      alert('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    if (!employeeData.age || employeeData.age < 18 || employeeData.age > 100) {
      alert('Das Alter muss zwischen 18 und 100 Jahren liegen.');
      return;
    }

    // Entferne die Bestätigungsfelder, die nicht zum Server gesendet werden sollen
    delete employeeData.email_confirm;
    delete employeeData.password_confirm;

    // Automatische Mitarbeiter-ID generieren (Timestamp + zufällige Zahl)
    employeeData.employee_id =
      'EMP' +
      Date.now().toString().slice(-6) +
      Math.floor(Math.random() * 1000);

    // Bei leerer Abteilung setzen wir null statt leeren String
    if (employeeData.department_id === '') {
      employeeData.department_id = null;
    }

    try {
      const response = await fetch('/admin/create-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(employeeData),
      });

      if (response.ok) {
        alert('Mitarbeiter erfolgreich erstellt');
        createEmployeeForm.reset();
        hideModal('employee-modal');
        loadRecentEmployees();
        loadDashboardStats();
        loadEmployeesForSelect();
        loadEmployeesTable('reload'); // Mitarbeitertabelle neu laden
      } else {
        const error = await response.json();
        alert(
          `Fehler: ${error.message || 'Unbekannter Fehler bei der Mitarbeitererstellung'}`
        );
      }
    } catch (error) {
      console.error('Fehler beim Erstellen des Mitarbeiters:', error);
      alert(`Ein Fehler ist aufgetreten: ${  error.message}`);
    }
  }

  // Load Recent Employees
  async function loadRecentEmployees() {
    try {
      // Direkt den Test-Endpunkt verwenden
      const response = await fetch('/test/db/employees');

      if (response.ok) {
        const employees = await response.json();

        // Sicherstellen, dass wir ein Array haben
        if (!Array.isArray(employees)) {
          console.error(
            'Expected employees to be an array, got:',
            typeof employees
          );
          return;
        }

        // Nehme die neuesten 5 Mitarbeiter und kehre die Reihenfolge um
        const recentEmployees = employees.slice(-5).reverse();

        // Update the employee box on dashboard
        const container = document.getElementById('recent-employees');
        if (container) {
          if (recentEmployees.length === 0) {
            container.innerHTML =
              '<div class="compact-list-item">Keine Mitarbeiter vorhanden</div>';
          } else {
            container.innerHTML = recentEmployees
              .map(
                (emp) => `
                            <div class="compact-list-item">
                                <span>${emp.first_name || ''} ${emp.last_name || ''}</span>
                                <small>${emp.position || emp.role || 'Keine Position'}</small>
                            </div>
                        `
              )
              .join('');
          }
        } else {
        }

        // Update the recent employees list in "Recently Added" section
        const recentList = document.getElementById('recent-employees-list');
        if (recentList) {
          if (recentEmployees.length === 0) {
            recentList.innerHTML = '<li>Keine neuen Mitarbeiter</li>';
          } else {
            recentList.innerHTML = recentEmployees
              .map(
                (emp) => `
                            <li>${emp.first_name || ''} ${emp.last_name || ''} - ${emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'Unbekanntes Datum'}</li>
                        `
              )
              .join('');
          }
        } else {
        }
      } else {
        console.error('Failed to load employees:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading recent employees:', error);
    }
  }

  // Load Recent Documents
  async function loadRecentDocuments() {
    try {
      // Direkt den Test-Endpunkt verwenden
      const response = await fetch('/test/db/documents');

      if (response.ok) {
        const documents = await response.json();
        const recentDocuments = documents.slice(-5).reverse();
        const container = document.getElementById('recent-documents');

        if (container) {
          container.innerHTML = recentDocuments
            .map(
              (doc) => `
                        <div class="compact-list-item">
                            <span>${doc.file_name}</span>
                            <small>${doc.category}</small>
                        </div>
                    `
            )
            .join('');
        }

        // Also update the recent documents list
        const recentList = document.getElementById('recent-documents-list');
        if (recentList) {
          recentList.innerHTML = recentDocuments
            .map(
              (doc) => `
                        <li>${doc.file_name} - ${new Date(doc.upload_date).toLocaleDateString()}</li>
                    `
            )
            .join('');
        }
      }
    } catch (error) {
      console.error('Error loading recent documents:', error);
    }
  }

  // Load Departments
  async function loadDepartments() {
    try {
      // Direkt den Test-Endpunkt verwenden
      const response = await fetch('/test/db/departments');

      if (response.ok) {
        const departments = await response.json();

        // Sicherstellen, dass wir ein Array haben
        if (!Array.isArray(departments)) {
          console.error(
            'Expected departments to be an array, got:',
            typeof departments
          );
          return;
        }

        const container = document.getElementById('department-list');

        if (container) {
          if (departments.length === 0) {
            container.innerHTML =
              '<div class="compact-list-item">Keine Abteilungen vorhanden</div>';
          } else {
            container.innerHTML = departments
              .map(
                (dept) => `
                            <div class="compact-list-item">
                                <span>${dept.name || 'Unbenannte Abteilung'}</span>
                                <small>${dept.employee_count || 0} Mitarbeiter</small>
                            </div>
                        `
              )
              .join('');
          }
        } else {
        }

        // Aktualisiere auch die Abteilungen für Auswahlfelder
        loadDepartmentsForEmployeeSelect();
      } else {
        console.error('Failed to load departments:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  // Load Teams
  async function loadTeams() {
    try {
      const response = await fetch('/teams', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const teams = await response.json();
        const container = document.getElementById('team-list');

        if (container) {
          container.innerHTML = teams
            .map(
              (team) => `
                        <div class="compact-list-item">
                            <span>${team.name}</span>
                            <small>${team.member_count || 0} Mitglieder</small>
                        </div>
                    `
            )
            .join('');
        }
      }
    } catch (error) {
      console.error('Error loading teams:', error);
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
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
      alert(`Ein Fehler ist aufgetreten: ${  error.message}`);
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
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
  const select = document.querySelector(
    '#team-form select[name="department_id"]'
  );
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
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const employees = await response.json();
        select.innerHTML =
          `<option value="">Bitte wählen...</option>${ 
                    employees.map(emp => `
                        <option value="${emp.id}">${emp.first_name} ${emp.last_name}</option>
                    `).join('')}`;
      }
    } catch (error) {
      console.error('Error loading employees for payslip select:', error);
    }
  }
}

// Load data for tables
// Globale Variable für Mitarbeiter
let allEmployees = [];

async function loadEmployeesTable(filter = '') {
  const token = localStorage.getItem('token');
  try {
    // Wenn wir noch keine Mitarbeiter haben oder ein Neuladeflag gesetzt ist, laden wir sie neu
    if (allEmployees.length === 0 || filter === 'reload') {
      const response = await fetch('/admin/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        allEmployees = await response.json();
      } else {
        console.error('Failed to load employees');
        return;
      }
    }

    // Mitarbeiter filtern, basierend auf dem übergebenen Filter
    let filteredEmployees = [...allEmployees];

    if (filter === 'inactive') {
      filteredEmployees = allEmployees.filter(
        (emp) => emp.status === 'inactive'
      );
    } else if (filter === 'active') {
      filteredEmployees = allEmployees.filter(
        (emp) => emp.status !== 'inactive'
      );
    } else if (filter && filter !== 'reload' && filter !== 'all') {
      // Suche nach einem Textfilter
      const searchTerm = filter.toLowerCase();
      filteredEmployees = allEmployees.filter(
        (emp) =>
          (emp.first_name &&
            emp.first_name.toLowerCase().includes(searchTerm)) ||
          (emp.last_name && emp.last_name.toLowerCase().includes(searchTerm)) ||
          (emp.email && emp.email.toLowerCase().includes(searchTerm)) ||
          (emp.position && emp.position.toLowerCase().includes(searchTerm)) ||
          (emp.employee_id &&
            emp.employee_id.toLowerCase().includes(searchTerm))
      );
    }

    const tbody = document.getElementById('employees-table-body');

    if (tbody) {
      if (filteredEmployees.length === 0) {
        tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center">Keine Mitarbeiter gefunden</td>
                    </tr>
                `;
        return;
      }

      tbody.innerHTML = filteredEmployees
        .map(
          (emp) => `
                <tr class="${emp.status === 'inactive' ? 'table-row-inactive' : ''}">
                    <td>${emp.first_name} ${emp.last_name}</td>
                    <td>${emp.email}</td>
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
            `
        )
        .join('');
    }
  } catch (error) {
    console.error('Error loading employees table:', error);
  }
}

// Event-Listener für Mitarbeitersuche und -Filter hinzufügen
document.addEventListener('DOMContentLoaded', () => {
  // Mitarbeitersuche
  const searchInput = document.getElementById('employee-search');
  const searchBtn = document.getElementById('employee-search-btn');

  if (searchInput && searchBtn) {
    // Suche bei Klick auf den Suchen-Button
    searchBtn.addEventListener('click', () => {
      const searchTerm = searchInput.value.trim();
      if (searchTerm) {
        loadEmployeesTable(searchTerm);
      } else {
        loadEmployeesTable('all');
      }
    });

    // Suche bei Drücken der Enter-Taste
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
          loadEmployeesTable(searchTerm);
        } else {
          loadEmployeesTable('all');
        }
      }
    });
  }

  // Filter-Buttons für Mitarbeiter
  const showAllBtn = document.getElementById('show-all-employees');
  const showActiveBtn = document.getElementById('filter-employees-active');
  const showInactiveBtn = document.getElementById('filter-employees-inactive');

  // Funktion zum Setzen der aktiven Klasse
  const setActiveFilterButton = (activeBtn) => {
    [showAllBtn, showActiveBtn, showInactiveBtn].forEach((btn) => {
      if (btn) {
        if (btn === activeBtn) {
          btn.classList.add('active');
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
        } else {
          btn.classList.remove('active');
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
        }
      }
    });
  };

  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      loadEmployeesTable('all');
      setActiveFilterButton(showAllBtn);
    });
  }

  if (showActiveBtn) {
    showActiveBtn.addEventListener('click', () => {
      loadEmployeesTable('active');
      setActiveFilterButton(showActiveBtn);
    });
  }

  if (showInactiveBtn) {
    showInactiveBtn.addEventListener('click', () => {
      loadEmployeesTable('inactive');
      setActiveFilterButton(showInactiveBtn);
    });
  }
});

// Globale Variable für Dokumente
let allDocuments = [];

async function loadDocumentsTable(filter = '') {
  const token = localStorage.getItem('token');
  try {
    // Wenn wir noch keine Dokumente haben oder ein Neuladeflag gesetzt ist, laden wir sie neu
    if (allDocuments.length === 0 || filter === 'reload') {
      const response = await fetch('/documents', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        allDocuments = await response.json();
      } else {
        console.error('Failed to load documents');
        return;
      }
    }

    // Dokumente filtern, basierend auf dem übergebenen Filter
    let filteredDocuments = [...allDocuments];

    if (filter === 'archived') {
      filteredDocuments = allDocuments.filter((doc) => doc.is_archived);
    } else if (filter === 'active') {
      filteredDocuments = allDocuments.filter((doc) => !doc.is_archived);
    } else if (filter && filter !== 'reload' && filter !== 'all') {
      // Suche nach einem Textfilter
      const searchTerm = filter.toLowerCase();
      filteredDocuments = allDocuments.filter(
        (doc) =>
          (doc.file_name && doc.file_name.toLowerCase().includes(searchTerm)) ||
          (doc.employee_name &&
            doc.employee_name.toLowerCase().includes(searchTerm)) ||
          (doc.category && doc.category.toLowerCase().includes(searchTerm)) ||
          (doc.description &&
            doc.description.toLowerCase().includes(searchTerm))
      );
    }

    const tbody = document.getElementById('documents-table-body');

    if (tbody) {
      if (filteredDocuments.length === 0) {
        tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center">Keine Dokumente gefunden</td>
                    </tr>
                `;
        return;
      }

      tbody.innerHTML = filteredDocuments
        .map(
          (doc) => `
                <tr class="${doc.is_archived ? 'table-row-archived' : ''}">
                    <td>${doc.file_name}</td>
                    <td>${doc.employee_name || '-'}</td>
                    <td>${doc.category}</td>
                    <td>${new Date(doc.upload_date).toLocaleDateString()}</td>
                    <td>
                        ${
                          doc.is_archived
                            ? '<span class="badge badge-secondary">Archiviert</span>'
                            : '<span class="badge badge-success">Aktiv</span>'
                        }
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="downloadDocument(${doc.id})">Download</button>
                        <button class="btn btn-sm ${doc.is_archived ? 'btn-info' : 'btn-warning'}" 
                            onclick="toggleDocumentArchive(${doc.id}, ${doc.is_archived})">
                            ${doc.is_archived ? 'Wiederherstellen' : 'Archivieren'}
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteDocument(${doc.id})">Löschen</button>
                    </td>
                </tr>
            `
        )
        .join('');
    }
  } catch (error) {
    console.error('Error loading documents table:', error);
  }
}

// Event-Listener für Dokumentensuche hinzufügen
document.addEventListener('DOMContentLoaded', () => {
  // Dokumentensuche
  const searchInput = document.getElementById('document-search');
  const searchBtn = document.getElementById('document-search-btn');

  if (searchInput && searchBtn) {
    // Suche bei Klick auf den Suchen-Button
    searchBtn.addEventListener('click', () => {
      const searchTerm = searchInput.value.trim();
      if (searchTerm) {
        loadDocumentsTable(searchTerm);
      } else {
        loadDocumentsTable('all');
      }
    });

    // Suche bei Drücken der Enter-Taste
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
          loadDocumentsTable(searchTerm);
        } else {
          loadDocumentsTable('all');
        }
      }
    });
  }

  // Filter-Buttons
  const showAllBtn = document.getElementById('show-all-documents');
  const showArchivedBtn = document.getElementById('filter-documents-archived');
  const showActiveBtn = document.getElementById('filter-documents-active');

  // Funktion zum Setzen der aktiven Klasse
  const setActiveFilterButton = (activeBtn) => {
    [showAllBtn, showArchivedBtn, showActiveBtn].forEach((btn) => {
      if (btn) {
        if (btn === activeBtn) {
          btn.classList.add('active');
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
        } else {
          btn.classList.remove('active');
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
        }
      }
    });
  };

  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      loadDocumentsTable('all');
      setActiveFilterButton(showAllBtn);
    });
  }

  if (showArchivedBtn) {
    showArchivedBtn.addEventListener('click', () => {
      loadDocumentsTable('archived');
      setActiveFilterButton(showArchivedBtn);
    });
  }

  if (showActiveBtn) {
    showActiveBtn.addEventListener('click', () => {
      loadDocumentsTable('active');
      setActiveFilterButton(showActiveBtn);
    });
  }

  // Setze "Alle anzeigen" standardmäßig als aktiv
  if (showAllBtn) {
    showAllBtn.classList.add('active');
    showAllBtn.classList.remove('btn-secondary');
    showAllBtn.classList.add('btn-primary');
  }
});

async function loadPayslipsTable() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch('/documents?category=payslip', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const payslips = await response.json();
      const tbody = document.getElementById('payslips-table-body');

      if (tbody) {
        tbody.innerHTML = payslips
          .map(
            (doc) => `
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
                `
          )
          .join('');
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
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const departments = await response.json();
      const tbody = document.getElementById('departments-table-body');

      if (tbody) {
        tbody.innerHTML = departments
          .map(
            (dept) => `
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
                `
          )
          .join('');
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
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const teams = await response.json();
      const tbody = document.getElementById('teams-table-body');

      if (tbody) {
        tbody.innerHTML = teams
          .map(
            (team) => `
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
                `
          )
          .join('');
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
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const employees = await response.json();
      selectElement.innerHTML =
        `<option value="">Bitte wählen...</option>${ 
                employees.map(emp => `
                    <option value="${emp.id}">${emp.first_name} ${emp.last_name}</option>
                `).join('')}`;
    }
  } catch (error) {
    console.error('Error loading employees for select:', error);
  }
}

async function loadDepartmentsForSelectElement(selectElement, token) {
  try {
    const response = await fetch('/departments', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const departments = await response.json();
      selectElement.innerHTML =
        `<option value="">Keine Abteilung</option>${ 
                departments.map(dept => `
                    <option value="${dept.id}">${dept.name}</option>
                `).join('')}`;
    }
  } catch (error) {
    console.error('Error loading departments for select:', error);
  }
}

// Lade Abteilungen für das Mitarbeiterformular
async function loadDepartmentsForEmployeeSelect() {
  const token = localStorage.getItem('token');
  const select = document.getElementById('employee-department-select');

  if (select) {
    try {
      // Status-Anzeige
      select.innerHTML =
        '<option value="">Abteilungen werden geladen...</option>';

      // Direkt den Test-Endpunkt verwenden
      const response = await fetch('/test/db/departments');

      if (response.ok) {
        const departments = await response.json();

        // Sicherstellen, dass wir ein Array haben
        if (!Array.isArray(departments)) {
          console.error(
            'Expected departments to be an array, got:',
            typeof departments
          );
          select.innerHTML =
            '<option value="">Fehler beim Laden der Abteilungen</option>';
          return;
        }

        if (departments.length === 0) {
          select.innerHTML =
            '<option value="">Keine Abteilungen verfügbar</option>';
        } else {
          select.innerHTML =
            `<option value="">Keine Abteilung</option>${ 
                        departments.map(dept => `
                            <option value="${dept.id}">${dept.name || 'Unbenannte Abteilung'}</option>
                        `).join('')}`;
              )
              .join('');
        }
      } else {
        console.error('Failed to load departments for employee select');
        select.innerHTML =
          '<option value="">Fehler beim Laden der Abteilungen</option>';
      }
    } catch (error) {
      console.error('Error loading departments for employee select:', error);
      select.innerHTML =
        '<option value="">Fehler beim Laden der Abteilungen</option>';
    }
  } else {
  }
}

// Department management functions
async function toggleDepartmentStatus(departmentId, currentStatus) {
  const token = localStorage.getItem('token');
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

  try {
    const response = await fetch(`/departments/${departmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (response.ok) {
      alert(
        `Abteilung wurde ${newStatus === 'active' ? 'aktiviert' : 'deaktiviert'}`
      );
      loadDepartmentsTable();
      loadDashboardStats();
    } else {
      const error = await response.json();
      alert(`Fehler: ${error.message}`);
    }
  } catch (error) {
    console.error('Error toggling department status:', error);
    alert('Ein Fehler ist aufgetreten.');
  }
}

// Employee management functions
async function toggleEmployeeStatus(employeeId, currentStatus) {
  const token = localStorage.getItem('token');
  const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';

  // Bestätigungsdialog anzeigen
  const confirmAction = confirm(
    `Möchten Sie diesen Mitarbeiter wirklich ${newStatus === 'active' ? 'aktivieren' : 'deaktivieren'}?` +
      `\n\nStatus wird geändert von: ${currentStatus === 'inactive' ? 'Inaktiv' : 'Aktiv'}` +
      `\nZu: ${newStatus === 'active' ? 'Aktiv' : 'Inaktiv'}`
  );

  if (!confirmAction) {
    return; // Wenn der Benutzer abbricht, nichts tun
  }

  try {
    const response = await fetch(
      `/admin/toggle-employee-status/${employeeId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      }
    );

    const result = await response.json();

    if (response.ok) {
      // Prüfen, ob eine Änderung tatsächlich durchgeführt wurde
      if (result.changed === false) {
        alert(result.message);
      } else {
        alert(
          `Mitarbeiter wurde ${newStatus === 'active' ? 'aktiviert' : 'deaktiviert'}`
        );
        // Aktualisiere die Mitarbeiterliste im Speicher
        const updatedEmployee = allEmployees.find(
          (emp) => emp.id === employeeId
        );
        if (updatedEmployee) {
          updatedEmployee.status = newStatus;
        }
        loadEmployeesTable('reload');
        loadDashboardStats();
      }
    } else {
      alert(
        `Fehler: ${result.message || 'Unbekannter Fehler beim Statuswechsel'}`
      );
    }
  } catch (error) {
    console.error('Error toggling employee status:', error);
    alert('Ein Fehler ist aufgetreten beim Statuswechsel.');
  }
}

async function editEmployee(employeeId) {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`/admin/employees/${employeeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const employee = await response.json();

      // Create edit modal content
      const modalContent = `
                <div class="modal" id="edit-employee-modal" style="display: flex;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title">Mitarbeiter bearbeiten</h3>
                            <button class="modal-close" onclick="hideModal('edit-employee-modal')">&times;</button>
                        </div>
                        <form id="edit-employee-form" onsubmit="updateEmployee(event, ${employeeId})">
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
                                <input type="number" name="age" class="form-control" min="18" max="100" value="${employee.age}" required>
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
                                    <option value="active" ${employee.status !== 'inactive' ? 'selected' : ''}>Aktiv</option>
                                    <option value="inactive" ${employee.status === 'inactive' ? 'selected' : ''}>Inaktiv</option>
                                </select>
                            </div>
                            <div class="button-group">
                                <button type="submit" class="btn btn-primary">Änderungen speichern</button>
                                <button type="button" class="btn btn-secondary" onclick="hideModal('edit-employee-modal')">Abbrechen</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

      // Add modal to body
      document.body.insertAdjacentHTML('beforeend', modalContent);

      // Lade Abteilungen für das Select-Feld
      const departmentSelect = document.getElementById(
        'edit-employee-department-select'
      );
      await loadDepartmentsForSelectElement(departmentSelect, token);

      // Setze den ausgewählten Wert für die Abteilung
      if (employee.department_id && departmentSelect) {
        for (const option of departmentSelect.options) {
          if (option.value == employee.department_id) {
            option.selected = true;
            break;
          }
        }
      }
    } else {
      console.error('Failed to load employee data');
      alert('Fehler beim Laden der Mitarbeiterdaten.');
    }
  } catch (error) {
    console.error('Error loading employee:', error);
    alert('Fehler beim Laden des Mitarbeiters.');
  }
}

async function updateEmployee(event, employeeId) {
  event.preventDefault();
  const token = localStorage.getItem('token');
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());

  // Prüfen, ob Abteilung leer ist und auf null setzen
  if (data.department_id === '') {
    data.department_id = null;
  }

  try {
    const response = await fetch(`/admin/employees/${employeeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      alert('Mitarbeiter erfolgreich aktualisiert');
      hideModal('edit-employee-modal');
      loadEmployeesTable('reload');
      loadDashboardStats();
      loadRecentEmployees();
    } else {
      const error = await response.json();
      alert(`Fehler: ${error.message}`);
    }
  } catch (error) {
    console.error('Error updating employee:', error);
    alert('Ein Fehler ist aufgetreten beim Aktualisieren des Mitarbeiters.');
  }
}

async function deleteEmployee(employeeId) {
  // Mitarbeiterinformationen holen für einen detaillierteren Bestätigungsdialog
  const token = localStorage.getItem('token');
  let employeeName = 'Mitarbeiter';

  try {
    // Mitarbeiterdaten abrufen
    const response = await fetch(`/admin/employees/${employeeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const employee = await response.json();
      employeeName = `${employee.first_name} ${employee.last_name}`;
    }
  } catch (error) {
    console.error('Error fetching employee details:', error);
  }

  // Detaillierterer Bestätigungsdialog
  const confirmAction = confirm(
    `ACHTUNG: Löschen kann nicht rückgängig gemacht werden!\n\n` +
      `Möchten Sie den Mitarbeiter "${employeeName}" wirklich löschen?\n\n` +
      `Alle zugehörigen Daten werden ebenfalls gelöscht.`
  );

  if (!confirmAction) {
    return;
  }

  try {
    const response = await fetch(`/admin/delete-employee/${employeeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert(`Mitarbeiter "${employeeName}" wurde erfolgreich gelöscht`);
      loadEmployeesTable('reload');
      loadDashboardStats();
      loadRecentEmployees();
    } else {
      // Erweiterte Fehlermeldung
      if (result.documentCount) {
        alert(
          `Fehler: ${result.message}\n\nDer Mitarbeiter hat noch ${result.documentCount} Dokumente zugeordnet.`
        );
      } else {
        alert(
          `Fehler: ${result.message || 'Unbekannter Fehler beim Löschen des Mitarbeiters'}`
        );
      }
    }
  } catch (error) {
    console.error('Error deleting employee:', error);
    alert('Ein Fehler ist aufgetreten beim Löschen des Mitarbeiters.');
  }
}

async function editDepartment(departmentId) {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`/departments/${departmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const department = await response.json();

      // Create edit modal content
      const modalContent = `
                <div class="modal" id="edit-department-modal" style="display: flex;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title">Abteilung bearbeiten</h3>
                            <button class="modal-close" onclick="hideModal('edit-department-modal')">&times;</button>
                        </div>
                        <form id="edit-department-form" onsubmit="updateDepartment(event, ${departmentId})">
                            <div class="form-group">
                                <label class="form-label">Name</label>
                                <input type="text" name="name" class="form-control" value="${department.name}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Beschreibung</label>
                                <textarea name="description" class="form-control" rows="3">${department.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select name="status" class="form-control">
                                    <option value="active" ${department.status === 'active' ? 'selected' : ''}>Aktiv</option>
                                    <option value="inactive" ${department.status === 'inactive' ? 'selected' : ''}>Inaktiv</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Sichtbarkeit</label>
                                <select name="visibility" class="form-control">
                                    <option value="public" ${department.visibility === 'public' ? 'selected' : ''}>Öffentlich</option>
                                    <option value="private" ${department.visibility === 'private' ? 'selected' : ''}>Privat</option>
                                </select>
                            </div>
                            <div class="button-group">
                                <button type="submit" class="btn btn-primary">Änderungen speichern</button>
                                <button type="button" class="btn btn-secondary" onclick="hideModal('edit-department-modal')">Abbrechen</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

      // Add modal to body
      document.body.insertAdjacentHTML('beforeend', modalContent);
    }
  } catch (error) {
    console.error('Error loading department:', error);
    alert('Fehler beim Laden der Abteilung.');
  }
}

async function updateDepartment(event, departmentId) {
  event.preventDefault();
  const token = localStorage.getItem('token');
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`/departments/${departmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      alert('Abteilung erfolgreich aktualisiert');
      hideModal('edit-department-modal');
      loadDepartmentsTable();
      loadDashboardStats();
    } else {
      const error = await response.json();
      alert(`Fehler: ${error.message}`);
    }
  } catch (error) {
    console.error('Error updating department:', error);
    alert('Ein Fehler ist aufgetreten.');
  }
}

async function deleteDepartment(departmentId) {
  if (!confirm('Sind Sie sicher, dass Sie diese Abteilung löschen möchten?')) {
    return;
  }

  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`/departments/${departmentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      alert('Abteilung erfolgreich gelöscht');
      loadDepartmentsTable();
      loadDashboardStats();
    } else {
      const error = await response.json();
      alert(`Fehler: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting department:', error);
    alert('Ein Fehler ist aufgetreten.');
  }
}

// Team Management Functions
async function editTeam(teamId) {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`/teams/${teamId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const team = await response.json();

      // Create edit modal
      const modalHtml = `
                <div id="edit-team-modal" class="modal" style="display: block;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title">Team bearbeiten</h3>
                            <button class="modal-close" onclick="hideModal('edit-team-modal')">&times;</button>
                        </div>
                        <form id="edit-team-form" onsubmit="updateTeam(event, ${teamId})">
                            <div class="form-group">
                                <label class="form-label">Name</label>
                                <input type="text" name="name" class="form-control" value="${team.name}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Beschreibung</label>
                                <textarea name="description" class="form-control" rows="3">${team.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Abteilung</label>
                                <select name="department_id" class="form-control">
                                    <option value="">Keine Abteilung</option>
                                    ${await getDepartmentOptions(team.department_id)}
                                </select>
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary">Team aktualisieren</button>
                                <button type="button" class="btn btn-secondary" onclick="hideModal('edit-team-modal')">Abbrechen</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    } else {
      alert('Fehler beim Laden des Teams');
    }
  } catch (error) {
    console.error('Error loading team:', error);
    alert('Ein Fehler ist aufgetreten.');
  }
}

async function updateTeam(event, teamId) {
  event.preventDefault();
  const token = localStorage.getItem('token');
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`/teams/${teamId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      alert('Team erfolgreich aktualisiert');
      hideModal('edit-team-modal');
      loadTeamsTable();
      loadDashboardStats();
    } else {
      const error = await response.json();
      alert(`Fehler: ${error.message}`);
    }
  } catch (error) {
    console.error('Error updating team:', error);
    alert('Ein Fehler ist aufgetreten.');
  }
}

async function deleteTeam(teamId) {
  if (!confirm('Sind Sie sicher, dass Sie dieses Team löschen möchten?')) {
    return;
  }

  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`/teams/${teamId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      alert('Team erfolgreich gelöscht');
      loadTeamsTable();
      loadDashboardStats();
    } else {
      const error = await response.json();
      alert(`Fehler: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting team:', error);
    alert('Ein Fehler ist aufgetreten.');
  }
}

// Global hideModal function
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  } else {
    console.error('Modal element not found in hideModal:', modalId);
  }
}

// Dokument archivieren oder wiederherstellen
async function toggleDocumentArchive(documentId, isArchived) {
  const token = localStorage.getItem('token');
  const action = isArchived ? 'wiederherstellen' : 'archivieren';

  if (!confirm(`Möchten Sie dieses Dokument wirklich ${action}?`)) {
    return;
  }

  try {
    const response = await fetch(`/documents/${documentId}/archive`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ archived: !isArchived }),
    });

    if (response.ok) {
      // Aktualisiere den Dokument-Status in unserer globalen Liste
      const updatedDocument = allDocuments.find((doc) => doc.id === documentId);
      if (updatedDocument) {
        updatedDocument.is_archived = !isArchived;
      }

      alert(
        `Dokument erfolgreich ${isArchived ? 'wiederhergestellt' : 'archiviert'}`
      );

      // Dokumententabelle aktualisieren und den aktuellen Filter beibehalten
      const searchInput = document.getElementById('document-search');
      if (searchInput && searchInput.value.trim()) {
        loadDocumentsTable(searchInput.value.trim());
      } else {
        // Wir prüfen, welcher Filter gerade aktiv ist
        const activeDocBtn = document.getElementById('filter-documents-active');
        const archivedDocBtn = document.getElementById(
          'filter-documents-archived'
        );

        if (activeDocBtn && activeDocBtn.classList.contains('active')) {
          loadDocumentsTable('active');
        } else if (
          archivedDocBtn &&
          archivedDocBtn.classList.contains('active')
        ) {
          loadDocumentsTable('archived');
        } else {
          loadDocumentsTable('all');
        }
      }

      // Aktualisiere auch die letzten Dokumente auf dem Dashboard
      loadRecentDocuments();
    } else {
      const error = await response.json();
      alert(`Fehler: ${error.message}`);
    }
  } catch (error) {
    console.error(
      `Error ${isArchived ? 'unarchiving' : 'archiving'} document:`,
      error
    );
    alert('Ein Fehler ist aufgetreten.');
  }
}

// Dokument herunterladen
async function downloadDocument(documentId) {
  const token = localStorage.getItem('token');

  try {
    // Öffne das Dokument in einem neuen Tab
    window.open(`/documents/${documentId}?inline=true`, '_blank');
  } catch (error) {
    console.error('Error downloading document:', error);
    alert('Fehler beim Herunterladen des Dokuments');
  }
}

// Dokument löschen
async function deleteDocument(documentId) {
  const token = localStorage.getItem('token');

  if (
    !confirm(
      'Möchten Sie dieses Dokument wirklich löschen? Dies kann nicht rückgängig gemacht werden.'
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      // Entferne das Dokument aus unserer globalen Liste
      allDocuments = allDocuments.filter((doc) => doc.id !== documentId);

      alert('Dokument erfolgreich gelöscht');

      // Dokumententabelle aktualisieren und den aktuellen Filter beibehalten
      const searchInput = document.getElementById('document-search');
      if (searchInput && searchInput.value.trim()) {
        loadDocumentsTable(searchInput.value.trim());
      } else {
        // Wir prüfen, welcher Filter gerade aktiv ist
        const activeDocBtn = document.getElementById('filter-documents-active');
        const archivedDocBtn = document.getElementById(
          'filter-documents-archived'
        );

        if (activeDocBtn && activeDocBtn.classList.contains('active')) {
          loadDocumentsTable('active');
        } else if (
          archivedDocBtn &&
          archivedDocBtn.classList.contains('active')
        ) {
          loadDocumentsTable('archived');
        } else {
          loadDocumentsTable('all');
        }
      }

      // Aktualisiere auch die letzten Dokumente auf dem Dashboard und die Statistiken
      loadRecentDocuments();
      loadDashboardStats();
    } else {
      const error = await response.json();
      alert(`Fehler: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    alert('Ein Fehler ist aufgetreten.');
  }
}

// Funktionen für "Alle anzeigen" Links
function showAllEmployees() {
  showSection('employees');
  loadEmployeesTable('all');
}

function showAllDocuments() {
  showSection('documents');
  loadDocumentsTable('all');
}

function showAllDepartments() {
  showSection('departments');
  loadDepartmentsTable();
}

function showAllTeams() {
  showSection('teams');
  loadTeamsTable();
}

// Globale Funktion für onclick-Events in HTML
function showEmployeeModal() {
  // Diese Funktion wird direkt in HTML-onClick-Attributen verwendet
  // Wir leiten den Aufruf an unsere detaillierte Implementierung weiter
  if (typeof showNewEmployeeModal === 'function') {
    showNewEmployeeModal();
  } else {
    // Fallback, falls die Hauptfunktion nicht verfügbar ist
    const modal = document.getElementById('employee-modal');
    if (modal) {
      modal.style.display = 'flex';

      // Lade die Abteilungen für das Formular, wenn möglich
      if (typeof loadDepartmentsForEmployeeSelect === 'function') {
        loadDepartmentsForEmployeeSelect();
      }
    } else {
      console.error('employee-modal not found');
      alert('Das Mitarbeiterformular konnte nicht geöffnet werden.');
    }
  }
}

// Function to load user info in the header
async function loadHeaderUserInfo() {
  try {
    const token = localStorage.getItem('token');
    if (token && token !== 'test-mode') {
      // Parse JWT token to get user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));

        // Update the username in header
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
          userNameElement.textContent = payload.username || 'Admin';
        }
      } catch (e) {
        console.error('Error parsing JWT token:', e);
      }

      // Try to fetch full user profile for more details
      try {
        const response = await fetch('/api/user/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          const user = userData.user || userData;

          // Update username with full name if available
          const userNameElement = document.getElementById('user-name');
          if (userNameElement) {
            if (user.first_name || user.last_name) {
              const fullName =
                `${user.first_name || ''} ${user.last_name || ''}`.trim();
              userNameElement.textContent =
                fullName || user.username || 'Admin';
            }
          }

          // Update avatar if available
          const userAvatar = document.getElementById('user-avatar');
          if (userAvatar && user.profile_picture) {
            userAvatar.src = user.profile_picture;
          }

          // Also trigger unified navigation to update
          if (
            window.unifiedNav &&
            typeof window.unifiedNav.loadFullUserProfile === 'function'
          ) {
            window.unifiedNav.loadFullUserProfile();
          }
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        // Keep the JWT-based info as fallback
      }
    } else {
      // No token or test mode, set default values
      const userNameElement = document.getElementById('user-name');
      if (userNameElement) {
        userNameElement.textContent = 'Admin';
      }
    }
  } catch (error) {
    console.error('Error loading header user info:', error);
    // Set fallback values
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
      userNameElement.textContent = 'Admin';
    }
  }
}
