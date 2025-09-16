const jwt = require('jsonwebtoken');

// Example token - replace with actual token from test
const token = process.argv[2];

if (!token) {
  console.info('Usage: node debug-jwt.js <token>');
  process.exit(1);
}

try {
  const decoded = jwt.decode(token);
  console.info('Decoded JWT:', JSON.stringify(decoded, null, 2));
} catch (error) {
  console.error('Error decoding token:', error.message);
}
