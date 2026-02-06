# Security Policy

**Version:** 1.0.0 | **Updated:** 2025-12-16

---

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

---

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

### Contact

Email: security@scs-technik.de

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

| Action                  | Timeframe |
| ----------------------- | --------- |
| Acknowledgment          | 48 hours  |
| Initial assessment      | 7 days    |
| Fix for critical issues | 14 days   |
| Fix for non-critical    | 30 days   |

### What to Expect

1. We acknowledge receipt within 48 hours
2. We investigate and assess severity
3. We develop and test a fix
4. We release the fix and credit you (if desired)

---

## Security Measures

### Authentication

- JWT-based authentication (access + refresh tokens)
- bcrypt password hashing (cost factor 12)
- Rate limiting on auth endpoints
- Session invalidation on logout

### Authorization

- Role-based access control (root, admin, employee)
- Row Level Security (RLS) for tenant isolation
- Endpoint-level permission checks

### Data Protection

- All data encrypted in transit (HTTPS)
- PostgreSQL with RLS policies
- Tenant isolation at database level
- Sensitive data never logged

### Input Validation

- Zod schema validation on all inputs
- Parameterized queries ($1, $2, $3) - no SQL injection
- Content-Type enforcement
- Request size limits

### Headers & CORS

- Helmet.js security headers
- Strict CORS policy
- CSRF protection
- XSS prevention

---

## Known Security Considerations

### Multi-Tenant Architecture

Each tenant's data is isolated via:

- `tenant_id` column on all tenant-specific tables
- PostgreSQL RLS policies
- Application-level checks

**Critical:** Never bypass RLS or expose cross-tenant data.

### File Uploads

- UUIDv7 filenames (no user input in paths)
- File type validation
- Size limits enforced
- Stored outside web root

### API Security

- All endpoints require authentication (except /health, /login)
- Rate limiting per IP and per user
- Request logging for audit trail

---

## Dependency Security

```bash
# Check for vulnerabilities
pnpm audit

# Update dependencies
pnpm update
```

We monitor dependencies via GitHub Dependabot.

---

## Security Checklist for Contributors

Before submitting code:

- [ ] No hardcoded secrets or credentials
- [ ] SQL uses parameterized queries ($1, $2, $3)
- [ ] User input validated with Zod
- [ ] Tenant isolation maintained
- [ ] No sensitive data in logs
- [ ] File paths sanitized
- [ ] Error messages don't leak internals

---

## References

- [CODE-OF-CONDUCT.md](./docs/CODE-OF-CONDUCT.md) - Development standards
- [TYPESCRIPT-STANDARDS.md](./docs/TYPESCRIPT-STANDARDS.md) - Code standards
- [DATABASE-MIGRATION-GUIDE.md](./docs/DATABASE-MIGRATION-GUIDE.md) - RLS documentation

---

**Security is everyone's responsibility.**
