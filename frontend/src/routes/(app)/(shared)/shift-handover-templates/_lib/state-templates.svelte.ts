/**
 * Shift-Handover Template Builder — Reactive working state.
 *
 * Factory pattern (matches `shifts/_lib/state-handover.svelte.ts` from §5.1) so
 * each page-instance owns its own reactive scope — no module-level `$state`
 * which would leak across users in SSR contexts.
 *
 * Working-vs-clean shape:
 *   - `WorkingField` carries UI-only fields `_uid` (stable {#each} key for
 *     reorder/remove) and `_keyTouched` (auto-derive label→key only until
 *     the user manually edits the key).
 *   - `getCleanFields()` strips the `_*` props and returns the persisted
 *     `ShiftHandoverFieldDef[]` shape that the backend Zod schema accepts.
 *
 * Validation strategy (R7 mitigation):
 *   - Per-field structural checks produce inline German error messages
 *     keyed by `_uid` so the UI can highlight the offending row.
 *   - Cross-field (duplicate keys) is also computed locally so the UI can
 *     mark BOTH duplicates, not just the index returned by Zod.
 *   - When all per-field/cross-field checks pass, the SHARED schema
 *     (`ShiftHandoverTemplateFieldsSchema`) runs as the canonical gate so
 *     drift between client and backend is impossible.
 *
 * Architecture:
 *   - Top-level helpers (pure or array-mutating) hold the work, so the
 *     factory itself stays under the 60-LOC ESLint cap and reads as a thin
 *     dispatcher to the helpers + reactive accessors.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.2 + §R7
 */
import {
  ShiftHandoverTemplateFieldsSchema,
  type ShiftHandoverFieldDef,
  type ShiftHandoverFieldOption,
  type ShiftHandoverFieldType,
} from '@assixx/shared/shift-handover';

const KEY_REGEX = /^[a-z][a-z0-9_]*$/;
const KEY_MAX_LENGTH = 30;
const FIELDS_MAX = 30;

export interface WorkingField {
  _uid: string;
  _keyTouched: boolean;
  type: ShiftHandoverFieldType;
  key: string;
  label: string;
  required: boolean;
  // Empty for non-select types; populated for `select`.
  options: ShiftHandoverFieldOption[];
}

export interface FieldErrors {
  key?: string;
  label?: string;
  options?: string;
}

export interface ValidationState {
  ok: boolean;
  /** Per-field errors keyed by `_uid`. */
  perField: Map<string, FieldErrors>;
  /** Cross-cutting message shown above the list (e.g., max-30). */
  global: string | null;
}

// ── Pure helpers ────────────────────────────────────────────────────────────

function newUid(): string {
  return crypto.randomUUID();
}

/**
 * Derive a DB-column-safe key from a German label.
 * Umlauts → ASCII expansion (ä→ae) per project convention; everything else
 * collapses to `_`. Result matches the shared `KEY_REGEX`.
 */
function deriveKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, KEY_MAX_LENGTH);
}

function cleanField(w: WorkingField): ShiftHandoverFieldDef {
  if (w.type === 'select') {
    return {
      key: w.key,
      label: w.label,
      required: w.required,
      type: 'select',
      options: w.options,
    };
  }
  return { key: w.key, label: w.label, required: w.required, type: w.type };
}

function inflateField(f: ShiftHandoverFieldDef): WorkingField {
  return {
    _uid: newUid(),
    _keyTouched: true, // server-loaded keys are canonical — never auto-rewrite
    type: f.type,
    key: f.key,
    label: f.label,
    required: f.required,
    options: f.type === 'select' ? f.options : [],
  };
}

function defaultsForType(type: ShiftHandoverFieldType): WorkingField {
  return {
    _uid: newUid(),
    _keyTouched: false,
    type,
    key: '',
    label: '',
    required: false,
    options: type === 'select' ? [{ value: 'option_1', label: 'Option 1' }] : [],
  };
}

// ── Validation helpers ──────────────────────────────────────────────────────

/** Per-field structural validation — German UI strings. */
function validateField(f: WorkingField): FieldErrors {
  const errors: FieldErrors = {};
  if (f.label.trim() === '') {
    errors.label = 'Bezeichnung darf nicht leer sein.';
  }
  if (f.key === '') {
    errors.key = 'Schlüssel darf nicht leer sein.';
  } else if (!KEY_REGEX.test(f.key)) {
    errors.key = 'Schlüssel: nur a–z, 0–9, _ — Anfang Kleinbuchstabe.';
  } else if (f.key.length > KEY_MAX_LENGTH) {
    errors.key = `Schlüssel max. ${KEY_MAX_LENGTH} Zeichen.`;
  }
  if (f.type === 'select' && f.options.length === 0) {
    errors.options = 'Mindestens eine Option erforderlich.';
  }
  return errors;
}

/** Returns the set of keys that appear more than once across `fields`. */
function findDuplicateKeys(fields: readonly WorkingField[]): Set<string> {
  const counts = new Map<string, number>();
  for (const f of fields) {
    if (f.key === '') continue; // empty key already flagged per-field
    counts.set(f.key, (counts.get(f.key) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [key, n] of counts) {
    if (n > 1) dupes.add(key);
  }
  return dupes;
}

function applyDuplicateMarkers(
  perField: Map<string, FieldErrors>,
  fields: readonly WorkingField[],
  dupes: Set<string>,
): void {
  if (dupes.size === 0) return;
  for (const f of fields) {
    if (!dupes.has(f.key)) continue;
    const existing = perField.get(f._uid) ?? {};
    existing.key = `Schlüssel "${f.key}" mehrfach vorhanden.`;
    perField.set(f._uid, existing);
  }
}

/** Final canonical gate via the SHARED schema (R7 mitigation). */
function runSchemaGate(fields: readonly WorkingField[]): string | null {
  const result = ShiftHandoverTemplateFieldsSchema.safeParse(fields.map(cleanField));
  if (result.success) return null;
  return result.error.issues[0]?.message ?? 'Validierung fehlgeschlagen.';
}

function computeValidation(fields: readonly WorkingField[]): ValidationState {
  const perField = new Map<string, FieldErrors>();
  for (const f of fields) {
    const errors = validateField(f);
    if (Object.keys(errors).length > 0) perField.set(f._uid, errors);
  }
  applyDuplicateMarkers(perField, fields, findDuplicateKeys(fields));

  let global: string | null = null;
  if (fields.length > FIELDS_MAX) global = `Maximal ${FIELDS_MAX} Felder pro Vorlage.`;
  if (perField.size === 0 && global === null) global = runSchemaGate(fields);

  return { ok: perField.size === 0 && global === null, perField, global };
}

function isDirty(
  fields: readonly WorkingField[],
  initial: readonly ShiftHandoverFieldDef[],
): boolean {
  if (fields.length !== initial.length) return true;
  return fields.some((f, i) => JSON.stringify(cleanField(f)) !== JSON.stringify(initial[i]));
}

// ── Mutator helpers (operate on the live $state array via reference) ────────

function findField(fields: readonly WorkingField[], uid: string): WorkingField | undefined {
  return fields.find((x) => x._uid === uid);
}

function setLabel(fields: WorkingField[], uid: string, label: string): void {
  const f = findField(fields, uid);
  if (f === undefined) return;
  f.label = label;
  // Auto-derive key only while the user hasn't manually touched it.
  if (!f._keyTouched) f.key = deriveKey(label);
}

function setKey(fields: WorkingField[], uid: string, key: string): void {
  const f = findField(fields, uid);
  if (f === undefined) return;
  f.key = key;
  f._keyTouched = true;
}

function setRequired(fields: WorkingField[], uid: string, required: boolean): void {
  const f = findField(fields, uid);
  if (f === undefined) return;
  f.required = required;
}

function setType(fields: WorkingField[], uid: string, type: ShiftHandoverFieldType): void {
  const f = findField(fields, uid);
  if (f === undefined) return;
  f.type = type;
  // Switching INTO select: seed one option so the row is immediately valid.
  if (type === 'select' && f.options.length === 0) {
    f.options = [{ value: 'option_1', label: 'Option 1' }];
  }
}

function pushOption(fields: WorkingField[], uid: string): void {
  const f = findField(fields, uid);
  if (f === undefined) return;
  const idx = f.options.length + 1;
  f.options.push({ value: `option_${idx}`, label: `Option ${idx}` });
}

function setOption(
  fields: WorkingField[],
  uid: string,
  idx: number,
  partial: { value?: string; label?: string },
): void {
  const f = findField(fields, uid);
  if (f === undefined) return;
  const opt = f.options[idx];
  if (partial.value !== undefined) opt.value = partial.value;
  if (partial.label !== undefined) opt.label = partial.label;
}

function spliceOption(fields: WorkingField[], uid: string, idx: number): void {
  const f = findField(fields, uid);
  if (f === undefined) return;
  f.options.splice(idx, 1);
}

function spliceField(fields: WorkingField[], uid: string): void {
  const idx = fields.findIndex((x) => x._uid === uid);
  if (idx >= 0) fields.splice(idx, 1);
}

function reorderField(fields: WorkingField[], fromIdx: number, toIdx: number): void {
  if (fromIdx === toIdx) return;
  if (fromIdx < 0 || fromIdx >= fields.length) return;
  if (toIdx < 0 || toIdx >= fields.length) return;
  const [moved] = fields.splice(fromIdx, 1);
  fields.splice(toIdx, 0, moved);
}

// ── Factory ─────────────────────────────────────────────────────────────────

export interface TemplateBuilderState {
  readonly fields: WorkingField[];
  readonly initial: ShiftHandoverFieldDef[];
  readonly dirty: boolean;
  readonly validation: ValidationState;
  readonly canSave: boolean;
  setInitial(fields: ShiftHandoverFieldDef[]): void;
  addField(type: ShiftHandoverFieldType): void;
  updateLabel(uid: string, label: string): void;
  updateKey(uid: string, key: string): void;
  updateRequired(uid: string, required: boolean): void;
  updateType(uid: string, type: ShiftHandoverFieldType): void;
  addOption(uid: string): void;
  updateOption(uid: string, idx: number, partial: { value?: string; label?: string }): void;
  removeOption(uid: string, idx: number): void;
  removeField(uid: string): void;
  moveField(fromIdx: number, toIdx: number): void;
  getCleanFields(): ShiftHandoverFieldDef[];
  markSaved(): void;
}

/**
 * Accessor bag for the factory's reactive $state bindings.
 *
 * Closure form is load-bearing: the `fields` binding is reassigned by
 * `setInitial` (→ new array = new Svelte proxy), so mutator methods must
 * always read the LIVE binding via `getFields()` rather than a captured
 * reference from call-time. Same reasoning for `initial`.
 */
interface BuilderAccessors {
  getFields: () => WorkingField[];
  setFields: (value: WorkingField[]) => void;
  setInitial: (value: ShiftHandoverFieldDef[]) => void;
}

/**
 * Extracted from `createTemplateBuilderState` to keep the factory under the
 * 60-LOC ESLint cap (ADR-041 / CODE-OF-CONDUCT). Each method is a thin wrapper
 * over a top-level mutator helper defined earlier in this file; the helpers
 * own the array-mutation semantics, this layer only bridges the factory's
 * `$state` closure into them.
 */
function buildTemplateBuilderMutators(
  acc: BuilderAccessors,
): Omit<TemplateBuilderState, 'fields' | 'initial' | 'dirty' | 'validation' | 'canSave'> {
  return {
    setInitial(newFields) {
      acc.setInitial(newFields);
      acc.setFields(newFields.map(inflateField));
    },
    addField(type) {
      acc.getFields().push(defaultsForType(type));
    },
    updateLabel(uid, label) {
      setLabel(acc.getFields(), uid, label);
    },
    updateKey(uid, key) {
      setKey(acc.getFields(), uid, key);
    },
    updateRequired(uid, required) {
      setRequired(acc.getFields(), uid, required);
    },
    updateType(uid, type) {
      setType(acc.getFields(), uid, type);
    },
    addOption(uid) {
      pushOption(acc.getFields(), uid);
    },
    updateOption(uid, idx, partial) {
      setOption(acc.getFields(), uid, idx, partial);
    },
    removeOption(uid, idx) {
      spliceOption(acc.getFields(), uid, idx);
    },
    removeField(uid) {
      spliceField(acc.getFields(), uid);
    },
    moveField(fromIdx, toIdx) {
      reorderField(acc.getFields(), fromIdx, toIdx);
    },
    getCleanFields() {
      return acc.getFields().map(cleanField);
    },
    markSaved() {
      const clean = acc.getFields().map(cleanField);
      acc.setInitial(clean);
      // Server-saved keys are now canonical — block auto-derive on subsequent
      // label edits so we don't silently rename persisted columns.
      for (const f of acc.getFields()) f._keyTouched = true;
    },
  };
}

export function createTemplateBuilderState(): TemplateBuilderState {
  let fields = $state<WorkingField[]>([]);
  let initial = $state<ShiftHandoverFieldDef[]>([]);
  const validation = $derived(computeValidation(fields));
  const dirty = $derived(isDirty(fields, initial));
  const canSave = $derived(dirty && validation.ok);

  const mutators = buildTemplateBuilderMutators({
    getFields: () => fields,
    setFields: (value) => {
      fields = value;
    },
    setInitial: (value) => {
      initial = value;
    },
  });

  return {
    get fields() {
      return fields;
    },
    get initial() {
      return initial;
    },
    get dirty() {
      return dirty;
    },
    get validation() {
      return validation;
    },
    get canSave() {
      return canSave;
    },
    ...mutators,
  };
}
