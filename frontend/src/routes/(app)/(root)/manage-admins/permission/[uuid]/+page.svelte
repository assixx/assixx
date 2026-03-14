<script lang="ts">
  /**
   * Permission Management - Admin Context
   * @module manage-admins/permission/[uuid]/+page
   *
   * Thin wrapper around shared PermissionSettings component.
   * Provides admin-specific context (back URL, breadcrumb label).
   */
  import PermissionSettings from '$lib/components/PermissionSettings.svelte';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
</script>

<PermissionSettings
  employee={data.employee}
  permissionData={data.permissions}
  error={data.error}
  backUrl="/manage-admins"
  backLabel="Adminverwaltung"
/>
