# Assixx Backend

## TypeScript Architecture

The backend is built with 100% TypeScript, providing full type safety and IntelliSense support.

### Key Features

- Type-safe route handlers with custom request types
- Pre-configured security middleware stacks
- Standardized error handling and responses
- Multi-tenant database queries with proper isolation
- Express-validator integration for input validation

### Quick Start

```typescript
import { Router } from 'express';
import { security } from './middleware/security';
import { typed } from './utils/routeHandlers';
import { successResponse, errorResponse } from './types/response.types';

const router = Router();

// Public endpoint
router.get(
  '/status',
  ...security.public(),
  typed.handler(async (req, res) => {
    res.json(successResponse({ status: 'ok' }));
  })
);

// Authenticated endpoint
router.get(
  '/profile',
  ...security.user(),
  typed.auth(async (req, res) => {
    // req.user is fully typed
    const userId = req.user.id;
    // Implementation
  })
);

// Admin endpoint with validation
router.post(
  '/users',
  ...security.admin(createUserValidation),
  typed.body<CreateUserDto>(async (req, res) => {
    // req.body is typed as CreateUserDto
    const { email, password } = req.body;
    // Implementation
  })
);
```

### Documentation

- [TypeScript Architecture Guide](./TYPESCRIPT-ARCHITECTURE-GUIDE.md) - Complete guide to the TypeScript architecture
- [API Documentation](../docs/API.md) - API endpoints reference
- [Database Schema](../docs/DATABASE-SETUP-README.md) - Database structure and migrations

### Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Type check
pnpm type-check

# Build for production
pnpm build
```

### Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

## Architecture Overview

```
src/
├── config/           # Configuration files
├── controllers/      # Business logic
├── middleware/       # Express middleware
├── models/          # Data models
├── routes/          # API routes
├── services/        # External services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── server.ts        # Application entry point
```

## Environment Variables

See `.env.example` for required environment variables.

## Contributing

Please read [TYPESCRIPT-ARCHITECTURE-GUIDE.md](./TYPESCRIPT-ARCHITECTURE-GUIDE.md) before making changes to ensure consistency with the established patterns.
