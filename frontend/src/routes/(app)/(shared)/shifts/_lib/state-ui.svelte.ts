// =============================================================================
// SHIFTS STATE - UI MODULE
// Loading, dragging, edit mode, planning UI flags
// =============================================================================

function createUiState() {
  // Start with true to prevent FOUC - initial render shows loading
  let isLoading = $state(true);
  let isDragging = $state(false);
  let isEditMode = $state(false);
  let isPlanLocked = $state(false);
  let showPlanningUI = $state(false);
  let currentWeek = $state<Date>(new Date());

  const reset = (): void => {
    isLoading = false;
    isDragging = false;
    isEditMode = false;
    isPlanLocked = false;
    showPlanningUI = false;
    currentWeek = new Date();
  };

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
    setIsLoading: (loading: boolean) => {
      isLoading = loading;
    },
    setIsDragging: (dragging: boolean) => {
      isDragging = dragging;
    },
    setIsEditMode: (editMode: boolean) => {
      isEditMode = editMode;
    },
    setIsPlanLocked: (locked: boolean) => {
      isPlanLocked = locked;
    },
    setShowPlanningUI: (show: boolean) => {
      showPlanningUI = show;
    },
    setCurrentWeek: (week: Date) => {
      currentWeek = week;
    },
    reset,
  };
}

export const uiState = createUiState();
