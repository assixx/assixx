// Compatibility wrapper for TypeScript migration
// This file ensures backward compatibility during migration
require('../register-ts');
module.exports = require('./auth.controller.ts');
