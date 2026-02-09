<script lang="ts">
  /**
   * Blackboard Edit Modal - Smart Component
   *
   * Self-contained edit modal that:
   * - Loads organization data (departments/teams/areas) on mount
   * - Manages form state internally
   * - Handles save logic
   *
   * Usage: <BlackboardEditModal {entry} onclose={...} onsaved={...} />
   */
  import { onMount, untrack } from 'svelte';

  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  import '../../../../../styles/blackboard.css';

  import { uploadAttachment } from './api';
  import BlackboardEntryModal from './BlackboardEntryModal.svelte';

  import type {
    BlackboardEntry,
    Priority,
    EntryColor,
    Department,
    Team,
    Area,
  } from './types';

  const log = createLogger('BlackboardEditModal');
  const apiClient = getApiClient();

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    /** Entry to edit */
    entry: BlackboardEntry;
    /** Called when modal is closed */
    onclose: () => void;
    /** Called after successful save (triggers data refresh) */
    onsaved: () => void;
  }

  const { entry, onclose, onsaved }: Props = $props();

  // =============================================================================
  // ORGANIZATION DATA STATE (loaded on mount)
  // =============================================================================

  let departments = $state<Department[]>([]);
  let teams = $state<Team[]>([]);
  let areas = $state<Area[]>([]);
  let orgDataLoading = $state(true);

  // =============================================================================
  // FORM STATE (untrack: intentionally capture initial entry values only)
  // =============================================================================

  let formTitle = $state(untrack(() => entry.title));
  let formContent = $state(untrack(() => entry.content));
  let formPriority = $state<Priority>(untrack(() => entry.priority));
  let formColor = $state<EntryColor>(untrack(() => entry.color));
  let formExpiresAt = $state(
    untrack(() => fromIso8601ToDateInput(entry.expiresAt)),
  );
  let formCompanyWide = $state(untrack(() => entry.orgLevel === 'company'));
  let formDepartmentIds = $state<number[]>(
    untrack(() => entry.departmentIds ?? []),
  );
  let formTeamIds = $state<number[]>(untrack(() => entry.teamIds ?? []));
  let formAreaIds = $state<number[]>(untrack(() => entry.areaIds ?? []));
  let attachmentFiles = $state<File[] | null>(null);

  // =============================================================================
  // HELPERS
  // =============================================================================

  /**
   * Convert YYYY-MM-DD to ISO 8601 format (end of day in LOCAL timezone)
   */
  function toIso8601EndOfDay(dateStr: string): string | null {
    if (dateStr === '' || dateStr.length === 0) return null;
    const localEndOfDay = new Date(`${dateStr}T23:59:59`);
    return localEndOfDay.toISOString();
  }

  /**
   * Convert ISO 8601 date to YYYY-MM-DD for HTML date input
   */
  function fromIso8601ToDateInput(isoDate: string | null | undefined): string {
    if (isoDate === null || isoDate === undefined || isoDate === '') return '';
    return isoDate.substring(0, 10);
  }

  // =============================================================================
  // LOAD ORGANIZATION DATA
  // =============================================================================

  async function loadOrgData(): Promise<void> {
    try {
      const [deptData, teamData, areaData] = await Promise.all([
        apiClient.get<Department[] | { data?: Department[] }>('/departments'),
        apiClient.get<Team[] | { data?: Team[] }>('/teams'),
        apiClient.get<Area[] | { data?: Area[] }>('/areas'),
      ]);

      departments = Array.isArray(deptData) ? deptData : (deptData.data ?? []);
      teams = Array.isArray(teamData) ? teamData : (teamData.data ?? []);
      areas = Array.isArray(areaData) ? areaData : (areaData.data ?? []);
    } catch (err) {
      log.error({ err }, 'Failed to load organization data');
      showErrorAlert('Fehler beim Laden der Organisationsdaten');
    } finally {
      orgDataLoading = false;
    }
  }

  onMount(() => {
    void loadOrgData();
  });

  // =============================================================================
  // SAVE LOGIC
  // =============================================================================

  function buildEntryPayload(): Record<string, unknown> {
    const orgIds =
      formCompanyWide ?
        { departmentIds: [], teamIds: [], areaIds: [] }
      : {
          departmentIds: formDepartmentIds,
          teamIds: formTeamIds,
          areaIds: formAreaIds,
        };

    return {
      title: formTitle,
      content: formContent,
      priority: formPriority,
      color: formColor,
      expiresAt: toIso8601EndOfDay(formExpiresAt),
      ...orgIds,
    };
  }

  async function uploadAttachments(entryId: number): Promise<void> {
    if (attachmentFiles === null || attachmentFiles.length === 0) return;

    for (const file of attachmentFiles) {
      try {
        await uploadAttachment(entryId, file);
      } catch (uploadErr) {
        log.error({ err: uploadErr, fileName: file.name }, 'Failed to upload');
        showErrorAlert(`Fehler beim Hochladen von ${file.name}`);
      }
    }
  }

  async function saveEntry(): Promise<void> {
    try {
      const payload = buildEntryPayload();
      await apiClient.put(`/blackboard/entries/${entry.id}`, payload);

      await uploadAttachments(entry.id);

      showSuccessAlert('Eintrag aktualisiert');
      onsaved();
      onclose();
    } catch (err) {
      log.error({ err }, 'Error saving entry');
      showErrorAlert(
        err instanceof Error ? err.message : 'Fehler beim Speichern',
      );
    }
  }

  function handleSubmit(e: Event): void {
    e.preventDefault();
    void saveEntry();
  }
</script>

{#if orgDataLoading}
  <!-- Loading overlay while fetching org data -->
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
  >
    <div class="ds-modal ds-modal--sm">
      <div class="ds-modal__body p-8 text-center">
        <div class="spinner-ring spinner-ring--lg"></div>
        <p class="mt-4 text-(--color-text-secondary)">Lade Daten...</p>
      </div>
    </div>
  </div>
{:else}
  <BlackboardEntryModal
    mode="edit"
    title={formTitle}
    content={formContent}
    priority={formPriority}
    color={formColor}
    expiresAt={formExpiresAt}
    companyWide={formCompanyWide}
    departmentIds={formDepartmentIds}
    teamIds={formTeamIds}
    areaIds={formAreaIds}
    {attachmentFiles}
    {departments}
    {teams}
    {areas}
    {onclose}
    onsubmit={handleSubmit}
    ontitlechange={(v: string) => (formTitle = v)}
    oncontentchange={(v: string) => (formContent = v)}
    onprioritychange={(v: Priority) => (formPriority = v)}
    oncolorchange={(v: EntryColor) => (formColor = v)}
    onexpireschange={(v: string) => (formExpiresAt = v)}
    oncompanywidechange={(v: boolean) => (formCompanyWide = v)}
    ondepartmentschange={(v: number[]) => (formDepartmentIds = v)}
    onteamschange={(v: number[]) => (formTeamIds = v)}
    onareaschange={(v: number[]) => (formAreaIds = v)}
    onfileschange={(v: File[] | null) => (attachmentFiles = v)}
  />
{/if}
