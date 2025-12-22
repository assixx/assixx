<script>
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';

  // Page-specific CSS
  import '../../../styles/account-settings.css';

  // Module imports
  import { loadDeletionStatus, getRootUserCount, deleteTenant, checkAuthRole } from './_lib/api';
  import { formatDate, getStatusLabel, showToast } from './_lib/utils';
  import {
    DELETE_CONFIRMATION_TEXT,
    MIN_REASON_LENGTH,
    MIN_ROOT_USERS,
    MESSAGES,
  } from './_lib/constants';

  /** @typedef {import('./_lib/types').DeletionStatusData} DeletionStatusData */

  // =============================================================================
  // SVELTE 5 RUNES - State
  // =============================================================================

  // Page State
  let loading = $state(true);
  /** @type {string | null} */
  const error = $state(null);

  // Pending Deletion State
  /** @type {DeletionStatusData | null} */
  let pendingDeletion = $state(/** @type {DeletionStatusData | null} */ (null));
  const hasPendingDeletion = $derived(pendingDeletion !== null);

  // Delete Modal State
  let showDeleteModal = $state(false);
  let deleteConfirmation = $state('');
  let deleteReason = $state('');
  let deleteLoading = $state(false);

  // =============================================================================
  // DERIVED STATE
  // =============================================================================

  const isDeleteConfirmationValid = $derived(deleteConfirmation === DELETE_CONFIRMATION_TEXT);
  const isReasonValid = $derived(deleteReason.length >= MIN_REASON_LENGTH);
  const canDelete = $derived(isDeleteConfirmationValid && isReasonValid);

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  $effect(() => {
    checkAuth();
  });

  // =============================================================================
  // AUTH CHECK
  // =============================================================================

  async function checkAuth() {
    try {
      const { isAuthenticated, role } = checkAuthRole();

      if (!isAuthenticated) {
        goto(`${base}/login`);
        return;
      }

      // Only root can access this page
      if (role !== 'root') {
        goto(`${base}/dashboard/${role}`);
        return;
      }

      pendingDeletion = await loadDeletionStatus();
    } catch (err) {
      console.error('[AccountSettings] Auth check failed:', err);
      goto(`${base}/login`);
    } finally {
      loading = false;
    }
  }

  // =============================================================================
  // HANDLERS
  // =============================================================================

  /**
   * Handle show delete modal button click
   * Checks for minimum 2 root users before showing modal
   */
  async function handleShowDeleteModal() {
    try {
      const rootUserCount = await getRootUserCount();
      console.info(`[AccountSettings] Found ${rootUserCount} root users in tenant`);

      if (rootUserCount < MIN_ROOT_USERS) {
        showToast(MESSAGES.notEnoughRootUsers(rootUserCount), 'error');
        return;
      }

      // Reset form and show modal
      deleteConfirmation = '';
      deleteReason = '';
      showDeleteModal = true;
    } catch (err) {
      console.error('[AccountSettings] Error checking root users:', err);
      // Show modal anyway if check fails
      deleteConfirmation = '';
      deleteReason = '';
      showDeleteModal = true;
    }
  }

  /**
   * Handle delete tenant confirmation
   */
  async function handleDeleteTenant() {
    if (!canDelete || deleteLoading) return;

    deleteLoading = true;

    try {
      await deleteTenant(deleteReason);
      showToast(MESSAGES.deletionRequested, 'success');

      // Close modal and reload deletion status to show banner
      showDeleteModal = false;
      pendingDeletion = await loadDeletionStatus();
    } catch (err) {
      console.error('[AccountSettings] Error deleting tenant:', err);
      const message = err instanceof Error ? err.message : MESSAGES.deletionError;
      showToast(message, 'error');
    } finally {
      deleteLoading = false;
    }
  }

  /**
   * Close delete modal
   */
  function closeDeleteModal() {
    showDeleteModal = false;
    deleteConfirmation = '';
    deleteReason = '';
  }

  /**
   * Handle keyboard events for modals
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (event.key === 'Escape' && showDeleteModal) {
      closeDeleteModal();
    }
  }

  /**
   * Handle backdrop click
   * @param {MouseEvent} event
   */
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && showDeleteModal) {
      closeDeleteModal();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="container">
  {#if loading}
    <!-- Loading State -->
    <div class="card">
      <div class="card__body">
        <div class="skeleton skeleton--text" style="width: 60%"></div>
        <div class="skeleton skeleton--text" style="width: 80%"></div>
        <div class="skeleton skeleton--text" style="width: 40%"></div>
      </div>
    </div>
  {:else if error}
    <!-- Error State -->
    <div class="alert alert--danger">
      <i class="fas fa-exclamation-triangle"></i>
      <span>{error}</span>
    </div>
  {:else}
    <div class="card card--danger-border">
      <!-- Card Header -->
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          Kontoeinstellungen
        </h2>
        <p class="text-[var(--color-text-secondary)] mt-2">
          Tenant-Verwaltung und Löschoptionen (Zwei-Personen-Prinzip)
        </p>
      </div>

      <div class="card__body">
        <!-- Pending Deletion Banner -->
        {#if hasPendingDeletion && pendingDeletion}
          <div class="alert alert--warning mb-6">
            <div class="alert__icon">
              <i class="fas fa-hourglass-half"></i>
            </div>
            <div class="alert__content flex-1">
              <p class="alert__title">Löschanfrage aktiv</p>
              <p class="alert__message">
                <strong>{getStatusLabel(pendingDeletion.status)}</strong> · Queue #{pendingDeletion.queueId}
                · Tenant #{pendingDeletion.tenantId} · Angefordert von {pendingDeletion.requestedByName ??
                  'Unbekannt'} am {formatDate(pendingDeletion.requestedAt)}
              </p>
              <a href="{base}/tenant-deletion-status" class="btn btn-warning mt-4">
                <i class="fas fa-external-link-alt mr-2"></i>
                Details anzeigen
              </a>
            </div>
          </div>
        {/if}

        <!-- Danger Zone Warning Alert -->
        <div class="alert alert--danger mb-6">
          <div class="alert__icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="alert__content">
            <p class="alert__title">Achtung: Diese Aktion kann nicht rückgängig gemacht werden!</p>
            <p class="alert__message">
              Durch das Löschen Ihres Tenants werden <strong>ALLE</strong> Daten unwiderruflich gelöscht:
            </p>
            <ul class="pl-5 mt-4 space-y-1 text-sm">
              <li>Alle Administratoren und Mitarbeiter</li>
              <li>Alle Dokumente und Dateien</li>
              <li>Alle Nachrichten und Chats</li>
              <li>Alle Einstellungen und Konfigurationen</li>
              <li>Die gesamte Firmenstruktur</li>
            </ul>
          </div>
        </div>

        <!-- Action Button -->
        {#if !hasPendingDeletion}
          <div class="flex gap-3">
            <button class="btn btn-danger" onclick={handleShowDeleteModal}>
              <i class="fas fa-trash-alt"></i>
              Tenant komplett löschen
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay modal-overlay--active"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div class="ds-modal ds-modal--md">
      <div class="ds-modal__header ds-modal__header--danger">
        <h2 class="ds-modal__title">
          <i class="fas fa-exclamation-triangle mr-3"></i>
          Tenant unwiderruflich löschen
        </h2>
        <button class="ds-modal__close" onclick={closeDeleteModal} aria-label="Schließen">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <!-- Final Warning Box -->
        <div class="alert alert--danger mb-6">
          <div class="alert__icon">
            <i class="fas fa-skull-crossbones"></i>
          </div>
          <div class="alert__content">
            <p class="alert__title">LETZTE WARNUNG!</p>
            <p class="alert__message">
              Sie sind dabei, Ihren gesamten Tenant zu löschen. Diese Aktion:
            </p>
            <ul class="pl-5 mt-2 space-y-1 text-sm">
              <li>Löscht ALLE Benutzer (Admins und Mitarbeiter)</li>
              <li>Löscht ALLE Daten und Dokumente</li>
              <li>Löscht ALLE Einstellungen</li>
              <li>Kann NICHT rückgängig gemacht werden</li>
            </ul>
          </div>
        </div>

        <!-- Two-Person-Principle Info Box -->
        <div class="info-box mb-6">
          <div class="flex items-start gap-3">
            <i class="fas fa-shield-alt text-blue-500 mt-1"></i>
            <div>
              <p class="font-semibold mb-2">Zwei-Personen-Prinzip (4-Augen-Prinzip)</p>
              <p class="mb-2">
                Die Löschung wird <strong>nicht sofort</strong> durchgeführt, sondern muss zuerst
                von einem zweiten Root-Benutzer genehmigt werden. Nach der Genehmigung beginnt eine
                <strong>30-tägige Nachfrist</strong>, in der die Löschung noch widerrufen werden
                kann.
              </p>
              <p class="text-sm">
                <i class="fas fa-info-circle mr-1"></i>
                Die tatsächliche Löschung erfolgt erst 30 Tage nach der Genehmigung durch den zweiten
                Root-Benutzer.
              </p>
            </div>
          </div>
        </div>

        <!-- Confirmation Input -->
        <div class="form-field mb-6">
          <label class="form-field__label" for="deleteConfirmation">
            Geben Sie zur Bestätigung <strong class="text-red-500"
              >{DELETE_CONFIRMATION_TEXT}</strong
            > ein:
          </label>
          <input
            type="text"
            id="deleteConfirmation"
            class="form-field__control"
            placeholder="Geben Sie {DELETE_CONFIRMATION_TEXT} ein"
            bind:value={deleteConfirmation}
          />
        </div>

        <!-- Delete Reason -->
        <div class="form-field">
          <label for="deleteReason" class="form-field__label">
            Grund für die Löschung (min. {MIN_REASON_LENGTH} Zeichen):
          </label>
          <textarea
            id="deleteReason"
            class="form-field__control"
            class:form-field__control--error={deleteReason.length > 0 && !isReasonValid}
            rows="3"
            placeholder="Bitte geben Sie einen Grund an (min. {MIN_REASON_LENGTH} Zeichen)..."
            minlength={MIN_REASON_LENGTH}
            bind:value={deleteReason}
          ></textarea>
          {#if deleteReason.length > 0 && !isReasonValid}
            <span class="form-field__message form-field__message--error">
              {MESSAGES.reasonTooShort(deleteReason.length)}
            </span>
          {:else if deleteReason.length > 0}
            <span class="form-field__message form-field__message--success">
              {MESSAGES.characterCount(deleteReason.length)}
            </span>
          {/if}
        </div>
      </div>

      <div class="ds-modal__footer ds-modal__footer--end">
        <button class="btn btn-cancel" onclick={closeDeleteModal}>
          <i class="fas fa-times"></i>
          Abbrechen
        </button>
        <button
          class="btn btn-danger"
          onclick={handleDeleteTenant}
          disabled={!canDelete || deleteLoading}
        >
          {#if deleteLoading}
            <i class="fas fa-spinner fa-spin"></i>
            Lösche...
          {:else}
            <i class="fas fa-trash-alt"></i>
            Endgültig löschen
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
