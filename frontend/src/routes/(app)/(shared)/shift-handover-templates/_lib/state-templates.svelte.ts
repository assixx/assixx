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
 * Validation strategy (R7 mitigation, post-2026-04-23 ADR-030 compliance):
 *   - Per-field structural checks produce inline German error messages
 *     keyed by `_uid` so the UI can highlight the offending row.
 *   - Cross-field (duplicate keys) is also computed locally so the UI can
 *     mark BOTH duplicates.
 *   - Backend Zod (`ShiftHandoverTemplateFieldsSchema` in
 *     `backend/src/nest/shift-handover/field-validators.ts`) is the
 *     authoritative validator on save: invalid payloads return 400 with
 *     `details[]` that the UI surfaces. Per ADR-030 §7 (Spec Deviation #8
 *     in the masterplan) Zod stays backend-only — the client mirrors the
 *     same invariants here in TypeScript so the UX feedback loop is
 *     instant without shipping the validator runtime to the browser.
 *
 * Architecture:
 *   - Top-level helpers (pure or array-mutating) hold the work, so the
 *     factory itself stays under the 60-LOC ESLint cap and reads as a thin
 *     dispatcher to the helpers + reactive accessors.
 *
 * @see docs/infrastructure/adr/ADR-030-zod-validation-architecture.md §7
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.2 + §R7
 */
import type {
  ShiftHandoverFieldDef,
  ShiftHandoverFieldOption,
  ShiftHandoverFieldType,
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
 *
 * May return `''` for pathological labels (digits-only, symbols-only). Callers
 * that need a guaranteed-valid key use `deriveUniqueKey()` which supplies the
 * `'feld'` fallback + duplicate disambiguation (Session 19).
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

/**
 * Derive a key guaranteed to (a) match `KEY_REGEX` and (b) be unique among
 * the current working fields excluding `selfUid`.
 *
 * Rationale: the Schlüssel input was removed from `FieldBuilder` (Session 19)
 * because end-users were confused by a column-identifier control they have no
 * mental model for. Without a manual escape hatch, the auto-derive path MUST
 * handle both degenerate cases itself — otherwise a duplicate label silently
 * blocks `canSave` via `findDuplicateKeys` with no UI affordance to resolve.
 *
 * Strategy:
 *   1. Base = `deriveKey(label)` — pathological labels (digits/symbols only)
 *      fall back to `'feld'` (German "field").
 *   2. If base is free, use it. Else append `_2`, `_3`, … capped at 999.
 *   3. Suffixed candidates respect `KEY_MAX_LENGTH` — we trim the base BEFORE
 *      appending so the suffix is always preserved.
 *
 * Legacy templates load with `_keyTouched=true` (see `inflateField`) so this
 * function is never called for server-persisted fields — existing manual keys
 * stay canonical and the schema_snapshot contract (R2) is untouched.
 */
function deriveUniqueKey(label: string, fields: readonly WorkingField[], selfUid: string): string {
  const raw = deriveKey(label);
  const base = raw === '' ? 'feld' : raw;
  const taken = new Set(fields.filter((f) => f._uid !== selfUid).map((f) => f.key));
  if (!taken.has(base)) return base;
  for (let n = 2; n <= 999; n++) {
    const suffix = `_${n}`;
    const trimmed = base.slice(0, KEY_MAX_LENGTH - suffix.length);
    const candidate = `${trimmed}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Should never happen (would require 998 identical labels). If it does,
  // let `findDuplicateKeys` surface the collision so backend Zod rejects.
  return base;
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

/**
 * Compute the full validation state.
 *
 * Per-field + cross-field invariants are mirrored in
 * `backend/src/nest/shift-handover/field-validators.ts` (Zod). Backend
 * is authoritative on save — see ADR-030 §7 + Spec Deviation #8 in the
 * masterplan. Local checks here exist only to give instant feedback in
 * the builder UI without shipping Zod to the browser.
 */
function computeValidation(fields: readonly WorkingField[]): ValidationState {
  const perField = new Map<string, FieldErrors>();
  for (const f of fields) {
    const errors = validateField(f);
    if (Object.keys(errors).length > 0) perField.set(f._uid, errors);
  }
  applyDuplicateMarkers(perField, fields, findDuplicateKeys(fields));

  const global: string | null =
    fields.length > FIELDS_MAX ? `Maximal ${FIELDS_MAX} Felder pro Vorlage.` : null;

  return { ok: perField.size === 0 && global === null, perField, global };
}

/**
 * Serialize a field definition with deterministic key order so the
 * `JSON.stringify`-based equality check in `isDirty` doesn't falsely
 * diverge when the two sides have different key-insertion orders.
 *
 * Why it's needed (Session 19 smoke-test finding): PostgreSQL `jsonb`
 * stores object keys sorted by length-then-alphabetic, so a field that
 * was saved as `{key, label, required, type}` returns on next load as
 * `{key, type, label, required}`. `cleanField` produces our original
 * insertion order → raw `JSON.stringify` diverges → `dirty=true` on
 * initial render, showing "Ungespeicherte Änderungen" before the user
 * has touched anything. Same issue on `ShiftHandoverFieldOption`
 * (`{value, label}` on save, `{label, value}` after jsonb round-trip).
 */
function canonicalize(f: ShiftHandoverFieldDef): string {
  if (f.type === 'select') {
    return JSON.stringify({
      type: 'select',
      key: f.key,
      label: f.label,
      required: f.required,
      options: f.options.map((o) => ({ value: o.value, label: o.label })),
    });
  }
  return JSON.stringify({
    type: f.type,
    key: f.key,
    label: f.label,
    required: f.required,
  });
}

function isDirty(
  fields: readonly WorkingField[],
  initial: readonly ShiftHandoverFieldDef[],
): boolean {
  if (fields.length !== initial.length) return true;
  // Length-equal precondition above guarantees `initial[i]` is defined for
  // every i in bounds, so no per-slot undefined guard is needed here.
  return fields.some((f, i) => canonicalize(cleanField(f)) !== canonicalize(initial[i]));
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
  // `deriveUniqueKey` supplies `'feld'` fallback + duplicate disambiguation —
  // required because the Schlüssel input was hidden in Session 19 (end-user
  // confusion), so users no longer have a manual escape hatch for collisions
  // or degenerate labels. Legacy fields load with `_keyTouched=true` and are
  // never retouched here — schema_snapshot contract (R2) stays intact.
  if (!f._keyTouched) f.key = deriveUniqueKey(label, fields, uid);
}

// Note: `setKey`/`updateKey` removed in Session 19 when the Schlüssel input
// was hidden. Keys are auto-derived from labels via `deriveUniqueKey` and no
// longer user-editable from the template builder. Server-loaded fields keep
// their manual keys via `_keyTouched=true` set in `inflateField`.

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
  // `updateKey` removed in Session 19 — keys are auto-derived.
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
