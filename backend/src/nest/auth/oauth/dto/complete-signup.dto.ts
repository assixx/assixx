/**
 * `POST /auth/oauth/microsoft/complete-signup`
 *
 * Body submitted by the frontend `/signup/oauth-complete` form: company details + the
 * Redis ticket UUID. Email and (in the OAuth path) the missing password are sourced
 * server-side from the resolved OAuth profile, NOT from this form.
 *
 * Field shapes are PICKED from the canonical `SignupSchema` to stay byte-identical
 * to the password-signup path — single source of truth for validation rules.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.6) and (Phase 5, Step 5.4)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { SignupSchema } from '../../../signup/dto/signup.dto.js';

export const CompleteSignupSchema = SignupSchema.pick({
  companyName: true,
  subdomain: true,
  phone: true,
  street: true,
  houseNumber: true,
  postalCode: true,
  city: true,
  countryCode: true,
  adminFirstName: true,
  adminLastName: true,
}).extend({
  ticket: z.string().min(1, 'OAuth signup ticket is required'),
});

export class CompleteSignupDto extends createZodDto(CompleteSignupSchema) {}
