<!--
  ShiftHandoverModal — draft-lifecycle modal for a single shift cell.

  Responsibilities (Plan §5.1):
   1. On mount, load the live template for the team *and* either fetch the
      existing entry or call `POST /shift-handover/entries` (idempotent:
      the backend returns an existing draft when present, otherwise
      creates one).
   2. Render pre-filled meta (date + KW, shift slot label, team name,
      assignee names) read-only.
   3. Render the free-text "Protokoll" textarea + one
      `ShiftHandoverFieldRenderer` per custom field, bound to the local
      `customValues` copy.
   4. Image upload (max 5 per entry, max 5 MB each, MIME whitelist per
      Plan §R11 — backend MulterFile pipeline enforces the same caps).
   5. Two footer actions — "Speichern (Entwurf)" patches the draft and
      closes; "Übergabe abschließen" submits and closes. After submit the
      entry becomes immutable (unless a Team-Lead reopens it via §2.8).
   6. Read-only mode when `readOnly=true` (non-assignee non-Lead, or when
      the entry is in `submitted` state for users without reopen rights).

  Backend validators remain authoritative (plan §Risk R7): custom-field
  values round-trip through the service's `buildEntryValuesSchema` on
  every PATCH/submit, so the modal is UX-only — HTML5 required + minimal
  type coercion in the renderer, no duplicate Zod code.

  Session-expired errors are handled centrally via the shared helper
  (CODE-OF-CONDUCT-SVELTE §"Session-Expired Handling").

  @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.1
  @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
  @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
-->
<script lang="ts">
  import { showErrorAlert, showSuccessAlert } from '$lib/utils/alerts';
  import { checkSessionExpired } from '$lib/utils/session-expired';

  import {
    attachmentUrl,
    deleteAttachment as apiDeleteAttachment,
    getEntry,
    getOrCreateDraft,
    getTemplate,
    submitEntry,
    updateEntry,
    uploadAttachment,
    type ShiftHandoverAttachment,
    type ShiftHandoverEntry,
  } from './api-shift-handover';
  import ShiftHandoverFieldRenderer from './ShiftHandoverFieldRenderer.svelte';
  import { getWeekNumber } from './utils';

  import type { HandoverSlot } from './shift-handover-types';
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

  interface Props {
    teamId: number;
    teamName: string;
    /** Hierarchy label for "team" (ADR-034) — tenant may rename e.g. to "Teilbereich". */
    teamLabel: string;
    shiftDate: string;
    shiftKey: HandoverSlot;
    assigneeNames: string[];
    /** Force read-only mode (non-assignee non-Lead, or submitted status). */
    readOnly: boolean;
    /** Pre-existing entry id (from the grid's bulk-status map) — skips the create POST. */
    existingEntryId: string | null;
    onclose: () => void;
    /** Emitted after draft save / submit so the parent grid can refresh its status map. */
    onmutated: () => void;
  }

  const {
    teamId,
    teamName,
    teamLabel,
    shiftDate,
    shiftKey,
    assigneeNames,
    readOnly,
    existingEntryId,
    onclose,
    onmutated,
  }: Props = $props();

  // Derived display values
  const shiftLabel = $derived(SHIFT_LABELS[shiftKey]);
  const dateDisplay = $derived.by(() => {
    const [y, m, d] = shiftDate.split('-');
    return `${d}.${m}.${y}`;
  });
  const kwDisplay = $derived.by(() => {
    const parsed = new Date(`${shiftDate}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? '–' : String(getWeekNumber(parsed));
  });

  // Lifecycle state
  let loading = $state(true);
  let saving = $state(false);
  let uploading = $state(false);
  let loadError = $state<string | null>(null);

  let entry = $state<ShiftHandoverEntry | null>(null);
  let templateFields = $state<ShiftHandoverFieldDef[]>([]);
  // Local mutable copies — flushed to backend on "Speichern" / "Abschließen".
  let protocolText = $state('');
  let customValues = $state<Record<string, unknown>>({});
  let attachments = $state<ShiftHandoverAttachment[]>([]);

  // For submitted entries the schema_snapshot — NOT the live template — is the
  // single source of truth for what to render (R2 drift-safety).
  const renderFields = $derived.by(() => {
    if (entry !== null && entry.status !== 'draft') {
      return entry.schema_snapshot;
    }
    return templateFields;
  });

  const hasEntry = $derived(entry !== null);
  const isSubmitted = $derived(entry?.status === 'submitted');
  const canEdit = $derived(!readOnly && !isSubmitted);
  const attachmentCount = $derived(attachments.length);
  const canUploadMore = $derived(canEdit && attachmentCount < MAX_ATTACHMENTS);

  $effect(() => {
    void loadOrCreateEntry();
  });

  async function loadOrCreateEntry(): Promise<void> {
    loading = true;
    loadError = null;
    try {
      const templateResult = await getTemplate(teamId);
      templateFields = templateResult.fields;

      // Read-only caller without an existing id = nothing to render (modal
      // will show the "no entry" alert).
      if (existingEntryId === null && readOnly) {
        return;
      }

      const loaded =
        existingEntryId !== null ?
          await getEntry(existingEntryId)
        : await getOrCreateDraft(teamId, shiftDate, shiftKey);
      applyEntry(loaded);
    } catch (err: unknown) {
      if (checkSessionExpired(err)) return;
      loadError = err instanceof Error ? err.message : 'Übergabe konnte nicht geladen werden.';
    } finally {
      loading = false;
    }
  }

  function applyEntry(loaded: ShiftHandoverEntry): void {
    entry = loaded;
    protocolText = loaded.protocol_text;
    customValues = { ...loaded.custom_values };
    // Attachments aren't returned inline on the entry endpoint — they'd
    // require a dedicated list call. V1: we render the freshly-uploaded
    // ones in memory after POSTing; historical attachments for an
    // existing entry would require an extra GET (deferred to V2 per plan
    // known-limitations — the modal starts with empty list for now).
    attachments = [];
  }

  function handleFieldChange(key: string, newValue: unknown): void {
    customValues = { ...customValues, [key]: newValue };
  }

  async function handleSaveDraft(): Promise<void> {
    if (entry === null || !canEdit) return;
    // Capture id before awaiting — `entry` is reassigned below; ESLint's
    // require-atomic-updates rule flags reading `entry.x` after an await
    // when the field is then written to.
    const entryId = entry.id;
    saving = true;
    try {
      const updated = await updateEntry(entryId, { protocolText, customValues });
      applyEntry(updated);
      onmutated();
      showSuccessAlert('Entwurf gespeichert.');
      onclose();
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
      const submitted = await submitEntry(entryId);
      applyEntry(submitted);
      onmutated();
      showSuccessAlert('Übergabe abgeschlossen.');
      onclose();
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

    const error = validateUpload(file);
    if (error !== null) {
      showErrorAlert(error);
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

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  aria-labelledby="shift-handover-modal-title"
  tabindex="-1"
  onclick={handleBackdropClick}
  onkeydown={(e) => {
    if (e.key === 'Escape') onclose();
  }}
>
  <div
    class="ds-modal ds-modal--lg"
    role="document"
  >
    <div class="ds-modal__header">
      <h2
        class="ds-modal__title flex items-center gap-3"
        id="shift-handover-modal-title"
      >
        <i class="fas fa-clipboard-list"></i>
        Schichtübergabe
        {#if isSubmitted}
          <span class="badge badge--success">Abgeschlossen</span>
        {:else if hasEntry}
          <span class="badge badge--warning">Entwurf</span>
        {/if}
      </h2>
      <button
        class="ds-modal__close"
        aria-label="Schließen"
        type="button"
        onclick={onclose}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="ds-modal__body">
      {#if loading}
        <div class="flex items-center justify-center gap-3 py-8">
          <div class="spinner-ring spinner-ring--md"></div>
          <span class="text-(--color-text-secondary)">Laden...</span>
        </div>
      {:else if loadError !== null}
        <div class="alert alert--danger">
          <i class="fas fa-exclamation-circle mr-2"></i>{loadError}
        </div>
      {:else if entry === null}
        <div class="alert alert--warning">
          <i class="fas fa-info-circle mr-2"></i>
          Für diese Schicht wurde keine Übergabe angelegt.
        </div>
      {:else}
        <!-- Meta block (read-only) -->
        <div class="meta-grid">
          <div>
            <span class="meta-label">Datum</span>
            <span class="meta-value">{dateDisplay} · KW {kwDisplay}</span>
          </div>
          <div>
            <span class="meta-label">Schicht</span>
            <span class="meta-value">{shiftLabel}</span>
          </div>
          <div>
            <span class="meta-label">{teamLabel}</span>
            <span class="meta-value">{teamName}</span>
          </div>
          <div>
            <span class="meta-label">Zugeteilt</span>
            <span class="meta-value">
              {assigneeNames.length === 0 ? 'Keine Zuordnung' : assigneeNames.join(', ')}
            </span>
          </div>
        </div>

        <!-- Protokoll -->
        <div class="form-field mt-4">
          <label
            class="form-field__label"
            for="shift-handover-protocol"
          >
            Protokoll
          </label>
          <textarea
            id="shift-handover-protocol"
            class="form-field__control"
            rows="5"
            placeholder="Freitext — Auffälligkeiten, offene Punkte, Übergaben …"
            disabled={!canEdit}
            value={protocolText}
            oninput={(e) => {
              protocolText = e.currentTarget.value;
            }}
          ></textarea>
        </div>

        <!-- Custom fields -->
        {#if renderFields.length > 0}
          <div class="custom-fields mt-4">
            <h3 class="meta-label u-uppercase mb-2">Zusatzfelder</h3>
            {#each renderFields as field (field.key)}
              <ShiftHandoverFieldRenderer
                {field}
                value={customValues[field.key]}
                disabled={!canEdit}
                onchange={(v) => {
                  handleFieldChange(field.key, v);
                }}
              />
            {/each}
          </div>
        {/if}

        <!-- Attachments -->
        <div class="attachments mt-4">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="meta-label u-uppercase">Anhänge ({attachmentCount}/{MAX_ATTACHMENTS})</h3>
            {#if canUploadMore}
              <label class="btn btn-cancel attach-btn">
                <i class="fas fa-upload mr-2"></i>
                {uploading ? 'Hochladen …' : 'Bild hinzufügen'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  class="attach-input"
                  disabled={uploading}
                  onchange={handleFileSelected}
                />
              </label>
            {/if}
          </div>
          {#if attachments.length === 0}
            <p class="u-fs-12 text-(--color-text-secondary)">Keine Anhänge hochgeladen.</p>
          {:else}
            <div class="attach-grid">
              {#each attachments as att (att.id)}
                <figure class="attach-tile">
                  <img
                    src={attachmentUrl(att.entry_id, att.id)}
                    alt={att.file_name}
                    loading="lazy"
                  />
                  {#if canEdit}
                    <button
                      type="button"
                      class="attach-delete"
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
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}
      >
        {canEdit ? 'Abbrechen' : 'Schließen'}
      </button>
      {#if canEdit && entry !== null}
        <button
          type="button"
          class="btn btn-secondary"
          disabled={saving}
          onclick={() => {
            void handleSaveDraft();
          }}
        >
          <i class="fas fa-save mr-2"></i>
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
          <i class="fas fa-check mr-2"></i>
          Übergabe abschließen
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-3);
  }

  .meta-label {
    display: block;
    color: var(--color-text-secondary);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.05em;
  }

  .u-uppercase {
    text-transform: uppercase;
  }

  .u-fs-12 {
    font-size: 12px;
  }

  .meta-value {
    display: block;
    margin-top: 2px;
    color: var(--text-primary);
    font-weight: 500;
    font-size: 13px;
  }

  .custom-fields :global(.form-field) {
    margin-bottom: var(--spacing-3);
  }

  .attach-btn {
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }

  .attach-input {
    position: absolute;
    top: 0;
    left: 0;
    opacity: 0%;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  .attach-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--spacing-3);
  }

  .attach-tile {
    display: flex;

    position: relative;
    flex-direction: column;
    overflow: hidden;

    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-lg);
    background: var(--glass-bg);

    margin: 0;
  }

  .attach-tile img {
    display: block;
    background: var(--glass-bg-hover);
    width: 100%;
    height: 90px;
    object-fit: cover;
  }

  .attach-tile figcaption {
    padding: 4px 6px;
    color: var(--text-secondary);
    overflow: hidden;
    font-size: 11px;

    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .attach-delete {
    display: flex;
    position: absolute;
    top: 4px;
    right: 4px;
    justify-content: center;
    align-items: center;

    cursor: pointer;
    border: 1px solid var(--color-danger);
    border-radius: 50%;
    background: color-mix(in oklch, var(--color-danger) 30%, transparent);
    padding: 0;

    width: 20px;
    height: 20px;
    color: var(--color-white);

    font-size: 10px;
  }
</style>
