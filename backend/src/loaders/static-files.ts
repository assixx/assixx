/**
 * Static Files Configuration Loader
 * Handles serving of static assets with proper caching
 */
import express, { Application, NextFunction, Request, Response } from 'express';
import path from 'path';

/**
 * Centralized static file serving with consistent security headers and caching
 * @param app - Express application
 * @param route - The route path to serve from
 * @param directory - The directory to serve files from
 * @param options - Configuration options
 */
function serveStatic(
  app: Application,
  route: string,
  directory: string,
  options: {
    cacheImages?: boolean; // Cache images for 7 days
    cacheBuild?: boolean; // Cache built JS/CSS for 1 day
    devOnly?: boolean; // Only serve in development
  } = {},
): void {
  // Skip if devOnly and in production
  if (options.devOnly && process.env.NODE_ENV === 'production') {
    return;
  }

  app.use(
    route,
    (req: Request, res: Response, next: NextFunction): void => {
      const filePath = req.path;

      // Security headers for all static files
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');

      // Cache control for images (7 days)
      if (options.cacheImages) {
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'];
        if (imageExtensions.some((ext: string) => filePath.toLowerCase().endsWith(ext))) {
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      }

      // Cache control for built assets (1 day)
      if (options.cacheBuild) {
        const buildExtensions = ['.js', '.css'];
        if (buildExtensions.some((ext: string) => filePath.endsWith(ext))) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      }

      // No cache for development
      if (process.env.NODE_ENV !== 'production' && !options.cacheImages && !options.cacheBuild) {
        res.setHeader('Cache-Control', 'no-store');
      }

      next();
    },
    express.static(directory, {
      index: false, // Disable directory indexing
      dotfiles: 'ignore', // Hide dotfiles
      etag: true, // Enable ETags for caching
      lastModified: true, // Send Last-Modified header
      maxAge:
        options.cacheImages ? '7d'
        : options.cacheBuild ? '1d'
        : 0,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[DEBUG] Static files mounted: ${route} -> ${directory}`);
  }
}

/**
 * Load static files configuration
 * @param app - Express application instance
 */
export function loadStaticFiles(app: Application): void {
  const projectRoot = process.cwd();

  // Define paths
  const frontendPath = path.join(projectRoot, 'frontend');
  const distPath = path.join(frontendPath, 'dist');
  const publicPath = path.join(frontendPath, 'public');
  const srcPath = path.join(frontendPath, 'src');

  // Serve static assets with appropriate caching
  // Assets from SOURCE (images, fonts, etc. that aren't bundled by Vite)
  serveStatic(app, '/assets', path.join(srcPath, 'assets'), { cacheImages: true });
  serveStatic(app, '/images', path.join(publicPath, 'images'), { cacheImages: true });
  serveStatic(app, '/styles', path.join(distPath, 'styles'), { cacheBuild: true });
  serveStatic(app, '/js', path.join(distPath, 'js'), { cacheBuild: true });
  // Serve scripts from SOURCE (not dist) - needed for non-bundled JS files like widget.js
  serveStatic(app, '/scripts', path.join(srcPath, 'scripts'), { cacheBuild: false });

  // Serve uploads directory (user-generated content)
  const uploadsPath = path.join(projectRoot, 'uploads');
  serveStatic(app, '/uploads', uploadsPath, { cacheImages: true });

  // Development-only: Storybook
  if (process.env.NODE_ENV !== 'production') {
    const storybookPath = path.join(projectRoot, 'storybook-static');
    serveStatic(app, '/storybook', storybookPath, { devOnly: true });
  }

  // Serve frontend SPA (must be after API routes)
  // This catches all remaining routes for client-side routing
  serveStatic(app, '/', distPath, { cacheBuild: true });

  console.log('✅ Static file serving configured');
}
