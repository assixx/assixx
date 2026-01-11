// =============================================================================
// MANAGE MACHINES - DATA STATE MODULE
// =============================================================================

import type { Machine, Department, Area, Team } from './types';

/**
 * Creates data-related state (machines, departments, areas, teams)
 */
export function createDataState() {
  let allMachines = $state<Machine[]>([]);
  let filteredMachines = $state<Machine[]>([]);
  let allDepartments = $state<Department[]>([]);
  let allAreas = $state<Area[]>([]);
  let allTeams = $state<Team[]>([]);

  return {
    get allMachines() {
      return allMachines;
    },
    get filteredMachines() {
      return filteredMachines;
    },
    get allDepartments() {
      return allDepartments;
    },
    get allAreas() {
      return allAreas;
    },
    get allTeams() {
      return allTeams;
    },
    setMachines: (v: Machine[]) => {
      allMachines = v;
    },
    setFilteredMachines: (v: Machine[]) => {
      filteredMachines = v;
    },
    setDepartments: (v: Department[]) => {
      allDepartments = v;
    },
    setAreas: (v: Area[]) => {
      allAreas = v;
    },
    setTeams: (v: Team[]) => {
      allTeams = v;
    },
  };
}

export type DataState = ReturnType<typeof createDataState>;
