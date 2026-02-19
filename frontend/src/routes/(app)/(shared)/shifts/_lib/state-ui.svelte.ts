// =============================================================================
// SHIFTS STATE - UI MODULE
// Loading, dragging, edit mode, planning UI flags
// =============================================================================

function createUiState() {
  let isLoading = $state(true); // true to prevent FOUC
  let isDragging = $state(false);
  let isEditMode = $state(false);
  let isPlanLocked = $state(false);
  let showPlanningUI = $state(false);
  let showTpmEvents = $state(false);
  let currentWeek = $state<Date>(new Date());

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
    get showTpmEvents() {
      return showTpmEvents;
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
    setShowTpmEvents: (v: boolean) => {
      showTpmEvents = v;
    },
    setCurrentWeek: (v: Date) => {
      currentWeek = v;
    },
    reset: (): void => {
      isLoading = false;
      isDragging = false;
      isEditMode = false;
      isPlanLocked = false;
      showPlanningUI = false;
      showTpmEvents = false;
      currentWeek = new Date();
    },
  };
}

export const uiState = createUiState();
