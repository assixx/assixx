#!/usr/bin/env node
/* eslint-env node */
/* global process, __dirname, console */

// Temporär NODE_ENV setzen
process.env.NODE_ENV = 'development';

const { swaggerSpec } = require('../backend/src/config/swagger');
const fs = require('fs');
const path = require('path');

// Spec als JSON speichern
const outputPath = path.join(__dirname, '../docs/openapi-spec.json');
fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));

console.info(`OpenAPI Spec exported to: ${outputPath}`);
console.info(`Total Paths: ${Object.keys(swaggerSpec.paths || {}).length}`);
console.info(`Total Schemas: ${Object.keys(swaggerSpec.components?.schemas || {}).length}`);
