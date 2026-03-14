<script lang="ts">
  /**
   * Permission Management - Employee Context
   * @module manage-employees/permission/[uuid]/+page
   *
   * Thin wrapper around shared PermissionSettings component.
   * Provides employee-specific context (back URL, breadcrumb label).
   */
  import PermissionSettings from '$lib/components/PermissionSettings.svelte';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
</script>

<PermissionSettings
  employee={data.employee}
  permissionData={data.permissions}
  error={data.error}
  backUrl="/manage-employees"
  backLabel="Mitarbeiterverwaltung"
/>
