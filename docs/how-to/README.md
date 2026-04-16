# HOW-TO Guides

> Standalone guides for specific tools, workflows, and patterns used in Assixx.
> Each guide is self-contained with context, examples, and troubleshooting.

---

## Guide Catalog

### Development & Tooling

| Guide                                                           | Description                                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [HOW-TO-CURL](./HOW-TO-CURL.md)                                 | API requests with curl — token handling, inline usage rules                                     |
| [HOW-TO-DOPPLER-GUIDE](./HOW-TO-DOPPLER-GUIDE.md)               | Doppler secret management — setup, configs, CLI reference                                       |
| [HOW-TO-POSTGRESQL-CLI](./HOW-TO-POSTGRESQL-CLI.md)             | psql client setup on WSL2, meta-command reference                                               |
| [HOW-TO-ENABLE-DEBUG-LOGGING](./HOW-TO-ENABLE-DEBUG-LOGGING.md) | Backend DEBUG + frontend PERF logging — opt-in activation                                       |
| [HOW-TO-KNIP](./HOW-TO-KNIP.md)                                 | Dead code & unused dependency detection with Knip                                               |
| [HOW-TO-FALLOW](./HOW-TO-FALLOW.md)                             | Dead code analysis with Fallow (Rust, fast, complementary to Knip)                              |
| [HOW-TO-CLOUDFLARE-TURNSTILE](./HOW-TO-CLOUDFLARE-TURNSTILE.md) | Bot-Schutz (Login/Signup) — Keys, CSP, Komponente, Fehler-Referenz                              |
| [HOW-TO-AZURE-AD-SETUP](./HOW-TO-AZURE-AD-SETUP.md)             | Microsoft OAuth — Azure AD App Registration, Redirect URIs, Doppler-Secrets, Rotation (ADR-046) |

### Testing

| Guide                                                   | Description                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| [HOW-TO-TEST-WITH-VITEST](./HOW-TO-TEST-WITH-VITEST.md) | API integration tests — test tenant, helpers, templates, troubleshooting |
| [HOW-TO-CREATE-TEST-USER](./HOW-TO-CREATE-TEST-USER.md) | Create test tenant + users after fresh install                           |

### Feature Development

| Guide                                                     | Description                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [HOW-TO-INTEGRATE-FEATURE](./HOW-TO-INTEGRATE-FEATURE.md) | End-to-end checklist for integrating a new feature (RLS, GRANTs, tests, docs) |
| [HOW-TO-PLAN-SAMPLE](./HOW-TO-PLAN-SAMPLE.md)             | Feature execution masterplan template (extracted from Vacation module)        |

### Versioning & Release

| Guide                                               | Description                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| [HOW-TO-USE-CHANGESETS](./HOW-TO-USE-CHANGESETS.md) | Changesets workflow — versioning, changelog generation, git tags |

### Database

| Guide                                                         | Description                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| [HOW-TO-RESET-DB-PROPERLY](./HOW-TO-RESET-DB-PROPERLY.md)     | Datenbank komplett zurücksetzen (Fresh Install, production-ready) |
| [HOW-TO-RESET-POSTGRESQL-ID](./HOW-TO-RESET-POSTGRESQL-ID.md) | Reset PostgreSQL ID sequences after TRUNCATE                      |

---

## Related

- [COMMON-COMMANDS.md](../COMMON-COMMANDS.md) — Quick command reference (all tools in one place)
- [DATABASE-MIGRATION-GUIDE.md](../DATABASE-MIGRATION-GUIDE.md) — Migration workflow, backup, rollback
- [TYPESCRIPT-STANDARDS.md](../TYPESCRIPT-STANDARDS.md) — Code standards and ESLint rules
- [CODE-OF-CONDUCT.md](../CODE-OF-CONDUCT.md) — Backend coding rules (Power of Ten, KISS)
- [CODE-OF-CONDUCT-SVELTE.md](../CODE-OF-CONDUCT-SVELTE.md) — Svelte 5 / SvelteKit patterns
