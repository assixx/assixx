/* eslint-disable max-lines */
/**
 * Bootstrap to Tailwind Class Mapper
 * Helps with migrating Bootstrap classes to Tailwind equivalents
 * Usage: node bootstrap-to-tailwind-mapper.js [html-file]
 */

// Comprehensive Bootstrap to Tailwind mapping
const classMap = {
  // Buttons
  btn: 'btn-glass',
  'btn-primary': 'btn-glass bg-primary hover:bg-primary-hover',
  'btn-secondary': 'btn-glass bg-secondary',
  'btn-success': 'btn-glass bg-success',
  'btn-danger': 'btn-glass bg-error',
  'btn-warning': 'btn-glass bg-warning',
  'btn-info': 'btn-glass bg-primary',
  'btn-light': 'btn-glass bg-gray-200',
  'btn-dark': 'btn-glass bg-gray-800',
  'btn-outline-primary': 'btn-glass border-primary text-primary hover:bg-primary hover:text-white',
  'btn-lg': 'px-6 py-3 text-lg',
  'btn-sm': 'px-3 py-1 text-sm',
  'btn-block': 'w-full',

  // Forms
  'form-control': 'input-glass',
  'form-group': 'form-group',
  'form-label': 'form-label',
  'form-select': 'form-select',
  'form-check': 'flex items-center',
  'form-check-input': 'form-checkbox mr-2',
  'form-check-label': 'text-sm',
  'invalid-feedback': 'text-error text-sm mt-1',
  'valid-feedback': 'text-success text-sm mt-1',

  // Grid System
  container: 'container-glass',
  'container-fluid': 'w-full px-4',
  row: 'flex flex-wrap -mx-2',
  col: 'px-2',
  'col-1': 'w-1/12 px-2',
  'col-2': 'w-2/12 px-2',
  'col-3': 'w-3/12 px-2',
  'col-4': 'w-4/12 px-2',
  'col-5': 'w-5/12 px-2',
  'col-6': 'w-6/12 px-2',
  'col-7': 'w-7/12 px-2',
  'col-8': 'w-8/12 px-2',
  'col-9': 'w-9/12 px-2',
  'col-10': 'w-10/12 px-2',
  'col-11': 'w-11/12 px-2',
  'col-12': 'w-full px-2',

  // Responsive Grid
  'col-sm-6': 'w-full sm:w-6/12 px-2',
  'col-md-4': 'w-full md:w-4/12 px-2',
  'col-md-6': 'w-full md:w-6/12 px-2',
  'col-md-8': 'w-full md:w-8/12 px-2',
  'col-lg-3': 'w-full lg:w-3/12 px-2',
  'col-lg-4': 'w-full lg:w-4/12 px-2',
  'col-lg-6': 'w-full lg:w-6/12 px-2',
  'col-xl-3': 'w-full xl:w-3/12 px-2',

  // Cards
  card: 'glass-card',
  'card-body': 'p-6',
  'card-header': 'px-6 py-4 border-b border-glass',
  'card-footer': 'px-6 py-4 border-t border-glass',
  'card-title': 'text-xl font-semibold mb-2',
  'card-text': 'text-secondary',
  'card-img-top': 'w-full rounded-t-lg',

  // Navigation
  navbar: 'nav-glass',
  'navbar-brand': 'text-xl font-bold',
  'navbar-nav': 'flex space-x-4',
  'nav-item': '',
  'nav-link': 'px-3 py-2 rounded hover:bg-glass-hover',
  'navbar-toggler': 'md:hidden',
  'navbar-collapse': 'md:flex',

  // Alerts
  alert: 'alert-glass',
  'alert-primary': 'alert-glass border-primary',
  'alert-secondary': 'alert-glass border-secondary',
  'alert-success': 'alert-glass alert-success',
  'alert-danger': 'alert-glass alert-error',
  'alert-warning': 'alert-glass alert-warning',
  'alert-info': 'alert-glass border-primary',
  'alert-dismissible': 'relative pr-10',

  // Badges
  badge: 'badge-glass',
  'badge-primary': 'badge-glass bg-primary',
  'badge-secondary': 'badge-glass bg-secondary',
  'badge-success': 'badge-glass bg-success',
  'badge-danger': 'badge-glass bg-error',
  'badge-warning': 'badge-glass bg-warning',
  'badge-info': 'badge-glass bg-primary',
  'badge-pill': 'rounded-full',

  // Tables
  table: 'table-glass',
  'table-striped': 'table-glass',
  'table-bordered': 'table-glass border',
  'table-hover': 'table-glass',
  'table-responsive': 'overflow-x-auto',
  'thead-dark': 'bg-gray-800',
  'thead-light': 'bg-gray-200',

  // Modals
  modal: 'modal-glass',
  'modal-dialog': 'modal-content-glass',
  'modal-content': '',
  'modal-header': 'px-6 py-4 border-b border-glass',
  'modal-body': 'p-6',
  'modal-footer': 'px-6 py-4 border-t border-glass',
  'modal-title': 'text-xl font-semibold',

  // Utilities - Display
  'd-none': 'd-none',
  'd-inline': 'd-inline',
  'd-inline-block': 'd-inline-block',
  'd-block': 'd-block',
  'd-flex': 'd-flex',
  'd-inline-flex': 'd-inline-flex',
  'd-grid': 'd-grid',

  // Utilities - Flexbox
  'flex-row': 'flex-row',
  'flex-column': 'flex-column',
  'flex-wrap': 'flex-wrap',
  'flex-nowrap': 'flex-nowrap',
  'justify-content-start': 'justify-start',
  'justify-content-end': 'justify-end',
  'justify-content-center': 'justify-center',
  'justify-content-between': 'justify-between',
  'justify-content-around': 'justify-around',
  'align-items-start': 'align-start',
  'align-items-end': 'align-end',
  'align-items-center': 'align-center',
  'align-items-stretch': 'align-stretch',
  'align-self-auto': 'self-auto',
  'align-self-start': 'self-start',
  'align-self-end': 'self-end',
  'align-self-center': 'self-center',
  'align-self-stretch': 'self-stretch',

  // Utilities - Spacing
  'm-0': 'm-0',
  'm-1': 'm-1',
  'm-2': 'm-2',
  'm-3': 'm-3',
  'm-4': 'm-4',
  'm-5': 'm-5',
  'mt-0': 'mt-0',
  'mt-1': 'mt-1',
  'mt-2': 'mt-2',
  'mt-3': 'mt-3',
  'mt-4': 'mt-4',
  'mt-5': 'mt-5',
  'mb-0': 'mb-0',
  'mb-1': 'mb-1',
  'mb-2': 'mb-2',
  'mb-3': 'mb-3',
  'mb-4': 'mb-4',
  'mb-5': 'mb-5',
  'ms-0': 'ms-0',
  'ms-1': 'ms-1',
  'ms-2': 'ms-2',
  'ms-3': 'ms-3',
  'ms-4': 'ms-4',
  'ms-5': 'ms-5',
  'me-0': 'me-0',
  'me-1': 'me-1',
  'me-2': 'me-2',
  'me-3': 'me-3',
  'me-4': 'me-4',
  'me-5': 'me-5',
  'mx-auto': 'mx-auto',
  'my-auto': 'my-auto',
  'p-0': 'p-0',
  'p-1': 'p-1',
  'p-2': 'p-2',
  'p-3': 'p-3',
  'p-4': 'p-4',
  'p-5': 'p-5',
  'pt-0': 'pt-0',
  'pt-1': 'pt-1',
  'pt-2': 'pt-2',
  'pt-3': 'pt-3',
  'pt-4': 'pt-4',
  'pt-5': 'pt-5',
  'pb-0': 'pb-0',
  'pb-1': 'pb-1',
  'pb-2': 'pb-2',
  'pb-3': 'pb-3',
  'pb-4': 'pb-4',
  'pb-5': 'pb-5',
  'ps-0': 'ps-0',
  'ps-1': 'ps-1',
  'ps-2': 'ps-2',
  'ps-3': 'ps-3',
  'ps-4': 'ps-4',
  'ps-5': 'ps-5',
  'pe-0': 'pe-0',
  'pe-1': 'pe-1',
  'pe-2': 'pe-2',
  'pe-3': 'pe-3',
  'pe-4': 'pe-4',
  'pe-5': 'pe-5',

  // Utilities - Text
  'text-left': 'text-left',
  'text-center': 'text-center',
  'text-right': 'text-right',
  'text-justify': 'text-justify',
  'text-lowercase': 'text-lowercase',
  'text-uppercase': 'text-uppercase',
  'text-capitalize': 'text-capitalize',
  'fw-normal': 'font-normal',
  'fw-bold': 'font-bold',
  'fw-light': 'font-light',
  'fs-1': 'text-4xl',
  'fs-2': 'text-3xl',
  'fs-3': 'text-2xl',
  'fs-4': 'text-xl',
  'fs-5': 'text-lg',
  'fs-6': 'text-base',
  'text-primary': 'text-primary',
  'text-secondary': 'text-secondary',
  'text-success': 'text-success',
  'text-danger': 'text-error',
  'text-warning': 'text-warning',
  'text-info': 'text-primary',
  'text-light': 'text-gray-200',
  'text-dark': 'text-gray-800',
  'text-muted': 'text-muted',
  'text-white': 'text-white',

  // Utilities - Background
  'bg-primary': 'bg-primary',
  'bg-secondary': 'bg-secondary',
  'bg-success': 'bg-success',
  'bg-danger': 'bg-error',
  'bg-warning': 'bg-warning',
  'bg-info': 'bg-primary',
  'bg-light': 'bg-gray-200',
  'bg-dark': 'bg-gray-800',
  'bg-white': 'bg-white',
  'bg-transparent': 'bg-transparent',

  // Utilities - Border
  border: 'border',
  'border-0': 'border-0',
  'border-primary': 'border-primary',
  'border-secondary': 'border-secondary',
  'border-success': 'border-success',
  'border-danger': 'border-error',
  'border-warning': 'border-warning',
  rounded: 'rounded',
  'rounded-0': 'rounded-0',
  'rounded-circle': 'rounded-full',
  'rounded-pill': 'rounded-full',

  // Utilities - Width & Height
  'w-25': 'w-25',
  'w-50': 'w-50',
  'w-75': 'w-75',
  'w-100': 'w-100',
  'w-auto': 'w-auto',
  'h-25': 'h-25',
  'h-50': 'h-50',
  'h-75': 'h-75',
  'h-100': 'h-100',
  'h-auto': 'h-auto',

  // Utilities - Position
  'position-static': 'position-static',
  'position-relative': 'position-relative',
  'position-absolute': 'position-absolute',
  'position-fixed': 'position-fixed',
  'position-sticky': 'position-sticky',

  // Utilities - Overflow
  'overflow-auto': 'overflow-auto',
  'overflow-hidden': 'overflow-hidden',
  'overflow-visible': 'overflow-visible',
  'overflow-scroll': 'overflow-scroll',

  // Utilities - Visibility
  visible: 'visible',
  invisible: 'invisible',

  // Utilities - Opacity
  'opacity-0': 'opacity-0',
  'opacity-25': 'opacity-25',
  'opacity-50': 'opacity-50',
  'opacity-75': 'opacity-75',
  'opacity-100': 'opacity-100',
};

/**
 * Convert Bootstrap classes to Tailwind
 * @param {string} classString - Original class string
 * @returns {string} - Converted class string
 */
function convertClasses(classString) {
  if (!classString) return '';

  const classes = classString.split(/\s+/);
  const converted = new Set();
  const unconverted = new Set();

  classes.forEach((cls) => {
    // Validate class name to prevent object injection
    if (typeof cls === 'string' && Object.prototype.hasOwnProperty.call(classMap, cls)) {
      // Add all space-separated classes from the mapping
      // eslint-disable-next-line security/detect-object-injection -- cls is validated via hasOwnProperty.call() check above
      const mappedClasses = classMap[cls];
      if (typeof mappedClasses === 'string') {
        mappedClasses.split(/\s+/).forEach((c) => converted.add(c));
      }
    } else {
      // Keep unconverted classes
      unconverted.add(cls);
    }
  });

  // Combine converted and unconverted classes
  return [...converted, ...unconverted].join(' ');
}

/**
 * Process HTML file and convert Bootstrap classes
 * @param {string} html - HTML content
 * @returns {string} - Converted HTML
 */
function processHTML(html) {
  // Regular expression to match class attributes
  const classRegex = /class="([^"]*)"/g;

  let convertedHTML = html;
  let match;
  const replacements = [];

  // Find all class attributes
  while ((match = classRegex.exec(html)) !== null) {
    const originalClasses = match[1];
    const convertedClasses = convertClasses(originalClasses);

    if (originalClasses !== convertedClasses) {
      replacements.push({
        original: `class="${originalClasses}"`,
        converted: `class="${convertedClasses}"`,
        line: html.substring(0, match.index).split('\n').length,
      });
    }
  }

  // Apply replacements
  replacements.forEach((replacement) => {
    convertedHTML = convertedHTML.replace(replacement.original, replacement.converted);
  });

  return { convertedHTML, replacements };
}

/**
 * Generate migration report
 * @param {Array} replacements - Array of replacements made
 * @returns {string} - Report string
 */
function generateReport(replacements) {
  if (replacements.length === 0) {
    return 'No Bootstrap classes found to convert.';
  }

  let report = `\n📊 Migration Report\n`;
  report += `${'='.repeat(50)}\n`;
  report += `Total conversions: ${replacements.length}\n\n`;

  replacements.forEach((r, index) => {
    report += `${index + 1}. Line ${r.line}:\n`;
    report += `   Before: ${r.original}\n`;
    report += `   After:  ${r.converted}\n\n`;
  });

  return report;
}

// CLI functionality
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📚 Bootstrap to Tailwind Class Mapper
=====================================

Usage: node bootstrap-to-tailwind-mapper.js [options] <file>

Options:
  --dry-run    Show what would be changed without modifying the file
  --output     Specify output file (default: overwrites input)
  --report     Generate detailed migration report

Examples:
  node bootstrap-to-tailwind-mapper.js admin-dashboard.html
  node bootstrap-to-tailwind-mapper.js --dry-run index.html
  node bootstrap-to-tailwind-mapper.js --output=migrated.html original.html
    `);
    process.exit(0);
  }

  const options = {
    dryRun: args.includes('--dry-run'),
    report: args.includes('--report'),
    output: null,
    input: null,
  };

  // Parse arguments
  args.forEach((arg) => {
    if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (!arg.startsWith('--')) {
      options.input = arg;
    }
  });

  if (!options.input) {
    console.error('❌ Error: No input file specified');
    process.exit(1);
  }

  // Validate and sanitize input path
  if (!options.input || typeof options.input !== 'string') {
    console.error('❌ Error: Invalid input file');
    process.exit(1);
  }

  // Resolve and validate input path
  const inputPath = path.resolve(options.input);

  // Security: Validate path is within project
  const projectRoot = path.resolve(process.cwd());
  if (!inputPath.startsWith(projectRoot)) {
    console.error('❌ Error: Input file must be within project directory');
    process.exit(1);
  }

  // Check file exists with validated path
  try {
    fs.accessSync(inputPath, fs.constants.R_OK);
  } catch {
    console.error(`❌ Error: File not found or not readable: ${inputPath}`);
    process.exit(1);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- inputPath is validated against projectRoot above (lines 450-453)
  const html = fs.readFileSync(inputPath, 'utf8');
  const { convertedHTML, replacements } = processHTML(html);

  // Generate report
  if (options.report || options.dryRun) {
    console.log(generateReport(replacements));
  }

  // Write output
  if (!options.dryRun) {
    // Validate output path
    const outputPath = options.output ? path.resolve(options.output) : inputPath;

    // Security: Validate output path is within project
    if (!outputPath.startsWith(projectRoot)) {
      console.error('❌ Error: Output file must be within project directory');
      process.exit(1);
    }

    // Write with validated path
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- outputPath is validated against projectRoot above (lines 477-480)
      fs.writeFileSync(outputPath, convertedHTML, 'utf8');
    } catch (error) {
      console.error(`❌ Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
    console.log(`✅ Successfully converted ${replacements.length} Bootstrap classes`);
    console.log(`📁 Output saved to: ${outputPath}`);
  } else {
    console.log('\n🔍 Dry run complete - no files modified');
  }
}

// Export for use as module
module.exports = {
  classMap,
  convertClasses,
  processHTML,
  generateReport,
};
