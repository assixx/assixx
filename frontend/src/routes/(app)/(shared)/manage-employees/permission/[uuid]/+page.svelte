<script lang="ts">
  /**
   * Permission Management - Employee Context
   * @module manage-employees/permission/[uuid]/+page
   *
   * Thin wrapper around shared PermissionSettings component.
   * Provides employee-specific context (back URL, breadcrumb label).
   * Shows PermissionDenied lock screen for leads without manage-permissions.
   */
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import PermissionSettings from '$lib/components/PermissionSettings.svelte';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
</script>

{#if data.permissionDenied}
  <PermissionDenied addonName="die Berechtigungsverwaltung" />
{:else}
  <PermissionSettings
    employee={data.employee}
    permissionData={data.permissions}
    error={data.error}
    backUrl="/manage-employees"
    backLabel="Mitarbeiterverwaltung"
    history={data.history}
    historyTotal={data.historyTotal}
    historyHasMore={data.historyHasMore}
  />
{/if}
