#!/usr/bin/env node

// Script to add Content-Type headers to all POST/PUT requests in teams-v2.test.ts

/* eslint-env node */
/* global __dirname, console */
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "../backend/src/routes/__tests__/teams-v2.test.ts",
);
let content = fs.readFileSync(filePath, "utf8");

// Pattern to find POST/PUT requests that need Content-Type header
// Look for .post( or .put( followed by .set("Authorization") and .send()
const patterns = [
  // POST/PUT with only Authorization header
  {
    regex:
      /(\.(post|put)\([^)]+\)\n\s*\.set\("Authorization"[^)]+\)\n\s*\.send\()/g,
    replacement: '$1.set("Content-Type", "application/json")\n        .send(',
  },
  // POST/PUT without any headers before send
  {
    regex: /(\.(post|put)\([^)]+\)\n\s*\.send\()/g,
    replacement: '$1.set("Content-Type", "application/json")\n        .send(',
  },
];

// Apply patterns
patterns.forEach(({ regex }) => {
  content = content.replace(regex, (match) => {
    // Only replace if Content-Type is not already present
    if (!match.includes("Content-Type")) {
      return match.replace(
        /\.send\(/,
        '.set("Content-Type", "application/json")\n        .send(',
      );
    }
    return match;
  });
});

// Write back the modified content
fs.writeFileSync(filePath, content);

console.log("Content-Type headers added to teams-v2.test.ts");
