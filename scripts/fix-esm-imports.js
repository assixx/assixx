#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function fixImports(dir) {
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const path = join(dir, file.name);

    if (file.isDirectory()) {
      await fixImports(path);
    } else if (file.name.endsWith('.js')) {
      let content = await readFile(path, 'utf8');

      // Fix relative imports without .js extension
      content = content.replace(
        /from ['"](\.[^'"]+)(?<!\.js)(?<!\.json)['"]/g,
        (match, importPath) => {
          // Don't add .js to paths that already have an extension
          if (importPath.includes('.')) {
            const parts = importPath.split('/');
            const lastPart = parts[parts.length - 1];
            if (lastPart.includes('.') && !lastPart.startsWith('.')) {
              return match;
            }
          }
          return `from '${importPath}.js'`;
        }
      );

      await writeFile(path, content);
    }
  }
}

// Run the fix on the dist directory
// Check if we're in backend directory or root
const distPath = process.cwd().endsWith('/backend')
  ? './dist'
  : './backend/dist';
fixImports(distPath).catch(console.error);
