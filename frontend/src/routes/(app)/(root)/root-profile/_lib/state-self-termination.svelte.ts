/**
 * Self-termination reactive state for /root-profile.
 *
 * Why a `.svelte.ts` module instead of inline `+page.svelte` `$state`:
 * the cooldown extraction (D10 — timestamp embedded in error message)
 * and the post-action error routing are non-trivial. Extracting keeps
 * the host page under the 850-line ESLint cap and makes the cooldown
 * regex independently testable.
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §5.1
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md Spec Deviation D10
 */
import { invalidateAll } from '$app/navigation';

import { ApiError } from '$lib/utils/api-client.types';
import { createLogger } from '$lib/utils/logger';

import { cancelOwnSelfTermination as apiCancel, requestSelfTermination as apiRequest } from './api';
import { SELF_TERMINATION_MESSAGES } from './constants';
import { showToast } from './utils';

import type { SelfTerminationRequest } from './types';

const log = createLogger('SelfTerminationState');

/** ISO-8601 timestamp regex (matches the format `RootSelfTerminationService`
 *  embeds in `ConflictException(COOLDOWN_ACTIVE)`'s message body — D10). */
const ISO_TIMESTAMP_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/;

/** Backend error codes the frontend reacts to (subset of
 *  `ROOT_SELF_TERMINATION_CODES` in the service). */
export const ERROR_CODES = {
  LAST_ROOT_PROTECTION: 'ROOT_LAST_ROOT_PROTECTION',
  COOLDOWN_ACTIVE: 'ROOT_REQUEST_COOLDOWN_ACTIVE',
  ALREADY_PENDING: 'ALREADY_PENDING',
} as const;

/**
 * Extract the cooldown end timestamp from an ApiError's message body.
 * Returns null when the regex doesn't match (defensive — backend wording
 * may shift between versions).
 *
 * Mirrors the regex used in `backend/test/root-self-termination.api.test.ts`
 * (Session 8, T14) so frontend + tests share one source of truth.
 */
export function parseCooldownFromError(err: unknown): Date | null {
  if (!(err instanceof ApiError)) return null;
  const match = ISO_TIMESTAMP_REGEX.exec(err.message);
  if (match === null) return null;
  const parsed = new Date(match[0]);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Reactive holder for self-termination state on `/root-profile`.
 *
 * Initialised from SSR data (`pending`) and mutated by user actions.
 * `cooldownEndsAt` and `lastRootBlocked` are populated REACTIVELY when
 * the backend rejects a request — there is no upfront endpoint that
 * exposes "are you in cooldown" or "are you the last root" without a
 * write attempt.
 */
export interface SelfTerminationState {
  /** Current pending request, or null. */
  readonly pending: SelfTerminationRequest | null;
  /** Cooldown end (set after a 409 COOLDOWN_ACTIVE response). */
  readonly cooldownEndsAt: Date | null;
  /** True when the backend rejected with LAST_ROOT_PROTECTION. */
  readonly lastRootBlocked: boolean;
  /** Submit-in-flight flag for spinner / disabled buttons. */
  readonly submitting: boolean;
  /** Open/close flag for the confirmation modal. */
  modalOpen: boolean;
  request(reason: string | null): Promise<void>;
  cancel(): Promise<void>;
  openModal(): void;
  closeModal(): void;
}

/**
 * Mutator surface used by the module-level `performRequest` /
 * `performCancel` helpers. Extracted so the helpers can live outside
 * `createSelfTerminationState` and keep the factory function under the
 * 60-line `max-lines-per-function` cap.
 */
interface Mutators {
  setPending(v: SelfTerminationRequest | null): void;
  setCooldownEndsAt(v: Date | null): void;
  setLastRootBlocked(v: boolean): void;
  setSubmitting(v: boolean): void;
  setModalOpen(v: boolean): void;
}

/** Map an ApiError's `code` to the matching state mutation + toast. */
function handleRequestError(err: unknown, m: Mutators): void {
  if (err instanceof ApiError) {
    if (err.code === ERROR_CODES.LAST_ROOT_PROTECTION) {
      m.setLastRootBlocked(true);
      showToast(SELF_TERMINATION_MESSAGES.toastErrorLastRoot, 'error');
      return;
    }
    if (err.code === ERROR_CODES.COOLDOWN_ACTIVE) {
      const parsed = parseCooldownFromError(err);
      if (parsed !== null) m.setCooldownEndsAt(parsed);
      showToast(SELF_TERMINATION_MESSAGES.toastErrorCooldown, 'error');
      return;
    }
    if (err.code === ERROR_CODES.ALREADY_PENDING) {
      showToast(SELF_TERMINATION_MESSAGES.toastErrorAlreadyPending, 'error');
      return;
    }
  }
  log.error({ err }, 'Self-termination request failed');
  showToast(SELF_TERMINATION_MESSAGES.toastError, 'error');
}

async function performRequest(reason: string | null, m: Mutators): Promise<void> {
  m.setSubmitting(true);
  try {
    const created = await apiRequest(reason);
    m.setPending(created);
    m.setModalOpen(false);
    showToast(SELF_TERMINATION_MESSAGES.toastRequested, 'success');
    await invalidateAll();
  } catch (err: unknown) {
    handleRequestError(err, m);
  } finally {
    m.setSubmitting(false);
  }
}

async function performCancel(m: Mutators): Promise<void> {
  m.setSubmitting(true);
  try {
    await apiCancel();
    m.setPending(null);
    showToast(SELF_TERMINATION_MESSAGES.toastCancelled, 'info');
    await invalidateAll();
  } catch (err: unknown) {
    log.error({ err }, 'Cancel self-termination failed');
    showToast(SELF_TERMINATION_MESSAGES.toastError, 'error');
  } finally {
    m.setSubmitting(false);
  }
}

/** Create a per-page reactive state container. Call once at top of the
 *  component script — Svelte 5 runes only work in `.svelte` / `.svelte.ts`. */
export function createSelfTerminationState(
  initialPending: SelfTerminationRequest | null,
): SelfTerminationState {
  let pending = $state<SelfTerminationRequest | null>(initialPending);
  let cooldownEndsAt = $state<Date | null>(null);
  let lastRootBlocked = $state<boolean>(false);
  let submitting = $state<boolean>(false);
  let modalOpen = $state<boolean>(false);

  const m: Mutators = {
    setPending: (v) => {
      pending = v;
    },
    setCooldownEndsAt: (v) => {
      cooldownEndsAt = v;
    },
    setLastRootBlocked: (v) => {
      lastRootBlocked = v;
    },
    setSubmitting: (v) => {
      submitting = v;
    },
    setModalOpen: (v) => {
      modalOpen = v;
    },
  };

  return {
    get pending() {
      return pending;
    },
    get cooldownEndsAt() {
      return cooldownEndsAt;
    },
    get lastRootBlocked() {
      return lastRootBlocked;
    },
    get submitting() {
      return submitting;
    },
    get modalOpen() {
      return modalOpen;
    },
    set modalOpen(value: boolean) {
      modalOpen = value;
    },
    openModal: () => {
      modalOpen = true;
    },
    closeModal: () => {
      modalOpen = false;
    },
    request: (reason: string | null) => performRequest(reason, m),
    cancel: () => performCancel(m),
  };
}
