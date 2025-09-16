#!/usr/bin/env node
/**
 * Script to fix import order issues based on ESLint import-x plugin rules
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all TypeScript files with import order errors
const eslintOutput = execSync('pnpm exec eslint . --format json 2>/dev/null || true', {
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 10,
});

let results;
try {
  results = JSON.parse(eslintOutput);
} catch (e) {
  console.error('Failed to parse ESLint output');
  process.exit(1);
}

let fixedCount = 0;
const filesToFix = new Map();

// Collect all import order errors
results.forEach((file) => {
  const importErrors = file.messages.filter(
    (msg) => msg.ruleId === 'import-x/order' || msg.ruleId === 'import-x/no-duplicates',
  );

  if (importErrors.length > 0) {
    filesToFix.set(file.filePath, importErrors);
  }
});

console.info(`Found ${filesToFix.size} files with import order issues`);

// Fix each file
for (const [filePath, errors] of filesToFix) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Extract all imports
    const imports = [];
    const nonImportLines = [];
    let inImportBlock = false;
    let firstImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this is an import statement
      if (
        trimmed.startsWith('import ') ||
        (inImportBlock &&
          trimmed.length > 0 &&
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('/*'))
      ) {
        if (firstImportIndex === -1) {
          firstImportIndex = i;
        }

        // Handle multi-line imports
        let fullImport = line;
        let j = i;

        // Check if import continues on next lines
        while (j < lines.length - 1 && !fullImport.includes(';') && !fullImport.includes('from')) {
          j++;
          fullImport += '\n' + lines[j];
        }

        // Skip ahead if we consumed multiple lines
        if (j > i) {
          for (let k = i + 1; k <= j; k++) {
            lines[k] = null; // Mark for removal
          }
          i = j;
        }

        imports.push(fullImport);
        inImportBlock = true;
      } else if (inImportBlock && trimmed.length === 0) {
        // Empty line in import block - skip it
        continue;
      } else {
        if (inImportBlock && trimmed.length > 0) {
          inImportBlock = false;
        }
        if (lines[i] !== null) {
          nonImportLines.push({ line, index: i });
        }
      }
    }

    // Categorize imports
    const importCategories = {
      builtin: [],
      external: [],
      internal: [],
      parent: [],
      sibling: [],
      index: [],
      type: [],
    };

    // Node.js built-in modules
    const builtinModules = [
      'fs',
      'path',
      'http',
      'https',
      'crypto',
      'os',
      'util',
      'stream',
      'querystring',
      'child_process',
      'cluster',
      'url',
      'buffer',
      'events',
      'assert',
      'dns',
      'net',
      'tls',
      'readline',
      'vm',
      'zlib',
    ];

    imports.forEach((imp) => {
      // Extract the module path
      const moduleMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
      const importMatch = imp.match(/import\s+['"]([^'"]+)['"]/);
      const module =
        moduleMatch ? moduleMatch[1]
        : importMatch ? importMatch[1]
        : '';

      // Remove duplicate imports
      const isDuplicate = Object.values(importCategories).some((cat) =>
        cat.some((existing) => {
          const existingModule =
            existing.match(/from\s+['"]([^'"]+)['"]/)?.[1] ||
            existing.match(/import\s+['"]([^'"]+)['"]/)?.[1] ||
            '';
          return existingModule === module && module !== '';
        }),
      );

      if (isDuplicate) {
        console.info(`Removing duplicate import: ${module}`);
        return;
      }

      // Type imports
      if (imp.includes('import type')) {
        importCategories.type.push(imp);
      }
      // Built-in modules
      else if (builtinModules.some((m) => module === m || module.startsWith(m + '/'))) {
        importCategories.builtin.push(imp);
      }
      // Relative imports
      else if (module.startsWith('.')) {
        if (module.startsWith('../')) {
          importCategories.parent.push(imp);
        } else if (module.startsWith('./')) {
          if (module === './' || module === './index') {
            importCategories.index.push(imp);
          } else {
            importCategories.sibling.push(imp);
          }
        }
      }
      // External modules
      else if (module && !module.startsWith('@/')) {
        importCategories.external.push(imp);
      }
      // Internal modules (alias imports)
      else {
        importCategories.internal.push(imp);
      }
    });

    // Sort each category alphabetically
    Object.keys(importCategories).forEach((key) => {
      importCategories[key].sort((a, b) => {
        const aModule =
          a.match(/from\s+['"]([^'"]+)['"]/)?.[1] ||
          a.match(/import\s+['"]([^'"]+)['"]/)?.[1] ||
          '';
        const bModule =
          b.match(/from\s+['"]([^'"]+)['"]/)?.[1] ||
          b.match(/import\s+['"]([^'"]+)['"]/)?.[1] ||
          '';
        return aModule.toLowerCase().localeCompare(bModule.toLowerCase());
      });
    });

    // Rebuild the file with sorted imports
    const sortedImports = [];
    const order = ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'];

    for (let i = 0; i < order.length; i++) {
      const category = order[i];
      if (importCategories[category].length > 0) {
        if (sortedImports.length > 0) {
          sortedImports.push(''); // Add blank line between groups
        }
        sortedImports.push(...importCategories[category]);
      }
    }

    // Reconstruct the file
    const newLines = [];

    // Add everything before the first import
    if (firstImportIndex > 0) {
      for (let i = 0; i < firstImportIndex; i++) {
        if (lines[i] !== null) {
          newLines.push(lines[i]);
        }
      }
    }

    // Add sorted imports
    newLines.push(...sortedImports);

    // Add everything after imports
    let addedEmptyLine = false;
    for (const { line, index } of nonImportLines) {
      // Add empty line after imports if needed
      if (!addedEmptyLine && index > firstImportIndex && line.trim().length > 0) {
        newLines.push('');
        addedEmptyLine = true;
      }
      newLines.push(line);
    }

    // Write the fixed content back
    fs.writeFileSync(filePath, newLines.join('\n'));
    fixedCount++;
    console.info(`Fixed import order in ${path.relative(process.cwd(), filePath)}`);
  } catch (e) {
    console.error(`Error processing ${filePath}:`, e.message);
  }
}

console.info(`\nTotal files fixed: ${fixedCount}`);
console.info('Running ESLint to check remaining import issues...');

// Run ESLint again to see how many issues remain
const remainingErrors = execSync(
  'pnpm exec eslint . 2>&1 | grep -E "(import-x/order|import-x/no-duplicates)" | wc -l',
  { encoding: 'utf8' },
).trim();

console.info(`Remaining import order errors: ${remainingErrors}`);
