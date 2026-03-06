// =============================================================================
// SHIFTS STATE - DATA MODULE (Composed)
// Combines hierarchy and employee state modules
// =============================================================================

import { createEmployeeState } from './state-employee.svelte';
import { createHierarchyState } from './state-hierarchy.svelte';

function createDataState() {
  const hierarchy = createHierarchyState();
  const employee = createEmployeeState();

  return {
    // Hierarchy state
    get areas() {
      return hierarchy.areas;
    },
    get departments() {
      return hierarchy.departments;
    },
    get assets() {
      return hierarchy.assets;
    },
    get teams() {
      return hierarchy.teams;
    },
    get teamLeaders() {
      return hierarchy.teamLeaders;
    },
    setAreas: hierarchy.setAreas,
    setDepartments: hierarchy.setDepartments,
    setAssets: hierarchy.setAssets,
    setTeams: hierarchy.setTeams,
    setTeamLeaders: hierarchy.setTeamLeaders,
    getAreaById: hierarchy.getAreaById,
    getDepartmentById: hierarchy.getDepartmentById,
    getAssetById: hierarchy.getAssetById,
    getTeamById: hierarchy.getTeamById,

    // Employee state
    get employees() {
      return employee.employees;
    },
    get teamMembers() {
      return employee.teamMembers;
    },
    get selectedEmployee() {
      return employee.selectedEmployee;
    },
    get employeeTeamInfo() {
      return employee.employeeTeamInfo;
    },
    get favorites() {
      return employee.favorites;
    },
    setEmployees: employee.setEmployees,
    setTeamMembers: employee.setTeamMembers,
    setSelectedEmployee: employee.setSelectedEmployee,
    setEmployeeTeamInfo: employee.setEmployeeTeamInfo,
    setFavorites: employee.setFavorites,
    getEmployeeById: employee.getEmployeeById,
    getMemberNameById: employee.getMemberNameById,

    // Combined reset
    reset: () => {
      hierarchy.reset();
      employee.reset();
    },
  };
}

export const dataState = createDataState();
