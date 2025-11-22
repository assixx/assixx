/**
 * UI classes for Admin Dashboard
 */

import type { User, Document } from '../../../types/api.types';
import { $$, $$id, createElement, setHTML, setText, show, hide } from '../../../utils/dom-utils';
import { showError } from '../../auth';
import { DepartmentService } from './services';
import type { DashboardStats, Department, Team, CalendarEventApi } from './types';

// UI Class Constants
const CLASS_COMPACT_ITEM = 'compact-item';
const CLASS_COMPACT_ITEM_NAME = 'compact-item-name';

/**
 * Manages dashboard UI updates
 */
export class DashboardUI {
  updateStats(stats: DashboardStats): void {
    const employeeCount = $$id('employee-count');
    const documentCount = $$id('document-count');
    const departmentCount = $$id('department-count');
    const teamCount = $$id('team-count');

    if (employeeCount !== null) {
      setText(employeeCount, stats.employeeCount.toString());
    }
    if (documentCount !== null) {
      setText(documentCount, stats.documentCount.toString());
    }
    if (departmentCount !== null) {
      setText(departmentCount, stats.departmentCount.toString());
    }
    if (teamCount !== null) {
      setText(teamCount, stats.teamCount.toString());
    }
  }

  updateRecentEmployees(employees: User[]): void {
    const container = $$id('recent-employees');
    if (container === null) return;

    if (employees.length === 0) {
      setHTML(container, '<p class="p-2 text-muted">Keine neuen Mitarbeiter</p>');
      return;
    }

    const items = employees.slice(0, 3).map((emp) => {
      const item = createElement('div', { className: CLASS_COMPACT_ITEM });
      const fullName = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim();
      const nameSpan = createElement('span', { className: CLASS_COMPACT_ITEM_NAME }, fullName);
      item.append(nameSpan);
      return item;
    });

    container.innerHTML = '';
    items.forEach((item) => {
      container.append(item);
    });
  }

  updateRecentDocuments(documents: Document[]): void {
    const container = $$id('recent-documents');
    if (container === null) return;

    if (documents.length === 0) {
      setHTML(container, '<p class="p-2 text-muted">Keine neuen Dokumente</p>');
      return;
    }

    const items = documents.slice(0, 5).map((doc) => {
      const item = createElement('div', { className: CLASS_COMPACT_ITEM });
      // Backend returns 'filename' (lowercase) - manual override, not standard camelCase
      const fileName = doc.filename;
      const nameSpan = createElement('span', { className: CLASS_COMPACT_ITEM_NAME, title: fileName }, fileName);
      item.append(nameSpan);
      return item;
    });

    container.innerHTML = '';
    items.forEach((item) => {
      container.append(item);
    });
  }

  updateDepartments(departments: Department[]): void {
    const container = $$id('department-list');
    if (container === null) return;

    if (departments.length === 0) {
      setHTML(container, '<p class="p-2 text-muted">Keine Abteilungen vorhanden</p>');
      return;
    }

    const items = departments.slice(0, 5).map((dept) => {
      const item = createElement('div', { className: CLASS_COMPACT_ITEM });
      const nameSpan = createElement('span', { className: CLASS_COMPACT_ITEM_NAME }, dept.name);
      item.append(nameSpan);
      return item;
    });

    container.innerHTML = '';
    items.forEach((item) => {
      container.append(item);
    });
  }

  updateTeams(teams: Team[]): void {
    const container = $$id('team-list');
    if (container === null) return;

    if (teams.length === 0) {
      setHTML(container, '<p class="p-2 text-muted">Keine Teams vorhanden</p>');
      return;
    }

    const items = teams.slice(0, 5).map((team) => {
      const item = createElement('div', { className: CLASS_COMPACT_ITEM });
      const nameSpan = createElement('span', { className: CLASS_COMPACT_ITEM_NAME }, team.name);
      item.append(nameSpan);
      return item;
    });

    container.innerHTML = '';
    items.forEach((item) => {
      container.append(item);
    });
  }

  /**
   * Update upcoming calendar events (next 3 events after today)
   */
  updateUpcomingEvents(events: CalendarEventApi[]): void {
    const container = $$id('calendar-events-list');
    if (container === null) return;

    if (events.length === 0) {
      setHTML(
        container,
        `<div class="p-2 rounded text-xs">
          <strong class="block font-semibold">Nächste Termine</strong>
          <p class="text-[var(--color-text-secondary)] mt-1">Keine anstehenden Termine</p>
        </div>`,
      );
      return;
    }

    // Only show next 3 events
    const upcomingEvents = events.slice(0, 3);

    container.innerHTML = '';

    upcomingEvents.forEach((event) => {
      const eventItem = this.createEventItem(event);
      container.append(eventItem);
    });
  }

  /**
   * Create event item HTML element
   */
  private createEventItem(event: CalendarEventApi): HTMLElement {
    // API v2 returns camelCase fields through dbToApiEvent
    const startDate = new Date(event.startTime);
    const day = startDate.getDate().toString();
    const month = startDate.toLocaleDateString('de-DE', { month: 'short' });

    // API returns allDay as boolean or number (1/0)
    const isAllDay = event.allDay === true || event.allDay === 1;
    const time = isAllDay ? 'Ganztägig' : startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    // Get org level class and text - API returns orgLevel
    const orgLevel = event.orgLevel ?? 'personal';
    const levelClass = `event-level-${orgLevel}`;
    const levelText = this.getOrgLevelText(orgLevel);

    const eventItem = createElement('div', { className: 'event-item' });
    eventItem.dataset.id = event.id.toString();

    // Event date section
    const eventDate = createElement('div', { className: 'event-date' });
    eventDate.append(
      createElement('span', { className: 'event-day' }, day),
      createElement('span', { className: 'event-month' }, month),
      createElement('span', { className: 'event-time' }, time),
    );

    // Event details section
    const eventDetails = createElement('div', { className: 'event-details' });
    const title = createElement(
      'div',
      { className: 'event-title' },
      event.title !== '' ? event.title : 'Unbenannter Termin',
    );
    eventDetails.append(title);

    // Location (optional)
    if (event.location !== undefined && event.location !== '') {
      const locationDiv = createElement('div', { className: 'event-location' });
      locationDiv.append(createElement('i', { className: 'fas fa-map-marker-alt' }), ` ${event.location}`);
      eventDetails.append(locationDiv);
    }

    // Org level badge
    const levelBadge = createElement('span', { className: `event-level ${levelClass}` }, levelText);
    eventDetails.append(levelBadge);

    eventItem.append(eventDate, eventDetails);

    // Click handler to open calendar
    eventItem.addEventListener('click', () => {
      window.location.href = '/calendar';
    });

    return eventItem;
  }

  /**
   * Get German text for org level
   */
  private getOrgLevelText(orgLevel: string): string {
    switch (orgLevel) {
      case 'company':
        return 'Firma';
      case 'department':
        return 'Abteilung';
      case 'team':
        return 'Team';
      case 'area':
        return 'Bereich';
      default:
        return 'Persönlich';
    }
  }
}

// BlackboardUI class removed - using shared blackboard-widget.js instead
// The widget is initialized directly in admin-dashboard.ts

/**
 * Manages employee modal and form
 */
export class EmployeeModalUI {
  private departmentService: DepartmentService;

  constructor() {
    this.departmentService = new DepartmentService();
  }

  async showNewEmployeeModal(): Promise<void> {
    const modal = $$id('employee-modal');
    if (modal === null) {
      console.error('Employee modal not found');
      return;
    }

    // Reset form
    const form = $$('#create-employee-form') as HTMLFormElement | null;
    if (form !== null) {
      form.reset();
      this.resetErrorMessages();
    }

    // Show modal
    show(modal);
    modal.style.display = 'flex';

    // Load departments
    await this.loadDepartmentsForSelect();
  }

  hideModal(): void {
    const modal = $$id('employee-modal');
    if (modal !== null) {
      hide(modal);
    }
  }

  private resetErrorMessages(): void {
    const emailError = $$id('email-error');
    const passwordError = $$id('password-error');

    if (emailError !== null) hide(emailError);
    if (passwordError !== null) hide(passwordError);
  }

  async loadDepartmentsForSelect(): Promise<void> {
    try {
      const departments = await this.departmentService.loadDepartments();
      const dropdown = $$id('employee-department-dropdown');

      if (dropdown === null) {
        console.error('Department dropdown not found');
        return;
      }

      // Clear and add placeholder
      const placeholderHtml = `
        <div class="dropdown-option" data-value="">
          Keine Abteilung
        </div>
      `;
      setHTML(dropdown, placeholderHtml);

      // Add departments
      departments.forEach((dept) => {
        const option = createElement(
          'div',
          {
            className: 'dropdown-option',
            dataset: { value: dept.id.toString() },
          },
          dept.name,
        );

        option.addEventListener('click', () => {
          this.selectDepartment(dept.id, dept.name);
        });

        dropdown.append(option);
      });
    } catch (error) {
      console.error('Error loading departments for select:', error);
      showError('Fehler beim Laden der Abteilungen');
    }
  }

  private selectDepartment(id: number, name: string): void {
    // Update hidden input
    const input = $$('#department_id') as HTMLInputElement | null;
    if (input !== null) {
      input.value = id.toString();
    }

    // Update display
    const display = $$('.dropdown-selected');
    if (display !== null) {
      setText(display, name);
    }

    // Close dropdown
    const dropdown = $$('.dropdown');
    if (dropdown !== null) {
      dropdown.classList.remove('open');
    }
  }

  setupValidation(): void {
    const emailInput = $$('#email') as HTMLInputElement | null;
    const emailConfirm = $$('#email_confirm') as HTMLInputElement | null;
    const emailError = $$id('email-error');

    const passwordInput = $$('#password') as HTMLInputElement | null;
    const passwordConfirm = $$('#password_confirm') as HTMLInputElement | null;
    const passwordError = $$id('password-error');

    // Email validation
    if (emailInput !== null && emailConfirm !== null && emailError !== null) {
      const checkEmails = (): void => {
        if (emailConfirm.value.length > 0 && emailInput.value !== emailConfirm.value) {
          show(emailError);
        } else {
          hide(emailError);
        }
      };

      emailInput.addEventListener('input', checkEmails);
      emailConfirm.addEventListener('input', checkEmails);
    }

    // Password validation
    if (passwordInput !== null && passwordConfirm !== null && passwordError !== null) {
      const checkPasswords = (): void => {
        if (passwordConfirm.value.length > 0 && passwordInput.value !== passwordConfirm.value) {
          show(passwordError);
        } else {
          hide(passwordError);
        }
      };

      passwordInput.addEventListener('input', checkPasswords);
      passwordConfirm.addEventListener('input', checkPasswords);
    }
  }
}
