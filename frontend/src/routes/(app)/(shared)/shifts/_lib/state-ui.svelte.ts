// =============================================================================
// SHIFTS STATE - UI MODULE
// Loading, dragging, edit mode, planning UI flags
// =============================================================================

let isLoading = $state(true); // true to prevent FOUC
let isDragging = $state(false);
let isEditMode = $state(false);
let isPlanLocked = $state(false);
let showPlanningUI = $state(false);
let currentWeek = $state(new Date());

/** Reset all UI flags to their default values */
function resetUiDefaults(): void {
  isLoading = false;
  isDragging = false;
  isEditMode = false;
  isPlanLocked = false;
  showPlanningUI = false;
  currentWeek = new Date();
}

function createUiState() {
  return {
    get isLoading() {
      return isLoading;
    },
    get isDragging() {
      return isDragging;
    },
    get isEditMode() {
      return isEditMode;
    },
    get isPlanLocked() {
      return isPlanLocked;
    },
    get showPlanningUI() {
      return showPlanningUI;
    },
    get currentWeek() {
      return currentWeek;
    },
    setIsLoading: (v: boolean) => {
      isLoading = v;
    },
    setIsDragging: (v: boolean) => {
      isDragging = v;
    },
    setIsEditMode: (v: boolean) => {
      isEditMode = v;
    },
    setIsPlanLocked: (v: boolean) => {
      isPlanLocked = v;
    },
    setShowPlanningUI: (v: boolean) => {
      showPlanningUI = v;
    },
    setCurrentWeek: (v: Date) => {
      currentWeek = v;
    },
    reset: resetUiDefaults,
  };
}

export const uiState = createUiState();
