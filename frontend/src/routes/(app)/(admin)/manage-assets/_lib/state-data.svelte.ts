// =============================================================================
// MANAGE MACHINES - DATA STATE MODULE
// =============================================================================

import type { Asset, Department, Area, Team } from './types';

/**
 * Creates data-related state (assets, departments, areas, teams)
 */
export function createDataState() {
  let allAssets = $state<Asset[]>([]);
  let filteredAssets = $state<Asset[]>([]);
  let allDepartments = $state<Department[]>([]);
  let allAreas = $state<Area[]>([]);
  let allTeams = $state<Team[]>([]);

  return {
    get allAssets() {
      return allAssets;
    },
    get filteredAssets() {
      return filteredAssets;
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
    setAssets: (v: Asset[]) => {
      allAssets = v;
    },
    setFilteredAssets: (v: Asset[]) => {
      filteredAssets = v;
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
