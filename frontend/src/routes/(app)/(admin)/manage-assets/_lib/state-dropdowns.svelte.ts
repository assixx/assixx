// =============================================================================
// MANAGE MACHINES - DROPDOWN STATE MODULE
// =============================================================================

/**
 * Creates dropdown-related state (all dropdown open/close states)
 */
export function createDropdownState() {
  let departmentDropdownOpen = $state(false);
  let areaDropdownOpen = $state(false);
  let typeDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);
  let teamsDropdownOpen = $state(false);

  const closeAllDropdowns = (): void => {
    departmentDropdownOpen = false;
    areaDropdownOpen = false;
    typeDropdownOpen = false;
    statusDropdownOpen = false;
    teamsDropdownOpen = false;
  };

  return {
    get departmentDropdownOpen() {
      return departmentDropdownOpen;
    },
    get areaDropdownOpen() {
      return areaDropdownOpen;
    },
    get typeDropdownOpen() {
      return typeDropdownOpen;
    },
    get statusDropdownOpen() {
      return statusDropdownOpen;
    },
    get teamsDropdownOpen() {
      return teamsDropdownOpen;
    },
    setDepartmentDropdownOpen: (v: boolean) => {
      departmentDropdownOpen = v;
    },
    setAreaDropdownOpen: (v: boolean) => {
      areaDropdownOpen = v;
    },
    setTypeDropdownOpen: (v: boolean) => {
      typeDropdownOpen = v;
    },
    setStatusDropdownOpen: (v: boolean) => {
      statusDropdownOpen = v;
    },
    setTeamsDropdownOpen: (v: boolean) => {
      teamsDropdownOpen = v;
    },
    closeAllDropdowns,
  };
}

export type DropdownState = ReturnType<typeof createDropdownState>;
