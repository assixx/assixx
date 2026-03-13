<!--
  Shared "Keine Berechtigung" banner for addon-gated pages.
  Shows when user lacks user-level addon permission (403 from PermissionGuard).
-->
<script lang="ts">
  const { addonName = 'dieses Modul' }: { addonName?: string } = $props();
</script>

<div class="container">
  <div class="card">
    <div class="card-body">
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-lock"></i>
        </div>
        <h3 class="empty-state__title">Keine Berechtigung</h3>
        <p class="empty-state__description">
          Sie haben keine Berechtigung für {addonName}. Bitte wenden Sie sich an
          Ihren Administrator.
        </p>
      </div>
    </div>
  </div>
</div>
