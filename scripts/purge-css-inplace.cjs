#!/usr/bin/env node
/**
 * Purge CSS In-Place
 * Removes unused CSS selectors and overwrites original files
 */

const { PurgeCSS } = require('purgecss');
const fs = require('fs');
const path = require('path');

async function purgeInPlace() {
  console.log('🔥 PURGING UNUSED CSS SELECTORS...\n');

  const configPath = path.join(process.cwd(), 'purgecss.config.cjs');
  const config = require(configPath);

  try {
    const results = await new PurgeCSS().purge(config);

    let totalSaved = 0;
    let filesModified = 0;

    for (const result of results) {
      if (!result.file) continue;

      const originalSize = fs.readFileSync(result.file, 'utf8').length;
      const newSize = result.css.length;
      const saved = originalSize - newSize;

      if (saved > 0) {
        // Overwrite original file
        fs.writeFileSync(result.file, result.css);
        totalSaved += saved;
        filesModified++;

        const shortName = result.file.replace(process.cwd() + '/', '');
        console.log(`✅ ${shortName}: -${(saved / 1024).toFixed(1)}KB`);
      }
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`📊 DONE: ${filesModified} files modified`);
    console.log(`💾 Total saved: ${(totalSaved / 1024).toFixed(1)}KB`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

purgeInPlace();
