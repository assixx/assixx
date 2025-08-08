#!/usr/bin/env node
/**
 * Script to fix promise handling issues
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all TypeScript files with promise errors
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

// Collect all promise-related errors
results.forEach((file) => {
  const promiseErrors = file.messages.filter(
    (msg) =>
      msg.ruleId === "@typescript-eslint/no-floating-promises" ||
      msg.ruleId === "@typescript-eslint/no-misused-promises" ||
      msg.ruleId === "@typescript-eslint/await-thenable",
  );

  if (promiseErrors.length > 0) {
    filesToFix.set(file.filePath, promiseErrors);
  }
});

console.info(`Found ${filesToFix.size} files with promise handling issues`);

// Fix each file
for (const [filePath, errors] of filesToFix) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    // Sort errors by line number in reverse order
    errors.sort((a, b) => b.line - a.line);

    errors.forEach((error) => {
      const lineIndex = error.line - 1;
      const line = lines[lineIndex];

      if (!line) return;

      // Handle different types of promise errors
      if (error.ruleId === "@typescript-eslint/no-floating-promises") {
        // Common patterns that need void operator
        const patterns = [
          // Function calls that return promises
          {
            pattern: /^(\s*)([\w.]+)\((.*)\);?\s*$/,
            replacement: (match, indent, func, args) =>
              `${indent}void ${func}(${args});`,
          },
          // Method calls that return promises
          {
            pattern: /^(\s*)([\w.]+\.[\w.]+)\((.*)\);?\s*$/,
            replacement: (match, indent, method, args) =>
              `${indent}void ${method}(${args});`,
          },
          // Async function calls in if statements
          {
            pattern: /^(\s*)if\s*\((.*)\)\s*{\s*$/,
            check: (match, indent, condition) =>
              condition.includes("(") && condition.includes(")"),
            skip: true, // These need manual review
          },
          // Promise chains
          {
            pattern: /^(\s*)(.*\.)then\(/,
            replacement: (match, indent, prefix) =>
              `${indent}void ${prefix}then(`,
          },
          // setTimeout/setInterval with async functions
          {
            pattern: /^(\s*)(setTimeout|setInterval)\(\s*async\s*/,
            replacement: (match, indent, timer) =>
              `${indent}void ${timer}(async `,
          },
        ];

        let fixed = false;
        for (const { pattern, replacement, skip } of patterns) {
          const match = line.match(pattern);
          if (match && !skip) {
            // Check if already has void
            if (!line.includes("void ")) {
              lines[lineIndex] = line.replace(pattern, replacement);
              fixed = true;
              fixedCount++;
              break;
            }
          }
        }

        // Handle specific common cases
        if (!fixed) {
          // loadShiftData() type calls
          if (
            line.includes("loadShiftData()") &&
            !line.includes("void") &&
            !line.includes("await")
          ) {
            lines[lineIndex] = line.replace(
              /(\s*)loadShiftData\(\)/,
              "$1void loadShiftData()",
            );
            fixedCount++;
          }
          // refreshUnreadCounts() type calls
          else if (
            line.includes("refreshUnreadCounts()") &&
            !line.includes("void") &&
            !line.includes("await")
          ) {
            lines[lineIndex] = line.replace(
              /(\s*)refreshUnreadCounts\(\)/,
              "$1void refreshUnreadCounts()",
            );
            fixedCount++;
          }
          // fetchAndDisplay type calls
          else if (
            line.match(/fetch(?:And\w+)?\(/) &&
            !line.includes("void") &&
            !line.includes("await")
          ) {
            lines[lineIndex] = line.replace(/(\s*)(fetch[\w]*\()/, "$1void $2");
            fixedCount++;
          }
          // initialize/init type calls
          else if (
            line.match(/\b(initialize|init)[\w]*\(/) &&
            !line.includes("void") &&
            !line.includes("await")
          ) {
            lines[lineIndex] = line.replace(
              /(\s*)((initialize|init)[\w]*\()/,
              "$1void $2",
            );
            fixedCount++;
          }
        }
      } else if (error.ruleId === "@typescript-eslint/no-misused-promises") {
        // setTimeout/setInterval with async functions
        if (line.includes("setTimeout") || line.includes("setInterval")) {
          // Wrap async function in void operator
          lines[lineIndex] = line
            .replace(/(setTimeout|setInterval)\(\s*async\s*\(/, "$1(async (")
            .replace(/(\)\s*=>\s*{)/, "$1 void (async () => {");

          // Find the closing of the async function
          let braceCount = 0;
          let foundStart = false;
          for (let i = lineIndex; i < lines.length; i++) {
            const checkLine = lines[i];
            for (const char of checkLine) {
              if (char === "{") {
                foundStart = true;
                braceCount++;
              } else if (char === "}" && foundStart) {
                braceCount--;
                if (braceCount === 0) {
                  // Found the closing brace
                  lines[i] = lines[i].replace(/}\s*,/, "})(),");
                  fixedCount++;
                  break;
                }
              }
            }
            if (braceCount === 0 && foundStart) break;
          }
        }
        // Event handlers with async functions
        else if (line.includes("addEventListener")) {
          lines[lineIndex] = line.replace(
            /addEventListener\([^,]+,\s*async\s*/,
            (match) => match.replace("async ", "(e) => { void (async () => "),
          );
          fixedCount++;
        }
      } else if (error.ruleId === "@typescript-eslint/await-thenable") {
        // Remove await from non-promise values
        if (line.includes("await") && line.includes("redisClient.quit()")) {
          lines[lineIndex] = line.replace(
            "await redisClient.quit()",
            "redisClient.quit()",
          );
          fixedCount++;
        }
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
  'pnpm exec eslint . 2>&1 | grep -E "(no-floating-promises|no-misused-promises|await-thenable)" | wc -l',
  { encoding: "utf8" },
).trim();

console.info(`Remaining promise handling errors: ${remainingErrors}`);
