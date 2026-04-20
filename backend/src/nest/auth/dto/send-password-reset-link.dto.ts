/**
 * Send Password Reset Link — Response DTO.
 *
 * Emitted by `POST /api/v2/users/:id/send-password-reset-link` on success.
 * Strict Root-only endpoint (ADR-050 §2.7 / §0.2.5 #13). No request DTO —
 * the target user id is a path param, initiator is the authenticated Root.
 *
 * @see docs/FEAT_FORGOT_PASSWORD_ROLE_GATE_MASTERPLAN.md §2.7
 * @see docs/infrastructure/adr/ADR-050-forgot-password-role-gate.md (pending Phase 6)
 */
export interface SendPasswordResetLinkResponse {
  readonly message: string;
}
