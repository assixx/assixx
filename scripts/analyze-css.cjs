#!/usr/bin/env node
/**
 * CSS Usage Analyzer for Assixx
 *
 * This script analyzes CSS files and reports potentially unused selectors.
 * It does NOT modify any files - it's purely for analysis.
 *
 * Usage:
 *   node scripts/analyze-css.cjs [--file <path>] [--verbose]
 *
 * Options:
 *   --file <path>   Analyze a specific CSS file instead of all
 *   --verbose       Show all details including kept selectors
 *   --json          Output as JSON for further processing
 */

const { PurgeCSS } = require('purgecss');
const fs = require('fs');
const path = require('path');

// ANSI colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const jsonOutput = args.includes('--json');
const fileIndex = args.indexOf('--file');
const specificFile = fileIndex !== -1 ? args[fileIndex + 1] : null;

async function analyzeCSS() {
  console.log(
    `${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.bold}${colors.cyan}║           CSS USAGE ANALYZER - Assixx                      ║${colors.reset}`,
  );
  console.log(
    `${colors.bold}${colors.cyan}║           DRY RUN - No files will be modified              ║${colors.reset}`,
  );
  console.log(
    `${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`,
  );
  console.log();

  // Load config
  const configPath = path.join(process.cwd(), 'purgecss.config.cjs');
  if (!fs.existsSync(configPath)) {
    console.error(`${colors.red}Error: purgecss.config.cjs not found${colors.reset}`);
    process.exit(1);
  }

  const config = require(configPath);

  // Override CSS files if specific file provided
  if (specificFile) {
    config.css = [specificFile];
    console.log(`${colors.yellow}Analyzing specific file: ${specificFile}${colors.reset}\n`);
  }

  try {
    const purgeCSSResult = await new PurgeCSS().purge({
      ...config,
      rejected: true,
    });

    const results = {
      totalFiles: purgeCSSResult.length,
      totalRejected: 0,
      files: [],
    };

    console.log(`${colors.bold}📊 Analysis Results${colors.reset}\n`);
    console.log(`${'─'.repeat(60)}`);

    for (const result of purgeCSSResult) {
      const fileName = result.file || 'unknown';
      const rejectedCount = result.rejected?.length || 0;
      const originalSize = result.css?.length || 0;

      // Get original file size
      let originalFileSize = 0;
      if (result.file && fs.existsSync(result.file)) {
        originalFileSize = fs.readFileSync(result.file, 'utf8').length;
      }

      const reduction =
        originalFileSize > 0 ? Math.round((1 - originalSize / originalFileSize) * 100) : 0;

      results.totalRejected += rejectedCount;
      results.files.push({
        file: fileName,
        rejectedCount,
        originalSize: originalFileSize,
        purgedSize: originalSize,
        reduction: `${reduction}%`,
        rejected: result.rejected || [],
      });

      // File header
      const shortName = fileName.replace(process.cwd(), '').replace(/^\//, '');
      const statusColor = rejectedCount > 0 ? colors.yellow : colors.green;
      const statusIcon = rejectedCount > 0 ? '⚠️ ' : '✅';

      console.log(`\n${statusIcon} ${colors.bold}${shortName}${colors.reset}`);
      console.log(
        `   ${colors.dim}Original: ${(originalFileSize / 1024).toFixed(1)}KB → Purged: ${(originalSize / 1024).toFixed(1)}KB (${statusColor}-${reduction}%${colors.reset})`,
      );

      if (rejectedCount > 0) {
        console.log(
          `   ${colors.yellow}Potentially unused selectors: ${rejectedCount}${colors.reset}`,
        );

        if (verbose) {
          console.log(`   ${colors.dim}Rejected selectors:${colors.reset}`);
          (result.rejected || []).slice(0, 50).forEach((selector) => {
            console.log(`     ${colors.red}- ${selector}${colors.reset}`);
          });
          if (rejectedCount > 50) {
            console.log(`     ${colors.dim}... and ${rejectedCount - 50} more${colors.reset}`);
          }
        }
      }
    }

    // Summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`${colors.bold}📈 SUMMARY${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`   Files analyzed: ${results.totalFiles}`);
    console.log(
      `   Total potentially unused selectors: ${colors.yellow}${results.totalRejected}${colors.reset}`,
    );

    // Warnings
    console.log(`\n${colors.bold}⚠️  IMPORTANT WARNINGS${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`${colors.yellow}   1. These are POTENTIAL unused selectors${colors.reset}`);
    console.log(
      `${colors.yellow}   2. Dynamic classes (JS-generated) may show as unused${colors.reset}`,
    );
    console.log(
      `${colors.yellow}   3. Design System classes for future use may show as unused${colors.reset}`,
    );
    console.log(`${colors.yellow}   4. ALWAYS review before deleting anything!${colors.reset}`);

    // Write detailed report
    const reportPath = path.join(process.cwd(), 'css-analysis-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n${colors.green}✅ Detailed report saved to: ${reportPath}${colors.reset}`);

    // JSON output if requested
    if (jsonOutput) {
      console.log(`\n${colors.bold}JSON Output:${colors.reset}`);
      console.log(JSON.stringify(results, null, 2));
    }

    console.log(`\n${colors.cyan}To see rejected selectors, run with --verbose${colors.reset}`);
    console.log(
      `${colors.cyan}To analyze a specific file: node scripts/analyze-css.cjs --file <path>${colors.reset}\n`,
    );
  } catch (error) {
    console.error(`${colors.red}Error during analysis:${colors.reset}`, error);
    process.exit(1);
  }
}

analyzeCSS();
