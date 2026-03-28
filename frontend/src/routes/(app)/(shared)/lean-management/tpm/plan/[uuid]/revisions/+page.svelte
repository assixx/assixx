<script lang="ts">
  /**
   * TPM Plan Revision History — Page Component
   *
   * Displays all revisions for a plan. Newest first, expandable diffs.
   * ISO 9001 Chapter 7.5.3 compliance: every plan change is traceable.
   * Layout: matches TPM standard (container > card > card__header pattern).
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';

  import RevisionList from './_lib/RevisionList.svelte';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const permissionDenied = $derived(data.permissionDenied);
  const plan = $derived(data.plan);
  const revisions = $derived(data.revisions);
  const error = $derived(data.error);

  function goBack(): void {
    const planUuid = plan?.uuid ?? '';
    void goto(resolve(`/lean-management/tpm/plan/${planUuid}`));
  }
</script>

{#if permissionDenied}
  <PermissionDenied addonName="das TPM-System" />
{:else if error !== null}
  <div class="container">
    <div class="card">
      <div
        class="card__body"
        style="text-align: center; padding: 2rem; color: var(--color-error);"
      >
        <i class="fas fa-exclamation-triangle mr-2"></i>
        {error}
      </div>
    </div>
  </div>
{:else if plan !== null && revisions !== null}
  <div class="container">
    <!-- Back Button -->
    <div class="mb-4">
      <button
        type="button"
        class="btn btn-light"
        onclick={goBack}
      >
        <i class="fas fa-arrow-left mr-2"></i>Zurück zum Plan
      </button>
    </div>

    <div class="card">
      <div class="card__header">
        <div>
          <h2 class="card__title">
            <i class="fas fa-history mr-2"></i>
            Versionshistorie
          </h2>
          <p class="mt-1 text-(--color-text-secondary)">
            {plan.name} · {plan.assetName ?? '—'}
          </p>
        </div>
        <span class="badge badge--primary mt-2">
          Aktuelle Version: v{revisions.currentVersion}
        </span>
      </div>

      <div class="card__body">
        <RevisionList
          revisions={revisions.revisions}
          currentVersion={revisions.currentVersion}
        />
      </div>
    </div>
  </div>
{/if}
