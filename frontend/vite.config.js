import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import tailwindcss from '@tailwindcss/vite';
import simpleHtmlPlugin from 'vite-plugin-simple-html';
import { visualizer } from 'rollup-plugin-visualizer';

// Get all HTML files from src/pages
const getHtmlInputs = () => {
  const inputs = {};
  const pagesDir = resolve(__dirname, 'src/pages');
  readdirSync(pagesDir)
    .filter((file) => file.endsWith('.html'))
    .forEach((file) => {
      const name = file.replace('.html', '');
      // eslint-disable-next-line security/detect-object-injection -- Safe: name comes from local filesystem during build
      inputs[name] = resolve(pagesDir, file);
    });

  return inputs;
};

export default defineConfig({
  root: 'src',
  base: '/',

  // 🔥 NEW: Cache Directory Optimization (Best Practice 2025)
  cacheDir: '../node_modules/.vite',

  build: {
    outDir: '../dist',
    emptyOutDir: true,

    // 🔥 NEW: Source Maps für Production Debugging
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,

    // 🔥 OPTIMIZED: Better Chunk Strategy
    rollupOptions: {
      input: getHtmlInputs(),
      output: {
        // Asset naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          // Handle FontAwesome CSS specifically
          if (assetInfo.name && assetInfo.name.includes('fontawesome')) {
            return 'css/[name][extname]';
          }
          if (/css/.test(ext)) {
            return 'css/[name]-[hash][extname]';
          }
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'images/[name]-[hash][extname]';
          }
          if (/woff|woff2|eot|ttf|otf/.test(ext)) {
            return 'fonts/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name].js',

        // OPTIMIZED: Manual Chunk Split Strategy with Lazy Loading Support
        // Split large libraries into separate chunks for on-demand loading
        manualChunks(id) {
          // CRITICAL: Password Strength Library - Split into smaller chunks!
          // Each module loads independently, keeping all chunks under 2MB
          if (id.includes('@zxcvbn-ts/core')) {
            return 'zxcvbn-core'; // ~800 KB - Core logic
          }
          if (id.includes('@zxcvbn-ts/language-common')) {
            return 'zxcvbn-common'; // ~1.2 MB - Common dictionaries
          }
          if (id.includes('@zxcvbn-ts/language-de')) {
            return 'zxcvbn-de'; // ~1.2 MB - German dictionaries
          }

          // FullCalendar: Split each plugin into separate chunks for lazy loading
          // This allows loading only the plugins needed for the current view
          if (id.includes('@fullcalendar/core')) {
            return 'fullcalendar-core'; // ~450 KB - Lazy load on calendar page
          }
          if (id.includes('@fullcalendar/daygrid')) {
            return 'fullcalendar-daygrid'; // ~150 KB - Loaded on demand (month view)
          }
          if (id.includes('@fullcalendar/timegrid')) {
            return 'fullcalendar-timegrid'; // ~200 KB - Loaded on demand (week/day view)
          }
          if (id.includes('@fullcalendar/interaction')) {
            return 'fullcalendar-interaction'; // ~100 KB - Loaded on demand (edit mode)
          }
          if (id.includes('@fullcalendar/list')) {
            return 'fullcalendar-list'; // ~80 KB - Loaded on demand (list view)
          }

          // Marked.js - Markdown parser (188 KB) - only for blackboard/calendar
          if (id.includes('marked')) {
            return 'marked.min'; // Lazy load only on markdown pages
          }

          // DOMPurify - small utility (~50 KB), can stay in common vendor
          if (id.includes('dompurify')) {
            return 'vendor-utils';
          }

          // Generic vendor chunk (should be minimal now - only shared utilities)
          // Most large libraries are now separated above
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        // In Production: Entferne nur debug/log/info, BEHALTE error/warn!
        drop_console: false, // Don't drop ALL console calls
        drop_debugger: true,
        // 🔥 NEW: More aggressive compression
        passes: 2,
        // Selektiv entfernen: debug/log/info werden entfernt, error/warn bleiben
        pure_funcs:
          process.env.NODE_ENV === 'production' ? ['console.debug', 'console.log', 'console.info'] : ['console.debug'],
      },
      // 🔥 NEW: Better mangle options
      mangle: {
        safari10: true,
      },
    },
    // 🔥 OPTIMIZED: Chunk size warning limit
    // With granular chunking, all chunks should be under 2MB
    chunkSizeWarningLimit: 2000, // Standard limit - no large chunks anymore

    // 🔥 NEW: CSS Code Split Control
    cssCodeSplit: true,

    // 🔥 NEW: Control asset inlining
    assetsInlineLimit: 4096, // 4KB
  },

  css: {
    // PostCSS configuration
    postcss: './postcss.config.js',
    // Enable CSS source maps in development
    devSourcemap: true,

    // 🔥 NEW: CSS Modules configuration
    modules: {
      localsConvention: 'camelCase',
      generateScopedName:
        process.env.NODE_ENV === 'production' ? '[hash:base64:5]' : '[name]__[local]__[hash:base64:5]',
    },
  },

  server: {
    port: 5173,

    // 🔥 NEW: Enhanced HMR Configuration (Best Practice 2025)
    hmr: {
      overlay: true,
      port: 5173,
      protocol: 'ws',
      host: 'localhost',
    },

    // 🔥 NEW: File Watching for WSL2/Docker environments
    watch: {
      // Use polling in WSL2/Docker
      usePolling: process.env.WSL_DISTRO_NAME ? true : false,
      interval: 100, // Check every 100ms when polling

      // Ignore patterns
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    },

    // 🔥 NEW: Warm up frequently used modules (Performance Optimization)
    warmup: {
      clientFiles: [
        './scripts/auth/index.ts',
        './scripts/components/unified-navigation.ts',
        './styles/main.css',
        './styles/tailwind.css',
      ],
    },

    // 🔥 NEW: HTTP/2 Push Headers
    headers: {
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },

    // 🔥 NEW: CORS configuration for development
    cors: true,

    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,

        // 🔥 NEW: WebSocket support
        ws: true,

        // 🔥 NEW: Better error handling
        configure: (proxy, options) => {
          proxy.on('error', (err, _req, res) => {
            console.error('Proxy error:', err);
          });
        },
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@styles': resolve(__dirname, './src/styles'),
      '@scripts': resolve(__dirname, './src/scripts'),
      '@components': resolve(__dirname, './src/components'),
      '@assets': resolve(__dirname, './src/assets'),
      // 🔥 NEW: Additional useful aliases
      '@utils': resolve(__dirname, './src/scripts/utils'),
      '@types': resolve(__dirname, './src/types'),
    },

    // 🔥 NEW: Extensions order (reduces filesystem checks)
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },

  optimizeDeps: {
    // 🔥 OPTIMIZED: Include more dependencies
    include: [
      '@fullcalendar/core',
      '@fullcalendar/daygrid',
      '@fullcalendar/timegrid',
      '@fullcalendar/interaction',
      '@fullcalendar/list',
      'dompurify',
    ],

    // 🔥 NEW: Exclude certain packages from optimization
    // CRITICAL: Exclude zxcvbn to ensure dynamic imports work properly!
    exclude: ['@zxcvbn-ts/core', '@zxcvbn-ts/language-common', '@zxcvbn-ts/language-de'],

    // 🔥 NEW: Force optimization even if cached (useful in development)
    force: false,

    // 🔥 NEW: Performance optimization for large codebases
    holdUntilCrawlEnd: false,

    // 🔥 NEW: ESM interop for problematic dependencies
    needsInterop: [],

    // 🔥 NEW: Custom entries for pre-bundling
    entries: ['src/pages/*.html', 'src/scripts/**/*.ts'],
  },

  // 🔥 NEW: JSON import optimization
  json: {
    namedExports: true,
    stringify: 'auto', // Stringify large JSON for better performance
  },

  // 🔥 NEW: Worker optimization
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'js/worker-[name]-[hash].js',
      },
    },
  },

  // 🔥 NEW: Preview server configuration
  preview: {
    port: 4173,
    strictPort: false,
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  },

  // 🔥 NEW: Experimental features for performance
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js') {
        return { relative: true };
      }
      return { relative: true };
    },
  },

  // 🔥 NEW: Future flags for upcoming deprecations
  future: {
    removeServerModuleGraph: 'warn',
    removeServerTransformRequest: 'warn',
  },

  // Custom plugins
  plugins: [
    // Tailwind CSS Plugin - MUST BE FIRST
    tailwindcss(),

    // HTML Minification Plugin - SWC-based (modern, fast)
    simpleHtmlPlugin({
      minify: {
        collapseWhitespaces: 'all', // Remove all whitespace
        minifyCss: true, // Minify inline CSS
        minifyJs: true, // Minify inline JS
        minifyJson: true, // Minify JSON
        removeComments: true, // Remove HTML comments (FullCalendar now bundled via npm)
      },
    }),

    // Plugin to inject font preloads into all HTML files
    {
      name: 'inject-font-preloads',
      transformIndexHtml: {
        order: 'pre', // Run before other transformations
        handler(html, ctx) {
          let modifiedHtml = html;

          // 1. Inject Outfit font if not present
          if (!html.includes('fonts.googleapis.com/css2') || !html.includes('Outfit')) {
            const outfitFont = `
    <!-- Font Preconnect for Performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet">`;
            modifiedHtml = modifiedHtml.replace('</title>', `</title>${outfitFont}`);
          }

          // 2. Inject Material Symbols if not present (Best Practice 2025)
          if (!html.includes('Material+Symbols+Outlined')) {
            const materialSymbols = `
    <!-- Material Symbols - Google Icons (Best Practice 2025) -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined">`;
            modifiedHtml = modifiedHtml.replace('</title>', `</title>${materialSymbols}`);
          }

          return modifiedHtml;
        },
      },
    },
    // Plugin to handle critical scripts (sidebar-init.js)
    {
      name: 'handle-critical-scripts',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          // Temporarily comment out critical scripts to avoid warnings during build
          return html.replace(
            /<script src="\/scripts\/critical\/sidebar-init\.js"[^>]*><\/script>/g,
            '<!-- CRITICAL_SCRIPT: $& -->',
          );
        },
      },
    },
    {
      name: 'restore-critical-scripts',
      enforce: 'post', // Run AFTER all other plugins including minification
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          // Restore critical scripts after processing
          return html.replace(/<!-- CRITICAL_SCRIPT: (<script[^>]*><\/script>) -->/g, '$1');
        },
      },
    },
    {
      name: 'copy-static-assets',
      writeBundle() {
        // Copy static library files
        const scriptsDir = resolve(__dirname, '../dist/scripts/lib');
        const stylesDir = resolve(__dirname, '../dist/styles/lib');
        const fontsDir = resolve(__dirname, '../dist/fonts');
        const distDir = resolve(__dirname, '../dist');

        // Create directories if they don't exist
        if (!existsSync(scriptsDir)) mkdirSync(scriptsDir, { recursive: true });
        if (!existsSync(stylesDir)) mkdirSync(stylesDir, { recursive: true });
        if (!existsSync(fontsDir)) mkdirSync(fontsDir, { recursive: true });

        // TEMPORARILY DISABLED FOR TESTING - sidebar-init.js might not be needed
        // const criticalScriptsDir = resolve(distDir, 'scripts/critical');
        // if (!existsSync(criticalScriptsDir)) mkdirSync(criticalScriptsDir, { recursive: true });

        // const sidebarInitSource = resolve(__dirname, 'src/scripts/critical/sidebar-init.js');
        // const sidebarInitDest = resolve(criticalScriptsDir, 'sidebar-init.js');
        // if (existsSync(sidebarInitSource)) {
        //   copyFileSync(sidebarInitSource, sidebarInitDest);
        //   console.info('✅ Copied sidebar-init.js to dist/scripts/critical');
        // }

        // Copy purify.min.js to dist/js
        const jsDir = resolve(distDir, 'js');
        if (!existsSync(jsDir)) mkdirSync(jsDir, { recursive: true });

        const purifySource = resolve(__dirname, 'public/js/purify.min.js');
        const purifyDest = resolve(jsDir, 'purify.min.js');
        if (existsSync(purifySource)) {
          copyFileSync(purifySource, purifyDest);
          console.info('✅ Copied purify.min.js to dist/js');
        }

        // Copy FullCalendar CSS (v6 doesn't export CSS from npm package)
        const fullcalendarCssSrc = resolve(__dirname, 'src/styles/lib/fullcalendar.min.css');
        if (existsSync(fullcalendarCssSrc)) {
          copyFileSync(fullcalendarCssSrc, resolve(stylesDir, 'fullcalendar.min.css'));
        }

        // Copy FontAwesome CSS (still external)
        const fontawesomeCssSrc = resolve(__dirname, 'src/styles/lib/fontawesome.min.css');
        if (existsSync(fontawesomeCssSrc)) {
          copyFileSync(fontawesomeCssSrc, resolve(stylesDir, 'fontawesome.min.css'));
        }

        // Copy FontAwesome webfonts
        const webfontsDir = resolve(__dirname, 'src/fonts');
        if (existsSync(webfontsDir)) {
          readdirSync(webfontsDir).forEach((file) => {
            if (file.startsWith('fa-')) {
              copyFileSync(resolve(webfontsDir, file), resolve(fontsDir, file));
            }
          });
        }
      },
    },

    // 🔥 NEW: Performance monitoring plugin
    {
      name: 'vite-plugin-performance',
      configResolved(config) {
        if (process.env.DEBUG_PERFORMANCE) {
          console.log('🚀 Vite Performance Mode Enabled');
        }
      },
      buildStart() {
        if (process.env.DEBUG_PERFORMANCE) {
          console.time('Build Time');
        }
      },
      buildEnd() {
        if (process.env.DEBUG_PERFORMANCE) {
          console.timeEnd('Build Time');
        }
      },
    },

    // 🔥 Bundle Analyzer - Visualize bundle composition (Best Practice 2025)
    // MUST BE LAST PLUGIN for accurate analysis after all transformations
    visualizer({
      filename: './dist/bundle-stats.html',
      title: 'Assixx Bundle Analysis',
      template: 'treemap', // Best for multi-page apps: treemap | sunburst | network | list
      open: false, // Set to true to auto-open in browser after build
      gzipSize: true, // Show real gzip sizes (what users download)
      brotliSize: false, // Enable when Brotli compression is active
      sourcemap: false, // Use sourcemaps for more accurate size calculation
      projectRoot: process.cwd(), // Root for relative file paths
    }),
  ],
});
