<!--
  Shift Handover Detail Page (plan §5.3 + Session 15 modal → page rewrite).

  Replaces the prior `ShiftHandoverModal.svelte` that lived inside the
  shift grid. Modal→page migration was triggered by the smoke test on
  2026-04-23: the modal inlined error/empty alerts instead of toasting,
  flashed the shell for ~1 frame before closing on 403, and had no
  deep-link. A dedicated page makes each entry URL-addressable, refresh-
  safe, and routes its error states through the SSR loader + global toast
  (same pattern as `/blackboard/[uuid]`, `/kvp-detail`).

  UI (2026-04-23 v2 — design-system alignment): layout mirrors the
  canonical detail-page skeleton shared with `/blackboard/[uuid]` and
  `/shift-handover-templates`:
    - `.container` as page wrapper (NOT `.page-container` — that is the
      glass-box primitive reserved for login/signup/wizards).
    - `.btn-light` back-button above the card (Blackboard pattern).
    - One `.card` hosts header (title + meta + status-badge), the three
      content sections (protocol / extra fields / attachments) separated
      by `.section-title`, and a `.card__footer` with right-aligned
      actions (cancel | draft | submit).
    - `.data-list.data-list--grid` for the meta block.
    - `.photo-gallery` / `.photo-thumbnail` for the attachments, matching
      the Blackboard detail view.

  Responsibilities:
    1. Render the meta block (date + KW, shift slot label, team).
    2. Render the free-text "Protokoll" textarea + one
       `ShiftHandoverFieldRenderer` per custom field, bound to local
       `customValues`.
    3. Image upload (max 5 per entry, max 5 MB each, MIME whitelist —
       backend `MulterFile` pipeline enforces the same caps).
    4. Footer actions:
       - `Abbrechen` → navigate back to `/shifts`.
       - `Speichern (Entwurf)` patches and returns to `/shifts` with a
         success toast via query-param.
       - `Übergabe abschließen` submits and returns to `/shifts`.
       After submit the entry becomes immutable (unless a Team-Lead
       reopens via the §2.8 endpoint — V2).

  The schema-snapshot contract (R2) is preserved: `renderFields` pulls
  from `entry.schema_snapshot` for submitted entries (frozen at submit
  time) or from the live template fields otherwise.

  Attachment rehydration (Session 22, 2026-04-25): the SSR loader receives
  the entry with its attachment list embedded inline (Inventory pattern —
  `GET /shift-handover/entries/:id` returns `{ ...entry, attachments[] }`).
  We seed the local `attachments` state from `initialEntry.attachments`
  on first load and on every navigation, so reopening a draft after a
  page round-trip shows the previously uploaded files instead of an empty
  list. Resolves Spec Deviation #6 / Known Limitation #15.

  @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.3 + Session 15 + Session 22
  @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
  @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md §6
  @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
  @see docs/infrastructure/adr/ADR-052-shift-handover-protocol.md
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';
  import { showErrorAlert, showSuccessAlert } from '$lib/utils/alerts';
  import { checkSessionExpired } from '$lib/utils/session-expired';

  import {
    attachmentUrl,
    deleteAttachment as apiDeleteAttachment,
    submitEntry,
    updateEntry,
    uploadAttachment,
    type ShiftHandoverAttachment,
    type ShiftHandoverEntryWithAttachments,
  } from '../../shifts/_lib/api-shift-handover';
  import ShiftHandoverFieldRenderer from '../../shifts/_lib/ShiftHandoverFieldRenderer.svelte';
  import { getWeekNumber } from '../../shifts/_lib/utils';

  import type { PageData } from './$types';
  import type { HandoverSlot } from '../../shifts/_lib/shift-handover-types';
  import type { ShiftHandoverFieldDef } from '@assixx/shared/shift-handover';

  // Backend owns the same caps (see shift-handover.types.ts). Duplicated
  // here so the UI can reject oversize uploads before the network round-
  // trip — the authoritative check stays server-side.
  const MAX_ATTACHMENTS = 5;
  const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
  const ALLOWED_MIME = new Set<string>(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

  const SHIFT_LABELS: Record<HandoverSlot, string> = {
    early: 'Frühschicht',
    late: 'Spätschicht',
    night: 'Nachtschicht',
  };

  const { data }: { data: PageData } = $props();

  const permissionDenied = $derived(data.permissionDenied);
  const initialEntry = $derived(data.entry);
  const templateFields = $derived(data.templateFields);
  const myPermissions = $derived(data.myPermissions);

  const labels = $derived(
    ((data as Record<string, unknown>).hierarchyLabels as HierarchyLabels | undefined) ??
      DEFAULT_HIERARCHY_LABELS,
  );

  /**
   * Strips `null`/`undefined` from `custom_values` on seed.
   *
   * Legacy drafts (pre-Session-23) may carry explicit nulls in
   * `custom_values` — the renderer used to emit `null` on cleared number/
   * select inputs. Backend Zod (`z.number().optional()`) rejects `null`,
   * so reopening + re-saving such a draft would 400 even without user
   * edits. The seed normalisation drops nulls so the next save sends a
   * clean payload (key absent = "not set"). Session 23 finding 2026-04-25.
   */
  function normaliseCustomValues(raw: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value !== null && value !== undefined) out[key] = value;
    }
    return out;
  }

  // Local mutable entry — server data is the initial seed; we reassign
  // after PATCH/submit so the UI stays in sync without a page round-trip.
  // Type widens to bare `ShiftHandoverEntry` after a PATCH/submit response
  // (no embedded attachments on those endpoints), but the seed always
  // carries the attachments array from the GET — see Session 22 rationale
  // in the JSDoc banner above.
  let entry = $state<ShiftHandoverEntryWithAttachments | null>(null);
  $effect(() => {
    entry = initialEntry;
    if (initialEntry !== null) {
      protocolText = initialEntry.protocol_text;
      customValues = normaliseCustomValues(initialEntry.custom_values);
      // `attachments` is guaranteed non-null by the controller's
      // `GET /entries/:id` composition (Session 22) — backend always
      // returns the embed array, never omits it.
      attachments = initialEntry.attachments;
    }
  });

  let protocolText = $state('');
  let customValues = $state<Record<string, unknown>>({});
  let attachments = $state<ShiftHandoverAttachment[]>([]);
  let saving = $state(false);
  let uploading = $state(false);

  // Ref to the hidden native <input type="file">. Visible trigger is the
  // `btn-upload` button below — mirrors BugReportForm / KVP upload pattern
  // (label-wrapping an <input> leaks OS-native styling on some browsers;
  // hidden input + programmatic click is the idiom used elsewhere).
  let fileInput: HTMLInputElement | undefined = $state();

  function openFilePicker(): void {
    fileInput?.click();
  }

  // For submitted entries `schema_snapshot` — NOT the live template — is
  // the single source of truth for what to render (R2 drift-safety).
  const renderFields = $derived.by((): ShiftHandoverFieldDef[] => {
    if (entry !== null && entry.status !== 'draft') {
      return entry.schema_snapshot;
    }
    return templateFields;
  });

  const isSubmitted = $derived(entry?.status === 'submitted');
  // V1 approximation of canEdit: write-permission + not submitted. The
  // backend enforces assignee-check on every PATCH/submit, so a non-
  // assignee with write-permission still gets 403 + German toast. V2
  // should surface assignee info in the entry DTO so the UI can hide
  // the edit controls pre-emptively (plan §Known Limitations).
  const canEdit = $derived(!isSubmitted && myPermissions.entries.canWrite);
  const attachmentCount = $derived(attachments.length);
  const canUploadMore = $derived(canEdit && attachmentCount < MAX_ATTACHMENTS);

  const shiftLabel = $derived.by(() => (entry === null ? '' : SHIFT_LABELS[entry.shift_key]));
  const dateDisplay = $derived.by(() => {
    if (entry === null) return '';
    const iso = entry.shift_date.slice(0, 10);
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  });
  const kwDisplay = $derived.by(() => {
    if (entry === null) return '–';
    const parsed = new Date(`${entry.shift_date.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? '–' : String(getWeekNumber(parsed));
  });

  /**
   * Apply a single field edit to `customValues`.
   *
   * Cleared inputs come through with `newValue === undefined` (renderer
   * contract since Session 23 — `null` was rejected by backend Zod). When
   * that happens we DROP the key from `customValues` rather than store
   * `undefined`/`null`, so the wire payload only carries set values.
   * Backend draft validation is lenient (`mode='draft'` in
   * `validateCustomValues`), so a missing key for a required field is
   * accepted on PATCH; submit-time strict validation enforces presence.
   */
  function handleFieldChange(key: string, newValue: unknown): void {
    if (newValue === undefined || newValue === null) {
      // Drop the key — `delete next[key]` would trip `no-dynamic-delete`,
      // and the destructuring-rest trick conflicts with the naming-convention
      // rule (no leading underscore on variables). filter+fromEntries is
      // the rule-clean idiom.
      customValues = Object.fromEntries(Object.entries(customValues).filter(([k]) => k !== key));
      return;
    }
    customValues = { ...customValues, [key]: newValue };
  }

  async function handleSaveDraft(): Promise<void> {
    if (entry === null || !canEdit) return;
    const entryId = entry.id;
    saving = true;
    try {
      await updateEntry(entryId, { protocolText, customValues });
      showSuccessAlert('Entwurf gespeichert.');
      await goto(resolve('/shifts'));
    } catch (err: unknown) {
      if (checkSessionExpired(err)) return;
      showErrorAlert(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      saving = false;
    }
  }

  async function handleSubmit(): Promise<void> {
    if (entry === null || !canEdit) return;
    const entryId = entry.id;
    saving = true;
    try {
      // Persist the latest body first so submit snapshots include it.
      await updateEntry(entryId, { protocolText, customValues });
      await submitEntry(entryId);
      showSuccessAlert('Übergabe abgeschlossen.');
      await goto(resolve('/shifts'));
    } catch (err: unknown) {
      if (checkSessionExpired(err)) return;
      showErrorAlert(
        err instanceof Error ? err.message : 'Übergabe konnte nicht abgeschlossen werden.',
      );
    } finally {
      saving = false;
    }
  }

  /** Returns a German error message if the file is invalid, else null. */
  function validateUpload(file: File): string | null {
    if (!ALLOWED_MIME.has(file.type)) return 'Nur JPEG, PNG, WebP oder HEIC erlaubt.';
    if (file.size > MAX_ATTACHMENT_BYTES) return 'Datei zu groß (max. 5 MB).';
    if (attachmentCount >= MAX_ATTACHMENTS) {
      return `Maximal ${MAX_ATTACHMENTS} Anhänge pro Übergabe.`;
    }
    return null;
  }

  async function handleFileSelected(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement | null;
    if (input === null || entry === null) return;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) return;

    const validationError = validateUpload(file);
    if (validationError !== null) {
      showErrorAlert(validationError);
      return;
    }

    const entryId = entry.id;
    uploading = true;
    try {
      const uploaded = await uploadAttachment(entryId, file);
      attachments = [...attachments, uploaded];
    } catch (err: unknown) {
      if (checkSessionExpired(err)) return;
      showErrorAlert(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
    } finally {
      uploading = false;
    }
  }

  async function handleDeleteAttachment(attachmentId: string): Promise<void> {
    if (entry === null || !canEdit) return;
    try {
      await apiDeleteAttachment(entry.id, attachmentId);
      attachments = attachments.filter((a) => a.id !== attachmentId);
    } catch (err: unknown) {
      if (checkSessionExpired(err)) return;
      showErrorAlert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    }
  }

  function handleCancel(): void {
    void goto(resolve('/shifts'));
  }
</script>

<svelte:head>
  <title>Schichtübergabe – Assixx</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="die Schichtübergabe" />
{:else if entry !== null}
  <!-- Hidden native file input — triggered by the visible btn-upload above. -->
  <input
    type="file"
    accept="image/jpeg,image/png,image/webp,image/heic"
    hidden
    bind:this={fileInput}
    onchange={(e) => {
      void handleFileSelected(e);
    }}
  />

  <div class="container">
    <!-- Back Button (Blackboard detail-page pattern) -->
    <div class="mb-4">
      <button
        type="button"
        class="btn btn-light"
        onclick={handleCancel}
      >
        <i class="fas fa-arrow-left mr-2"></i>
        Zurück zur Schichtplanung
      </button>
    </div>

    <div class="card detail-main">
      <!-- Header: Title + Meta + Status Badge -->
      <div class="detail-header">
        <div>
          <div class="detail-title">
            <i class="fas fa-clipboard-list mr-2"></i>Schichtübergabe
          </div>
          <div class="detail-meta">
            <span><i class="fas fa-calendar"></i>{dateDisplay} · KW {kwDisplay}</span>
            <span><i class="fas fa-clock"></i>{shiftLabel}</span>
            <span><i class="fas fa-users"></i>{labels.team} #{entry.team_id}</span>
            <!-- Author chip: who had the shift / opened the draft. Backend
                 denormalises `users.first_name + last_name` (or email fallback)
                 into `created_by_name` on the GET response — Session 24
                 resolves the Session-18 Known Limitation. -->
            <span><i class="fas fa-user"></i>{entry.created_by_name ?? 'Unbekannt'}</span>
          </div>
        </div>
        <div class="status-priority">
          {#if isSubmitted}
            <span class="badge badge--success">
              <i class="fas fa-check-circle mr-1"></i>Abgeschlossen
            </span>
          {:else}
            <span class="badge badge--warning">
              <i class="fas fa-pen mr-1"></i>Entwurf
            </span>
          {/if}
        </div>
      </div>

      <!-- Protokoll Section -->
      <div class="content-section">
        <h3 class="section-title">
          <i class="fas fa-align-left"></i> Protokoll
        </h3>
        <div class="form-field">
          <label
            class="form-field__label sr-only"
            for="shift-handover-protocol"
          >
            Protokoll
          </label>
          <textarea
            id="shift-handover-protocol"
            class="form-field__control"
            rows="6"
            placeholder="Freitext — Auffälligkeiten, offene Punkte, Übergaben …"
            disabled={!canEdit}
            bind:value={protocolText}
          ></textarea>
        </div>
      </div>

      <!-- Zusatzfelder Section -->
      <div class="content-section">
        <h3 class="section-title">
          <i class="fas fa-list-check"></i> Zusatzfelder
        </h3>
        {#if renderFields.length > 0}
          <div class="fields-stack">
            {#each renderFields as field (field.key)}
              <ShiftHandoverFieldRenderer
                {field}
                value={customValues[field.key]}
                disabled={!canEdit}
                onchange={(v: unknown) => {
                  handleFieldChange(field.key, v);
                }}
              />
            {/each}
          </div>
        {:else}
          <p class="empty-hint">
            <i class="fas fa-info-circle mr-2"></i>
            Für dieses Team ist keine Übergabe-Vorlage konfiguriert.
          </p>
        {/if}
      </div>

      <!-- Anhänge Section -->
      <div class="content-section">
        <div class="section-row">
          <h3 class="section-title">
            <i class="fas fa-paperclip"></i> Anhänge
            <span class="attach-count">({attachmentCount}/{MAX_ATTACHMENTS})</span>
          </h3>
          {#if canUploadMore}
            <button
              type="button"
              class="btn btn-upload"
              disabled={uploading}
              onclick={openFilePicker}
            >
              <i class="fas fa-upload mr-2"></i>
              Hochladen
            </button>
          {/if}
        </div>
        {#if attachments.length === 0 && canUploadMore}
          <!-- File upload zone — drag-drop target + click-to-upload.
               Mirrors BlackboardEntryModal pattern (design-system
               primitive `file-upload-zone`). The hidden ref-input
               above the .container tree handles the btn-upload
               click path; this zone owns its own input so the native
               drag-and-drop target is inside the visual drop area. -->
          <div class="file-upload-zone file-upload-zone--compact">
            <input
              type="file"
              class="file-upload-zone__input"
              id="attachmentInput"
              accept="image/jpeg,image/png,image/webp,image/heic"
              disabled={uploading}
              onchange={(e) => {
                void handleFileSelected(e);
              }}
            />
            <label
              for="attachmentInput"
              class="file-upload-zone__label"
            >
              <div class="file-upload-zone__icon">
                <i class="fas fa-cloud-upload-alt"></i>
              </div>
              <div class="file-upload-zone__text">
                <p class="file-upload-zone__title">Dateien hierher ziehen</p>
              </div>
            </label>
          </div>
        {:else if attachments.length === 0}
          <p class="empty-hint">
            <i class="fas fa-image mr-2"></i>
            Keine Anhänge hochgeladen.
          </p>
        {:else}
          <div class="photo-gallery">
            {#each attachments as att (att.id)}
              <figure class="photo-thumbnail">
                <img
                  src={attachmentUrl(entry.id, att.id)}
                  alt={att.file_name}
                  loading="lazy"
                />
                {#if canEdit}
                  <button
                    type="button"
                    class="photo-thumbnail__delete"
                    aria-label="Anhang löschen"
                    onclick={() => {
                      void handleDeleteAttachment(att.id);
                    }}
                  >
                    <i class="fas fa-times"></i>
                  </button>
                {/if}
                <figcaption>{att.file_name}</figcaption>
              </figure>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer Actions: right-aligned (cancel | draft | submit) -->
      <div class="card__footer action-footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={handleCancel}
        >
          {canEdit ? 'Abbrechen' : 'Schließen'}
        </button>
        {#if canEdit}
          <button
            type="button"
            class="btn btn-secondary"
            disabled={saving}
            onclick={() => {
              void handleSaveDraft();
            }}
          >
            {#if saving}
              <span class="spinner-ring spinner-ring--sm mr-2"></span>
            {:else}
              <i class="fas fa-save mr-2"></i>
            {/if}
            Speichern (Entwurf)
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={saving}
            onclick={() => {
              void handleSubmit();
            }}
          >
            {#if saving}
              <span class="spinner-ring spinner-ring--sm mr-2"></span>
            {:else}
              <i class="fas fa-check mr-2"></i>
            {/if}
            Übergabe abschließen
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /*
   * Page-local residuals only — everything else is design-system owned:
   *   .container, .card, .card__footer, .btn*, .badge*,
   *   .form-field*, .spinner-ring*, spacing utilities.
   *
   * The `.detail-*`, `.content-section`, `.section-title`, and
   * `.photo-gallery` rules mirror `/blackboard/[uuid]` 1:1 so the two
   * detail pages stay visually aligned without extracting a shared
   * layer prematurely (KISS — two sites of duplication, not three).
   * If a third detail page adopts the same pattern, promote these rules
   * into the design-system under `primitives/detail-layout/`.
   */

  .detail-main {
    padding: var(--spacing-8);
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
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-6);
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .detail-meta span {
    display: inline-flex;
    gap: var(--spacing-2);
    align-items: center;
  }

  .detail-meta i {
    color: var(--color-primary);
  }

  .status-priority {
    display: flex;
    flex-wrap: wrap;
    flex-shrink: 0;
    gap: var(--spacing-3);
    align-items: center;
  }

  /* ─── Content Sections ──────── */

  .content-section {
    margin-bottom: var(--spacing-8);
  }

  .content-section:last-of-type {
    margin-bottom: 0;
  }

  .section-title {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
    margin-bottom: var(--spacing-4);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-primary);
  }

  /* Section header that carries an inline action (upload button on the
   * Anhänge section). h3 keeps its own line-height; flex wrapper aligns
   * both children to their natural baseline. Embedding the button inside
   * the h3 would stretch it to the h3's larger line-box. */
  .section-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-4);
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-4);
  }

  .section-row .section-title {
    margin-bottom: 0;
  }

  .attach-count {
    color: var(--color-text-secondary);
    font-weight: 500;
    font-size: 0.9rem;
  }

  /* ─── Fields + Empty States ──────── */

  .fields-stack {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .empty-hint {
    margin: 0;
    padding: var(--spacing-4);
    border: 1px dashed var(--color-glass-border);
    border-radius: var(--radius-xl);
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    background: var(--glass-bg);
  }

  /* Screen-reader-only label for the protocol textarea — the visible
   * label is the `.section-title` above, but we keep a semantic <label>
   * for a11y without visual duplication. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;

    /* `clip-path: inset(50%)` replaces the deprecated `clip: rect(0,0,0,0)`
     * (stylelint property-no-deprecated). Collapses the 1x1 box to zero
     * area visually while leaving the element in the a11y tree. */
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  /* ─── Attachments (photo gallery — Blackboard pattern) ──────── */

  .photo-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--spacing-4);
  }

  .photo-thumbnail {
    position: relative;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .photo-thumbnail img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border: 2px solid transparent;
    border-radius: var(--radius-xl);
    background: var(--glass-bg-active);
    transition:
      transform 0.15s ease,
      border-color 0.15s ease;
  }

  .photo-thumbnail img:hover {
    transform: scale(1.03);
    border-color: var(--color-primary);
  }

  .photo-thumbnail__delete {
    position: absolute;
    top: 6px;
    right: 6px;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 50%;

    background: color-mix(in oklch, var(--color-black) 65%, transparent);
    color: var(--color-white);

    cursor: pointer;
    transition: background 0.15s ease;
  }

  .photo-thumbnail__delete:hover {
    background: var(--color-danger);
  }

  .photo-thumbnail figcaption {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    word-break: break-all;
  }

  /* ─── Footer Actions ──────── */

  .action-footer {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-3);
    justify-content: flex-end;
  }

  /* Cancel stays on the left edge, primary actions group on the right.
   * Semantic order in markup (cancel → draft → submit) is preserved for
   * keyboard/screen-reader flow; visual layout uses `margin-right: auto`
   * to push cancel left without re-ordering the DOM. */
  .action-footer .btn-cancel {
    margin-right: auto;
  }

  /* ─── Responsive ──────── */

  @media (width < 640px) {
    .detail-main {
      padding: var(--spacing-5);
    }

    .detail-header {
      flex-direction: column;
      margin-bottom: var(--spacing-6);
    }

    .detail-meta {
      gap: var(--spacing-3);
    }

    .action-footer {
      flex-direction: column-reverse;
    }

    .action-footer .btn-cancel {
      margin-right: 0;
    }
  }
</style>
