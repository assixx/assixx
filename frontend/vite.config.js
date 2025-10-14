import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import tailwindcss from '@tailwindcss/vite';
import simpleHtmlPlugin from 'vite-plugin-simple-html';

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

  build: {
    outDir: '../dist',
    emptyOutDir: true,
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
        chunkFileNames: 'js/[name].js',
        entryFileNames: 'js/[name].js',
      },
    },
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: true,
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
  },

  css: {
    // PostCSS configuration
    postcss: './postcss.config.js',
    // Enable CSS source maps in development
    devSourcemap: true,
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
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
    },
  },

  optimizeDeps: {
    include: [
      'marked',
      'chart.js',
      'moment',
      '@fullcalendar/core',
      '@fullcalendar/daygrid',
      '@fullcalendar/timegrid',
      '@fullcalendar/interaction',
      '@fullcalendar/list',
    ],
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
          // Skip if already has Google Fonts Outfit
          if (html.includes('fonts.googleapis.com/css2') && html.includes('Outfit')) {
            return html;
          }

          // Add preconnect and font link after <title> tag
          const fontPreloads = `
    <!-- Font Preconnect for Performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet">`;

          return html.replace('</title>', `</title>${fontPreloads}`);
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

        // Copy critical scripts
        const criticalScriptsDir = resolve(distDir, 'scripts/critical');
        if (!existsSync(criticalScriptsDir)) mkdirSync(criticalScriptsDir, { recursive: true });

        const sidebarInitSource = resolve(__dirname, 'src/scripts/critical/sidebar-init.js');
        const sidebarInitDest = resolve(criticalScriptsDir, 'sidebar-init.js');
        if (existsSync(sidebarInitSource)) {
          copyFileSync(sidebarInitSource, sidebarInitDest);
          console.info('✅ Copied sidebar-init.js to dist/scripts/critical');
        }

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
  ],
});
