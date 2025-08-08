#!/usr/bin/env node
/**
 * Script to fix nullish coalescing operator issues
 * Replaces || with ?? where appropriate
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all TypeScript files with nullish coalescing errors
const eslintOutput = execSync(
  "pnpm exec eslint . --format json 2>/dev/null || true",
  { encoding: "utf8", maxBuffer: 1024 * 1024 * 10 },
);

let results;
try {
  results = JSON.parse(eslintOutput);
} catch (e) {
  console.error("Failed to parse ESLint output");
  process.exit(1);
}

let fixedCount = 0;
const filesToFix = new Map();

// Collect all nullish coalescing errors
results.forEach((file) => {
  const nullishErrors = file.messages.filter(
    (msg) => msg.ruleId === "@typescript-eslint/prefer-nullish-coalescing",
  );

  if (nullishErrors.length > 0) {
    filesToFix.set(file.filePath, nullishErrors);
  }
});

console.info(`Found ${filesToFix.size} files with nullish coalescing issues`);

// Fix each file
for (const [filePath, errors] of filesToFix) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    // Sort errors by line number in reverse order to avoid line number shifts
    errors.sort((a, b) => b.line - a.line);

    errors.forEach((error) => {
      const lineIndex = error.line - 1;
      const line = lines[lineIndex];

      if (line) {
        // Look for patterns like: variable || defaultValue
        // Common safe patterns to replace
        const patterns = [
          // Simple variable || literal
          /(\w+)\s*\|\|\s*(['"`].*?['"`]|\d+|true|false|null|undefined|\[\]|\{\})/g,
          // Property access || literal
          /(\w+\.\w+(?:\.\w+)*)\s*\|\|\s*(['"`].*?['"`]|\d+|true|false|null|undefined|\[\]|\{\})/g,
          // Array access || literal
          /(\w+\[\w+\])\s*\|\|\s*(['"`].*?['"`]|\d+|true|false|null|undefined|\[\]|\{\})/g,
          // Function call || literal
          /(\w+\([^)]*\))\s*\|\|\s*(['"`].*?['"`]|\d+|true|false|null|undefined|\[\]|\{\})/g,
          // req.query/body/params pattern
          /(req\.\w+\.\w+)\s*\|\|\s*(['"`].*?['"`]|\d+|true|false|null|undefined|\[\]|\{\})/g,
          // process.env pattern
          /(process\.env\.\w+)\s*\|\|\s*(['"`].*?['"`]|\d+|true|false|null|undefined|\[\]|\{\})/g,
        ];

        let newLine = line;
        let changed = false;

        for (const pattern of patterns) {
          const matches = line.matchAll(pattern);
          for (const match of matches) {
            // Check if this is at the right column
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;

            // Only replace if it's near the error column
            if (
              Math.abs(matchStart - error.column) < 10 ||
              (error.column >= matchStart && error.column <= matchEnd)
            ) {
              newLine =
                newLine.substring(0, match.index) +
                match[0].replace(/\|\|/g, "??") +
                newLine.substring(match.index + match[0].length);
              changed = true;
              fixedCount++;
              break;
            }
          }
          if (changed) break;
        }

        // If no pattern matched, try a more general replacement
        if (!changed && line.includes("||")) {
          // Find the || operator near the error column
          const orIndex = line.indexOf("||", Math.max(0, error.column - 5));
          if (orIndex !== -1 && Math.abs(orIndex - error.column) < 10) {
            newLine =
              line.substring(0, orIndex) + "??" + line.substring(orIndex + 2);
            fixedCount++;
          }
        }

        lines[lineIndex] = newLine;
      }
    });

    // Write the fixed content back
    fs.writeFileSync(filePath, lines.join("\n"));
    console.info(
      `Fixed ${errors.length} issues in ${path.relative(process.cwd(), filePath)}`,
    );
  } catch (e) {
    console.error(`Error processing ${filePath}:`, e.message);
  }
}

console.info(`\nTotal fixes applied: ${fixedCount}`);
console.info("Running ESLint to check remaining issues...");

// Run ESLint again to see how many issues remain
const remainingErrors = execSync(
  'pnpm exec eslint . 2>&1 | grep "prefer-nullish-coalescing" | wc -l',
  { encoding: "utf8" },
).trim();

console.info(`Remaining nullish coalescing errors: ${remainingErrors}`);
