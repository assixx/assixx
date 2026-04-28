/**
 * Manage Approvals — Constants
 * @module shared/manage-approvals/_lib/constants
 *
 * German UI copy for the root self-termination peer-approval flow
 * (Step 5.3 of FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md). Mirrors the
 * tone established by `(root)/root-profile/_lib/constants.ts`
 * (Step 5.1) so the requester-side and approver-side wording stay
 * consistent.
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §5.3
 */

/** Card + modal copy. Section 5.3 mandates German labels throughout. */
export const ROOT_SELF_TERMINATION_MESSAGES = {
  // Card section
  sectionTitle: 'Root-Konto-Löschungen — Peer-Genehmigung',
  sectionSubtitle:
    'Anträge anderer Root-Benutzer zur Löschung ihres eigenen Kontos. Sie können nicht über Ihren eigenen Antrag entscheiden.',
  emptyState: 'Keine ausstehenden Anträge.',

  // Card row labels
  rowRequesterPrefix: 'Antragsteller:',
  rowExpiresPrefix: 'Läuft ab am',
  rowReasonLabel: 'Begründung',
  rowNoReason: '(keine Begründung angegeben)',
  rowApproveBtn: 'Genehmigen',
  rowRejectBtn: 'Ablehnen',

  // Approve modal
  approveModalTitle: 'Konto-Löschung genehmigen',
  approveModalWarning:
    'Mit Genehmigung wird das Root-Konto SOFORT deaktiviert (is_active = 4). Diese Aktion kann nicht rückgängig gemacht werden.',
  approveModalCommentLabel: 'Kommentar (optional)',
  approveModalCommentPlaceholder: 'Optionaler Kommentar zur Genehmigung...',
  approveModalSubmit: 'Konto deaktivieren',
  approveModalCancel: 'Abbrechen',

  // Reject modal
  rejectModalTitle: 'Konto-Löschung ablehnen',
  rejectModalWarning:
    'Der Antragsteller wird benachrichtigt und kann frühestens 24 Stunden nach Ablehnung erneut beantragen.',
  rejectModalReasonLabel: 'Begründung der Ablehnung *',
  rejectModalReasonPlaceholder: 'Begründung (Pflichtfeld)...',
  rejectModalReasonRequired: 'Bitte geben Sie eine Begründung an.',
  rejectModalSubmit: 'Ablehnen',
  rejectModalCancel: 'Abbrechen',

  // Toasts
  toastApproved: 'Antrag genehmigt — Konto deaktiviert.',
  toastRejected: 'Antrag abgelehnt.',
  toastError: 'Fehler bei der Bearbeitung.',
  toastErrorLastRoot: 'Letzter Root im Tenant — Antrag kann nicht genehmigt werden.',
  toastErrorExpired: 'Antrag ist abgelaufen.',
  toastErrorReasonRequired: 'Begründung ist erforderlich.',
} as const;

/** Maximum reason / comment length — mirrors backend Zod schema (1000). */
export const ROOT_SELF_TERMINATION_REASON_MAX = 1000;

/** Backend error codes the card handles explicitly. Other codes fall through
 *  to the generic toast. Mirrors `ROOT_SELF_TERMINATION_CODES` in
 *  `backend/src/nest/root/root-self-termination.service.ts`. */
export const ROOT_SELF_TERMINATION_ERROR_CODES = {
  LAST_ROOT_PROTECTION: 'ROOT_LAST_ROOT_PROTECTION',
  EXPIRED: 'EXPIRED',
  REJECTION_REASON_REQUIRED: 'REJECTION_REASON_REQUIRED',
} as const;
