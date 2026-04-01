<script lang="ts">
  /**
   * RevisionDiff — Shows before/after diff for changed fields between two revisions.
   */
  import type { TpmPlanRevision } from './types';

  const WEEKDAY_NAMES = [
    'Sonntag',
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag',
  ];

  interface FieldDef {
    dbColumn: string;
    apiField: keyof TpmPlanRevision;
    label: string;
  }

  const FIELDS: FieldDef[] = [
    { dbColumn: 'name', apiField: 'name', label: 'Name' },
    { dbColumn: 'base_weekday', apiField: 'baseWeekday', label: 'Basistag' },
    { dbColumn: 'base_repeat_every', apiField: 'baseRepeatEvery', label: 'Wiederholung' },
    { dbColumn: 'base_time', apiField: 'baseTime', label: 'Basiszeit' },
    { dbColumn: 'buffer_hours', apiField: 'bufferHours', label: 'Pufferzeit (Std)' },
    { dbColumn: 'notes', apiField: 'notes', label: 'Notizen' },
    { dbColumn: 'asset_id', apiField: 'assetId', label: 'Anlage' },
  ];

  interface Props {
    current: TpmPlanRevision;
    previous: TpmPlanRevision;
  }

  const { current, previous }: Props = $props();

  function formatFieldValue(def: FieldDef, raw: string | number | null): string {
    if (raw === null) return '—';
    const str = String(raw);
    if (def.dbColumn === 'base_weekday') return WEEKDAY_NAMES[Number(raw)] ?? str;
    if (def.dbColumn === 'base_time') return str.length > 5 ? str.slice(0, 5) : str;
    if (def.dbColumn === 'buffer_hours') return `${str} Std`;
    if (def.dbColumn === 'base_repeat_every') return `${str}. Wochentag`;
    if (def.dbColumn === 'notes') return str.length > 80 ? `${str.slice(0, 80)}...` : str;
    return str;
  }

  function getVal(rev: TpmPlanRevision, field: keyof TpmPlanRevision): string | number | null {
    const v = rev[field];
    if (typeof v === 'string' || typeof v === 'number') return v;
    return null;
  }

  const changedEntries = $derived(
    current.changedFields
      .map((dbCol: string) => {
        const def = FIELDS.find((f) => f.dbColumn === dbCol);
        if (def === undefined) return null;
        return {
          label: def.label,
          oldValue: formatFieldValue(def, getVal(previous, def.apiField)),
          newValue: formatFieldValue(def, getVal(current, def.apiField)),
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null),
  );
</script>

{#if changedEntries.length > 0}
  <table class="diff-table">
    <thead>
      <tr>
        <th>Feld</th>
        <th>v{previous.revisionNumber} (vorher)</th>
        <th>v{current.revisionNumber} (nachher)</th>
      </tr>
    </thead>
    <tbody>
      {#each changedEntries as entry (entry.label)}
        <tr>
          <td class="diff-field">{entry.label}</td>
          <td class="diff-old">{entry.oldValue}</td>
          <td class="diff-new">{entry.newValue}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  .diff-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    margin-top: 0.5rem;
  }

  .diff-table th {
    text-align: left;
    padding: 0.375rem 0.625rem;
    color: var(--color-text-muted);
    font-weight: 500;
    font-size: 0.75rem;
    border-bottom: 1px solid var(--glass-border);
  }

  .diff-table td {
    padding: 0.375rem 0.625rem;
    border-bottom: 1px solid var(--glass-border);
  }

  .diff-field {
    font-weight: 500;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .diff-old {
    color: var(--color-error, #e53e3e);
    text-decoration: line-through;
    opacity: 70%;
  }

  .diff-new {
    color: var(--color-success, #38a169);
    font-weight: 500;
  }
</style>
