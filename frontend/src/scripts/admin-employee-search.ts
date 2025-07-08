/**
 * Admin-Dashboard erweiterte Mitarbeitersuche
 */

import type { User } from '../types/api.types';
import { getAuthToken } from './auth';

interface Department {
  id: number;
  name: string;
}

interface EmployeeSearchResult extends User {
  department_name?: string;
  employee_id?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface SearchResponse {
  users: EmployeeSearchResult[];
  pagination: PaginationInfo;
}

document.addEventListener('DOMContentLoaded', () => {
  // Bestehende Elemente
  const employeeTableBody = document.getElementById('employee-table-body') as HTMLTableSectionElement;

  // Neue Elemente für die erweiterte Suche
  const searchForm = document.getElementById('employee-search-form') as HTMLFormElement;
  const searchInput = document.getElementById('employee-search-input') as HTMLInputElement;
  const departmentFilter = document.getElementById('department-filter') as HTMLSelectElement;
  const paginationContainer = document.getElementById('pagination-container') as HTMLElement;

  // Event-Listener hinzufügen
  if (searchForm) {
    searchForm.addEventListener('submit', handleSearch);
  }

  if (departmentFilter) {
    departmentFilter.addEventListener('change', handleSearch);
    // Abteilungen laden
    loadDepartments();
  }

  // Initialen Suchvorgang ausführen
  if (searchForm) {
    loadEmployees();
  }

  // Funktion zum Laden der Abteilungen
  async function loadDepartments(): Promise<void> {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/departments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const departments: Department[] = await response.json();

        // Departmentfilter befüllen
        departmentFilter.innerHTML = '<option value="">Alle Abteilungen</option>';

        departments.forEach((dept) => {
          const option = document.createElement('option');
          option.value = dept.id.toString();
          option.textContent = dept.name;
          departmentFilter.appendChild(option);
        });
      } else {
        console.error('Fehler beim Laden der Abteilungen');
      }
    } catch (error) {
      console.error('Fehler beim Laden der Abteilungen:', error);
    }
  }

  // Funktion zum Laden der Mitarbeiter mit Filtern
  async function loadEmployees(page: number = 1): Promise<void> {
    const token = getAuthToken();
    if (!token) return;

    try {
      // Suchparameter aufbauen
      const searchTerm = searchInput ? searchInput.value.trim() : '';
      const departmentId = departmentFilter ? departmentFilter.value : '';

      // URL mit Parametern erstellen
      let url = `/users/search?role=employee&page=${page}&limit=10`;

      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }

      if (departmentId) {
        url += `&department_id=${departmentId}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: SearchResponse = await response.json();
        displayEmployees(data.users);

        // Pagination anzeigen
        if (paginationContainer) {
          displayPagination(data.pagination, page);
        }
      } else {
        const error = await response.json();
        console.error('Fehler:', error.message);

        if (employeeTableBody) {
          employeeTableBody.innerHTML = `<tr><td colspan="5" class="text-center">Fehler beim Laden der Mitarbeiter: ${error.message}</td></tr>`;
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Mitarbeiter:', error);

      if (employeeTableBody) {
        employeeTableBody.innerHTML =
          '<tr><td colspan="5" class="text-center">Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.</td></tr>';
      }
    }
  }

  // Event-Handler für die Suche
  function handleSearch(e?: Event): void {
    if (e) {
      e.preventDefault();
    }
    loadEmployees(1); // Bei neuer Suche immer auf Seite 1 zurücksetzen
  }

  // Funktion zum Anzeigen der Mitarbeiter
  function displayEmployees(employees: EmployeeSearchResult[]): void {
    if (!employeeTableBody) return;

    employeeTableBody.innerHTML = '';

    if (employees.length === 0) {
      employeeTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Keine Mitarbeiter gefunden</td></tr>';
      return;
    }

    employees.forEach((employee) => {
      const row = document.createElement('tr');

      // Profilbild oder Platzhalter
      const profileImage = employee.profile_picture
        ? `<img src="/${employee.profile_picture}" class="profile-thumbnail" alt="${employee.first_name}" width="40" height="40">`
        : `<div class="profile-placeholder">${(employee.first_name || '').charAt(0)}${(employee.last_name || '').charAt(0)}</div>`;

      // Abteilungsinformation
      const departmentInfo = employee.department_name
        ? `<span class="department-badge">${employee.department_name}</span>`
        : '';

      row.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            ${profileImage}
            <div class="ml-3">
              <div class="employee-name">${employee.first_name || ''} ${employee.last_name || ''}</div>
              <div class="employee-position">${employee.position || ''}</div>
            </div>
          </div>
        </td>
        <td>${employee.email}</td>
        <td>
          ${employee.employee_id || ''}
          ${departmentInfo}
        </td>
        <td>${employee.phone || '-'}</td>
        <td>
          <button onclick="uploadDocumentFor('${employee.id}')" class="btn btn-sm btn-primary">Dokument hochladen</button>
          <button class="delete-btn btn btn-sm btn-danger" 
                  data-id="${employee.id}" 
                  data-name="${employee.first_name || ''} ${employee.last_name || ''}">
              Löschen
          </button>
          <button class="edit-btn btn btn-sm btn-secondary" 
                  data-id="${employee.id}" 
                  data-name="${employee.first_name || ''} ${employee.last_name || ''}">
              Bearbeiten
          </button>
        </td>
      `;

      employeeTableBody.appendChild(row);
    });

    // Event-Listener für die Lösch-Buttons hinzufügen
    document.querySelectorAll<HTMLButtonElement>('.delete-btn').forEach((button) => {
      button.addEventListener('click', deleteEmployee);
    });

    // Event-Listener für die Bearbeiten-Buttons hinzufügen
    document.querySelectorAll<HTMLButtonElement>('.edit-btn').forEach((button) => {
      button.addEventListener('click', editEmployee);
    });
  }

  // Funktion zum Anzeigen der Pagination
  function displayPagination(pagination: PaginationInfo, currentPage: number): void {
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';

    if (pagination.pages <= 1) {
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'pagination justify-content-center';

    // Zurück-Button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.textContent = 'Zurück';
    if (currentPage > 1) {
      prevLink.addEventListener('click', (e: Event) => {
        e.preventDefault();
        loadEmployees(currentPage - 1);
      });
    }
    prevLi.appendChild(prevLink);
    ul.appendChild(prevLi);

    // Seitenzahlen
    const maxPages = 5; // Maximale Anzahl von Seiten, die angezeigt werden
    const startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    const endPage = Math.min(pagination.pages, startPage + maxPages - 1);

    for (let i = startPage; i <= endPage; i++) {
      const li = document.createElement('li');
      li.className = `page-item ${i === currentPage ? 'active' : ''}`;
      const link = document.createElement('a');
      link.className = 'page-link';
      link.href = '#';
      link.textContent = i.toString();
      link.addEventListener('click', (e: Event) => {
        e.preventDefault();
        loadEmployees(i);
      });
      li.appendChild(link);
      ul.appendChild(li);
    }

    // Weiter-Button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === pagination.pages ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.textContent = 'Weiter';
    if (currentPage < pagination.pages) {
      nextLink.addEventListener('click', (e: Event) => {
        e.preventDefault();
        loadEmployees(currentPage + 1);
      });
    }
    nextLi.appendChild(nextLink);
    ul.appendChild(nextLi);

    paginationContainer.appendChild(ul);
  }

  // Funktion zum Löschen eines Mitarbeiters
  async function deleteEmployee(e: Event): Promise<void> {
    const button = e.target as HTMLButtonElement;
    const employeeId = button.getAttribute('data-id');
    const employeeName = button.getAttribute('data-name');

    if (!employeeId || !employeeName) return;

    if (!confirm(`Sind Sie sicher, dass Sie den Mitarbeiter "${employeeName}" löschen möchten?`)) {
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`/admin/delete-employee/${employeeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert(`Mitarbeiter "${employeeName}" wurde erfolgreich gelöscht.`);
        // Mitarbeiterliste neu laden
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

  // Funktion zum Bearbeiten eines Mitarbeiters
  function editEmployee(e: Event): void {
    const button = e.target as HTMLButtonElement;
    const employeeId = button.getAttribute('data-id');
    const employeeName = button.getAttribute('data-name');

    if (!employeeId || !employeeName) return;

    // Modal oder separate Seite zum Bearbeiten des Mitarbeiters öffnen
    // Hier kann je nach UI-Design eine eigene Implementierung erfolgen

    alert(`Bearbeiten von Mitarbeiter "${employeeName}" (ID: ${employeeId}) wird implementiert...`);

    // Beispielweise:
    // window.location.href = `/admin/edit-employee.html?id=${employeeId}`;
  }
});

// Export function to window for backwards compatibility
if (typeof window !== 'undefined') {
  interface WindowWithUpload extends Window {
    uploadDocumentFor: (employeeId: string) => void;
  }
  const windowWithUpload = window as unknown as WindowWithUpload;
  windowWithUpload.uploadDocumentFor = (employeeId: string) => {
    // Redirect to upload page with pre-selected employee
    window.location.href = `/document-upload?userId=${employeeId}`;
  };
}
