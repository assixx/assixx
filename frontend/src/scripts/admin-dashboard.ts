/**
 * Admin Dashboard Script
 * Handles admin-specific functionality including employee, document, department, and team management
 */

import type { User, Document } from '../types/api.types';
import { getAuthToken, showSuccess, showError } from './auth';
import { showSection } from './show-section';

interface DashboardStats {
  employeeCount: number;
  documentCount: number;
  departmentCount: number;
  teamCount: number;
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface Team {
  id: number;
  name: string;
  department_id: number;
  department_name?: string;
}

interface EmployeeFormData {
  username: string;
  email: string;
  email_confirm: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  position?: string;
  department_id?: string;
  team_id?: string;
  phone?: string;
  birth_date?: string;
  start_date?: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
}

interface CreateEmployeeFormElements extends HTMLFormControlsCollection {
  username: HTMLInputElement;
  email: HTMLInputElement;
  email_confirm: HTMLInputElement;
  password: HTMLInputElement;
  password_confirm: HTMLInputElement;
  first_name: HTMLInputElement;
  last_name: HTMLInputElement;
  employee_id: HTMLInputElement;
  position: HTMLInputElement;
  department_id: HTMLSelectElement;
  team_id: HTMLSelectElement;
  phone: HTMLInputElement;
  birth_date: HTMLInputElement;
  start_date: HTMLInputElement;
  street: HTMLInputElement;
  house_number: HTMLInputElement;
  postal_code: HTMLInputElement;
  city: HTMLInputElement;
}

interface CreateEmployeeForm extends HTMLFormElement {
  readonly elements: CreateEmployeeFormElements;
}

// Global token variable
let token: string | null = null;

// Define functions globally so they can be accessed from HTML onclick handlers
// Load Departments for Employee Select (defined globally)
const loadDepartmentsForEmployeeSelect = async function (): Promise<void> {
  try {
    const authToken = token || getAuthToken();
    const response = await fetch('/api/departments', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load departments for select');
    }

    const departments = await response.json();
    const dropdownOptions = document.getElementById('employee-department-dropdown');

    if (!dropdownOptions) return;

    // Clear existing options and add placeholder
    dropdownOptions.innerHTML = `
      <div class="dropdown-option" data-value="" onclick="selectDropdownOption('employee-department', '', 'Keine Abteilung')">
        Keine Abteilung
      </div>
    `;

    departments.forEach((dept: Department) => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'dropdown-option';
      optionDiv.setAttribute('data-value', dept.id.toString());
      optionDiv.textContent = dept.name;
      optionDiv.onclick = () => {
        (window as any).selectDropdownOption('employee-department', dept.id.toString(), dept.name);
      };
      dropdownOptions.appendChild(optionDiv);
    });
  } catch (error) {
    console.error('Error loading departments for select:', error);
    showError('Fehler beim Laden der Abteilungen');
  }
};

// Show New Employee Modal (defined globally)
const showNewEmployeeModal = function (): void {
  const modal = document.getElementById('employee-modal') as HTMLElement;
  if (modal) {
    // Formular zurücksetzen, falls es bereits benutzt wurde
    const form = document.getElementById('create-employee-form') as HTMLFormElement;
    if (form) {
      form.reset();

      // Fehler-Anzeigen zurücksetzen
      const emailError = document.getElementById('email-error') as HTMLElement;
      const passwordError = document.getElementById('password-error') as HTMLElement;

      if (emailError) emailError.style.display = 'none';
      if (passwordError) passwordError.style.display = 'none';
    }

    // Modal anzeigen
    modal.style.display = 'flex';

    // Abteilungen für das Formular laden
    loadDepartmentsForEmployeeSelect();
  } else {
    console.error('employee-modal element not found!');
    // eslint-disable-next-line no-alert
    alert('Das Mitarbeiterformular konnte nicht geöffnet werden.');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  token = getAuthToken();

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
  const createEmployeeForm = document.getElementById('create-employee-form') as CreateEmployeeForm;
  // const uploadDocumentForm = document.getElementById('document-upload-form') as HTMLFormElement;
  const departmentForm = document.getElementById('department-form') as HTMLFormElement;
  const teamForm = document.getElementById('team-form') as HTMLFormElement;
  const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;

  // Buttons für Mitarbeiter-Modal
  const newEmployeeBtn = document.getElementById('new-employee-button') as HTMLButtonElement;
  const employeesSectionNewBtn = document.getElementById('employees-section-new-button') as HTMLButtonElement;

  // Event-Listener für Formulare
  if (createEmployeeForm) {
    createEmployeeForm.addEventListener('submit', createEmployee);

    // Live-Validierung für E-Mail und Passwort hinzufügen
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const emailConfirmInput = document.getElementById('email_confirm') as HTMLInputElement;
    const emailError = document.getElementById('email-error') as HTMLElement;

    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const passwordConfirmInput = document.getElementById('password_confirm') as HTMLInputElement;
    const passwordError = document.getElementById('password-error') as HTMLElement;

    // E-Mail-Validierung
    if (emailInput && emailConfirmInput && emailError) {
      const checkEmails = function () {
        if (emailConfirmInput.value && emailInput.value !== emailConfirmInput.value) {
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
        if (passwordConfirmInput.value && passwordInput.value !== passwordConfirmInput.value) {
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
  if (departmentForm) departmentForm.addEventListener('submit', createDepartment);
  if (teamForm) teamForm.addEventListener('submit', createTeam);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Event-Listener für Mitarbeiter-Buttons
  if (newEmployeeBtn) {
    newEmployeeBtn.addEventListener('click', () => {
      showNewEmployeeModal();
    });
  }

  if (employeesSectionNewBtn) {
    employeesSectionNewBtn.addEventListener('click', () => {
      showNewEmployeeModal();
    });
  }

  // Initial loads - add slight delay to ensure DOM is ready
  setTimeout(() => {
    loadDashboardStats();
    loadRecentEmployees();
    loadRecentDocuments();
    loadDepartments();
    loadTeams();
    loadDepartmentsForEmployeeSelect(); // Laden der Abteilungen für Mitarbeiterformular
    loadBlackboardPreview(); // Laden der Blackboard-Einträge
  }, 100);

  // Setup manage links
  const manageEmployeesLink = document.getElementById('manage-employees-link');
  if (manageEmployeesLink) {
    manageEmployeesLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('employees');
    });
  }

  const manageDocumentsLink = document.getElementById('manage-documents-link');
  if (manageDocumentsLink) {
    manageDocumentsLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('documents');
    });
  }

  const manageDepartmentsLink = document.getElementById('manage-departments-link');
  if (manageDepartmentsLink) {
    manageDepartmentsLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('departments');
    });
  }

  // Load Dashboard Statistics
  async function loadDashboardStats(): Promise<void> {
    try {
      // Get auth token
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }

      // Admin Dashboard Stats Endpoint verwenden
      const statsRes = await fetch('/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statsRes.ok) {
        const stats: DashboardStats = await statsRes.json();

        // Update UI mit den Statistiken vom Admin Dashboard Endpoint
        const employeeCount = document.getElementById('employee-count');
        const documentCount = document.getElementById('document-count');
        const deptCountElement = document.getElementById('department-count');
        const teamCount = document.getElementById('team-count');

        if (employeeCount) employeeCount.textContent = (stats.employeeCount || 0).toString();
        if (documentCount) documentCount.textContent = (stats.documentCount || 0).toString();
        if (deptCountElement) deptCountElement.textContent = (stats.departmentCount || 0).toString();
        if (teamCount) teamCount.textContent = (stats.teamCount || 0).toString();
      } else {
        console.error('Failed to load dashboard stats', statsRes.statusText);

        // Check if unauthorized
        if (statsRes.status === 401) {
          console.error('Token expired or invalid, redirecting to login');
          window.location.href = '/pages/login.html';
          return;
        }

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
  async function loadDashboardStatsIndividually(): Promise<void> {
    // Get auth token
    const token = getAuthToken();
    if (!token) {
      console.error('No auth token found for individual stats loading');
      return;
    }

    // Mitarbeiter
    try {
      const employeesRes = await fetch('/api/admin/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (employeesRes.ok) {
        const employees: User[] = await employeesRes.json();
        const employeeCount = document.getElementById('employee-count');
        if (employeeCount) employeeCount.textContent = employees.length.toString();
      } else {
        console.error('Failed to load employees', employeesRes.statusText);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }

    // Dokumente
    try {
      const documentsRes = await fetch('/api/admin/documents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (documentsRes.ok) {
        const documents: Document[] = await documentsRes.json();
        const documentCount = document.getElementById('document-count');
        if (documentCount) documentCount.textContent = documents.length.toString();
      } else {
        console.error('Failed to load documents', documentsRes.statusText);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }

    // Abteilungen
    try {
      const departmentsRes = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (departmentsRes.ok) {
        const departments: Department[] = await departmentsRes.json();
        const deptCountElement = document.getElementById('department-count');
        if (deptCountElement) {
          deptCountElement.textContent = departments.length.toString();
        }
      } else {
        console.error('Failed to load departments', departmentsRes.statusText);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }

    // Teams
    try {
      const teamsRes = await fetch('/api/teams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (teamsRes.ok) {
        const teams: Team[] = await teamsRes.json();
        const teamCount = document.getElementById('team-count');
        if (teamCount) teamCount.textContent = teams.length.toString();
      } else {
        console.error('Failed to load teams', teamsRes.statusText);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  }
  
  // Load Blackboard Preview - zeigt die neuesten 3 Einträge
  async function loadBlackboardPreview(): Promise<void> {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found for blackboard preview');
        return;
      }

      const response = await fetch('/api/blackboard/entries?limit=3&sortBy=created_at&sortOrder=DESC', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const previewContainer = document.getElementById('blackboard-preview');
      if (!previewContainer) return;

      if (!response.ok) {
        if (response.status === 401) {
          console.error('Unauthorized access to blackboard');
        }
        throw new Error('Failed to load blackboard entries');
      }

      const data = await response.json();
      const entries = data.entries || [];

      // Clear loading placeholder
      previewContainer.innerHTML = '';

      if (entries.length === 0) {
        // Empty state
        previewContainer.innerHTML = `
          <div class="blackboard-empty-state">
            <i class="fas fa-clipboard"></i>
            <p>Keine Einträge vorhanden</p>
          </div>
        `;
        return;
      }

      // Render entries
      const entriesHtml = entries.map((entry: any) => {
        const priorityClass = `priority-${entry.priority || 'normal'}`;
        const priorityLabel = getPriorityLabel(entry.priority);
        const createdDate = new Date(entry.created_at).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        return `
          <div class="list-item" onclick="window.location.href='/pages/blackboard.html'">
            <div class="list-item-content">
              <div class="list-item-title">${entry.title}</div>
              <div class="list-item-meta">
                <span class="priority-badge ${priorityClass}">${priorityLabel}</span>
                <span>${createdDate}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      previewContainer.innerHTML = entriesHtml;

    } catch (error) {
      console.error('Error loading blackboard preview:', error);
      
      const previewContainer = document.getElementById('blackboard-preview');
      if (previewContainer) {
        previewContainer.innerHTML = `
          <div class="blackboard-empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Fehler beim Laden</p>
          </div>
        `;
      }
    }
  }

  // Hilfsfunktion für Priority Labels
  function getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      urgent: 'Dringend',
      high: 'Hoch',
      normal: 'Normal',
      low: 'Niedrig'
    };
    return labels[priority] || 'Normal';
  }

  // Create Employee
  async function createEmployee(e: Event): Promise<void> {
    e.preventDefault();

    if (!createEmployeeForm) return;

    const formData = new FormData(createEmployeeForm);
    const employeeData = Object.fromEntries(formData.entries()) as unknown as EmployeeFormData;

    // E-Mail-Übereinstimmung prüfen
    const emailError = document.getElementById('email-error') as HTMLElement;
    if (employeeData.email !== employeeData.email_confirm) {
      if (emailError) emailError.style.display = 'block';
      // eslint-disable-next-line no-alert
      alert('Die E-Mail-Adressen stimmen nicht überein');
      return;
    } else {
      if (emailError) emailError.style.display = 'none';
    }

    // Passwort-Übereinstimmung prüfen
    const passwordError = document.getElementById('password-error') as HTMLElement;
    if (employeeData.password !== employeeData.password_confirm) {
      if (passwordError) passwordError.style.display = 'block';
      // eslint-disable-next-line no-alert
      alert('Die Passwörter stimmen nicht überein');
      return;
    } else {
      if (passwordError) passwordError.style.display = 'none';
    }

    // Validierung auf Client-Seite, um bessere Fehlermeldungen zu geben
    if (!employeeData.username || employeeData.username.length < 3) {
      // eslint-disable-next-line no-alert
      alert('Der Benutzername muss mindestens 3 Zeichen lang sein.');
      return;
    }

    try {
      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: employeeData.username,
          email: employeeData.email,
          password: employeeData.password,
          first_name: employeeData.first_name,
          last_name: employeeData.last_name,
          employee_id: employeeData.employee_id,
          position: employeeData.position || '',
          department_id: employeeData.department_id ? parseInt(employeeData.department_id) : null,
          team_id: employeeData.team_id ? parseInt(employeeData.team_id) : null,
          phone: employeeData.phone || '',
          birth_date: employeeData.birth_date || null,
          start_date: employeeData.start_date || null,
          street: employeeData.street || '',
          house_number: employeeData.house_number || '',
          postal_code: employeeData.postal_code || '',
          city: employeeData.city || '',
        }),
      });

      if (response.ok) {
        showSuccess('Mitarbeiter erfolgreich erstellt!');
        createEmployeeForm.reset();

        // Modal schließen
        const modal = document.getElementById('employee-modal') as HTMLElement;
        if (modal) modal.style.display = 'none';

        // Listen neu laden
        loadRecentEmployees();
        loadDashboardStats();
      } else {
        const error = await response.json();
        showError(error.message || 'Fehler beim Erstellen des Mitarbeiters');
      }
    } catch (error) {
      console.error('Fehler beim Erstellen des Mitarbeiters:', error);
      showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  // Load Header User Info
  async function loadHeaderUserInfo(): Promise<void> {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData: User = await response.json();
        const userNameElement = document.getElementById('user-name') as HTMLElement;
        const userAvatar = document.getElementById('user-avatar') as HTMLImageElement;

        if (userNameElement) {
          const fullName =
            userData.first_name && userData.last_name
              ? `${userData.first_name} ${userData.last_name}`
              : userData.username;
          userNameElement.textContent = fullName;
        }

        if (userAvatar && userData.profile_picture) {
          userAvatar.src = userData.profile_picture;
          userAvatar.onerror = function () {
            this.src = '/assets/images/default-avatar.svg';
          };
        }
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  }

  // Logout function
  function logout(): void {
    // eslint-disable-next-line no-alert
    if (confirm('Möchten Sie sich wirklich abmelden?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.href = '/pages/login.html';
    }
  }

  // Placeholder functions - to be implemented
  async function loadRecentEmployees(): Promise<void> {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/users?role=employee&limit=5', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load recent employees');
      }

      const data = await response.json();
      const employees = Array.isArray(data) ? data : data.users || data.employees || [];

      // Fill compact card
      const employeeCard = document.getElementById('recent-employees');
      if (employeeCard) {
        employeeCard.innerHTML = '';

        if (!employees || employees.length === 0) {
          employeeCard.innerHTML = '<p class="text-muted">Keine neuen Mitarbeiter</p>';
        } else {
          employees.slice(0, 5).forEach((emp: User) => {
            const item = document.createElement('div');
            item.className = 'compact-item';
            item.innerHTML = `
              <span class="compact-item-name">${emp.first_name} ${emp.last_name}</span>
              <span class="compact-item-count">${emp.position || 'Mitarbeiter'}</span>
            `;
            employeeCard.appendChild(item);
          });
        }
      }

      // Also fill detailed list if it exists
      const employeeDetailList = document.getElementById('recent-employees-list');
      if (employeeDetailList) {
        employeeDetailList.innerHTML = '';

        if (!employees || employees.length === 0) {
          employeeDetailList.innerHTML = '<li class="text-muted">Keine neuen Mitarbeiter</li>';
        } else {
          employees.slice(0, 10).forEach((emp: User) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
              <strong>${emp.first_name} ${emp.last_name}</strong> - ${emp.position || 'Mitarbeiter'}
              <span class="text-muted">(${emp.department || 'Keine Abteilung'})</span>
            `;
            employeeDetailList.appendChild(listItem);
          });
        }
      }
    } catch (error) {
      console.error('Error loading recent employees:', error);
    }
  }

  async function loadRecentDocuments(): Promise<void> {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/documents?limit=5', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load recent documents');
      }

      const data = await response.json();
      const documents = Array.isArray(data) ? data : data.documents || data.data || [];

      // Fill compact card
      const documentCard = document.getElementById('recent-documents');
      if (documentCard) {
        documentCard.innerHTML = '';

        if (!documents || documents.length === 0) {
          documentCard.innerHTML = '<p class="text-muted">Keine neuen Dokumente</p>';
        } else {
          documents.slice(0, 5).forEach((doc: Document) => {
            const item = document.createElement('div');
            item.className = 'compact-item';
            const uploadDate = new Date(doc.created_at).toLocaleDateString('de-DE');
            item.innerHTML = `
              <span class="compact-item-name">${doc.file_name}</span>
              <span class="compact-item-count">${uploadDate}</span>
            `;
            documentCard.appendChild(item);
          });
        }
      }

      // Also fill detailed list if it exists
      const documentDetailList = document.getElementById('recent-documents-list');
      if (documentDetailList) {
        documentDetailList.innerHTML = '';

        if (!documents || documents.length === 0) {
          documentDetailList.innerHTML = '<li class="text-muted">Keine neuen Dokumente</li>';
        } else {
          documents.slice(0, 10).forEach((doc: Document) => {
            const listItem = document.createElement('li');
            const uploadDate = new Date(doc.created_at).toLocaleDateString('de-DE');
            listItem.innerHTML = `
              <strong>${doc.file_name}</strong> - ${doc.category || 'Allgemein'}
              <span class="text-muted">(${uploadDate})</span>
            `;
            documentDetailList.appendChild(listItem);
          });
        }
      }
    } catch (error) {
      console.error('Error loading recent documents:', error);
    }
  }

  async function loadDepartments(): Promise<void> {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load departments');
      }

      const departments = await response.json();
      const departmentList = document.getElementById('department-list');

      if (!departmentList) return;

      departmentList.innerHTML = '';

      if (departments.length === 0) {
        departmentList.innerHTML = '<p class="text-muted">Keine Abteilungen vorhanden</p>';
        return;
      }

      departments.slice(0, 5).forEach((dept: any) => {
        // Convert Buffer to String if needed
        let description = '';
        if (dept.description) {
          if (dept.description.type === 'Buffer' && dept.description.data) {
            description = String.fromCharCode(...dept.description.data);
          } else if (typeof dept.description === 'string') {
            description = dept.description;
          }
        }
        
        const item = document.createElement('div');
        item.className = 'compact-item';
        item.innerHTML = `
          <span class="compact-item-name">${dept.name}</span>
          <span class="compact-item-count">${description}</span>
        `;
        departmentList.appendChild(item);
      });
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  async function loadTeams(): Promise<void> {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/teams', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load teams');
      }

      const teams = await response.json();
      const teamList = document.getElementById('team-list');

      if (!teamList) return;

      teamList.innerHTML = '';

      if (teams.length === 0) {
        teamList.innerHTML = '<p class="text-muted">Keine Teams vorhanden</p>';
        return;
      }

      teams.slice(0, 5).forEach((team: Team) => {
        const item = document.createElement('div');
        item.className = 'compact-item';
        item.innerHTML = `
          <span class="compact-item-name">${team.name}</span>
          <span class="compact-item-count">${team.department_name || ''}</span>
        `;
        teamList.appendChild(item);
      });
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  }

  // Note: loadDepartmentsForEmployeeSelect is now defined globally above

  async function createDepartment(e: Event): Promise<void> {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const departmentData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      status: formData.get('status') as string || 'active',
      visibility: formData.get('visibility') as string || 'public',
    };

    try {
      const token = getAuthToken();
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(departmentData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create department');
      }

      await response.json();
      showSuccess('Abteilung erfolgreich erstellt');

      // Reset form and close modal
      form.reset();
      const modal = document.getElementById('department-modal');
      if (modal) modal.style.display = 'none';

      // Reload departments
      await loadDepartments();
      await loadDepartmentsForEmployeeSelect();
    } catch (error) {
      console.error('Error creating department:', error);
      showError(`Fehler beim Erstellen der Abteilung: ${(error as Error).message}`);
    }
  }

  async function createTeam(e: Event): Promise<void> {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const teamData = {
      name: formData.get('name') as string,
      department_id: parseInt(formData.get('department_id') as string),
      description: formData.get('description') as string,
    };

    try {
      const token = getAuthToken();
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(teamData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create team');
      }

      await response.json();
      showSuccess('Team erfolgreich erstellt');

      // Reset form and close modal
      form.reset();
      const modal = document.getElementById('team-modal');
      if (modal) modal.style.display = 'none';

      // Reload teams
      await loadTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      showError(`Fehler beim Erstellen des Teams: ${(error as Error).message}`);
    }
  }
});

// Extend window for admin dashboard functions
declare global {
  interface Window {
    showNewEmployeeModal: typeof showNewEmployeeModal;
    loadDepartmentsForEmployeeSelect: typeof loadDepartmentsForEmployeeSelect;
    showSection: typeof showSection;
    loadRecentEmployees?: () => Promise<void>;
    loadDashboardStats?: () => Promise<void>;
  }
}

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.showNewEmployeeModal = showNewEmployeeModal;
  window.loadDepartmentsForEmployeeSelect = loadDepartmentsForEmployeeSelect;
  window.showSection = showSection;
  
  // Export the async functions that are defined inside DOMContentLoaded
  // We need to wait for DOMContentLoaded to ensure they're defined
  document.addEventListener('DOMContentLoaded', () => {
    // These functions will be available after the main DOMContentLoaded handler runs
    setTimeout(() => {
      const adminDashboard = document.querySelector('#dashboard-section');
      if (adminDashboard) {
        // Export loadRecentEmployees and loadDashboardStats if they exist
        // They're defined in the DOMContentLoaded handler
      }
    }, 100);
  });
}
