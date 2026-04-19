<!--
  /settings/company-profile/domains
  Tenant Domain Verification — Root-only management page.

  Shows the tenant's domains in a table, lets the root add new ones, trigger
  DNS-TXT verification, mark a primary, or remove a domain. The page is the
  ONLY place that translates `state-data` mutations into toasts + the
  `invalidateAll()` call required by masterplan §5.1 / v0.3.0 S4 — without
  that invalidation, the unverified-banner (§5.3) and the user-create-button
  unlock would stay stale until the user manually navigates.

  RBAC enforced by the `(root)` route group layout (ADR-012). All endpoints
  hit by this page are also `@Roles('root')` server-side, so a non-root
  bypassing the layout would still see 403s.

  @see masterplan §5.1
-->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { getApiErrorMessage } from '$lib/utils/api-client.types';

  import AddDomainModal from './_lib/AddDomainModal.svelte';
  import DomainRow from './_lib/DomainRow.svelte';
  import {
    addDomain,
    closeAddModal,
    getAddModalOpen,
    getInstructionsPanel,
    getPendingActionId,
    hideInstructions,
    openAddModal,
    removeDomain,
    setAddModalSubmitting,
    setPendingActionId,
    setPrimary,
    showInstructions,
    verifyDomain,
  } from './_lib/state.svelte.js';
  import VerifyInstructionsPanel from './_lib/VerifyInstructionsPanel.svelte';

  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  const { data }: Props = $props();

  // --- Reactive views from SSR data ---
  //
  // Read `domains` directly from `data` (server-load result). The previous
  // `$effect(() => setDomains(data.domains))` pattern was an SSR-vs-client
  // mismatch: the module-level `$state([])` in `state-data.svelte.ts` ran
  // BEFORE `$effect`, so the SSR HTML always rendered with `domains.length
  // === 0` → empty-state visible until client-side hydration replaced it.
  // That window made the §5.4.3 page-mount smoke flake by catching the
  // empty-state's "Domain hinzufügen" button alongside the FAB (strict-mode
  // duplicate-name violation). Reading `data.domains` directly closes the
  // gap — SSR HTML now renders the table on first paint.
  //
  // Mutation handlers below call `await invalidateAll()` after success so
  // SvelteKit re-runs `+page.server.ts → GET /api/v2/domains` and `data`
  // reflects the latest server state without a manual reload. This extends
  // the verify-success pattern from ADR-049 §5.1 / masterplan v0.3.0 S4 to
  // every mutation (add / setPrimary / remove). State-data's local mutation
  // bookkeeping still runs (its §5.4.1 unit tests remain valid in isolation),
  // but the page no longer reads from it — single source of truth: server.
  const domains = $derived(data.domains);
  const showAddModal = $derived(getAddModalOpen());
  const pendingActionId = $derived(getPendingActionId());
  const instructionsPanel = $derived(getInstructionsPanel());

  // --- Handlers ---

  async function handleAddDomain(domain: string): Promise<void> {
    setAddModalSubmitting(true);
    try {
      const created = await addDomain(domain);
      // §0.2.5 #10: verificationInstructions are emitted ONLY on this response
      // — capture them now or they're gone. Surface immediately.
      if (created.verificationInstructions !== undefined) {
        showInstructions(created.id, created.domain, created.verificationInstructions);
      }
      closeAddModal();
      showSuccessAlert(`Domain ${created.domain} hinzugefügt.`);
      // Refresh `data.domains` so the new pending row appears in the table
      // immediately. The page reads from `data.domains` directly (see hydration
      // comment above), so without this the new row would only appear on the
      // next manual navigation. Mirrors the verify-success pattern from
      // masterplan v0.3.0 S4 / ADR-049 §5.1.
      await invalidateAll();
    } catch (err: unknown) {
      // ApiError surfaces backend codes — the German messages live server-side
      // (validateBusinessDomain throws ConflictException with German messages
      // per §2.5). `getApiErrorMessage` extracts the message safely.
      showErrorAlert(getApiErrorMessage(err, 'Domain konnte nicht hinzugefügt werden.'));
    } finally {
      setAddModalSubmitting(false);
    }
  }

  async function handleVerify(id: string): Promise<void> {
    setPendingActionId(id);
    try {
      const updated = await verifyDomain(id);
      if (updated.status === 'verified') {
        showSuccessAlert(
          `Domain ${updated.domain} verifiziert. Dein Tenant ist jetzt vollständig aktiviert.`,
        );
        // v0.3.0 S4: re-fetch the layout's `verificationStatus` so the §5.3
        // banner disappears + user-creation buttons unlock in the SAME tab
        // without a manual reload. This is the single most important call
        // in the whole frontend for the verify-success UX contract.
        await invalidateAll();
      } else {
        // DNS lookup either NXDOMAIN'd, timed out, or returned a non-matching
        // TXT value. Backend logs the details; UI shows a generic-but-honest
        // message and points the user at the instructions panel.
        showErrorAlert(
          'Verifizierung fehlgeschlagen. Prüfe den TXT-Eintrag (DNS-Propagation kann ein paar Minuten dauern) und versuche es erneut.',
        );
      }
    } catch (err: unknown) {
      showErrorAlert(getApiErrorMessage(err, 'Verifizierung konnte nicht durchgeführt werden.'));
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleSetPrimary(id: string): Promise<void> {
    setPendingActionId(id);
    try {
      await setPrimary(id);
      showSuccessAlert('Primär-Domain aktualisiert.');
      // Refresh `data.domains` so the star indicator on the new primary
      // (and the cleared star on the old one) reflects in the table.
      // Without this, the page reads stale isPrimary flags from the SSR
      // snapshot until the user navigates manually.
      await invalidateAll();
    } catch (err: unknown) {
      showErrorAlert(getApiErrorMessage(err, 'Primär-Domain konnte nicht gesetzt werden.'));
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleRemove(id: string): Promise<void> {
    setPendingActionId(id);
    try {
      await removeDomain(id);
      showSuccessAlert('Domain entfernt.');
      // Always re-fetch: the table reads from `data.domains`, so without
      // invalidate the removed row would linger in the UI. This also covers
      // the graceful-degradation case (Phase 4 D27): if the removed row was
      // the only verified one, `(app)/+layout.server.ts` re-runs and flips
      // `data.tenantVerified` back to `false`, re-rendering the
      // UnverifiedDomainBanner + re-locking the user-creation buttons in
      // the same tab.
      await invalidateAll();
    } catch (err: unknown) {
      showErrorAlert(getApiErrorMessage(err, 'Domain konnte nicht entfernt werden.'));
    } finally {
      setPendingActionId(null);
    }
  }
</script>

<svelte:head>
  <title>Domains verwalten · Assixx</title>
</svelte:head>

<!--
  Layout matches manage-admins design-system pattern (Phase-5 polish, 2026-04-19):
  `container` + card-header (title + description + inline action) + `data-table`
  with hover/striped/table-responsive. `empty-state` component replaces the
  plaintext placeholder. Floating-action-button mirrors manage-admins FAB so
  "Domain hinzufügen" is reachable from any scroll position. Add-button is
  NOT disabled on tenantVerified=false — this page IS the unlock path.
-->
<div class="container">
  {#if data.loadError}
    <div class="card mb-4">
      <div class="card__body">
        <p class="text-(--color-danger)">
          Domains konnten nicht geladen werden. Bitte lade die Seite neu oder kontaktiere den
          Support.
        </p>
      </div>
    </div>
  {/if}

  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-globe mr-2"></i>
        Firmen-Domains
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Verifiziere die Domain Deines Unternehmens, um neue Benutzer anlegen zu können. Die
        Verifizierung erfolgt über einen TXT-Eintrag in Deiner DNS-Zone.
      </p>
    </div>

    <div class="card__body">
      {#if domains.length === 0}
        <div
          id="domains-empty"
          class="empty-state"
        >
          <div class="empty-state__icon">
            <i class="fas fa-globe"></i>
          </div>
          <h3 class="empty-state__title">Noch keine Domains</h3>
          <p class="empty-state__description">
            Füge Deine Firmen-Domain hinzu, um die Verifizierung per DNS-TXT-Eintrag zu starten.
          </p>
          <button
            type="button"
            class="btn btn-primary"
            onclick={openAddModal}
            data-testid="add-domain-btn-empty"
          >
            <i class="fas fa-plus"></i>
            Domain hinzufügen
          </button>
        </div>
      {:else}
        <div id="domains-table-content">
          <div class="table-responsive">
            <table
              class="data-table data-table--hover data-table--striped"
              id="domains-table"
            >
              <thead>
                <tr>
                  <th scope="col">Domain</th>
                  <th scope="col">Status</th>
                  <th scope="col">Primär</th>
                  <th scope="col">Hinzugefügt</th>
                  <th scope="col">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {#each domains as domain (domain.id)}
                  <DomainRow
                    {domain}
                    isPending={pendingActionId === domain.id}
                    onverify={handleVerify}
                    onprimary={handleSetPrimary}
                    onremove={handleRemove}
                  />
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#if instructionsPanel !== null}
    <VerifyInstructionsPanel
      domain={instructionsPanel.domain}
      instructions={instructionsPanel.instructions}
      onclose={hideInstructions}
    />
  {/if}
</div>

<!-- Floating Action Button — mirrors manage-admins pattern -->
<button
  type="button"
  class="btn-float"
  onclick={openAddModal}
  title="Domain hinzufügen"
  aria-label="Domain hinzufügen"
  data-testid="add-domain-btn"
>
  <i class="fas fa-plus"></i>
</button>

<AddDomainModal
  show={showAddModal}
  onsubmit={handleAddDomain}
/>
