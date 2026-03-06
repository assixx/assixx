// =============================================================================
// SHIFTS STATE - HIERARCHY MODULE
// Areas, departments, assets, teams, team leaders
// =============================================================================

import type { Area, Department, Asset, Team, TeamLeader } from './types';

export function createHierarchyState() {
  let areas = $state<Area[]>([]);
  let departments = $state<Department[]>([]);
  let assets = $state<Asset[]>([]);
  let teams = $state<Team[]>([]);
  let teamLeaders = $state<TeamLeader[]>([]);

  return {
    get areas() {
      return areas;
    },
    get departments() {
      return departments;
    },
    get assets() {
      return assets;
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
    setAssets: (data: Asset[]) => {
      assets = data;
    },
    setTeams: (data: Team[]) => {
      teams = data;
    },
    setTeamLeaders: (data: TeamLeader[]) => {
      teamLeaders = data;
    },
    getAreaById: (id: number) => areas.find((a) => a.id === id),
    getDepartmentById: (id: number) => departments.find((d) => d.id === id),
    getAssetById: (id: number) => assets.find((m) => m.id === id),
    getTeamById: (id: number) => teams.find((t) => t.id === id),
    reset: () => {
      areas = [];
      departments = [];
      assets = [];
      teams = [];
      teamLeaders = [];
    },
  };
}

export type HierarchyState = ReturnType<typeof createHierarchyState>;
