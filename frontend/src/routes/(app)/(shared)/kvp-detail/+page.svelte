<script lang="ts">
  /**
   * KVP Detail - Page Component
   * SSR: Data loaded in +page.server.ts
   * Level 3: $derived from SSR data + invalidateAll() after mutations
   */
  import { onDestroy, untrack } from 'svelte';

  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showConfirm, showErrorAlert, showSuccessAlert, showWarningAlert } from '$lib/utils';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { filterState } from '../kvp/_lib/state-filters.svelte';
  import { isFaIcon } from '../kvp/_lib/utils';
  import { fetchEligibleUsers } from '../work-orders/_lib/api';

  import {
    addComment,
    updateSuggestionStatus,
    shareSuggestion,
    unshareSuggestion,
    archiveSuggestion,
    unarchiveSuggestion,
    getShareLevelText,
    confirmSuggestion,
    unconfirmSuggestion,
    requestApproval,
  } from './_lib/api';
  import AttachmentPreviewModal from './_lib/AttachmentPreviewModal.svelte';
  import CommentsSection from './_lib/CommentsSection.svelte';
  import CreateWorkOrderFromKvp from './_lib/CreateWorkOrderFromKvp.svelte';
  import DetailSidebar from './_lib/DetailSidebar.svelte';
  import PhotoGallery from './_lib/PhotoGallery.svelte';
  import RejectionModal from './_lib/RejectionModal.svelte';
  import ShareModal from './_lib/ShareModal.svelte';
  import { kvpDetailState } from './_lib/state.svelte';
  import StatusDropdown from './_lib/StatusDropdown.svelte';
  import {
    getStatusBadgeClass,
    getStatusText,
    getPriorityBadgeClass,
    getPriorityText,
    getVisibilityBadgeClass,
    getVisibilityInfo,
    formatDate,
    formatCurrency,
    hasFinancialInfo,
    hasImplementationDate,
    getSharedByInfo,
    isImageAttachment,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { Attachment, KvpStatus } from './_lib/types';
  import type { EligibleUser } from '../work-orders/_lib/types';

  /** Interface for CommentsSection component exported methods */
  interface CommentsSectionExports {
    getCommentInput: () => HTMLTextAreaElement | undefined;
    clearInput: () => void;
  }

  // ==========================================================================
  // SSR DATA (single source of truth via $derived)
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  const permissionDenied = $derived(data.permissionDenied);

  // Hierarchy labels from layout data inheritance
  const labels = $derived(data.hierarchyLabels);

  // Derived from SSR data (server guarantees non-null values)
  const suggestion = $derived(data.suggestion);
  const comments = $derived(data.comments);
  const attachments = $derived(data.attachments);
  const departments = $derived(data.departments);
  const teams = $derived(data.teams);
  const areas = $derived(data.areas);
  const assets = $derived(data.assets);
  const currentUser = $derived(data.currentUser);
  const linkedWorkOrders = $derived(data.linkedWorkOrders);
  const approval = $derived(data.approval);
  const hasApprovalConfig = $derived(data.hasApprovalConfig);
  const isApprovalMaster = $derived(data.isApprovalMaster);

  // Derived: Photo attachments (uses IMAGE_FILE_TYPES from constants via util)
  const photoAttachments = $derived(
    attachments.filter((att: Attachment) => isImageAttachment(att)),
  );

  // Derived: Visibility info for current suggestion (with dynamic hierarchy labels)
  const visibilityInfo = $derived(
    suggestion !== null ? getVisibilityInfo(suggestion, labels) : null,
  );

  // effectiveRole logic moved to StatusDropdown.svelte (reads from kvpDetailState.effectiveRole)

  // ==========================================================================
  // UI STATE (local only)
  // ==========================================================================

  // Comment section ref (typed for exported methods)
  let commentsSectionRef: CommentsSectionExports | undefined = $state();
  let pendingStatus = $state<KvpStatus | null>(null);
  let rejectionReason = $state('');

  // Preview Modal State (page-level, like blackboard pattern)
  let showPreviewModal = $state(false);
  let previewIndex = $state<number | null>(null);

  const previewAttachment = $derived.by((): Attachment | null => {
    if (previewIndex === null) return null;
    return attachments[previewIndex] ?? null;
  });

  // Loading states managed by kvpDetailState for child components

  // ==========================================================================
  // SYNC STATE STORE (for child components that use it)
  // ==========================================================================

  $effect(() => {
    // Depend only on `data` - the single source of truth from SSR
    // This prevents the infinite loop caused by reading $derived values
    // that would re-trigger when store updates cause child re-renders
    // Reading `data` creates the reactive dependency for this effect
    void data;

    // Use untrack to read derived values without creating dependencies
    // This breaks the reactive cycle: read → write → update → re-read
    untrack(() => {
      // Guard: Protected route, but handle null gracefully
      if (currentUser === null) {
        return;
      }

      kvpDetailState.setUser({
        id: currentUser.id,
        role: currentUser.role,
        tenantId: 0,
      });
      kvpDetailState.setTeamLead(data.isTeamLead ?? false);
      kvpDetailState.setSuggestion(suggestion);
      kvpDetailState.setComments(comments.comments, comments.total, comments.hasMore);
      kvpDetailState.setAttachments(attachments);
      kvpDetailState.setDepartments(departments);
      kvpDetailState.setTeams(teams);
      kvpDetailState.setAreas(areas);
      kvpDetailState.setAssets(assets);
      kvpDetailState.setLoading(false);
    });
  });

  onDestroy(() => {
    kvpDetailState.reset();
  });

  // ==========================================================================
  // PREVIEW MODAL HANDLERS (unified for photos + attachments)
  // ==========================================================================

  function openPreview(att: Attachment): void {
    const idx = attachments.findIndex((a: Attachment) => a.fileUuid === att.fileUuid);
    if (idx === -1) return;
    previewIndex = idx;
    showPreviewModal = true;
  }

  function closePreview(): void {
    showPreviewModal = false;
    previewIndex = null;
  }

  function handlePreviewPrev(): void {
    if (previewIndex === null || attachments.length <= 1) return;
    previewIndex = previewIndex === 0 ? attachments.length - 1 : previewIndex - 1;
  }

  function handlePreviewNext(): void {
    if (previewIndex === null || attachments.length <= 1) return;
    previewIndex = previewIndex === attachments.length - 1 ? 0 : previewIndex + 1;
  }

  // ==========================================================================
  // KEYBOARD HANDLER
  // ==========================================================================

  function handleKeydown(e: KeyboardEvent): void {
    if (showPreviewModal) {
      if (e.key === 'ArrowLeft') handlePreviewPrev();
      else if (e.key === 'ArrowRight') handlePreviewNext();
    }
  }

  // ==========================================================================
  // COMMENT HANDLERS
  // ==========================================================================

  async function handleAddComment() {
    if (commentsSectionRef === undefined) return;
    const textarea: HTMLTextAreaElement | undefined = commentsSectionRef.getCommentInput();
    if (textarea === undefined) return;
    const comment = textarea.value.trim();
    if (comment === '') return;

    if (suggestion === null) return;
    kvpDetailState.setAddingComment(true);

    const result = await addComment(suggestion.uuid, comment);
    if (result.success) {
      showSuccessAlert('Kommentar hinzugefuegt');
      commentsSectionRef.clearInput();
      await invalidateAll();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim hinzufügen');
    }

    kvpDetailState.setAddingComment(false);
  }

  // ==========================================================================
  // STATUS HANDLERS
  // ==========================================================================

  async function handleStatusChange(newStatus: KvpStatus) {
    kvpDetailState.closeAllDropdowns();

    // If rejected, show rejection modal first
    if (newStatus === 'rejected') {
      pendingStatus = newStatus;
      kvpDetailState.openRejectionModal();
      return;
    }

    await performStatusUpdate(newStatus);
  }

  async function handleConfirmRejection() {
    // Capture current value before async operation to avoid race condition
    const statusToUpdate = pendingStatus;
    if (statusToUpdate === null) return;

    const reason = rejectionReason.trim();
    if (reason === '') {
      showErrorAlert('Ein Ablehnungsgrund ist erforderlich');
      return;
    }

    // Reset state before async operation
    pendingStatus = null;
    rejectionReason = '';
    kvpDetailState.closeRejectionModal();

    await performStatusUpdate(statusToUpdate, reason);
  }

  function handleCancelRejection() {
    kvpDetailState.closeRejectionModal();
    pendingStatus = null;
    rejectionReason = '';
  }

  async function performStatusUpdate(newStatus: KvpStatus, reason?: string) {
    if (suggestion === null) return;
    kvpDetailState.setUpdatingStatus(true);

    const result = await updateSuggestionStatus(suggestion.uuid, newStatus, reason);
    if (result.success) {
      showSuccessAlert(`Status geändert zu: ${getStatusText(newStatus)}`);
      await invalidateAll();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim Aktualisieren');
    }

    kvpDetailState.setUpdatingStatus(false);
  }

  // ==========================================================================
  // SHARE HANDLERS
  // ==========================================================================

  function handleOpenShareModal() {
    kvpDetailState.openShareModal();
  }

  async function handleConfirmShare() {
    const level = kvpDetailState.selectedShareLevel;
    let orgId = kvpDetailState.selectedOrgId;

    if (level === null) {
      showErrorAlert('Bitte wählen Sie eine Organisationsebene');
      return;
    }

    // For company level, use tenant ID
    if (level === 'company') {
      orgId = 0; // tenantId comes from server context
    }

    if (orgId === null) {
      showErrorAlert('Bitte wählen Sie eine Organisation');
      return;
    }

    if (suggestion === null) return;
    kvpDetailState.setSharing(true);
    kvpDetailState.closeShareModal();

    const result = await shareSuggestion(suggestion.uuid, level, orgId);
    if (result.success) {
      showSuccessAlert(`Vorschlag wurde auf ${getShareLevelText(level)} geteilt`);
      await invalidateAll();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim Teilen');
    }

    kvpDetailState.setSharing(false);
  }

  async function handleUnshare() {
    const confirmed = await showConfirm('Möchten Sie das Teilen wirklich rückgängig machen?');
    if (!confirmed || suggestion === null) return;

    const result = await unshareSuggestion(suggestion.uuid);
    if (result.success) {
      showSuccessAlert('Teilen wurde rückgängig gemacht');
      await invalidateAll();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim rückgängigmachen');
    }
  }

  // ==========================================================================
  // READ CONFIRMATION HANDLERS (Pattern 2: Individual Decrement/Increment)
  // ==========================================================================

  async function handleConfirm() {
    if (suggestion === null) return;
    const result = await confirmSuggestion(suggestion.uuid);
    if (result.success) {
      notificationStore.decrementCount('kvp'); // Update badge immediately
      showSuccessAlert('Als gelesen markiert');
      await invalidateAll();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim Markieren');
    }
  }

  async function handleUnconfirm() {
    if (suggestion === null) return;
    const result = await unconfirmSuggestion(suggestion.uuid);
    if (result.success) {
      notificationStore.incrementCount('kvp'); // Update badge immediately
      showSuccessAlert('Als ungelesen markiert');
      await invalidateAll();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim Markieren');
    }
  }

  // ==========================================================================
  // ARCHIVE HANDLER
  // ==========================================================================

  async function handleArchive() {
    const confirmed = await showConfirm('Möchten Sie diesen Vorschlag wirklich archivieren?');
    if (!confirmed || suggestion === null) return;

    const result = await archiveSuggestion(suggestion.uuid);
    if (result.success) {
      showSuccessAlert('Vorschlag wurde archiviert');
      setTimeout(() => void goto(resolve('/kvp')), 1500);
    } else {
      showErrorAlert(result.error ?? 'Fehler beim Archivieren');
    }
  }

  // ==========================================================================
  // UNARCHIVE (RESTORE) HANDLER
  // ==========================================================================

  async function handleUnarchive() {
    const confirmed = await showConfirm('Möchten Sie diesen Vorschlag wirklich wiederherstellen?');
    if (!confirmed || suggestion === null) return;

    const result = await unarchiveSuggestion(suggestion.uuid);
    if (result.success) {
      showSuccessAlert('Vorschlag wurde wiederhergestellt');
      await invalidateAll();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim Wiederherstellen');
    }
  }

  // ==========================================================================
  // APPROVAL HANDLER
  // ==========================================================================

  async function handleRequestApproval(): Promise<void> {
    if (suggestion === null) return;

    const result = await requestApproval(suggestion.uuid);
    if (result.success) {
      showSuccessAlert('Freigabe wurde angefordert');
      await invalidateAll();
    } else {
      showErrorAlert(result.error ?? 'Fehler beim Anfordern der Freigabe');
    }
  }

  // ==========================================================================
  // WORK ORDER MODAL HANDLERS
  // ==========================================================================

  let showWoModal = $state(false);
  let woPreloadedUsers = $state<EligibleUser[] | null>(null);

  // Approval approve/reject from detail page (for KVP approval masters)
  let showApproveApprovalModal = $state(false);
  let showRejectApprovalModal = $state(false);
  let approvalNote = $state('');
  let approvalRejectNote = $state('');
  let approvalSubmitting = $state(false);

  async function handleOpenWoModal(): Promise<void> {
    try {
      const users = await fetchEligibleUsers();
      woPreloadedUsers = users;
      showWoModal = true;
    } catch (err: unknown) {
      const is403 =
        err instanceof Error && 'status' in err && (err as { status: number }).status === 403;
      if (is403) {
        showWarningAlert(
          'Keine Berechtigung für Arbeitsaufträge. Bitte Administrator kontaktieren.',
        );
      } else {
        showErrorAlert('Fehler beim Laden der Arbeitsauftrag-Daten.');
      }
    }
  }

  function handleCloseWoModal(): void {
    showWoModal = false;
  }

  function handleWoSaved(): void {
    showWoModal = false;
    void invalidateAll();
  }

  // ==========================================================================
  // APPROVAL APPROVE/REJECT FROM DETAIL (KVP Approval Master)
  // ==========================================================================

  function openApproveApprovalModal(): void {
    approvalNote = '';
    showApproveApprovalModal = true;
  }

  function openRejectApprovalModal(): void {
    approvalRejectNote = '';
    showRejectApprovalModal = true;
  }

  async function handleApproveApproval(): Promise<void> {
    if (approval === null) return;
    approvalSubmitting = true;
    try {
      const res = await fetch(`/api/v2/approvals/${approval.uuid}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionNote: approvalNote !== '' ? approvalNote : null }),
      });
      if (res.ok) {
        showSuccessAlert('Freigabe genehmigt');
        showApproveApprovalModal = false;
        await invalidateAll();
      } else {
        const body = (await res.json()) as { error?: { message?: string } };
        showErrorAlert(body.error?.message ?? 'Fehler beim Genehmigen');
      }
    } catch {
      showErrorAlert('Fehler beim Genehmigen');
    } finally {
      approvalSubmitting = false;
    }
  }

  async function handleRejectApproval(): Promise<void> {
    if (approval === null || approvalRejectNote.trim() === '') return;
    approvalSubmitting = true;
    try {
      const res = await fetch(`/api/v2/approvals/${approval.uuid}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionNote: approvalRejectNote }),
      });
      if (res.ok) {
        showSuccessAlert('Freigabe abgelehnt');
        showRejectApprovalModal = false;
        await invalidateAll();
      } else {
        const body = (await res.json()) as { error?: { message?: string } };
        showErrorAlert(body.error?.message ?? 'Fehler beim Ablehnen');
      }
    } catch {
      showErrorAlert('Fehler beim Ablehnen');
    } finally {
      approvalSubmitting = false;
    }
  }

  // ==========================================================================
  // DROPDOWN HANDLERS
  // ==========================================================================

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(() => {
      kvpDetailState.closeAllDropdowns();
    });
  });
</script>

<svelte:head>
  <title>KVP Vorschlag - Assixx</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

{#if permissionDenied}
  <PermissionDenied addonName="das KVP-Modul" />
{:else if suggestion !== null}
  <div class="container">
    <!-- Back Button -->
    <div class="mb-4">
      <button
        type="button"
        class="btn btn-light"
        onclick={() => {
          filterState.reset();
          void goto(resolve('/kvp'));
        }}
      >
        <i class="fas fa-arrow-left mr-2"></i>Zurück zur Übersicht
      </button>
    </div>

    <div class="detail-container">
      <!-- Main Content -->
      <div class="detail-main card">
        <!-- Header -->
        <div class="detail-header">
          <div>
            <div class="detail-title">{suggestion.title}</div>
            <div class="detail-meta">
              <span>
                <i class="fas fa-user"></i>
                {suggestion.submittedByName}
                {suggestion.submittedByLastname}
              </span>
              <span>
                <i class="fas fa-calendar"></i>
                {formatDate(suggestion.createdAt)}
              </span>
              <span>
                <i class="fas fa-building"></i>
                {suggestion.departmentName}
              </span>
            </div>
          </div>
          <div class="status-priority">
            <span class="badge {getPriorityBadgeClass(suggestion.priority)}">
              {getPriorityText(suggestion.priority)}
            </span>
            <span class="badge {getStatusBadgeClass(suggestion.status)}">
              {getStatusText(suggestion.status)}
            </span>
            {#if suggestion.isShared}
              <div class="share-info">
                <i class="fas fa-share-alt"></i>
                <span class="badge {getVisibilityBadgeClass(suggestion.orgLevel)}">
                  <i class="fas {visibilityInfo?.icon}"></i>
                  <span>{visibilityInfo?.text}{getSharedByInfo(suggestion)}</span>
                </span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Details Section -->
        <div class="content-section">
          <h3 class="section-title">
            <i class="fas fa-info-circle"></i>
            Details
          </h3>
          <div class="data-list data-list--grid">
            <div class="data-list__item">
              <span class="data-list__label">Kategorie</span>
              <span class="data-list__value">
                <div
                  class="category-tag"
                  class:category-tag--deleted={suggestion.categoryIsDeleted === true}
                  style:background="{suggestion.categoryColor}20"
                  style:color={suggestion.categoryColor}
                  style:border="1px solid {suggestion.categoryColor}"
                >
                  {#if isFaIcon(suggestion.categoryIcon)}
                    <i
                      class="fas fa-{suggestion.categoryIcon}"
                      style:margin-right="0.1em"
                    ></i>
                  {:else}
                    {suggestion.categoryIcon}
                  {/if}
                  {suggestion.categoryName}
                </div>
              </span>
            </div>
            <div class="data-list__item">
              <span class="data-list__label">Status</span>
              <StatusDropdown
                {suggestion}
                {hasApprovalConfig}
                onstatuschange={handleStatusChange}
              />
            </div>
            {#if suggestion.assignedToName !== undefined}
              <div class="data-list__item">
                <span class="data-list__label">Zugewiesen an</span>
                <span class="data-list__value">{suggestion.assignedToName}</span>
              </div>
            {/if}
            {#if hasImplementationDate(suggestion)}
              <div class="data-list__item">
                <span class="data-list__label">Umsetzung</span>
                <span class="data-list__value"
                  >{formatDate(suggestion.implementationDate ?? '')}</span
                >
              </div>
            {/if}
            {#if suggestion.status === 'rejected' && suggestion.rejectionReason !== undefined && suggestion.rejectionReason !== ''}
              <div class="data-list__item">
                <span class="data-list__label">Ablehnungsgrund</span>
                <span class="data-list__value">{suggestion.rejectionReason}</span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Description -->
        <div class="content-section">
          <h3 class="section-title">
            <i class="fas fa-align-left"></i>
            Beschreibung
          </h3>
          <div class="section-content">{suggestion.description}</div>
        </div>

        <!-- Expected Benefit -->
        <div class="content-section">
          <h3 class="section-title">
            <i class="fas fa-chart-line"></i>
            Erwarteter Nutzen
          </h3>
          <div class="section-content">
            {(
              suggestion.expectedBenefit !== null &&
              suggestion.expectedBenefit !== undefined &&
              suggestion.expectedBenefit !== ''
            ) ?
              suggestion.expectedBenefit
            : 'Keine Angabe'}
          </div>
        </div>

        <!-- Photo Gallery -->
        {#if photoAttachments.length > 0}
          <div class="content-section">
            <h3 class="section-title">
              <i class="fas fa-images"></i>
              Fotos
            </h3>
            <PhotoGallery
              photos={photoAttachments}
              onphotoclick={openPreview}
            />
          </div>
        {/if}

        <!-- Financial Info -->
        {#if hasFinancialInfo(suggestion)}
          <div class="content-section">
            <h3 class="section-title">
              <i class="fas fa-euro-sign"></i>
              Finanzielle Informationen
            </h3>
            <div class="data-list data-list--grid">
              {#if suggestion.estimatedCost !== undefined && suggestion.estimatedCost !== 0}
                <div class="data-list__item">
                  <span class="data-list__label">Geschätzte Kosten</span>
                  <span class="data-list__value">{formatCurrency(suggestion.estimatedCost)}</span>
                </div>
              {/if}
              {#if suggestion.actualSavings !== undefined && suggestion.actualSavings !== 0}
                <div class="data-list__item">
                  <span class="data-list__label">Tatsaechliche Einsparungen</span>
                  <span class="data-list__value">{formatCurrency(suggestion.actualSavings)}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Comments Section -->
        <CommentsSection
          bind:this={commentsSectionRef}
          onaddcomment={handleAddComment}
        />
      </div>

      <!-- Sidebar -->
      <DetailSidebar
        {suggestion}
        {linkedWorkOrders}
        {approval}
        {hasApprovalConfig}
        {isApprovalMaster}
        onopensharemodal={handleOpenShareModal}
        onunshare={handleUnshare}
        onarchive={handleArchive}
        onunarchive={handleUnarchive}
        onconfirm={handleConfirm}
        onunconfirm={handleUnconfirm}
        onopenpreview={openPreview}
        onopenworkordermodal={handleOpenWoModal}
        onrequestapproval={handleRequestApproval}
        onapprove={openApproveApprovalModal}
        onreject={openRejectApprovalModal}
      />
    </div>
  </div>

  <!-- Modal Components -->
  {#if kvpDetailState.canManage}
    <CreateWorkOrderFromKvp
      show={showWoModal}
      {suggestion}
      preloadedUsers={woPreloadedUsers}
      onclose={handleCloseWoModal}
      onsaved={handleWoSaved}
    />
  {/if}
  <ShareModal
    {labels}
    onconfirm={handleConfirmShare}
  />
  <RejectionModal
    bind:rejectionReason
    onconfirm={handleConfirmRejection}
    oncancel={handleCancelRejection}
  />
  <AttachmentPreviewModal
    show={showPreviewModal}
    attachment={previewAttachment}
    onclose={closePreview}
    onprev={handlePreviewPrev}
    onnext={handlePreviewNext}
    currentIndex={previewIndex ?? undefined}
    totalCount={attachments.length}
  />

  <!-- Approval Approve Modal (KVP Approval Master) -->
  <ConfirmModal
    show={showApproveApprovalModal && approval !== null}
    id="kvp-approve-approval-modal"
    wide
    title="Freigabe genehmigen"
    variant="success"
    icon="fa-check"
    confirmLabel="Genehmigen"
    submitting={approvalSubmitting}
    onconfirm={() => void handleApproveApproval()}
    oncancel={() => {
      showApproveApprovalModal = false;
    }}
  >
    {#if approval !== null}
      <p><strong>{suggestion.title}</strong></p>
      <p>Angefragt von: {approval.requestedByName}</p>
      <div class="confirm-modal__input-group">
        <textarea
          id="kvp-approve-note"
          class="confirm-modal__input"
          rows="3"
          bind:value={approvalNote}
          placeholder="Optionaler Kommentar zur Genehmigung..."
        ></textarea>
      </div>
    {/if}
  </ConfirmModal>

  <!-- Approval Reject Modal (KVP Approval Master) -->
  <ConfirmModal
    show={showRejectApprovalModal && approval !== null}
    id="kvp-reject-approval-modal"
    wide
    title="Freigabe ablehnen"
    variant="danger"
    icon="fa-times"
    confirmLabel="Ablehnen"
    submitting={approvalSubmitting}
    onconfirm={() => void handleRejectApproval()}
    oncancel={() => {
      showRejectApprovalModal = false;
    }}
  >
    {#if approval !== null}
      <p><strong>{suggestion.title}</strong></p>
      <p>Angefragt von: {approval.requestedByName}</p>
      <div class="confirm-modal__input-group">
        <textarea
          id="kvp-reject-note"
          class="confirm-modal__input"
          rows="3"
          bind:value={approvalRejectNote}
          placeholder="Begründung für die Ablehnung..."
          required
        ></textarea>
      </div>
    {/if}
  </ConfirmModal>
{/if}

<style>
  /* ─── Layout ──────── */

  .detail-container {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr 475px;
    gap: var(--spacing-6);
  }

  .detail-main {
    z-index: 1;
    padding: var(--spacing-8);
    margin-bottom: 0;
  }

  /* ─── Header ──────── */

  .detail-header {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-4);
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--spacing-8);
  }

  .detail-title {
    margin-bottom: var(--spacing-2);
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .detail-meta {
    display: flex;
    gap: var(--spacing-6);
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .detail-meta span {
    display: inline-flex;
    gap: var(--spacing-2);
    align-items: center;
  }

  .detail-meta i {
    color: var(--primary-color);
  }

  .category-tag {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding: 4px 12px;
    border-radius: var(--radius-xl);
    font-size: 0.8rem;
  }

  /* Soft-deleted category: strikethrough + dimmed opacity */
  .category-tag--deleted {
    text-decoration: line-through;
    opacity: 55%;
  }

  .status-priority {
    display: flex;
    flex-wrap: wrap;
    flex-shrink: 0;
    gap: var(--spacing-3);
    align-items: center;
  }

  .share-info {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .share-info > :global(i.fa-share-alt) {
    font-size: 0.875rem;
    color: oklch(49.26% 0 0) !important;
  }

  /* ─── Content Sections ──────── */

  .content-section {
    margin-bottom: var(--spacing-8);
  }

  .section-title {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
    margin-bottom: var(--spacing-4);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--primary-color);
  }

  .section-content {
    padding: var(--spacing-4);
    border: var(--glass-border);
    border-radius: var(--glass-card-radius);
    line-height: 1.6;
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
    background: var(--glass-bg);
    backdrop-filter: var(--glass-backdrop);
    box-shadow: var(--glass-card-shadow);
  }

  /* ─── Status Dropdown Override ──────── */

  :global([data-dropdown='status'] .dropdown__trigger) {
    width: auto;
    min-width: 180px;
  }

  :global([data-dropdown='status'] .dropdown__menu) {
    min-width: 180px;
    left: auto;
    right: auto;
  }

  /* ─── Responsive ──────── */

  @media (width < 768px) {
    .detail-container {
      grid-template-columns: 1fr;
    }
  }
</style>
