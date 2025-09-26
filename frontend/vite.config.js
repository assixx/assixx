import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync, mkdirSync, copyFileSync } from 'fs';

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
    include: ['marked', 'chart.js', 'moment'],
    exclude: ['fullcalendar', 'fullcalendar-locales'],
  },

  // Custom plugins
  plugins: [
    // Plugin to handle external scripts
    {
      name: 'handle-external-scripts',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          // Temporarily comment out external scripts to avoid warnings
          return html
            .replace(
              /<script src="\/scripts\/critical\/sidebar-init\.js"[^>]*><\/script>/g,
              '<!-- CRITICAL_SCRIPT: $& -->',
            )
            .replace(/<script src="\/scripts\/lib\/fullcalendar[^"]*"[^>]*><\/script>/g, '<!-- EXTERNAL_SCRIPT: $& -->')
            .replace(/<link[^>]*href="[^"]*fontawesome[^"]*\.css"[^>]*>/g, '<!-- EXTERNAL_STYLE: $& -->');
        },
      },
    },
    {
      name: 'restore-external-scripts',
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          // Restore external scripts after processing
          return html
            .replace(/<!-- CRITICAL_SCRIPT: (<script[^>]*><\/script>) -->/g, '$1')
            .replace(/<!-- EXTERNAL_SCRIPT: (<script[^>]*><\/script>) -->/g, '$1')
            .replace(/<!-- EXTERNAL_STYLE: (<link[^>]*>) -->/g, '$1');
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

        // Copy FullCalendar JS files
        const fullcalendarSrc = resolve(__dirname, 'src/scripts/lib/fullcalendar.min.js');
        const fullcalendarLocalesSrc = resolve(__dirname, 'src/scripts/lib/fullcalendar-locales.min.js');
        const fullcalendarCssSrc = resolve(__dirname, 'src/styles/lib/fullcalendar.min.css');
        const fontawesomeCssSrc = resolve(__dirname, 'src/styles/lib/fontawesome.min.css');

        if (existsSync(fullcalendarSrc)) {
          copyFileSync(fullcalendarSrc, resolve(scriptsDir, 'fullcalendar.min.js'));
        }
        if (existsSync(fullcalendarLocalesSrc)) {
          copyFileSync(fullcalendarLocalesSrc, resolve(scriptsDir, 'fullcalendar-locales.min.js'));
        }
        if (existsSync(fullcalendarCssSrc)) {
          copyFileSync(fullcalendarCssSrc, resolve(stylesDir, 'fullcalendar.min.css'));
        }
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
