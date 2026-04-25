/**
 * Signup `_lib/api.ts` — Error-Code → German-Message Mapping Tests
 *
 * Asserts the §5.2 / v0.3.1 F1 wiring: backend `validateBusinessEmail`
 * codes (`INVALID_FORMAT`, `DISPOSABLE_EMAIL`, `FREE_EMAIL_PROVIDER`) flow
 * through `registerUser()`'s catch block and surface as the German strings
 * from `EMAIL_VALIDATION_MESSAGES` in `_lib/constants.ts`.
 *
 * **Drift guard (v0.3.4 D30):** if a backend code is renamed
 * (e.g., `FREE_EMAIL_PROVIDER` → `FREEMAIL_PROVIDER`) without updating
 * `EMAIL_VALIDATION_MESSAGES`, this test fails byte-for-byte.
 *
 * @see masterplan §5.4.2
 * @see backend/src/nest/domains/email-validator.ts (source of code constants)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '$lib/utils/api-client.types';

import { EMAIL_VALIDATION_MESSAGES, ERROR_MESSAGES } from './constants';

// Mock the api-client module BEFORE importing the SUT — the registerUser
// closure captures `apiClient` at module-load time, so mocking later has no
// effect. `vi.mock` is hoisted, but the mocked factory must be self-contained
// (no external references — the `vi.fn()` is created inside the factory).
const postMock = vi.fn();

vi.mock('$lib/utils/api-client', () => ({
  getApiClient: () => ({
    post: postMock,
  }),
}));

// Import AFTER vi.mock so registerUser's `apiClient = getApiClient()` resolves
// to our mocked instance.
const { registerUser } = await import('./api');

const VALID_PAYLOAD = {
  companyName: 'Probe GmbH',
  subdomain: 'probe',
  email: 'admin@probe-gmbh.de',
  phone: '+491511234567',
  adminEmail: 'admin@probe-gmbh.de',
  adminPassword: 'StrongPassword2026!',
  adminFirstName: 'Probe',
  adminLastName: 'Admin',
};

beforeEach(() => {
  postMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('registerUser — German-message mapping for backend signup-validation codes', () => {
  it('maps INVALID_FORMAT → German format-error message', async () => {
    postMock.mockRejectedValueOnce(new ApiError('Invalid format', 'INVALID_FORMAT', 400));

    await expect(registerUser(VALID_PAYLOAD)).rejects.toThrow(
      EMAIL_VALIDATION_MESSAGES.INVALID_FORMAT,
    );
  });

  it('maps DISPOSABLE_EMAIL → German Wegwerf-Mail message', async () => {
    postMock.mockRejectedValueOnce(new ApiError('Disposable provider', 'DISPOSABLE_EMAIL', 400));

    await expect(registerUser(VALID_PAYLOAD)).rejects.toThrow(
      EMAIL_VALIDATION_MESSAGES.DISPOSABLE_EMAIL,
    );
  });

  it('maps FREE_EMAIL_PROVIDER → German Firmen-Mail message', async () => {
    postMock.mockRejectedValueOnce(new ApiError('Free provider', 'FREE_EMAIL_PROVIDER', 400));

    await expect(registerUser(VALID_PAYLOAD)).rejects.toThrow(
      EMAIL_VALIDATION_MESSAGES.FREE_EMAIL_PROVIDER,
    );
  });

  it('preserves the original ApiError as `cause` for debugging', async () => {
    const originalError = new ApiError('Free provider', 'FREE_EMAIL_PROVIDER', 400);
    postMock.mockRejectedValueOnce(originalError);

    try {
      await registerUser(VALID_PAYLOAD);
      expect.fail('Expected registerUser to reject');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).cause).toBe(originalError);
    }
  });
});

describe('registerUser — fallback for unknown / non-ApiError errors', () => {
  it('falls back to generic registrationFailed for an unknown ApiError code', async () => {
    // Code that is NOT in EMAIL_VALIDATION_MESSAGES → should NOT crash, should
    // surface either the original ApiError.message or the generic fallback.
    postMock.mockRejectedValueOnce(
      new ApiError('Something else broke', 'TOTALLY_NEW_CODE_2027', 500),
    );

    await expect(registerUser(VALID_PAYLOAD)).rejects.toThrow('Something else broke');
  });

  it('falls back to generic registrationFailed for a plain Error with empty message', async () => {
    postMock.mockRejectedValueOnce(new Error(''));

    await expect(registerUser(VALID_PAYLOAD)).rejects.toThrow(ERROR_MESSAGES.registrationFailed);
  });

  it('falls back to generic registrationFailed for a non-Error rejection', async () => {
    // Network errors, AbortErrors, or other non-Error rejections (rare but possible).
    postMock.mockRejectedValueOnce('string-rejection-not-an-error');

    await expect(registerUser(VALID_PAYLOAD)).rejects.toThrow(ERROR_MESSAGES.registrationFailed);
  });
});

describe('registerUser — happy path passes through unchanged', () => {
  it('returns the response from apiClient.post on success', async () => {
    const expectedResponse = {
      tenantId: 11,
      userId: 33,
      tenantVerificationRequired: true,
    };
    postMock.mockResolvedValueOnce(expectedResponse);

    const result = await registerUser(VALID_PAYLOAD);

    expect(result).toEqual(expectedResponse);
    expect(postMock).toHaveBeenCalledWith('/signup', VALID_PAYLOAD, { useAuth: false });
  });
});
