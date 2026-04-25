# HOW-TO: Azure AD App Registration for Microsoft OAuth Sign-In

> **When to use:** You are setting up Microsoft OAuth sign-in for an Assixx
> deployment (dev, staging, or prod). Needs to be done once per environment's
> public URL. See [ADR-046](../infrastructure/adr/ADR-046-oauth-sign-in.md)
> for architectural context.
>
> **Prerequisite:** An Azure AD tenant where you have permission to create
> app registrations. (Free Azure account with an AAD tenant is enough — no
> paid SKU required for the app registration itself.)

---

## What you will create

1. **One Azure AD App Registration** — identifies Assixx to Microsoft's
   identity platform. Provides the Client ID + secret.
2. **Two (or more) Redirect URIs on that registration** — one per environment
   (dev localhost, staging, prod). Azure lists them on the same app.
3. **Three Doppler secrets** — Client ID, Client Secret, PUBLIC_APP_URL.

---

## Step 1 — Create the App Registration

1. Sign in at <https://entra.microsoft.com/> (or the legacy
   <https://portal.azure.com/> → "Microsoft Entra ID"). Use the tenant-admin
   account — app registrations require tenant-admin rights.
2. Navigate: **Applications → App registrations → New registration**.
3. Fill the form:

   | Field                       | Value                                                                |
   | --------------------------- | -------------------------------------------------------------------- |
   | **Name**                    | `Assixx OAuth Sign-In` (display name — users never see it)           |
   | **Supported account types** | **Accounts in any organizational directory (Multitenant)** ✅        |
   | **Redirect URI — platform** | Web                                                                  |
   | **Redirect URI — URL**      | `https://www.assixx.com/api/v2/auth/oauth/microsoft/callback` (prod) |

4. Click **Register**.

**Why "Multitenant" (not "Single tenant")?** Assixx customers belong to their
own Azure AD tenants, not to ours. The `/organizations/` authorization
endpoint used by the backend accepts work/school accounts from any Azure AD
tenant — your app registration must be multitenant-enabled for this to work.

**Why "Web" not "SPA" or "Mobile"?** The token exchange uses a client_secret,
which mandates the confidential-client "Web" platform. SPA uses PKCE without
a secret — not our flow.

---

## Step 2 — Add Development + Additional Redirect URIs

After registration, open **Authentication** in the left nav.

Click **Add URI** under "Web → Redirect URIs" and add each environment you need:

| Environment | Redirect URI                                                      |
| ----------- | ----------------------------------------------------------------- |
| Dev (local) | `http://localhost:3000/api/v2/auth/oauth/microsoft/callback`      |
| Staging     | `https://staging.assixx.com/api/v2/auth/oauth/microsoft/callback` |
| Prod        | `https://www.assixx.com/api/v2/auth/oauth/microsoft/callback`     |

Click **Save** at the top.

**Format rules (Microsoft enforces these):**

- Dev URIs MUST use `http://localhost` — other HTTP origins (like `http://example.com`) are rejected.
- Staging and prod MUST use `https://` — Microsoft refuses non-localhost HTTP.
- The path MUST be exactly `/api/v2/auth/oauth/microsoft/callback`. The
  backend derives this from `PUBLIC_APP_URL` at boot, so it's not
  configurable per deployment.

**Under "Implicit grant and hybrid flows"**: leave BOTH checkboxes
(Access tokens, ID tokens) **unchecked**. We use the authorization-code flow
with PKCE; implicit is a legacy fallback we don't need.

---

## Step 3 — Create the Client Secret

1. Open **Certificates & secrets** in the left nav.
2. Under **Client secrets**, click **New client secret**.
3. Fill the form:

   | Field       | Value                                                                                |
   | ----------- | ------------------------------------------------------------------------------------ |
   | Description | `Assixx OAuth — prod` (or `dev` / `staging` — whatever environment you're wiring up) |
   | Expires     | 24 months (Microsoft's max; rotate before expiry — see "Secret rotation" below)      |

4. Click **Add**.

5. **Copy the secret VALUE immediately** (not the Secret ID — different
   thing). It's only shown ONCE. If you close the page before copying, you
   must create a new secret and delete the old one. This is Microsoft's
   design — they do not let you re-view the value.

---

## Step 4 — Configure API Permissions

1. Open **API permissions** in the left nav.
2. The required state is **Microsoft Graph → User.Read (Delegated)** —
   this is Azure's default for new app registrations. **Leave it.**

**Why `User.Read`?** Sign-in itself uses the OIDC-standard
`openid profile email` scopes (implicit, no configuration needed), AND
**`User.Read`** — a delegated Graph permission required to sync the user's
Microsoft 365 profile photo into the Assixx avatar (see
[ADR-046 Amendment 2026-04-17](../infrastructure/adr/ADR-046-oauth-sign-in.md#amendment-2026-04-17-a4-partial-reversal--microsoft-graph-profile-photo-sync)).
`User.Read` is auto-consented per-user — **no admin consent required**.
Users see a "Read your profile" line on Microsoft's consent screen the first
time they sign in after the scope rollout; that is expected and correct.

**Do NOT** add `ProfilePhoto.Read.All` — it is tenant-wide and forces an
admin-consent prompt most customers cannot approve without their IT team.

**Do NOT** add `offline_access` — we do not store refresh tokens (ADR-046 D10).
The Graph `access_token` is used in-flight during the OAuth callback only; it
is never persisted to the database.

**Important:** Do NOT click "Grant admin consent for {tenant}". That's for
our internal AAD tenant, not our customers'. Customer tenant admins grant
consent on their end via Microsoft's consent prompt during first sign-in.

---

## Step 5 — Capture the Secrets for Doppler

On the **Overview** page of your app registration:

| Doppler secret                  | Where to find it                             |
| ------------------------------- | -------------------------------------------- |
| `MICROSOFT_OAUTH_CLIENT_ID`     | Overview → **Application (client) ID**       |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | Certificates & secrets → **Value** (Step 3)  |
| `PUBLIC_APP_URL`                | Your deployment's base URL (see table below) |

### `PUBLIC_APP_URL` values

This secret drives the backend's redirect-URI derivation at boot:

```
${PUBLIC_APP_URL}/api/v2/auth/oauth/microsoft/callback
```

| Environment | Value                        |
| ----------- | ---------------------------- |
| Dev (local) | `http://localhost:3000`      |
| Staging     | `https://staging.assixx.com` |
| Prod        | `https://www.assixx.com`     |

**Do NOT include a trailing slash.** The backend concatenates the path
directly; `http://localhost:3000/` would produce `//api/v2/...` and break the
redirect-URI match in Azure.

---

## Step 6 — Add Secrets to Doppler

```bash
# Select the right Doppler config per environment
doppler setup --project assixx --config dev        # or staging / prod

doppler secrets set MICROSOFT_OAUTH_CLIENT_ID='<the GUID from Step 5>'
doppler secrets set MICROSOFT_OAUTH_CLIENT_SECRET='<the value from Step 3>'
doppler secrets set PUBLIC_APP_URL='http://localhost:3000'      # or the prod URL

# Verify
doppler secrets get MICROSOFT_OAUTH_CLIENT_ID --plain
doppler secrets get PUBLIC_APP_URL --plain
```

Then reload the backend so the new env reaches the container:

```bash
cd /home/scs/projects/Assixx/docker && doppler run -- docker-compose restart backend
docker logs assixx-backend --tail 20 | grep 'redirect_uri='
# Expected line:
# [MicrosoftProvider] Microsoft OAuth initialised. redirect_uri=http://localhost:3000/api/v2/auth/oauth/microsoft/callback
```

The boot-time log line is the authoritative check — if it doesn't match the
URI you registered in Azure, Microsoft will reject the callback with
`AADSTS50011: Reply URL mismatch` and the user sees a dead-end error page.

---

## Step 7 — Test the Flow

Local dev:

```bash
cd /home/scs/projects/Assixx
pnpm run dev:svelte  # Vite on :5173
# In another terminal, ensure backend is up:
doppler run -- docker-compose -f docker/docker-compose.yml up -d backend
```

Open <http://localhost:5173/signup> in a private browser window (avoids
leftover cookies from other sessions). Click **Mit Microsoft registrieren**.

Expected flow:

1. Redirect to `login.microsoftonline.com/organizations/oauth2/v2.0/authorize?...`
2. You sign in with a work/school Microsoft account
3. Microsoft shows the consent prompt (first time per user) — accept it
4. Redirect back to `http://localhost:3000/api/v2/auth/oauth/microsoft/callback`
5. Backend 302s to `http://localhost:5173/signup/oauth-complete?ticket={uuidv7}`
6. Form is pre-filled with email (read-only) and name (editable)
7. Fill company name, subdomain, phone, accept terms, submit
8. Land on `/root-dashboard` with httpOnly cookies set

### If step 4 returns `AADSTS50011` Reply URL mismatch

Azure shows the exact URL it expected. Copy it, open the Azure app
registration → Authentication → Redirect URIs, and add that exact URL.
Wait 30–60 s for Azure to propagate, retry.

### If step 4 returns `AADSTS50020` Personal account rejected

You tried to sign in with a personal `@outlook.com` account. Use a
work/school account instead. The `/organizations/` endpoint deliberately
rejects consumer accounts (plan §0 — B2B filter).

### If step 6 shows a blank email field

The peek endpoint (`GET /api/v2/auth/oauth/microsoft/signup-ticket/:id`)
failed to read the ticket from Redis. Check that:

- Redis is up: `docker ps | grep assixx-redis` → should be `Up`
- Backend has the same Redis password as Redis itself (compare Doppler
  `REDIS_PASSWORD` with `docker exec assixx-redis redis-cli INFO server`)
- Ticket hasn't expired (15 min TTL — re-run the flow from Step 1)

---

## Secret Rotation

**Rotate `MICROSOFT_OAUTH_CLIENT_SECRET` before the Azure-shown expiry
(max 24 months).** Procedure:

1. Azure portal → App registration → Certificates & secrets → **New client
   secret** — create the replacement FIRST.
2. Copy the new value, put it in Doppler alongside the old one (temporarily):

   ```bash
   # Optional: keep old and new side-by-side during rollout.
   doppler secrets set MICROSOFT_OAUTH_CLIENT_SECRET_NEW='<new>'
   ```

3. Deploy the new secret as `MICROSOFT_OAUTH_CLIENT_SECRET` and restart the
   backend.
4. Verify a test login succeeds with the new secret in use.
5. Azure portal → Delete the OLD secret.
6. Remove the `*_NEW` staging variable from Doppler.

**Window of validity:** Both secrets are accepted simultaneously while both
exist in Azure, so there is no downtime during rotation.

---

## Security Notes

- **The client_secret is exactly that — a secret.** Never commit it to
  git, never paste it into Slack/Teams, never log it. The backend has a
  dedicated redaction layer in `MicrosoftProvider` error paths
  ([ADR-046 § Risks R7](../infrastructure/adr/ADR-046-oauth-sign-in.md)).
- **Dev client_secret should NOT be reused for prod.** Create separate
  secrets per environment so you can revoke one without affecting others.
- **The client_id is NOT a secret.** It's visible in the redirect URL that
  browsers construct. Treat it as public configuration. Do not try to
  obfuscate it.
- **Multitenant apps are visible to all Microsoft customers.** The app
  registration's display name ("Assixx OAuth Sign-In") is what customer
  admins see on the consent screen — keep it recognisable and professional.

---

## Reference Commands

Smoke-test the live endpoints (backend must be running):

```bash
# 1. Authorize endpoint should 302 with all the PKCE+state params
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" \
  http://localhost:3000/api/v2/auth/oauth/microsoft/authorize?mode=login
# Expected: 302 https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?client_id=...&scope=openid+profile+email+User.Read&...

# 2. Peek endpoint with a known-bad id — expect 400
curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:3000/api/v2/auth/oauth/microsoft/signup-ticket/not-a-uuid
# Expected: 400

# 3. Peek with a valid-format but nonexistent ticket — expect 404
curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:3000/api/v2/auth/oauth/microsoft/signup-ticket/00000000-0000-0000-0000-000000000000
# Expected: 404
```

---

## Related

- [ADR-046: Microsoft OAuth Sign-In](../infrastructure/adr/ADR-046-oauth-sign-in.md) — architectural decisions
- [FEAT_MICROSOFT_OAUTH_MASTERPLAN.md](../FEAT_MICROSOFT_OAUTH_MASTERPLAN.md) — execution plan + spec deviations
- [HOW-TO-DOPPLER-GUIDE.md](./HOW-TO-DOPPLER-GUIDE.md) — general Doppler workflow
- [Microsoft identity platform — authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Azure AD app registration — Microsoft Learn](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
