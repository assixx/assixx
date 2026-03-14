<!--
  ScopeInfoBanner — Organizational Scope Info for Manage Pages

  Shows scoped admins which areas/departments they can see.
  Hidden for Root / has_full_access (they see everything).
  Uses hierarchy labels (ADR-034) for tenant-specific naming.

  @see docs/FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md Step 6.3
-->
<script lang="ts">
  import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
  import type { OrganizationalScope } from '$lib/types/organizational-scope';

  interface Props {
    scope: OrganizationalScope;
    labels: HierarchyLabels;
  }

  const { scope, labels }: Props = $props();

  const areaNames = $derived(scope.areaNames ?? []);
  const deptNames = $derived(scope.departmentNames ?? []);
  const hasNames = $derived(areaNames.length > 0 || deptNames.length > 0);
</script>

{#if scope.type === 'limited'}
  <div
    class="alert alert--info"
    role="status"
  >
    <div class="alert__icon">
      <i class="fas fa-filter"></i>
    </div>
    <div class="alert__content">
      {#if hasNames}
        <div class="alert__title">Eingeschränkte Ansicht</div>
        <div class="alert__message">
          {#if areaNames.length > 0}
            {labels.area}: <strong>{areaNames.join(', ')}</strong>
          {/if}
          {#if deptNames.length > 0}
            {#if areaNames.length > 0}
              ·
            {/if}
            {labels.department}: <strong>{deptNames.join(', ')}</strong>
          {/if}
        </div>
      {:else}
        <div class="alert__title">Eingeschränkte Ansicht</div>
        <div class="alert__message">
          Du siehst nur Einträge in deinem Zuständigkeitsbereich.
        </div>
      {/if}
    </div>
  </div>
{/if}
