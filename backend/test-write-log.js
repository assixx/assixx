import fs from 'fs';

const testLog = `
Test Log at ${new Date().toISOString()}
This is a test to see if we can write logs
`;

fs.appendFileSync('/tmp/role-switch-debug.log', testLog);
console.info('Log written to /tmp/role-switch-debug.log');
