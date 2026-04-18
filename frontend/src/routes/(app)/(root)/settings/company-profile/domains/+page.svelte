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
    getDomains,
    getInstructionsPanel,
    getPendingActionId,
    hideInstructions,
    openAddModal,
    removeDomain,
    setAddModalSubmitting,
    setDomains,
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

  // --- Hydrate state from SSR data ---
  //
  // `data.domains` changes when SvelteKit re-runs the load function (e.g.
  // after `invalidateAll()`). Mirror it into the reactive `state-data` store
  // so child components and derived getters see the latest list.
  $effect(() => {
    setDomains(data.domains);
  });

  // --- Reactive views into the facade ---

  const domains = $derived(getDomains());
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
    } catch (err: unknown) {
      showErrorAlert(getApiErrorMessage(err, 'Primär-Domain konnte nicht gesetzt werden.'));
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleRemove(id: string): Promise<void> {
    setPendingActionId(id);
    try {
      const target = domains.find((d) => d.id === id);
      const wasOnlyVerified =
        target?.status === 'verified' &&
        domains.filter((d) => d.status === 'verified').length === 1;

      await removeDomain(id);
      showSuccessAlert('Domain entfernt.');

      // If the removed row was the ONLY verified domain, the tenant just
      // re-locked (graceful-degradation contract per Phase 4 D27). Re-fetch
      // the layout so the §5.3 banner reappears + user-create buttons disable.
      if (wasOnlyVerified) {
        await invalidateAll();
      }
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

<div class="container mx-auto max-w-5xl p-6">
  <header class="mb-6">
    <h1 class="text-2xl font-semibold">Firmen-Domains</h1>
    <p class="mt-2">
      Verifiziere die Domain Deines Unternehmens, um neue Benutzer anlegen zu können. Die
      Verifizierung erfolgt über einen TXT-Eintrag in Deiner DNS-Zone.
    </p>
  </header>

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
    <div class="card__header flex items-center justify-between">
      <h2 class="card__title">Verwaltete Domains</h2>
      <button
        type="button"
        class="btn btn-primary"
        onclick={openAddModal}
        data-testid="add-domain-btn"
      >
        <i
          class="fas fa-plus mr-2"
          aria-hidden="true"
        ></i>
        Domain hinzufügen
      </button>
    </div>
    <div class="card__body">
      {#if domains.length === 0}
        <p class="py-8 text-center text-(--color-text-secondary)">
          Noch keine Domains hinzugefügt.
        </p>
      {:else}
        <table class="table w-full">
          <thead>
            <tr>
              <th class="text-left">Domain</th>
              <th class="text-left">Status</th>
              <th class="text-center">Primär</th>
              <th class="text-left">Hinzugefügt</th>
              <th class="text-right">Aktionen</th>
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

<AddDomainModal
  show={showAddModal}
  onsubmit={handleAddDomain}
/>
