<script lang="ts">
  /**
   * Permission Management - Root User Context
   * @module manage-root/permission/[uuid]/+page
   *
   * Thin wrapper around shared PermissionSettings component.
   * Provides root-user-specific context (back URL, breadcrumb label).
   */
  import PermissionSettings from '$lib/components/PermissionSettings.svelte';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
</script>

<PermissionSettings
  employee={data.employee}
  permissionData={data.permissions}
  error={data.error}
  backUrl="/manage-root"
  backLabel="Root User Verwaltung"
/>
