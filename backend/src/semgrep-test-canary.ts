// ⚠️ DELIBERATE VULNERABILITY — Semgrep Canary Test
// This file exists ONLY to verify local and CI scans find the same issues.
// DELETE after verification.

import jwt from 'jsonwebtoken';

// Pattern 1: Hardcoded JWT secret (should trigger hardcoded-jwt-secret)
const token = jwt.sign({ user: 'admin' }, 'my-super-secret-key-12345');

// Pattern 2: JWT verify with hardcoded secret
const decoded = jwt.verify(token, 'my-super-secret-key-12345');

// Pattern 3: eval with expression
const userInput = process.argv[2];
eval(userInput);
