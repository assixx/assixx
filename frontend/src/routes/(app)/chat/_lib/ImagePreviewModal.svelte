<script lang="ts">
  interface PreviewImage {
    src: string;
    alt: string;
  }

  interface Props {
    show: boolean;
    image: PreviewImage | null;
    onclose: () => void;
  }

  const { show, image, onclose }: Props = $props();

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      onclose();
    }
  }

  function handleDownload(): void {
    if (image === null) return;

    const link = document.createElement('a');
    link.href = image.src;
    link.download = image.alt;
    link.click();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show && image !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay modal-overlay--active" onclick={handleOverlayClick}>
    <div
      class="ds-modal ds-modal--xl"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-image mr-2"></i>
          {image.alt}
        </h3>
        <button type="button" class="ds-modal__close" aria-label="Schliessen" onclick={onclose}>
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body p-0">
        <div class="h-[70vh] min-h-[600px] w-full flex items-center justify-center bg-surface-1">
          <img src={image.src} class="max-w-full max-h-full object-contain" alt={image.alt} />
        </div>
      </div>
      <div class="ds-modal__footer">
        <button type="button" class="btn btn-cancel" onclick={onclose}>
          <i class="fas fa-times mr-2"></i>
          Schliessen
        </button>
        <button type="button" class="btn btn-modal" onclick={handleDownload}>
          <i class="fas fa-download mr-2"></i>
          Herunterladen
        </button>
      </div>
    </div>
  </div>
{/if}
