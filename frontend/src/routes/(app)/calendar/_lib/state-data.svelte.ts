// =============================================================================
// CALENDAR STATE - DATA MODULE
// Organization data (departments, teams, areas, employees)
// =============================================================================

import { userState } from './state-user.svelte';

import type { Department, Team, Area, User } from './types';

function createDataState() {
  let departments = $state<Department[]>([]);
  let teams = $state<Team[]>([]);
  let areas = $state<Area[]>([]);
  let employees = $state<User[]>([]);

  function setOrganizationData(data: {
    departments: Department[];
    teams: Team[];
    areas: Area[];
    users: User[];
  }) {
    departments = data.departments;
    teams = data.teams;
    areas = data.areas;
    employees = data.users.filter((u) => u.id !== userState.currentUserId);
  }

  function getDepartmentById(id: number): Department | undefined {
    return departments.find((d) => d.id === id);
  }

  function getTeamById(id: number): Team | undefined {
    return teams.find((t) => t.id === id);
  }

  function getTeamsByDepartment(departmentId: number): Team[] {
    return teams.filter((t) => t.departmentId === departmentId);
  }

  function getEmployeeById(id: number): User | undefined {
    return employees.find((e) => e.id === id);
  }

  function reset() {
    departments = [];
    teams = [];
    areas = [];
    employees = [];
  }

  return {
    get departments() {
      return departments;
    },
    get teams() {
      return teams;
    },
    get areas() {
      return areas;
    },
    get employees() {
      return employees;
    },
    setOrganizationData,
    getDepartmentById,
    getTeamById,
    getTeamsByDepartment,
    getEmployeeById,
    reset,
  };
}

export const dataState = createDataState();
