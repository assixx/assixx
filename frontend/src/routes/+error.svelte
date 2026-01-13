<!--
  Global Error Page (404, 500, etc.)

  Design System Components Used:
  - empty-state (with semantic variants)
  - badge
  - btn

  @see https://svelte.dev/docs/kit/errors
  @see frontend/src/design-system/primitives/empty-states/README.md
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  /**
   * Navigate back in browser history
   */
  function goBack(): void {
    history.back();
  }

  /**
   * Navigate to home/login
   */
  function goHome(): void {
    void goto('/login');
  }

  // Error info from page state
  const status = $derived(page.status);
  const message = $derived(page.error?.message ?? 'Ein Fehler ist aufgetreten');

  // Determine error type for styling
  const isNotFound = $derived(status === 404);
  const isServerError = $derived(status >= 500);

  // Variant class for empty-state
  const variantClass = $derived(
    isNotFound ? 'empty-state--warning' : isServerError ? 'empty-state--error' : 'empty-state--info',
  );

  // Icon based on error type
  const iconClass = $derived(
    isNotFound ? 'fa-search' : isServerError ? 'fa-server' : 'fa-exclamation-circle',
  );

  // Badge variant
  const badgeClass = $derived(
    isNotFound ? 'badge--warning' : isServerError ? 'badge--danger' : 'badge--info',
  );

  // German error titles
  const errorTitle = $derived(
    isNotFound
      ? 'Seite nicht gefunden'
      : isServerError
        ? 'Server-Fehler'
        : 'Ein Fehler ist aufgetreten',
  );

  // German descriptions
  const errorDescription = $derived(
    isNotFound
      ? 'Die angeforderte Seite existiert nicht oder wurde verschoben.'
      : isServerError
        ? 'Der Server konnte die Anfrage nicht verarbeiten. Bitte versuchen Sie es später erneut.'
        : message,
  );

  // Status text
  const statusText = $derived(
    isNotFound ? 'Not Found' : isServerError ? 'Server Error' : 'Error',
  );
</script>

<svelte:head>
  <title>{status} - {errorTitle} | Assixx</title>
</svelte:head>

<div class="error-page">
  <div class="empty-state {variantClass} empty-state--bordered" role="alert">
    <!-- Icon -->
    <div class="empty-state__icon">
      <i class="fas {iconClass}"></i>
    </div>

    <!-- Title -->
    <h1 class="empty-state__title">{errorTitle}</h1>

    <!-- Description -->
    <p class="empty-state__description">{errorDescription}</p>

    <!-- Error Code Badge -->
    <div class="error-badge">
      <span class="badge badge--lg badge--uppercase {badgeClass}">
        {status} {statusText}
      </span>
    </div>

    <!-- Actions -->
    <div class="empty-state__actions">
      <button type="button" class="btn btn-cancel" onclick={goBack}>
        <i class="fas fa-arrow-left"></i>
        Zurück
      </button>

      <button type="button" class="btn btn-primary" onclick={goHome}>
        <i class="fas fa-home"></i>
        Zur Startseite
      </button>
    </div>

    <!-- Screen reader -->
    <span class="empty-state__sr-only">
      Fehler {status}: {errorTitle}
    </span>
  </div>
</div>

<style>
  .error-page {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: var(--spacing-lg);
    background: var(--color-bg-primary);
  }

  .error-page .empty-state {
    max-width: 500px;
  }

  .error-badge {
    margin-bottom: var(--spacing-6);
  }
</style>
