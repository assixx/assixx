/**
 * Auth DTOs Barrel Export
 */
export {
  ConnectionTicketDto,
  ConnectionTicketSchema,
  type ConnectionTicketResponse,
} from './connection-ticket.dto.js';
export {
  ForgotPasswordDto,
  ForgotPasswordSchema,
  type ForgotPasswordResponse,
} from './forgot-password.dto.js';
// Session 12c (ADR-050): apex-login → subdomain-handoff mint endpoint.
export { HandoffMintDto, HandoffMintSchema, type HandoffMintResponse } from './handoff-mint.dto.js';
export { LoginDto, LoginSchema, type LoginResponse } from './login.dto.js';
export { RefreshDto, RefreshSchema, type RefreshResponse } from './refresh.dto.js';
export { RegisterDto, RegisterSchema, type RegisterResponse } from './register.dto.js';
export {
  ResetPasswordDto,
  ResetPasswordSchema,
  type ResetPasswordResponse,
} from './reset-password.dto.js';
export type { SendPasswordResetLinkResponse } from './send-password-reset-link.dto.js';
