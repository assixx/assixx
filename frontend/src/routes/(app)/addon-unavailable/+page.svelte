<!--
  Addon Unavailable Page

  Shown when a user navigates to an addon that is not activated for their tenant.
  Semantically different from /permission-denied (role/permission issue):
  - Permission → "Ask your administrator"
  - Addon → "Contact admin to activate / start 30-day trial"

  Design System Components Used:
  - empty-state (with --warning, --bordered, --full-height variants)
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

  /** Navigate back in browser history */
  function goBack(): void {
    history.back();
  }

  /** Navigate to role-appropriate dashboard */
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
  <title>Modul nicht verfügbar | Assixx</title>
</svelte:head>

<!--
  Using Design System: empty-state component
  Variants: --warning (amber icon), --bordered (glass card), --full-height (centers vertically)
-->
<div
  class="empty-state empty-state--warning empty-state--bordered empty-state--full-height"
  role="alert"
>
  <!-- Icon Container -->
  <div class="empty-state__icon">
    <i class="fas fa-puzzle-piece"></i>
  </div>

  <!-- Title -->
  <h1 class="empty-state__title">
    {#if data.addonCode}
      {data.addonCode.charAt(0).toUpperCase() +
        data.addonCode.slice(1).replaceAll('_', ' ')} — Modul nicht aktiviert
    {:else}
      Modul nicht verfügbar
    {/if}
  </h1>

  <!-- Description -->
  <p class="empty-state__description">
    Dieses Modul ist für Ihren Mandanten nicht aktiviert. Jedes Modul kann 30
    Tage kostenlos getestet werden — wenden Sie sich an Ihren Administrator, um
    die Testphase zu starten.
  </p>

  <!-- Error Code Badge -->
  <div class="error-code-badge">
    <span class="badge badge--warning badge--lg badge--uppercase">
      Modul nicht aktiviert
    </span>
  </div>

  <!-- Actions -->
  <div class="empty-state__actions">
    <button
      type="button"
      class="btn btn-cancel"
      onclick={goBack}
    >
      <i class="fas fa-arrow-left"></i>
      Zurück
    </button>

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
  <span class="empty-state__sr-only">
    Dieses Modul ist nicht für Ihren Mandanten aktiviert. Kontaktieren Sie Ihren
    Administrator für eine 30-tägige Testphase.
  </span>
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
