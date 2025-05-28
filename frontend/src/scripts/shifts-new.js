/**
 * New Shift Planning System - JavaScript Implementation
 * Interactive weekly shift planning with drag & drop functionality
 */

class ShiftPlanningSystem {
  constructor() {
    this.currentWeek = new Date();
    this.selectedEmployee = null;
    this.currentShiftPlan = null;
    this.employees = [];
    this.weeklyShifts = {};
    this.isAdmin = false;
    this.userRole = '';

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

  async init() {
    console.log('Initializing Shift Planning System...');

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

    console.log('Shift Planning System initialized');
  }

  async checkUserRole() {
    try {
      const user = await getStoredUserData();
      if (user) {
        this.userRole = user.role || 'employee';
        this.isAdmin = ['admin', 'root', 'manager', 'team_lead'].includes(
          this.userRole
        );
        this.currentUserId = user.id; // Store current user ID

        document.getElementById('userName').textContent =
          user.username || user.name || 'User';

        // Update info row with user's department/team info
        if (user.department) {
          document.getElementById('currentDepartment').textContent =
            user.department;
        }
        if (user.position) {
          document.getElementById('currentTeamLeader').textContent =
            user.name || user.username;
        }
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  }

  setupEventListeners() {
    // Week navigation
    document
      .getElementById('prevWeekBtn')
      .addEventListener('click', () => this.navigateWeek(-1));
    document
      .getElementById('nextWeekBtn')
      .addEventListener('click', () => this.navigateWeek(1));

    // Employee selection (fallback for non-drag interaction)
    document.addEventListener('click', (e) => {
      if (e.target.closest('.employee-item') && !this.isDragging) {
        this.selectEmployee(e.target.closest('.employee-item'));
      }
    });

    // Shift cell assignment (fallback for non-drag interaction)
    document.addEventListener('click', (e) => {
      if (e.target.closest('.shift-cell') && this.isAdmin && !this.isDragging) {
        this.assignEmployeeToShift(e.target.closest('.shift-cell'));
      }
    });

    // Drag & Drop Events
    this.setupDragAndDrop();

    // Context selection events
    this.setupContextEvents();

    // Weekly notes functionality
    this.setupNotesEvents();

    // Admin actions
    document
      .getElementById('saveScheduleBtn')
      .addEventListener('click', () => this.saveSchedule());
    document
      .getElementById('resetScheduleBtn')
      .addEventListener('click', () => this.resetSchedule());

    // Logout functionality
    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.href = '/login';
    });
  }

  setupDragAndDrop() {
    if (!this.isAdmin) return; // Only admins can drag employees

    // Drag start on employee items
    document.addEventListener('dragstart', (e) => {
      if (e.target.closest('.employee-item')) {
        const employeeItem = e.target.closest('.employee-item');

        // Check if employee is available for dragging
        if (employeeItem.getAttribute('draggable') === 'false') {
          e.preventDefault();
          return;
        }

        this.isDragging = true;
        employeeItem.classList.add('dragging');

        // Store employee data for drop
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(
          'text/plain',
          JSON.stringify({
            id: employeeItem.getAttribute('data-employee-id'),
            name: employeeItem.getAttribute('data-employee-name'),
            status: employeeItem.getAttribute('data-employee-status'),
            restrictions: employeeItem.getAttribute(
              'data-employee-restrictions'
            ),
          })
        );

        console.log(
          'Drag started for employee:',
          employeeItem.getAttribute('data-employee-name')
        );
      }
    });

    // Drag end
    document.addEventListener('dragend', (e) => {
      if (e.target.closest('.employee-item')) {
        e.target.closest('.employee-item').classList.remove('dragging');
        this.isDragging = false;

        // Remove all drag-over classes
        document.querySelectorAll('.shift-cell').forEach((cell) => {
          cell.classList.remove('drag-over', 'drop-invalid');
        });
      }
    });

    // Drag over shift cells
    document.addEventListener('dragover', (e) => {
      const shiftCell = e.target.closest('.shift-cell');
      if (shiftCell) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Visual feedback
        const employeeData = e.dataTransfer.types.includes('text/plain');
        if (employeeData) {
          shiftCell.classList.add('drag-over');
        }
      }
    });

    // Drag enter
    document.addEventListener('dragenter', (e) => {
      const shiftCell = e.target.closest('.shift-cell');
      if (shiftCell) {
        e.preventDefault();
      }
    });

    // Drag leave
    document.addEventListener('dragleave', (e) => {
      const shiftCell = e.target.closest('.shift-cell');
      if (shiftCell && !shiftCell.contains(e.relatedTarget)) {
        shiftCell.classList.remove('drag-over', 'drop-invalid');
      }
    });

    // Drop on shift cells
    document.addEventListener('drop', (e) => {
      const shiftCell = e.target.closest('.shift-cell');
      if (shiftCell) {
        e.preventDefault();

        try {
          const employeeData = JSON.parse(e.dataTransfer.getData('text/plain'));
          const day = shiftCell.getAttribute('data-day');
          const shift = shiftCell.getAttribute('data-shift');

          // Validate drop
          const validation = this.validateEmployeeDrop(
            employeeData,
            shift,
            day
          );
          if (validation.valid) {
            this.assignEmployeeToShiftDrop(shiftCell, employeeData, day, shift);
            shiftCell.classList.remove('drag-over');
          } else {
            // Invalid drop - show error feedback
            shiftCell.classList.remove('drag-over');
            shiftCell.classList.add('drop-invalid');
            setTimeout(() => {
              shiftCell.classList.remove('drop-invalid');
            }, 1000);

            this.showDropErrorMessage(validation.message);
          }
        } catch (error) {
          console.error('Error processing drop:', error);
        }
      }
    });
  }

  validateEmployeeDrop(employeeData, shiftType, day) {
    // Check if employee is unavailable
    if (employeeData.status === 'unavailable') {
      return {
        valid: false,
        message: `${employeeData.name} ist nicht verfügbar`,
      };
    }

    // Check shift restrictions
    if (employeeData.status === 'limited') {
      if (employeeData.restrictions === 'early' && shiftType !== 'early') {
        return {
          valid: false,
          message: `${employeeData.name} kann nur Frühschicht arbeiten`,
        };
      }
    }

    // Check if employee is already assigned to another shift on the same day
    if (this.weeklyShifts[day]) {
      for (const existingShiftType of Object.keys(this.weeklyShifts[day])) {
        if (
          existingShiftType !== shiftType &&
          this.weeklyShifts[day][existingShiftType].employeeId ==
            employeeData.id
        ) {
          const shiftNames = {
            early: 'Frühschicht',
            late: 'Spätschicht',
            night: 'Nachtschicht',
          };
          return {
            valid: false,
            message: `${employeeData.name} ist bereits für ${shiftNames[existingShiftType]} an diesem Tag eingeteilt`,
          };
        }
      }
    }

    return { valid: true };
  }

  assignEmployeeToShiftDrop(shiftCell, employeeData, day, shift) {
    // Update shift cell
    const assignmentDiv = shiftCell.querySelector('.employee-assignment');
    assignmentDiv.innerHTML = `
            <div class="employee-name">${employeeData.name}</div>
            <div class="shift-time">${this.getShiftTime(shift)}</div>
        `;

    shiftCell.classList.add('assigned');

    // Store assignment
    if (!this.weeklyShifts[day]) {
      this.weeklyShifts[day] = {};
    }
    this.weeklyShifts[day][shift] = {
      employeeId: employeeData.id,
      employeeName: employeeData.name,
    };

    console.log(`Dropped ${employeeData.name} to ${day} ${shift} shift`);

    // Show success feedback
    this.showDropSuccess(employeeData.name, day, shift);
  }

  showDropErrorMessage(message) {
    // Create temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            word-wrap: break-word;
        `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 4000);
  }

  showDropError(employeeData, shiftType) {
    let message = '';

    if (employeeData.status === 'unavailable') {
      message = `${employeeData.name} ist nicht verfügbar`;
    } else if (
      employeeData.status === 'limited' &&
      employeeData.restrictions === 'early' &&
      shiftType !== 'early'
    ) {
      message = `${employeeData.name} kann nur Frühschicht arbeiten`;
    }

    this.showDropErrorMessage(message);
  }

  showDropSuccess(employeeName, day, shift) {
    const shiftNames = {
      early: 'Frühschicht',
      late: 'Spätschicht',
      night: 'Nachtschicht',
    };

    const dayNames = {
      monday: 'Montag',
      tuesday: 'Dienstag',
      wednesday: 'Mittwoch',
      thursday: 'Donnerstag',
      friday: 'Freitag',
      saturday: 'Samstag',
    };

    const message = `${employeeName} wurde ${dayNames[day]} ${shiftNames[shift]} zugewiesen`;

    // Create temporary success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success-color);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
    successDiv.textContent = message;
    document.body.appendChild(successDiv);

    setTimeout(() => {
      successDiv.remove();
    }, 2000);
  }

  setupContextEvents() {
    if (!this.isAdmin) return;

    // Department selection
    document
      .getElementById('departmentSelect')
      .addEventListener('change', async (e) => {
        this.selectedContext.departmentId = e.target.value;
        await this.onContextChange();
      });

    // Machine selection
    document
      .getElementById('machineSelect')
      .addEventListener('change', async (e) => {
        this.selectedContext.machineId = e.target.value;
        await this.onContextChange();
      });

    // Team leader selection
    document
      .getElementById('teamLeaderSelect')
      .addEventListener('change', async (e) => {
        this.selectedContext.teamLeaderId = e.target.value;
        await this.onContextChange();
      });

    // Area selection
    document
      .getElementById('areaSelect')
      .addEventListener('change', async (e) => {
        this.selectedContext.areaId = e.target.value;
        await this.onContextChange();
      });
  }

  setupNotesEvents() {
    const notesTextarea = document.getElementById('weeklyNotes');

    if (!this.isAdmin) {
      // Make readonly for employees
      notesTextarea.readOnly = true;
      notesTextarea.classList.add('readonly');
      notesTextarea.placeholder =
        'Notizen können nur von Admins bearbeitet werden';
      return;
    }

    // Auto-save notes on input (debounced)
    let saveTimeout;
    notesTextarea.addEventListener('input', (e) => {
      this.weeklyNotes = e.target.value;

      // Clear previous timeout
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      // Save after 2 seconds of no typing
      saveTimeout = setTimeout(() => {
        this.saveWeeklyNotes();
      }, 2000);
    });

    // Save notes on blur (when user clicks away)
    notesTextarea.addEventListener('blur', () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      this.saveWeeklyNotes();
    });
  }

  async loadContextData() {
    try {
      // Load departments
      await this.loadDepartments();

      // Load machines (will be filtered by department)
      await this.loadMachines();

      // Load team leaders
      await this.loadTeamLeaders();

      // Load areas
      await this.loadAreas();
    } catch (error) {
      console.error('Error loading context data:', error);
      this.loadDummyContextData();
    }
  }

  async loadDepartments() {
    try {
      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Departments API response:', data);
        this.departments = data.departments || data || [];
      } else {
        throw new Error('Failed to load departments');
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      this.departments = [
        { id: 1, name: 'Produktion' },
        { id: 2, name: 'Logistik' },
        { id: 3, name: 'Qualitätssicherung' },
        { id: 4, name: 'Wartung' },
      ];
    }
    this.populateDepartmentSelect();
  }

  async loadMachines() {
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

  async loadTeamLeaders() {
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
        this.teamLeaders = (data.users || [])
          .filter((user) =>
            ['admin', 'root', 'manager', 'team_lead'].includes(user.role)
          )
          .map((user) => ({
            id: user.id,
            name:
              user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.username,
            username: user.username,
          }));
      } else {
        throw new Error('Failed to load team leaders');
      }
    } catch (error) {
      console.error('Error loading team leaders:', error);
      this.teamLeaders = [
        { id: 1, name: 'Max Mustermann', username: 'max.mustermann' },
        { id: 2, name: 'Sarah Weber', username: 'sarah.weber' },
        { id: 3, name: 'Michael Klein', username: 'michael.klein' },
        { id: 4, name: 'Anna Fischer', username: 'anna.fischer' },
      ];
    }
    this.populateTeamLeaderSelect();
  }

  async loadAreas() {
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

  populateDepartmentSelect() {
    const select = document.getElementById('departmentSelect');
    if (!select) {
      console.error('Department select element not found');
      return;
    }

    select.innerHTML = '<option value="">Abteilung wählen...</option>';

    console.log('Populating departments:', this.departments);
    this.departments.forEach((dept) => {
      console.log('Adding department:', dept);
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.name;
      select.appendChild(option);
    });

    console.log(
      'Department select populated with',
      this.departments.length,
      'departments'
    );
  }

  populateMachineSelect() {
    const select = document.getElementById('machineSelect');
    select.innerHTML = '<option value="">Maschine wählen...</option>';

    // Filter machines by selected department if any
    let filteredMachines = this.machines;
    if (this.selectedContext.departmentId) {
      filteredMachines = this.machines.filter(
        (machine) => machine.department_id == this.selectedContext.departmentId
      );
    }

    filteredMachines.forEach((machine) => {
      const option = document.createElement('option');
      option.value = machine.id;
      option.textContent = machine.name;
      select.appendChild(option);
    });
  }

  populateTeamLeaderSelect() {
    const select = document.getElementById('teamLeaderSelect');
    select.innerHTML = '<option value="">Teamleiter wählen...</option>';

    this.teamLeaders.forEach((leader) => {
      const option = document.createElement('option');
      option.value = leader.id;
      option.textContent = leader.name || leader.username;
      select.appendChild(option);
    });
  }

  populateAreaSelect() {
    const select = document.getElementById('areaSelect');
    select.innerHTML = '<option value="">Bereich wählen...</option>';

    this.areas.forEach((area) => {
      const option = document.createElement('option');
      option.value = area.id;
      option.textContent = area.name;
      select.appendChild(option);
    });
  }

  async onContextChange() {
    // Reload machines when department changes
    if (this.selectedContext.departmentId) {
      await this.loadMachines();
    }

    // Reload employees based on context
    await this.loadEmployees();

    // Clear current shifts when context changes
    this.clearWeekShifts();

    console.log('Context changed:', this.selectedContext);
  }

  updateUIForRole() {
    const adminActions = document.getElementById('adminActions');

    if (!this.isAdmin) {
      // Hide admin actions for employees
      adminActions.style.display = 'none';

      // Hide select elements and show static values for employees
      document.querySelectorAll('.info-select').forEach((select) => {
        select.style.display = 'none';
      });

      document.querySelectorAll('.info-value').forEach((value) => {
        value.style.display = 'block';
      });

      // Make shift cells non-interactive for employees
      document.querySelectorAll('.shift-cell').forEach((cell) => {
        cell.style.cursor = 'default';
        cell.classList.add('employee-view');
      });

      // Change sidebar title for employees
      document.querySelector('.sidebar-title').textContent = 'Meine Kollegen';
    } else {
      // Show select elements for admins
      document.querySelectorAll('.info-select').forEach((select) => {
        select.style.display = 'block';
      });

      document.querySelectorAll('.info-value').forEach((value) => {
        value.style.display = 'none';
      });
    }
  }

  async loadEmployees() {
    try {
      let url = '/users';
      const params = new URLSearchParams();

      // Add context filters
      if (this.selectedContext.departmentId) {
        params.append('department_id', this.selectedContext.departmentId);
      }
      if (this.selectedContext.teamLeaderId) {
        params.append('team_leader_id', this.selectedContext.teamLeaderId);
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
        // Filter for employees only
        this.employees = (data.users || [])
          .filter(
            (user) => user.role === 'employee' || user.role === 'team_lead'
          )
          .map((user) => ({
            id: user.id,
            name:
              user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.username,
            status: 'available', // Default status
            experience: '2 Jahre', // Default experience
            restrictions: null,
          }));
        this.renderEmployeeList();
      } else {
        console.error('Failed to load employees');
        // Use dummy data for now
        this.loadDummyEmployees();
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      this.loadDummyEmployees();
    }
  }

  loadDummyEmployees() {
    // Dummy employee data for testing
    this.employees = [
      {
        id: 1,
        name: 'Johann Müller',
        status: 'available',
        experience: '5 Jahre',
        restrictions: null,
      },
      {
        id: 2,
        name: 'Anna Schmidt',
        status: 'limited',
        experience: '3 Jahre',
        restrictions: 'Nur Frühschicht',
      },
      {
        id: 3,
        name: 'Peter Weber',
        status: 'unavailable',
        experience: '7 Jahre',
        restrictions: 'Urlaub bis 26.05.2025',
      },
      {
        id: 4,
        name: 'Lisa Wagner',
        status: 'available',
        experience: '3 Jahre',
        restrictions: null,
      },
      {
        id: 5,
        name: 'Tom Fischer',
        status: 'unavailable',
        experience: '2 Jahre',
        restrictions: 'Krank seit 20.05.2025',
      },
    ];
    this.renderEmployeeList();
  }

  renderEmployeeList() {
    const employeeList = document.getElementById('employeeList');
    employeeList.innerHTML = '';

    // Hide employee list for non-admin users
    if (!this.isAdmin) {
      const sidebar = employeeList.closest('.employee-sidebar');
      if (sidebar) {
        sidebar.style.display = 'none';
      }
      return;
    }

    this.employees.forEach((employee) => {
      const statusClass = `status-${employee.status}`;
      const statusText = this.getStatusText(employee.status);

      const employeeDiv = document.createElement('div');
      let className = 'employee-item';
      if (employee.status === 'unavailable') {
        className += ' unavailable';
      }
      employeeDiv.className = className;

      // Set data attributes for drag & drop
      employeeDiv.setAttribute('data-employee-id', employee.id);
      employeeDiv.setAttribute('data-employee-name', employee.name);
      employeeDiv.setAttribute('data-employee-status', employee.status);

      // Set draggable attribute
      const isDraggable = employee.status !== 'unavailable' && this.isAdmin;
      employeeDiv.setAttribute('draggable', isDraggable);

      // Set restrictions if any
      if (
        employee.restrictions &&
        employee.restrictions.includes('Frühschicht')
      ) {
        employeeDiv.setAttribute('data-employee-restrictions', 'early');
      }

      employeeDiv.innerHTML = `
                <div class="employee-header">
                    <div class="employee-name-sidebar">${employee.name}</div>
                    <div class="availability-status ${statusClass}">${statusText}</div>
                </div>
                <div class="employee-details">
                    ${employee.restrictions || `Erfahrung: ${employee.experience}`}
                </div>
            `;

      employeeList.appendChild(employeeDiv);
    });
  }

  getStatusText(status) {
    const statusMap = {
      available: 'Verfügbar',
      limited: 'Begrenzt',
      unavailable: 'Nicht verfügbar',
    };
    return statusMap[status] || 'Unbekannt';
  }

  selectEmployee(employeeElement) {
    if (!this.isAdmin) return;

    // Remove previous selection
    document.querySelectorAll('.employee-item.selected').forEach((item) => {
      item.classList.remove('selected');
    });

    // Select new employee
    employeeElement.classList.add('selected');
    this.selectedEmployee = {
      id: employeeElement.getAttribute('data-employee-id'),
      name: employeeElement.querySelector('.employee-name-sidebar').textContent,
      element: employeeElement,
    };

    console.log('Selected employee:', this.selectedEmployee);
  }

  assignEmployeeToShift(shiftCell) {
    if (!this.isAdmin || !this.selectedEmployee) {
      return;
    }

    const day = shiftCell.getAttribute('data-day');
    const shift = shiftCell.getAttribute('data-shift');

    // Get employee data
    const employee = this.employees.find(
      (emp) => emp.id == this.selectedEmployee.id
    );
    if (!employee) return;

    // Convert employee to format expected by validateEmployeeDrop
    const employeeData = {
      id: employee.id,
      name: employee.name,
      status: employee.status,
      restrictions: employee.restrictions,
    };

    // Validate the assignment
    const validation = this.validateEmployeeDrop(employeeData, shift, day);
    if (!validation.valid) {
      this.showDropErrorMessage(validation.message);
      return;
    }

    // Update shift cell
    const assignmentDiv = shiftCell.querySelector('.employee-assignment');
    assignmentDiv.innerHTML = `
            <div class="employee-name">${this.selectedEmployee.name}</div>
            <div class="shift-time">${this.getShiftTime(shift)}</div>
        `;

    shiftCell.classList.add('assigned');

    // Store assignment
    if (!this.weeklyShifts[day]) {
      this.weeklyShifts[day] = {};
    }
    this.weeklyShifts[day][shift] = {
      employeeId: this.selectedEmployee.id,
      employeeName: this.selectedEmployee.name,
    };

    console.log(
      `Assigned ${this.selectedEmployee.name} to ${day} ${shift} shift`
    );

    // Clear selection
    this.selectedEmployee = null;
    document.querySelectorAll('.employee-item.selected').forEach((item) => {
      item.classList.remove('selected');
    });
  }

  getShiftTime(shift) {
    const times = {
      early: '06:00-14:00',
      late: '14:00-22:00',
      night: '22:00-06:00',
    };
    return times[shift] || '';
  }

  navigateWeek(direction) {
    const currentDate = new Date(this.currentWeek);
    currentDate.setDate(currentDate.getDate() + direction * 7);
    this.currentWeek = currentDate;

    this.updateWeekDisplay();
    this.loadCurrentWeekData();
    this.loadWeeklyNotes();
  }

  updateWeekDisplay() {
    const monday = this.getMonday(this.currentWeek);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const weekNumber = this.getWeekNumber(monday);

    const weekInfo = `KW ${weekNumber} - ${this.formatDate(monday)} bis ${this.formatDate(saturday)}`;
    document.getElementById('currentWeekInfo').textContent = weekInfo;

    // Update day headers
    const dayHeaders = document.querySelectorAll('.day-header');
    const days = [
      'Montag',
      'Dienstag',
      'Mittwoch',
      'Donnerstag',
      'Freitag',
      'Samstag',
    ];

    for (let i = 1; i < dayHeaders.length; i++) {
      // Skip first header (Schicht)
      const date = new Date(monday);
      date.setDate(monday.getDate() + (i - 1));

      dayHeaders[i].innerHTML = `
                ${days[i - 1]}<br>
                <span style="font-size: 12px; font-weight: 400;">${this.formatShortDate(date)}</span>
            `;
    }
  }

  getMonday(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  getWeekNumber(date) {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  formatDate(date) {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatShortDate(date) {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  async loadCurrentWeekData() {
    if (!this.isAdmin) {
      // For employees, load only their own shifts
      await this.loadEmployeeShifts();
      return;
    }

    try {
      const monday = this.getMonday(new Date(this.currentWeek));
      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);

      const startDate = monday.toISOString().split('T')[0];
      const endDate = saturday.toISOString().split('T')[0];

      const response = await fetch(
        `/api/shifts/weekly?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.displayWeeklyShifts(data.shifts || []);
      } else {
        console.log('No existing shifts found for this week');
        this.clearWeekShifts();
      }
    } catch (error) {
      console.error('Error loading week data:', error);
      this.clearWeekShifts();
    }
  }

  async loadEmployeeShifts() {
    try {
      const monday = this.getMonday(new Date(this.currentWeek));
      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);

      const startDate = monday.toISOString().split('T')[0];
      const endDate = saturday.toISOString().split('T')[0];

      const response = await fetch(
        `/api/shifts/my-shifts?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.displayEmployeeShifts(data.shifts || []);
      } else {
        console.log('No shifts found for employee this week');
        this.clearWeekShifts();
      }
    } catch (error) {
      console.error('Error loading employee shifts:', error);
      this.clearWeekShifts();
    }
  }

  displayWeeklyShifts(shifts) {
    this.clearWeekShifts();

    shifts.forEach((shift) => {
      const dayName = this.getDayName(shift.date);
      const shiftType = this.getShiftType(shift.start_time);

      if (dayName && shiftType) {
        const cell = document.querySelector(
          `[data-day="${dayName}"][data-shift="${shiftType}"]`
        );
        if (cell && shift.employee_name && shift.employee_name.trim()) {
          const assignmentDiv = cell.querySelector('.employee-assignment');
          assignmentDiv.innerHTML = `
                        <div class="employee-name">${shift.employee_name.trim()}</div>
                        <div class="shift-time">${shift.start_time}-${shift.end_time}</div>
                    `;
          cell.classList.add('assigned');

          // Store the assignment in weeklyShifts for editing
          if (!this.weeklyShifts[dayName]) {
            this.weeklyShifts[dayName] = {};
          }
          this.weeklyShifts[dayName][shiftType] = {
            employeeId: shift.user_id,
            employeeName: shift.employee_name.trim(),
          };
        }
      }
    });
  }

  displayWeekShifts(plans) {
    this.clearWeekShifts();

    plans.forEach((plan) => {
      if (plan.shifts) {
        plan.shifts.forEach((shift) => {
          const dayName = this.getDayName(shift.date);
          const shiftType = this.getShiftType(shift.start_time);

          if (dayName && shiftType) {
            const cell = document.querySelector(
              `[data-day="${dayName}"][data-shift="${shiftType}"]`
            );
            if (cell && shift.employee_name) {
              const assignmentDiv = cell.querySelector('.employee-assignment');
              assignmentDiv.innerHTML = `
                                <div class="employee-name">${shift.employee_name}</div>
                                <div class="shift-time">${shift.start_time}-${shift.end_time}</div>
                            `;
              cell.classList.add('assigned');
            }
          }
        });
      }
    });
  }

  displayEmployeeShifts(shifts) {
    this.clearWeekShifts();

    shifts.forEach((shift) => {
      const dayName = this.getDayName(shift.date);
      const shiftType = this.getShiftType(shift.start_time);

      if (dayName && shiftType) {
        const cell = document.querySelector(
          `[data-day="${dayName}"][data-shift="${shiftType}"]`
        );
        if (cell) {
          const assignmentDiv = cell.querySelector('.employee-assignment');
          assignmentDiv.innerHTML = `
                        <div class="employee-name">Meine Schicht</div>
                        <div class="shift-time">${shift.start_time}-${shift.end_time}</div>
                    `;
          cell.classList.add('assigned');
          cell.style.background = 'rgb(38, 51, 15)';
        }
      }
    });
  }

  getDayName(dateString) {
    const date = new Date(dateString);
    const dayIndex = date.getDay();
    const days = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    return days[dayIndex];
  }

  getShiftType(startTime) {
    const hour = parseInt(startTime.split(':')[0]);
    if (hour >= 6 && hour < 14) return 'early';
    if (hour >= 14 && hour < 22) return 'late';
    return 'night';
  }

  clearWeekShifts() {
    document.querySelectorAll('.shift-cell').forEach((cell) => {
      const assignmentDiv = cell.querySelector('.employee-assignment');
      assignmentDiv.innerHTML =
        '<div class="empty-slot">Mitarbeiter zuweisen</div>';
      cell.classList.remove('assigned');
      cell.style.background = '';
    });
    this.weeklyShifts = {};
  }

  async saveSchedule() {
    if (!this.isAdmin) {
      alert('Keine Berechtigung zum Speichern');
      return;
    }

    if (Object.keys(this.weeklyShifts).length === 0) {
      alert('Keine Änderungen zum Speichern vorhanden');
      return;
    }

    try {
      const monday = this.getMonday(new Date(this.currentWeek));
      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);

      const planData = {
        name: `Schichtplan KW ${this.getWeekNumber(monday)}`,
        description: `Automatisch generierter Schichtplan für KW ${this.getWeekNumber(monday)}`,
        start_date: monday.toISOString().split('T')[0],
        end_date: saturday.toISOString().split('T')[0],
        department_id: this.selectedContext.departmentId || null,
        team_id: this.selectedContext.teamLeaderId || null,
      };

      console.log('Saving shift plan with data:', planData);

      const response = await fetch('/api/shifts/plans', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(planData),
      });

      if (response.ok) {
        const result = await response.json();
        const planId = result.plan.id;

        // Now save individual shifts
        await this.saveShiftsToplan(planId);

        alert('Schichtplan erfolgreich gespeichert!');
        await this.loadCurrentWeekData();
      } else {
        const error = await response.json();
        console.error('Error response:', error);
        alert(`Fehler beim Speichern: ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Fehler beim Speichern des Schichtplans');
    }
  }

  async saveShiftsToplan(planId) {
    const monday = this.getMonday(new Date(this.currentWeek));

    // Convert weeklyShifts to individual shift records
    for (const day of Object.keys(this.weeklyShifts)) {
      for (const shiftType of Object.keys(this.weeklyShifts[day])) {
        const assignment = this.weeklyShifts[day][shiftType];
        const dayIndex = this.getDayIndex(day);
        const shiftDate = new Date(monday);
        shiftDate.setDate(monday.getDate() + dayIndex);

        const times = this.getShiftTimes(shiftType);

        // First create the shift
        const shiftData = {
          plan_id: planId,
          date: shiftDate.toISOString().split('T')[0],
          start_time: times.start,
          end_time: times.end,
          type: shiftType,
        };

        try {
          console.log('Creating shift:', shiftData);
          const shiftResponse = await fetch('/api/shifts', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${getAuthToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(shiftData),
          });

          if (shiftResponse.ok) {
            const shiftResult = await shiftResponse.json();
            const shiftId = shiftResult.shift.id;

            // Then assign the employee to the shift
            const assignmentData = {
              shift_id: shiftId,
              user_id: assignment.employeeId,
              status: 'A',
            };

            console.log('Assigning employee to shift:', assignmentData);
            const assignResponse = await fetch(
              `/api/shifts/${shiftId}/assign`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${getAuthToken()}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(assignmentData),
              }
            );

            if (!assignResponse.ok) {
              console.error('Failed to assign employee:', assignmentData);
            }
          } else {
            console.error('Failed to create shift:', shiftData);
            const error = await shiftResponse.text();
            console.error('Shift creation error:', error);
          }
        } catch (error) {
          console.error('Error saving individual shift:', error);
        }
      }
    }
  }

  convertShiftsToAPI() {
    const shifts = [];
    const monday = this.getMonday(new Date(this.currentWeek));

    Object.keys(this.weeklyShifts).forEach((day) => {
      Object.keys(this.weeklyShifts[day]).forEach((shiftType) => {
        const assignment = this.weeklyShifts[day][shiftType];
        const dayIndex = this.getDayIndex(day);
        const shiftDate = new Date(monday);
        shiftDate.setDate(monday.getDate() + dayIndex);

        const times = this.getShiftTimes(shiftType);

        shifts.push({
          date: shiftDate.toISOString().split('T')[0],
          start_time: times.start,
          end_time: times.end,
          employee_id: assignment.employeeId,
          type: shiftType,
        });
      });
    });

    return shifts;
  }

  getDayIndex(dayName) {
    const days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    return days.indexOf(dayName);
  }

  getShiftTimes(shiftType) {
    const times = {
      early: { start: '06:00', end: '14:00' },
      late: { start: '14:00', end: '22:00' },
      night: { start: '22:00', end: '06:00' },
    };
    return times[shiftType];
  }

  async loadWeeklyNotes() {
    try {
      const monday = this.getMonday(new Date(this.currentWeek));
      const weekNumber = this.getWeekNumber(monday);
      const year = monday.getFullYear();

      const response = await fetch(
        `/api/shifts/weekly-notes?week=${weekNumber}&year=${year}`,
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.weeklyNotes = data.notes || '';
      } else {
        this.weeklyNotes = '';
      }
    } catch (error) {
      console.error('Error loading weekly notes:', error);
      this.weeklyNotes = '';
    }

    // Update textarea
    const notesTextarea = document.getElementById('weeklyNotes');
    if (notesTextarea) {
      notesTextarea.value = this.weeklyNotes;
    }
  }

  async saveWeeklyNotes() {
    if (!this.isAdmin) return;

    try {
      const monday = this.getMonday(new Date(this.currentWeek));
      const weekNumber = this.getWeekNumber(monday);
      const year = monday.getFullYear();

      const response = await fetch('/api/shifts/weekly-notes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          week: weekNumber,
          year,
          notes: this.weeklyNotes,
          context: this.selectedContext,
        }),
      });

      if (response.ok) {
        // Show subtle save indicator
        this.showSaveIndicator();
      } else {
        console.error('Failed to save weekly notes');
      }
    } catch (error) {
      console.error('Error saving weekly notes:', error);
    }
  }

  showSaveIndicator() {
    const notesTextarea = document.getElementById('weeklyNotes');
    const originalBorder = notesTextarea.style.borderColor;

    // Flash green border to indicate save
    notesTextarea.style.borderColor = 'var(--success-color)';
    notesTextarea.style.transition = 'border-color 0.3s ease';

    setTimeout(() => {
      notesTextarea.style.borderColor = originalBorder;
      setTimeout(() => {
        notesTextarea.style.transition = '';
      }, 300);
    }, 500);
  }

  resetSchedule() {
    if (!this.isAdmin) {
      alert('Keine Berechtigung zum Zurücksetzen');
      return;
    }

    if (
      confirm('Möchten Sie alle Änderungen der aktuellen Woche zurücksetzen?')
    ) {
      this.clearWeekShifts();
      this.selectedEmployee = null;
      document.querySelectorAll('.employee-item.selected').forEach((item) => {
        item.classList.remove('selected');
      });
    }
  }

  highlightEmployeeShifts() {
    // Only highlight for non-admin users
    if (this.isAdmin || !this.currentUserId) return;

    // Find all shift cells with assigned employees
    document.querySelectorAll('.shift-cell.assigned').forEach((cell) => {
      const employeeName = cell.textContent.trim();
      const assignedEmployees = cell.querySelectorAll('.assigned-employee');

      // Check if current user is assigned to this shift
      assignedEmployees.forEach((employeeDiv) => {
        const employeeId = employeeDiv.getAttribute('data-employee-id');
        if (
          employeeId &&
          parseInt(employeeId) === parseInt(this.currentUserId)
        ) {
          cell.classList.add('employee-shift');
        }
      });

      // Also check by employee name comparison if ID not available
      if (assignedEmployees.length === 0 && employeeName) {
        // Get current user's name for comparison
        const currentUser = this.employees.find(
          (emp) => emp.id === this.currentUserId
        );
        if (currentUser && employeeName.includes(currentUser.name)) {
          cell.classList.add('employee-shift');
        }
      }
    });
  }
}

// Initialize the shift planning system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ShiftPlanningSystem();
});

// Helper function to get auth token (should be available from auth.js)
function getAuthToken() {
  return localStorage.getItem('token') || localStorage.getItem('authToken');
}

// Helper function to get stored user data (should be available from auth.js)
async function getStoredUserData() {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
}
