/**
 * Admin Dashboard Script - Modern TypeScript Implementation
 * Handles admin-specific functionality with modular architecture
 * Following strict TypeScript standards and best practices
 */

import { $$, $$id, setText, hide } from '../../../utils/dom-utils';
import { getAuthToken, showError } from '../../auth';
// showSection removed - deprecated, sections are now separate pages
import type { EmployeeFormData } from './types';
// Type for the BlackboardWidget from blackboard-widget.js
interface BlackboardWidgetInstance {
  container: HTMLElement | null;
  entries: unknown[];
  loading: boolean;
  sidebarCollapsed: boolean;
  init: () => Promise<void>;
  setupSidebarListener: () => void;
  render: () => void;
  loadEntries: () => Promise<void>;
}
import { DashboardService, EmployeeService, DepartmentService, TeamService, DocumentService } from './services';
import { DashboardUI, EmployeeModalUI } from './ui';

/**
 * Main AdminDashboard class that coordinates all components
 */
class AdminDashboard {
  private dashboardService: DashboardService;
  private employeeService: EmployeeService;
  private departmentService: DepartmentService;
  private teamService: TeamService;
  private documentService: DocumentService;

  private dashboardUI: DashboardUI;
  private employeeModalUI: EmployeeModalUI;
  private blackboardWidget: BlackboardWidgetInstance | null = null; // Reference to the shared blackboard widget

  // Getter for blackboard widget (for future use if needed)
  public getBlackboardWidget(): BlackboardWidgetInstance | null {
    return this.blackboardWidget;
  }

  // Getter for document service (used by HTML to access cached documents)
  public getDocumentService(): DocumentService {
    return this.documentService;
  }

  constructor() {
    // Initialize services
    this.dashboardService = new DashboardService();
    this.employeeService = new EmployeeService();
    this.departmentService = new DepartmentService();
    this.teamService = new TeamService();
    this.documentService = new DocumentService();

    // Initialize UI managers
    this.dashboardUI = new DashboardUI();
    this.employeeModalUI = new EmployeeModalUI();

    // Initialize the blackboard widget (will be done in loadInitialData)
    this.blackboardWidget = null;
  }

  initialize(): void {
    // Check authentication
    const token = getAuthToken();
    if (token === null || token === '') {
      // In production: redirect to login
      // window.location.href = '/login';
      // return;
    }

    // Setup event listeners
    this.setupEventListeners();

    // Load initial data with slight delay for DOM readiness
    setTimeout(() => {
      void this.loadInitialData();
    }, 100);

    // Handle section parameter
    // Section parameters are deprecated - admin dashboard always shows dashboard
  }

  private setupEventListeners(): void {
    // Employee form submission
    const createEmployeeForm = $$('#create-employee-form') as HTMLFormElement | null;
    if (createEmployeeForm !== null) {
      createEmployeeForm.addEventListener('submit', (e) => {
        void this.handleEmployeeSubmit(e);
      });
    }

    // Department form submission
    const departmentForm = $$('#department-form') as HTMLFormElement | null;
    if (departmentForm !== null) {
      departmentForm.addEventListener('submit', (e) => {
        void this.handleDepartmentSubmit(e);
      });
    }

    // Team form submission
    const teamForm = $$('#team-form') as HTMLFormElement | null;
    if (teamForm !== null) {
      teamForm.addEventListener('submit', (e) => {
        void this.handleTeamSubmit(e);
      });
    }

    // New employee button
    const newEmployeeBtn = $$id('new-employee-button');
    if (newEmployeeBtn !== null) {
      newEmployeeBtn.addEventListener('click', () => {
        void this.employeeModalUI.showNewEmployeeModal();
      });
    }

    // Employees section new button
    const employeesSectionBtn = $$id('employees-section-new-button');
    if (employeesSectionBtn !== null) {
      employeesSectionBtn.addEventListener('click', () => {
        void this.employeeModalUI.showNewEmployeeModal();
      });
    }

    // Setup form validation
    this.employeeModalUI.setupValidation();

    // Setup manage links
    this.setupManageLinks();
  }

  private setupManageLinks(): void {
    // These links should navigate to separate pages, not sections
    const links = [
      { id: 'manage-employees-link', url: '/manage-employees' },
      { id: 'manage-documents-link', url: '/documents' },
      { id: 'manage-departments-link', url: '/manage-departments' },
    ];

    links.forEach(({ id, url }) => {
      const link = $$id(id);
      if (link !== null) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = url;
        });
      }
    });
  }

  private async loadInitialData(): Promise<void> {
    try {
      // Load Blackboard FIRST (most visible widget) - ALONE without competition
      this.loadBlackboardWidget();
      await this.loadBlackboardPreview();

      // Give browser time to render Blackboard before loading other data
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Load all data first (this will populate the cache)
      // These calls will cache the data for subsequent use
      await Promise.all([
        this.loadRecentEmployees(), // Will load ALL employees and cache them
        this.loadRecentDocuments(), // Will load ALL documents and cache them
        this.loadDepartments(), // Will load and cache departments
        this.loadTeams(), // Will load and cache teams
      ]);

      // NOW load stats - this will use the cached data from above
      // No additional API calls will be made
      this.loadDashboardStats();
    } catch (error) {
      console.error('[Admin Dashboard] Error loading initial data:', error);
    }
  }

  private loadDashboardStats(): void {
    try {
      const stats = this.dashboardService.loadStats();
      this.dashboardUI.updateStats(stats);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  private async loadRecentEmployees(): Promise<void> {
    try {
      const employees = await this.employeeService.loadRecentEmployees();
      this.dashboardUI.updateRecentEmployees(employees);
    } catch (error) {
      console.error('Error loading recent employees:', error);
    }
  }

  private async loadRecentDocuments(): Promise<void> {
    try {
      const documents = await this.documentService.loadRecentDocuments();
      this.dashboardUI.updateRecentDocuments(documents);
    } catch (error) {
      console.error('Error loading recent documents:', error);
    }
  }

  private async loadDepartments(): Promise<void> {
    try {
      const departments = await this.departmentService.loadDepartments();
      this.dashboardUI.updateDepartments(departments);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  private async loadTeams(): Promise<void> {
    try {
      const teams = await this.teamService.loadTeams();
      this.dashboardUI.updateTeams(teams);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  }

  private async loadBlackboardPreview(): Promise<void> {
    // Blackboard preview functionality is handled by the widget itself
    // No separate loading needed
  }

  private loadBlackboardWidget(): void {
    try {
      // Initialize the blackboard widget from blackboard-widget.js
      // The widget handles its own data loading
      if ($$id('blackboard-widget-container') !== null) {
        // Check if BlackboardWidget class is available
        if (typeof window.BlackboardWidget === 'undefined') {
          // Dynamically load the blackboard widget script
          const script = document.createElement('script');
          script.src = '/scripts/blackboard/widget.js';
          script.onload = () => {
            // Script will auto-initialize when loaded
            // Just capture the reference once it's initialized
            setTimeout(() => {
              if (window.blackboardWidget) {
                this.blackboardWidget = window.blackboardWidget;
              }
            }, 500);
          };
          document.head.appendChild(script);
        } else {
          // Widget class already available, check if initialized
          if (window.blackboardWidget) {
            this.blackboardWidget = window.blackboardWidget;
          } else if (window.initializeBlackboardWidget) {
            // Manually trigger initialization if needed
            window.initializeBlackboardWidget();
            setTimeout(() => {
              if (window.blackboardWidget) {
                this.blackboardWidget = window.blackboardWidget;
              }
            }, 500);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing blackboard widget:', error);
    }
  }

  private async handleEmployeeSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    // Extract and validate form data
    const employeeData: EmployeeFormData = {
      username: formData.get('username') as string,
      email: formData.get('email') as string,
      emailConfirm: formData.get('email_confirm') as string,
      password: formData.get('password') as string,
      passwordConfirm: formData.get('password_confirm') as string,
      firstName: formData.get('first_name') as string,
      lastName: formData.get('last_name') as string,
      employeeId: formData.get('employee_id') as string,
      position: formData.get('position') as string,
      departmentId:
        formData.get('department_id') !== null
          ? Number.parseInt(formData.get('department_id') as string, 10)
          : undefined,
      phone: formData.get('phone') as string,
      birthDate: formData.get('birth_date') as string,
      startDate: formData.get('start_date') as string,
      street: formData.get('street') as string,
      houseNumber: formData.get('house_number') as string,
      postalCode: formData.get('postal_code') as string,
      city: formData.get('city') as string,
    };

    // Validate emails match
    if (employeeData.email !== employeeData.emailConfirm) {
      showError('Die E-Mail-Adressen stimmen nicht überein');
      return;
    }

    // Validate passwords match
    if (employeeData.password !== employeeData.passwordConfirm) {
      showError('Die Passwörter stimmen nicht überein');
      return;
    }

    try {
      await this.employeeService.createEmployee(employeeData);
      form.reset();
      this.employeeModalUI.hideModal();

      // Reload data - loadRecentEmployees will refresh the employee cache
      await this.loadRecentEmployees();
      // Update stats with new cached data
      this.loadDashboardStats();

      // Optional: reload page for full refresh
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error creating employee:', error);
      showError(error instanceof Error ? error.message : 'Fehler beim Erstellen des Mitarbeiters');
    }
  }

  private async handleDepartmentSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const departmentData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      status: (formData.get('status') ?? 'active') as string,
      visibility: (formData.get('visibility') ?? 'public') as string,
    };

    try {
      await this.departmentService.createDepartment(departmentData);
      form.reset();

      // Hide modal
      const modal = $$id('department-modal');
      if (modal !== null) hide(modal);

      // Reload data - loadDepartments will refresh the cache
      // loadDepartmentsForSelect will use the cached data
      await this.loadDepartments();
      await this.employeeModalUI.loadDepartmentsForSelect();
      // Update stats with new cached data
      this.loadDashboardStats();
    } catch (error) {
      console.error('Error creating department:', error);
      showError(
        `Fehler beim Erstellen der Abteilung: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      );
    }
  }

  private async handleTeamSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const teamData = {
      name: formData.get('name') as string,
      departmentId: Number.parseInt(formData.get('department_id') as string, 10),
      description: formData.get('description') as string,
    };

    try {
      await this.teamService.createTeam(teamData);
      form.reset();

      // Hide modal
      const modal = $$id('team-modal');
      if (modal !== null) hide(modal);

      // Reload teams - will refresh cache
      await this.loadTeams();
      // Update stats with new cached data
      this.loadDashboardStats();
    } catch (error) {
      console.error('Error creating team:', error);
      showError(`Fehler beim Erstellen des Teams: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }

  // handleSectionParameter removed - deprecated, no sections anymore
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const dashboard = new AdminDashboard();
  dashboard.initialize();

  // Expose dashboard instance to window for HTML access to services
  window.adminDashboard = dashboard;
});

// ============================================================================
// GLOBAL EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================

declare global {
  interface Window {
    adminDashboard?: AdminDashboard;
    showNewEmployeeModal?: () => Promise<void>;
    loadDepartmentsForEmployeeSelect?: () => Promise<void>;
    selectDropdownOption?: (dropdownName: string, value: string, label: string) => void;
    BlackboardWidget?: new (containerId: string) => BlackboardWidgetInstance;
    blackboardWidget?: BlackboardWidgetInstance;
    initializeBlackboardWidget?: () => void;
  }
}

// Export functions to window for HTML onclick handlers
if (typeof window !== 'undefined') {
  const employeeModalUI = new EmployeeModalUI();

  window.showNewEmployeeModal = async (): Promise<void> => {
    await employeeModalUI.showNewEmployeeModal();
  };

  window.loadDepartmentsForEmployeeSelect = async (): Promise<void> => {
    await employeeModalUI.loadDepartmentsForSelect();
  };

  // showSection removed - deprecated

  window.selectDropdownOption = (dropdownName: string, value: string, label: string): void => {
    const input = $$(`#${dropdownName}_id`) as HTMLInputElement | null;
    if (input !== null) {
      input.value = value;
    }
    const display = $$(`#${dropdownName}-selected`);
    if (display !== null) {
      setText(display, label);
    }
  };
}
