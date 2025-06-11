/**
 * New Shift Planning System - TypeScript Implementation
 * Interactive weekly shift planning with drag & drop functionality
 */

import type { User } from '../types/api.types';
import { getAuthToken, removeAuthToken, showSuccess, showError, showInfo } from './auth';
import { openModal, closeModal } from './utils/modal-manager';

interface Employee extends User {
  department_id?: number;
  team_id?: number;
  shift_assignments?: ShiftAssignment[];
  availability_status?: 'available' | 'unavailable' | 'vacation' | 'sick';
}

interface ShiftAssignment {
  id: number;
  employee_id: number;
  date: string;
  shift_type: 'early' | 'late' | 'night';
  department_id?: number;
  machine_id?: number;
  team_leader_id?: number;
  area_id?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface Machine {
  id: number;
  name: string;
  department_id: number;
  description?: string;
}

interface Area {
  id: number;
  name: string;
  description?: string;
}

interface TeamLeader {
  id: number;
  name: string;
  username: string;
}

interface SelectedContext {
  departmentId: number | null;
  machineId: number | null;
  teamLeaderId: number | null;
  areaId: number | null;
}

interface WeeklyShifts {
  [key: string]: {
    [key: string]: number[];
  };
}

class ShiftPlanningSystem {
  private currentWeek: Date;
  private selectedEmployee: Employee | null;
  private employees: Employee[];
  private weeklyShifts: WeeklyShifts;
  private isAdmin: boolean;
  private userRole: string;
  private currentUserId: number | null;
  private isDragging: boolean;

  // Context data for shift planning
  private departments: Department[];
  private machines: Machine[];
  private teamLeaders: TeamLeader[];
  private areas: Area[];
  private selectedContext: SelectedContext;

  private weeklyNotes: string;

  constructor() {
    this.currentWeek = new Date();
    this.selectedEmployee = null;
    this.employees = [];
    this.weeklyShifts = {};
    this.isAdmin = false;
    this.userRole = '';
    this.currentUserId = null;
    this.isDragging = false;

    // Context data for shift planning
    this.departments = [];
    this.machines = [];
    this.teamLeaders = [];
    this.areas = [];
    this.selectedContext = {
      departmentId: null,
      machineId: null,
      teamLeaderId: null,
      areaId: null,
    };

    this.weeklyNotes = '';

    this.init();
  }

  async init(): Promise<void> {
    console.info('Initializing Shift Planning System...');

    // Check user authentication and role
    await this.checkUserRole();

    // Initialize event listeners
    this.setupEventListeners();

    // Load context data
    await this.loadContextData();

    // Load initial data
    await this.loadEmployees();
    await this.loadCurrentWeekData();
    await this.loadWeeklyNotes();

    // Update UI based on user role
    this.updateUIForRole();

    // Highlight employee's own shifts
    this.highlightEmployeeShifts();

    console.info('Shift Planning System initialized');
  }

  async checkUserRole(): Promise<void> {
    try {
      const user = await this.getStoredUserData();
      if (user) {
        this.userRole = user.role || 'employee';
        this.isAdmin = ['admin', 'root', 'manager', 'team_lead'].includes(this.userRole);
        this.currentUserId = user.id;

        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
          userNameElement.textContent = user.username || 'User';
        }

        // Update info row with user's department/team info
        const currentDeptElement = document.getElementById('currentDepartment');
        if (currentDeptElement && user.department_id) {
          currentDeptElement.textContent = `Department ${user.department_id}`;
        }

        const currentTeamLeaderElement = document.getElementById('currentTeamLeader');
        if (currentTeamLeaderElement && user.position) {
          currentTeamLeaderElement.textContent = user.username || '';
        }
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  }

  private async getStoredUserData(): Promise<User | null> {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }

    return null;
  }

  setupEventListeners(): void {
    // Week navigation
    document.getElementById('prevWeekBtn')?.addEventListener('click', () => this.navigateWeek(-1));
    document.getElementById('nextWeekBtn')?.addEventListener('click', () => this.navigateWeek(1));

    // Employee selection (fallback for non-drag interaction)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest('.employee-item') as HTMLElement;
      if (employeeItem && !this.isDragging) {
        this.selectEmployee(employeeItem);
      }
    });

    // Shift cell assignment (fallback for non-drag interaction)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const shiftCell = target.closest('.shift-cell') as HTMLElement;
      if (shiftCell && this.isAdmin && !this.isDragging) {
        this.assignEmployeeToShift(shiftCell);
      } else if (shiftCell && !this.isAdmin && !this.isDragging) {
        // Show shift details modal for employees
        this.showShiftDetailsModal(shiftCell);
      }
    });

    // Drag & Drop Events
    this.setupDragAndDrop();

    // Context selection events
    this.setupContextEvents();

    // Weekly notes functionality
    this.setupNotesEvents();

    // Admin actions
    document.getElementById('saveScheduleBtn')?.addEventListener('click', () => this.saveSchedule());
    document.getElementById('resetScheduleBtn')?.addEventListener('click', () => this.resetSchedule());

    // Remove logout functionality - handled by unified navigation
  }

  setupDragAndDrop(): void {
    if (!this.isAdmin) return; // Only admins can drag employees

    // Drag start on employee items
    document.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest('.employee-item') as HTMLElement;

      if (employeeItem) {
        // Check if employee is available for dragging
        if (employeeItem.getAttribute('draggable') === 'false') {
          e.preventDefault();
          return;
        }

        this.isDragging = true;
        employeeItem.classList.add('dragging');

        const employeeId = employeeItem.dataset.employeeId;
        if (employeeId && e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', employeeId);
        }
      }
    });

    // Drag end
    document.addEventListener('dragend', (e) => {
      const target = e.target as HTMLElement;
      const employeeItem = target.closest('.employee-item') as HTMLElement;

      if (employeeItem) {
        this.isDragging = false;
        employeeItem.classList.remove('dragging');
      }
    });

    // Drag over shift cells
    document.addEventListener('dragover', (e) => {
      const target = e.target as HTMLElement;
      const shiftCell = target.closest('.shift-cell') as HTMLElement;

      if (shiftCell) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
        shiftCell.classList.add('drag-over');
      }
    });

    // Drag leave
    document.addEventListener('dragleave', (e) => {
      const target = e.target as HTMLElement;
      const shiftCell = target.closest('.shift-cell') as HTMLElement;

      if (shiftCell) {
        shiftCell.classList.remove('drag-over');
      }
    });

    // Drop on shift cells
    document.addEventListener('drop', (e) => {
      const target = e.target as HTMLElement;
      const shiftCell = target.closest('.shift-cell') as HTMLElement;

      if (shiftCell) {
        e.preventDefault();
        shiftCell.classList.remove('drag-over');

        const employeeId = e.dataTransfer?.getData('text/plain');
        if (employeeId) {
          this.assignShift(shiftCell, parseInt(employeeId));
        }
      }
    });
  }

  setupContextEvents(): void {
    // Department selection
    const departmentSelect = document.getElementById('departmentSelect') as HTMLSelectElement;
    departmentSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.selectedContext.departmentId = target.value ? parseInt(target.value) : null;
      this.onContextChange();
    });

    // Machine selection
    const machineSelect = document.getElementById('machineSelect') as HTMLSelectElement;
    machineSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.selectedContext.machineId = target.value ? parseInt(target.value) : null;
    });

    // Team leader selection
    const teamLeaderSelect = document.getElementById('teamLeaderSelect') as HTMLSelectElement;
    teamLeaderSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.selectedContext.teamLeaderId = target.value ? parseInt(target.value) : null;
    });

    // Area selection
    const areaSelect = document.getElementById('areaSelect') as HTMLSelectElement;
    areaSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.selectedContext.areaId = target.value ? parseInt(target.value) : null;
    });
  }

  setupNotesEvents(): void {
    const notesToggle = document.getElementById('notesToggle') as HTMLElement;
    const notesPanel = document.getElementById('notesPanel') as HTMLElement;
    const notesTextarea = document.getElementById('weeklyNotes') as HTMLTextAreaElement;
    const saveNotesBtn = document.getElementById('saveNotesBtn') as HTMLButtonElement;

    notesToggle?.addEventListener('click', () => {
      notesPanel?.classList.toggle('show');
      if (notesPanel?.classList.contains('show')) {
        notesTextarea?.focus();
      }
    });

    saveNotesBtn?.addEventListener('click', () => {
      this.saveWeeklyNotes();
    });

    // Auto-save notes on input (with debounce)
    let saveTimeout: NodeJS.Timeout;
    notesTextarea?.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.saveWeeklyNotes();
      }, 1000);
    });
  }

  async loadContextData(): Promise<void> {
    await Promise.all([this.loadDepartments(), this.loadMachines(), this.loadTeamLeaders(), this.loadAreas()]);
  }

  async loadDepartments(): Promise<void> {
    try {
      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.info('Departments API response:', data);
        this.departments = Array.isArray(data) ? data : data.departments || [];
      } else {
        throw new Error('Failed to load departments');
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      // Fallback data
      this.departments = [
        { id: 1, name: 'Produktion' },
        { id: 2, name: 'Logistik' },
        { id: 3, name: 'Qualitätssicherung' },
        { id: 4, name: 'Wartung' },
      ];
    }
    this.populateDepartmentSelect();
  }

  async loadMachines(): Promise<void> {
    try {
      let url = '/api/machines';
      if (this.selectedContext.departmentId) {
        url += `?department_id=${this.selectedContext.departmentId}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.machines = data.machines || [];
      } else {
        throw new Error('Failed to load machines');
      }
    } catch (error) {
      console.error('Error loading machines:', error);
      // Fallback data
      this.machines = [
        { id: 1, name: 'Anlage 01', department_id: 1 },
        { id: 2, name: 'Anlage 02', department_id: 1 },
        { id: 3, name: 'Förderband A', department_id: 2 },
        { id: 4, name: 'Förderband B', department_id: 2 },
        { id: 5, name: 'Prüfstand 01', department_id: 3 },
      ];
    }
    this.populateMachineSelect();
  }

  async loadTeamLeaders(): Promise<void> {
    try {
      const response = await fetch('/api/users', {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter for team leaders and admins
        const users = Array.isArray(data) ? data : data.users || [];
        this.teamLeaders = users
          .filter((user: User) => ['admin', 'root', 'manager', 'team_lead'].includes(user.role))
          .map((user: User) => ({
            id: user.id,
            name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username,
            username: user.username,
          }));
      } else {
        throw new Error('Failed to load team leaders');
      }
    } catch (error) {
      console.error('Error loading team leaders:', error);
      // Fallback data
      this.teamLeaders = [
        { id: 1, name: 'Max Mustermann', username: 'max.mustermann' },
        { id: 2, name: 'Sarah Weber', username: 'sarah.weber' },
        { id: 3, name: 'Michael Klein', username: 'michael.klein' },
        { id: 4, name: 'Anna Fischer', username: 'anna.fischer' },
      ];
    }
    this.populateTeamLeaderSelect();
  }

  async loadAreas(): Promise<void> {
    try {
      const response = await fetch('/api/areas', {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.areas = data.areas || [];
      } else {
        throw new Error('Failed to load areas');
      }
    } catch (error) {
      console.error('Error loading areas:', error);
      // Fallback data
      this.areas = [
        { id: 1, name: 'Halle A' },
        { id: 2, name: 'Halle B' },
        { id: 3, name: 'Lager Nord' },
        { id: 4, name: 'Lager Süd' },
        { id: 5, name: 'Bürobereich' },
      ];
    }
    this.populateAreaSelect();
  }

  populateDepartmentSelect(): void {
    const select = document.getElementById('departmentSelect') as HTMLSelectElement;
    if (!select) {
      console.error('Department select element not found');
      return;
    }

    select.innerHTML = '<option value="">Abteilung wählen...</option>';

    console.info('Populating departments:', this.departments);
    this.departments.forEach((dept) => {
      console.info('Adding department:', dept);
      const option = document.createElement('option');
      option.value = dept.id.toString();
      option.textContent = dept.name;
      select.appendChild(option);
    });

    console.info('Department select populated with', this.departments.length, 'departments');
  }

  populateMachineSelect(): void {
    const select = document.getElementById('machineSelect') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Maschine wählen...</option>';

    // Filter machines by selected department if any
    let filteredMachines = this.machines;
    if (this.selectedContext.departmentId) {
      filteredMachines = this.machines.filter((machine) => machine.department_id === this.selectedContext.departmentId);
    }

    filteredMachines.forEach((machine) => {
      const option = document.createElement('option');
      option.value = machine.id.toString();
      option.textContent = machine.name;
      select.appendChild(option);
    });
  }

  populateTeamLeaderSelect(): void {
    const select = document.getElementById('teamLeaderSelect') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Teamleiter wählen...</option>';

    this.teamLeaders.forEach((leader) => {
      const option = document.createElement('option');
      option.value = leader.id.toString();
      option.textContent = leader.name || leader.username;
      select.appendChild(option);
    });
  }

  populateAreaSelect(): void {
    const select = document.getElementById('areaSelect') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Bereich wählen...</option>';

    this.areas.forEach((area) => {
      const option = document.createElement('option');
      option.value = area.id.toString();
      option.textContent = area.name;
      select.appendChild(option);
    });
  }

  async onContextChange(): Promise<void> {
    // Reload machines when department changes
    if (this.selectedContext.departmentId) {
      await this.loadMachines();
    }

    // Reload employees based on context
    await this.loadEmployees();
  }

  async loadEmployees(): Promise<void> {
    try {
      let url = '/api/users';
      const params = new URLSearchParams();

      if (this.selectedContext.departmentId) {
        params.append('department_id', this.selectedContext.departmentId.toString());
      }
      if (this.selectedContext.teamLeaderId) {
        params.append('team_leader_id', this.selectedContext.teamLeaderId.toString());
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const users = Array.isArray(data) ? data : data.users || [];
        this.employees = users.filter((user: User) => user.role === 'employee');
        this.renderEmployeeList();
      } else {
        throw new Error('Failed to load employees');
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      // Fallback data
      this.employees = [
        {
          id: 1,
          username: 'john.doe',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          role: 'employee',
          availability_status: 'available',
        },
        {
          id: 2,
          username: 'jane.smith',
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          role: 'employee',
          availability_status: 'available',
        },
      ] as Employee[];
      this.renderEmployeeList();
    }
  }

  renderEmployeeList(): void {
    const container = document.getElementById('employeeList');
    if (!container) return;

    container.innerHTML = '';

    this.employees.forEach((employee) => {
      const item = document.createElement('div');
      item.className = 'employee-item';
      item.dataset.employeeId = employee.id.toString();

      const isDraggable = this.isAdmin && employee.availability_status === 'available';
      item.setAttribute('draggable', isDraggable.toString());

      if (!isDraggable) {
        item.classList.add('unavailable');
      }

      const name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username;
      const statusIcon = this.getAvailabilityIcon(employee.availability_status);

      item.innerHTML = `
        <div class="employee-info">
          <span class="employee-name">${this.escapeHtml(name)}</span>
          ${statusIcon}
        </div>
        <div class="employee-stats">
          <span class="shift-count">0</span>
        </div>
      `;

      container.appendChild(item);
    });

    // Update shift counts
    this.updateEmployeeShiftCounts();
  }

  getAvailabilityIcon(status?: string): string {
    switch (status) {
      case 'vacation':
        return '<i class="fas fa-plane status-icon vacation" title="Im Urlaub"></i>';
      case 'sick':
        return '<i class="fas fa-notes-medical status-icon sick" title="Krank"></i>';
      case 'unavailable':
        return '<i class="fas fa-ban status-icon unavailable" title="Nicht verfügbar"></i>';
      default:
        return '';
    }
  }

  updateEmployeeShiftCounts(): void {
    // Reset all counts
    document.querySelectorAll('.shift-count').forEach((el) => {
      el.textContent = '0';
    });

    // Count shifts for each employee
    const shiftCounts: { [key: number]: number } = {};

    Object.values(this.weeklyShifts).forEach((dayShifts) => {
      Object.values(dayShifts).forEach((employeeIds) => {
        employeeIds.forEach((employeeId) => {
          shiftCounts[employeeId] = (shiftCounts[employeeId] || 0) + 1;
        });
      });
    });

    // Update UI
    Object.entries(shiftCounts).forEach(([employeeId, count]) => {
      const item = document.querySelector(`[data-employee-id="${employeeId}"] .shift-count`);
      if (item) {
        item.textContent = count.toString();
      }
    });
  }

  selectEmployee(employeeItem: HTMLElement): void {
    if (!this.isAdmin) return;

    // Remove previous selection
    document.querySelectorAll('.employee-item').forEach((item) => {
      item.classList.remove('selected');
    });

    // Add selection to clicked item
    employeeItem.classList.add('selected');

    const employeeId = parseInt(employeeItem.dataset.employeeId || '0');
    this.selectedEmployee = this.employees.find((e) => e.id === employeeId) || null;
  }

  assignEmployeeToShift(shiftCell: HTMLElement): void {
    if (!this.isAdmin || !this.selectedEmployee) return;

    const date = shiftCell.dataset.date;
    const shift = shiftCell.dataset.shift;

    if (!date || !shift) return;

    this.assignShift(shiftCell, this.selectedEmployee.id);
  }

  assignShift(shiftCell: HTMLElement, employeeId: number): void {
    const date = shiftCell.dataset.date;
    const shift = shiftCell.dataset.shift;

    if (!date || !shift) return;

    const employee = this.employees.find((e) => e.id === employeeId);
    if (!employee) return;

    // Check if employee is available
    if (employee.availability_status !== 'available' && employee.availability_status !== undefined) {
      showError(`${employee.first_name || employee.username} ist nicht verfügbar`);
      return;
    }

    // Initialize data structures if needed
    if (!this.weeklyShifts[date]) {
      this.weeklyShifts[date] = {};
    }
    if (!this.weeklyShifts[date][shift]) {
      this.weeklyShifts[date][shift] = [];
    }

    // Check if employee is already assigned to this shift
    if (this.weeklyShifts[date][shift].includes(employeeId)) {
      // Remove assignment
      this.weeklyShifts[date][shift] = this.weeklyShifts[date][shift].filter((id) => id !== employeeId);
    } else {
      // Add assignment
      this.weeklyShifts[date][shift].push(employeeId);
    }

    // Update UI
    this.renderShiftAssignments(date, shift);
    this.updateEmployeeShiftCounts();
  }

  renderShiftAssignments(date: string, shift: string): void {
    const shiftCell = document.querySelector(`[data-date="${date}"][data-shift="${shift}"]`) as HTMLElement;

    if (!shiftCell) return;

    const assignmentsContainer = shiftCell.querySelector('.shift-assignments') || document.createElement('div');
    assignmentsContainer.className = 'shift-assignments';
    assignmentsContainer.innerHTML = '';

    const employeeIds = this.weeklyShifts[date]?.[shift] || [];

    employeeIds.forEach((employeeId) => {
      const employee = this.employees.find((e) => e.id === employeeId);
      if (employee) {
        const tag = document.createElement('div');
        tag.className = 'employee-tag';

        const name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username;
        tag.innerHTML = `
          <span>${this.escapeHtml(name)}</span>
          ${this.isAdmin ? `<i class="fas fa-times remove-btn" data-employee-id="${employeeId}"></i>` : ''}
        `;

        if (this.isAdmin) {
          const removeBtn = tag.querySelector('.remove-btn');
          removeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.assignShift(shiftCell, employeeId);
          });
        }

        assignmentsContainer.appendChild(tag);
      }
    });

    if (!shiftCell.contains(assignmentsContainer)) {
      shiftCell.appendChild(assignmentsContainer);
    }
  }

  async loadCurrentWeekData(): Promise<void> {
    try {
      const weekStart = this.getWeekStart(this.currentWeek);
      const weekEnd = this.getWeekEnd(this.currentWeek);

      const response = await fetch(`/api/shifts?start=${weekStart}&end=${weekEnd}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.processShiftData(data.shifts || []);
        this.renderWeekView();
      } else {
        throw new Error('Failed to load shift data');
      }
    } catch (error) {
      console.error('Error loading shift data:', error);
      this.renderWeekView();
    }
  }

  processShiftData(shifts: ShiftAssignment[]): void {
    this.weeklyShifts = {};

    shifts.forEach((shift) => {
      const date = shift.date;
      const shiftType = shift.shift_type;

      if (!this.weeklyShifts[date]) {
        this.weeklyShifts[date] = {};
      }
      if (!this.weeklyShifts[date][shiftType]) {
        this.weeklyShifts[date][shiftType] = [];
      }

      this.weeklyShifts[date][shiftType].push(shift.employee_id);
    });
  }

  renderWeekView(): void {
    const weekStart = this.getWeekStart(this.currentWeek);
    const weekContainer = document.getElementById('weekView');

    if (!weekContainer) return;

    // Update week display
    const currentWeekElement = document.getElementById('currentWeek');
    if (currentWeekElement) {
      currentWeekElement.textContent = this.formatWeekRange(weekStart);
    }

    // Clear existing content
    weekContainer.innerHTML = '';

    // Create header row
    const headerRow = document.createElement('div');
    headerRow.className = 'week-header';
    headerRow.innerHTML = '<div class="time-header">Schicht</div>';

    // Add day headers
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dayHeader = document.createElement('div');
      dayHeader.className = 'day-header';
      dayHeader.innerHTML = `
        <div class="day-name">${this.getDayName(date)}</div>
        <div class="day-date">${date.getDate()}.${date.getMonth() + 1}.</div>
      `;
      headerRow.appendChild(dayHeader);
    }

    weekContainer.appendChild(headerRow);

    // Create shift rows
    const shifts = [
      { key: 'early', name: 'Frühschicht', time: '06:00 - 14:00' },
      { key: 'late', name: 'Spätschicht', time: '14:00 - 22:00' },
      { key: 'night', name: 'Nachtschicht', time: '22:00 - 06:00' },
    ];

    shifts.forEach((shift) => {
      const shiftRow = document.createElement('div');
      shiftRow.className = 'shift-row';

      // Shift info
      const shiftInfo = document.createElement('div');
      shiftInfo.className = 'shift-info';
      shiftInfo.innerHTML = `
        <div class="shift-name">${shift.name}</div>
        <div class="shift-time">${shift.time}</div>
      `;
      shiftRow.appendChild(shiftInfo);

      // Shift cells for each day
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dateStr = this.formatDate(date);

        const shiftCell = document.createElement('div');
        shiftCell.className = 'shift-cell';
        shiftCell.dataset.date = dateStr;
        shiftCell.dataset.shift = shift.key;

        // Render existing assignments
        this.renderShiftAssignments(dateStr, shift.key);

        shiftRow.appendChild(shiftCell);
      }

      weekContainer.appendChild(shiftRow);
    });

    // Render all assignments
    Object.entries(this.weeklyShifts).forEach(([date, shifts]) => {
      Object.entries(shifts).forEach(([shiftType, _employeeIds]) => {
        this.renderShiftAssignments(date, shiftType);
      });
    });
  }

  navigateWeek(direction: number): void {
    const newDate = new Date(this.currentWeek);
    newDate.setDate(newDate.getDate() + direction * 7);
    this.currentWeek = newDate;
    this.loadCurrentWeekData();
  }

  getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    return new Date(d.setDate(diff));
  }

  getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return weekEnd;
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatWeekRange(weekStart: Date): string {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
    };
    const startStr = weekStart.toLocaleDateString('de-DE', options);
    const endStr = weekEnd.toLocaleDateString('de-DE', options);

    return `${startStr} - ${endStr} ${weekEnd.getFullYear()}`;
  }

  getDayName(date: Date): string {
    return date.toLocaleDateString('de-DE', { weekday: 'short' });
  }

  async saveSchedule(): Promise<void> {
    if (!this.isAdmin) return;

    try {
      const weekStart = this.formatDate(this.getWeekStart(this.currentWeek));
      const weekEnd = this.formatDate(this.getWeekEnd(this.currentWeek));

      // Prepare shift assignments
      const assignments: Array<{
        employee_id: number;
        shift_date: string;
        shift_type: string;
        week_start: string;
        week_end: string;
        department_id?: number;
        machine_id?: number;
        team_leader_id?: number;
        area_id?: number;
      }> = [];

      Object.entries(this.weeklyShifts).forEach(([date, shifts]) => {
        Object.entries(shifts).forEach(([shiftType, employeeIds]) => {
          employeeIds.forEach((employeeId) => {
            assignments.push({
              employee_id: employeeId,
              shift_date: date,
              shift_type: shiftType,
              week_start: weekStart,
              week_end: weekEnd,
              department_id: this.selectedContext.departmentId || undefined,
              machine_id: this.selectedContext.machineId || undefined,
              team_leader_id: this.selectedContext.teamLeaderId || undefined,
              area_id: this.selectedContext.areaId || undefined,
            });
          });
        });
      });

      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          week_start: weekStart,
          week_end: weekEnd,
          assignments,
          notes: this.weeklyNotes,
        }),
      });

      if (response.ok) {
        showSuccess('Schichtplan erfolgreich gespeichert!');
        await this.loadCurrentWeekData();
      } else {
        const error = await response.json();
        showError(error.message || 'Fehler beim Speichern des Schichtplans');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      showError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  resetSchedule(): void {
    if (!this.isAdmin) return;

    if (!confirm('Möchten Sie den aktuellen Schichtplan wirklich zurücksetzen?')) {
      return;
    }

    this.weeklyShifts = {};
    this.renderWeekView();
    this.updateEmployeeShiftCounts();
    showInfo('Schichtplan wurde zurückgesetzt');
  }

  async loadWeeklyNotes(): Promise<void> {
    try {
      const weekStart = this.formatDate(this.getWeekStart(this.currentWeek));

      const response = await fetch(`/api/shifts/notes?week=${weekStart}`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.weeklyNotes = data.notes || '';

        const notesTextarea = document.getElementById('weeklyNotes') as HTMLTextAreaElement;
        if (notesTextarea) {
          notesTextarea.value = this.weeklyNotes;
        }
      }
    } catch (error) {
      console.error('Error loading weekly notes:', error);
    }
  }

  async saveWeeklyNotes(): Promise<void> {
    if (!this.isAdmin) return;

    try {
      const notesTextarea = document.getElementById('weeklyNotes') as HTMLTextAreaElement;
      this.weeklyNotes = notesTextarea?.value || '';

      const weekStart = this.formatDate(this.getWeekStart(this.currentWeek));

      const response = await fetch('/api/shifts/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          week: weekStart,
          notes: this.weeklyNotes,
        }),
      });

      if (response.ok) {
        showSuccess('Notizen gespeichert');
      } else {
        showError('Fehler beim Speichern der Notizen');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      showError('Ein Fehler ist aufgetreten');
    }
  }

  updateUIForRole(): void {
    const adminControls = document.querySelectorAll('.admin-controls');
    const employeeInfo = document.querySelectorAll('.employee-info-section');

    if (this.isAdmin) {
      adminControls.forEach((el) => el.classList.remove('hidden'));
      employeeInfo.forEach((el) => el.classList.add('hidden'));
    } else {
      adminControls.forEach((el) => el.classList.add('hidden'));
      employeeInfo.forEach((el) => el.classList.remove('hidden'));
    }

    // Update instructions
    const instructions = document.getElementById('instructions');
    if (instructions) {
      if (this.isAdmin) {
        instructions.innerHTML = `
          <p>Ziehen Sie Mitarbeiter auf die gewünschten Schichten oder klicken Sie erst auf einen Mitarbeiter und dann auf eine Schicht.</p>
        `;
      } else {
        instructions.innerHTML = `
          <p>Hier sehen Sie Ihren aktuellen Schichtplan. Ihre Schichten sind hervorgehoben.</p>
        `;
      }
    }
  }

  highlightEmployeeShifts(): void {
    if (this.isAdmin || !this.currentUserId) return;

    // Remove existing highlights
    document.querySelectorAll('.employee-shift').forEach((el) => {
      el.classList.remove('employee-shift');
    });

    // Highlight current employee's shifts
    Object.entries(this.weeklyShifts).forEach(([date, shifts]) => {
      Object.entries(shifts).forEach(([shiftType, employeeIds]) => {
        if (this.currentUserId !== null && employeeIds.includes(this.currentUserId)) {
          const shiftCell = document.querySelector(`[data-date="${date}"][data-shift="${shiftType}"]`);
          shiftCell?.classList.add('employee-shift');
        }
      });
    });
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  private showShiftDetailsModal(shiftCell: HTMLElement): void {
    const date = shiftCell.dataset.date;
    const shift = shiftCell.dataset.shift;
    
    if (!date || !shift) return;

    // Find shift details
    const shiftDate = new Date(date);
    const dayName = shiftDate.toLocaleDateString('de-DE', { weekday: 'long' });
    const dateStr = shiftDate.toLocaleDateString('de-DE');
    
    // Get shift time based on type
    const shiftTimes: { [key: string]: string } = {
      'early': '06:00 - 14:00',
      'late': '14:00 - 22:00',
      'night': '22:00 - 06:00'
    };
    
    const shiftNames: { [key: string]: string } = {
      'early': 'Frühschicht',
      'late': 'Spätschicht',
      'night': 'Nachtschicht'
    };

    // Get assigned employees for this shift
    const employeeIds = this.weeklyShifts[date]?.[shift] || [];
    const assignedEmployees = employeeIds.map(id => {
      const employee = this.employees.find(e => e.id === id);
      if (employee) {
        const name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username;
        return this.escapeHtml(name);
      }
      return '';
    }).filter(name => name).join(', ');

    const modalContent = `
      <div class="shift-detail-modal">
        <h3>${shiftNames[shift]} - ${dayName}</h3>
        <div class="shift-detail-info">
          <div class="detail-row">
            <span class="detail-label">Datum:</span>
            <span class="detail-value">${dateStr}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Zeit:</span>
            <span class="detail-value">${shiftTimes[shift]}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Zugewiesene Mitarbeiter:</span>
            <span class="detail-value">${assignedEmployees || 'Keine Mitarbeiter zugewiesen'}</span>
          </div>
          ${this.selectedContext.departmentId ? `
          <div class="detail-row">
            <span class="detail-label">Abteilung:</span>
            <span class="detail-value">${this.departments.find(d => d.id === this.selectedContext.departmentId)?.name || '-'}</span>
          </div>` : ''}
          ${this.selectedContext.machineId ? `
          <div class="detail-row">
            <span class="detail-label">Maschine:</span>
            <span class="detail-value">${this.machines.find(m => m.id === this.selectedContext.machineId)?.name || '-'}</span>
          </div>` : ''}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="window.modalManager.closeModal()">Schließen</button>
        </div>
      </div>
    `;

    openModal(modalContent, {
      title: 'Schichtdetails',
      size: 'medium'
    });
  }
}

// Initialize the system when the page loads
// let shiftPlanningSystem: ShiftPlanningSystem;

document.addEventListener('DOMContentLoaded', () => {
  new ShiftPlanningSystem();
});

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  interface WindowWithShiftPlanning extends Window {
    ShiftPlanningSystem: typeof ShiftPlanningSystem;
  }
  (window as unknown as WindowWithShiftPlanning).ShiftPlanningSystem = ShiftPlanningSystem;
}
