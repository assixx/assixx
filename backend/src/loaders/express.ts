/**
 * Express Basic Configuration Loader
 * Sets up fundamental Express middleware for parsing, logging, etc.
 */
import cookieParser from 'cookie-parser';
import express, { Application } from 'express';
import morgan from 'morgan';

/**
 * Load basic Express configuration
 * @param app - Express application instance
 */
export function loadExpress(app: Application): void {
  // Trust proxy - important for getting correct IPs in Docker/Nginx setup
  if (process.env['NODE_ENV'] === 'production') {
    app.set('trust proxy', 1);
  }
  // Request logging
  if (process.env['NODE_ENV'] !== 'test') {
    app.use(morgan('combined'));
  }

  // Body parsing middleware - MUST be before routes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Cookie parser for session handling
  app.use(cookieParser());

  // Enable case-sensitive and strict routing
  app.set('case sensitive routing', true);
  app.set('strict routing', false);

  console.log('✅ Express basic configuration loaded');
}
