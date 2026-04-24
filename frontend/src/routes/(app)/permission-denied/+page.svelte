<!--
  Permission Denied Page

  Design System Components Used:
  - empty-state (with --error, --bordered, --full-height variants)
  - badge (with --lg, --uppercase variants)
  - btn (btn-cancel, btn-primary)

  @see frontend/src/design-system/primitives/empty-states/README.md
  @see frontend/src/design-system/primitives/badges/README.md
  @see frontend/src/design-system/primitives/buttons/README.md
-->
<script lang="ts">
  import { goto } from '$app/navigation';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  /**
   * Navigate to role-appropriate dashboard
   */
  function goHome(): void {
    const role = data.userRole;
    if (role === 'root') {
      void goto('/root-dashboard');
    } else if (role === 'admin') {
      void goto('/admin-dashboard');
    } else {
      void goto('/employee-dashboard');
    }
  }
</script>

<svelte:head>
  <title>Zugriff verweigert | Assixx</title>
</svelte:head>

<!--
  Using Design System: empty-state component
  Variants: --error (red icon), --bordered (glass card), --full-height (centers vertically)
-->
<div
  class="empty-state empty-state--error empty-state--bordered empty-state--full-height"
  role="alert"
>
  <!-- Icon Container - Design System handles styling -->
  <div class="empty-state__icon">
    <i class="fas fa-ban"></i>
  </div>

  <!-- Title -->
  <h1 class="empty-state__title">Zugriff verweigert</h1>

  <!-- Description -->
  <p class="empty-state__description">
    Sie haben keine Berechtigung, diese Seite aufzurufen. Bitte wenden Sie sich an Ihren
    Administrator, wenn Sie glauben, dass dies ein Fehler ist.
  </p>

  <!-- Error Code Badge - Design System badge component -->
  <div class="error-code-badge">
    <span class="badge badge--danger badge--lg badge--uppercase"> 403 Forbidden </span>
  </div>

  <!-- Actions - Design System button components -->
  <div class="empty-state__actions">
    <button
      type="button"
      class="btn btn-primary"
      onclick={goHome}
    >
      <i class="fas fa-home"></i>
      Zur Startseite
    </button>
  </div>

  <!-- Screen reader announcement -->
  <span class="empty-state__sr-only"> Fehler 403: Zugriff auf diese Seite wurde verweigert. </span>
</div>

<style>
  /*
   * Page-specific styles only.
   * All component styles come from Design System.
   */

  /* Badge positioning within empty-state */
  .error-code-badge {
    margin-bottom: var(--spacing-6);
  }

  /* Override empty-state max-width for this page */
  :global(.empty-state--full-height) {
    max-width: 500px;
    margin: 0 auto;
  }
</style>
