// =============================================================================
// SHIFTS STATE - HIERARCHY MODULE
// Areas, departments, machines, teams, team leaders
// =============================================================================

import type { Area, Department, Machine, Team, TeamLeader } from './types';

export function createHierarchyState() {
  let areas = $state<Area[]>([]);
  let departments = $state<Department[]>([]);
  let machines = $state<Machine[]>([]);
  let teams = $state<Team[]>([]);
  let teamLeaders = $state<TeamLeader[]>([]);

  return {
    get areas() {
      return areas;
    },
    get departments() {
      return departments;
    },
    get machines() {
      return machines;
    },
    get teams() {
      return teams;
    },
    get teamLeaders() {
      return teamLeaders;
    },
    setAreas: (data: Area[]) => {
      areas = data;
    },
    setDepartments: (data: Department[]) => {
      departments = data;
    },
    setMachines: (data: Machine[]) => {
      machines = data;
    },
    setTeams: (data: Team[]) => {
      teams = data;
    },
    setTeamLeaders: (data: TeamLeader[]) => {
      teamLeaders = data;
    },
    getAreaById: (id: number) => areas.find((a) => a.id === id),
    getDepartmentById: (id: number) => departments.find((d) => d.id === id),
    getMachineById: (id: number) => machines.find((m) => m.id === id),
    getTeamById: (id: number) => teams.find((t) => t.id === id),
    reset: () => {
      areas = [];
      departments = [];
      machines = [];
      teams = [];
      teamLeaders = [];
    },
  };
}

export type HierarchyState = ReturnType<typeof createHierarchyState>;
