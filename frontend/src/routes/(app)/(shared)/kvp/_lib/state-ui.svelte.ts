// =============================================================================
// KVP - UI STATE (Svelte 5 Runes)
// =============================================================================

const MAX_PHOTOS: number = 5;

/**
 * UI state: modal, loading, photos
 */
function createUiState() {
  let showCreateModal = $state(false);
  let selectedPhotos = $state<File[]>([]);
  // Start true to prevent FOUC (triple-render)
  let isLoading = $state(true);
  let isSubmitting = $state(false);

  function openCreateModal(): void {
    selectedPhotos = [];
    showCreateModal = true;
  }

  function closeCreateModal(): void {
    showCreateModal = false;
    selectedPhotos = [];
  }

  function addPhoto(file: File): void {
    if (selectedPhotos.length < MAX_PHOTOS) {
      selectedPhotos = [...selectedPhotos, file];
    }
  }

  function removePhoto(index: number): void {
    selectedPhotos = selectedPhotos.filter((_, i) => i !== index);
  }

  function clearPhotos(): void {
    selectedPhotos = [];
  }

  function setLoading(val: boolean): void {
    isLoading = val;
  }

  function setSubmitting(val: boolean): void {
    isSubmitting = val;
  }

  function reset(): void {
    showCreateModal = false;
    selectedPhotos = [];
    isLoading = false;
    isSubmitting = false;
  }

  return {
    get showCreateModal() {
      return showCreateModal;
    },
    get selectedPhotos() {
      return selectedPhotos;
    },
    get isLoading() {
      return isLoading;
    },
    get isSubmitting() {
      return isSubmitting;
    },
    openCreateModal,
    closeCreateModal,
    addPhoto,
    removePhoto,
    clearPhotos,
    setLoading,
    setSubmitting,
    reset,
  };
}

export const uiState = createUiState();
