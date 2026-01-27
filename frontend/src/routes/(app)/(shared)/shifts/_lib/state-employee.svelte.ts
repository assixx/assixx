// =============================================================================
// SHIFTS STATE - EMPLOYEE MODULE
// Employees, team members, favorites
// =============================================================================

import type {
  Employee,
  TeamMember,
  ShiftFavorite,
  EmployeeTeamInfo,
} from './types';

/** Format employee display name from employee object */
function formatEmployeeName(
  employee: Employee | undefined,
  fallbackId: number,
): string {
  if (employee === undefined) return `User ${fallbackId}`;
  const firstName = employee.firstName ?? '';
  const lastName = employee.lastName ?? '';
  if (firstName !== '' || lastName !== '')
    return `${firstName} ${lastName}`.trim();
  return employee.username !== '' ? employee.username : `User ${fallbackId}`;
}

export function createEmployeeState() {
  let employees = $state<Employee[]>([]);
  let teamMembers = $state<TeamMember[]>([]);
  let selectedEmployee = $state<Employee | null>(null);
  let employeeTeamInfo = $state<EmployeeTeamInfo | null>(null);
  let favorites = $state<ShiftFavorite[]>([]);

  const getEmployeeById = (id: number) => employees.find((e) => e.id === id);

  return {
    get employees() {
      return employees;
    },
    get teamMembers() {
      return teamMembers;
    },
    get selectedEmployee() {
      return selectedEmployee;
    },
    get employeeTeamInfo() {
      return employeeTeamInfo;
    },
    get favorites() {
      return favorites;
    },
    setEmployees: (data: Employee[]) => {
      employees = data;
    },
    setTeamMembers: (data: TeamMember[]) => {
      teamMembers = data;
    },
    setSelectedEmployee: (emp: Employee | null) => {
      selectedEmployee = emp;
    },
    setEmployeeTeamInfo: (info: EmployeeTeamInfo | null) => {
      employeeTeamInfo = info;
    },
    setFavorites: (data: ShiftFavorite[]) => {
      favorites = data;
    },
    getEmployeeById,
    getMemberNameById: (userId: number) =>
      formatEmployeeName(getEmployeeById(userId), userId),
    reset: () => {
      employees = [];
      teamMembers = [];
      selectedEmployee = null;
      employeeTeamInfo = null;
      favorites = [];
    },
  };
}

export type EmployeeState = ReturnType<typeof createEmployeeState>;
