/**
 * Admin Dashboard Script
 * Handles admin-specific functionality including employee, document, department, and team management
 */

import type { User, Document } from '../types/api.types';
import { getAuthToken } from './auth';
import { showSuccess, showError, showInfo } from './auth';

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
  const uploadDocumentForm = document.getElementById('document-upload-form') as HTMLFormElement;
  const departmentForm = document.getElementById('department-form') as HTMLFormElement;
  const teamForm = document.getElementById('team-form') as HTMLFormElement;
  const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;

  // Buttons für Mitarbeiter-Modal
  const newEmployeeBtn = document.getElementById('new-employee-button') as HTMLButtonElement;
  const employeesSectionNewBtn = document.getElementById(
    'employees-section-new-button'
  ) as HTMLButtonElement;

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
    newEmployeeBtn.addEventListener('click', () => {
      showNewEmployeeModal();
    });
  }

  if (employeesSectionNewBtn) {
    employeesSectionNewBtn.addEventListener('click', () => {
      showNewEmployeeModal();
    });
  }

  // Funktion zum Anzeigen des Mitarbeiter-Modals
  function showNewEmployeeModal(): void {
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
        headers: { Authorization: `Bearer ${token}` }
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
      alert('Die E-Mail-Adressen stimmen nicht überein');
      return;
    } else {
      if (emailError) emailError.style.display = 'none';
    }

    // Passwort-Übereinstimmung prüfen
    const passwordError = document.getElementById('password-error') as HTMLElement;
    if (employeeData.password !== employeeData.password_confirm) {
      if (passwordError) passwordError.style.display = 'block';
      alert('Die Passwörter stimmen nicht überein');
      return;
    } else {
      if (passwordError) passwordError.style.display = 'none';
    }

    // Validierung auf Client-Seite, um bessere Fehlermeldungen zu geben
    if (!employeeData.username || employeeData.username.length < 3) {
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
          const fullName = userData.first_name && userData.last_name
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
    if (confirm('Möchten Sie sich wirklich abmelden?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.href = '/pages/login.html';
    }
  }

  // Placeholder functions - to be implemented
  async function loadRecentEmployees(): Promise<void> {
    // Implementation needed
  }

  async function loadRecentDocuments(): Promise<void> {
    // Implementation needed
  }

  async function loadDepartments(): Promise<void> {
    // Implementation needed
  }

  async function loadTeams(): Promise<void> {
    // Implementation needed
  }

  async function loadDepartmentsForEmployeeSelect(): Promise<void> {
    // Implementation needed
  }

  async function createDepartment(e: Event): Promise<void> {
    e.preventDefault();
    // Implementation needed
  }

  async function createTeam(e: Event): Promise<void> {
    e.preventDefault();
    // Implementation needed
  }
});

// Export functions to window for backwards compatibility
if (typeof window !== 'undefined') {
  (window as any).showNewEmployeeModal = () => {
    const modal = document.getElementById('employee-modal') as HTMLElement;
    if (modal) modal.style.display = 'flex';
  };
}