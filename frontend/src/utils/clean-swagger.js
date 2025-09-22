#!/usr/bin/env node

/**
 * Clean Swagger JSON by removing invalid $ref references
 * This is a workaround for the broken Swagger definitions
 */

const fs = require('fs');

// Read the swagger.json file
const swaggerPath = process.argv[2] || 'swagger.json';
const outputPath = process.argv[3] || 'swagger-cleaned.json';

console.log(`Reading ${swaggerPath}...`);
// eslint-disable-next-line security/detect-non-literal-fs-filename -- Command-line argument from user, safe for CLI tool
const swagger = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

// eslint-disable-next-line sonarjs/cognitive-complexity
function cleanRefs(obj, path = '') {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  // If this object has a $ref that points to a non-existent definition
  if (obj.$ref && typeof obj.$ref === 'string' && obj.$ref.startsWith('#/')) {
    // Check if it's a local reference that doesn't exist
    const refPath = obj.$ref.substring(2).split('/');
    let target = swagger;

    for (const segment of refPath) {
      const decodedSegment = decodeURIComponent(segment.replace(/~1/g, '/').replace(/~0/g, '~'));
      if (target && typeof target === 'object' && decodedSegment in target) {
        // eslint-disable-next-line security/detect-object-injection -- decodedSegment is from swagger definition paths, not user input
        target = target[decodedSegment];
      } else {
        // Reference doesn't exist, replace with empty object
        console.warn(`Removing invalid $ref: ${obj.$ref} at ${path}`);
        return {
          description: 'Reference removed due to missing definition',
          type: 'object',
          properties: {},
        };
      }
    }
  }

  // Recursively clean nested objects
  if (Array.isArray(obj)) {
    return obj.map((item, index) => cleanRefs(item, `${path}[${index}]`));
  } else {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      // eslint-disable-next-line security/detect-object-injection -- key is from Object.entries() of swagger object, not user input
      cleaned[key] = cleanRefs(value, `${path}.${key}`);
    }
    return cleaned;
  }
}

console.log('Cleaning invalid references...');
const cleaned = cleanRefs(swagger);

console.log(`Writing cleaned swagger to ${outputPath}...`);
// eslint-disable-next-line security/detect-non-literal-fs-filename -- Command-line argument from user, safe for CLI tool
fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2));

console.log('✅ Done! Invalid $ref references have been removed.');
console.log(`You can now use: npx openapi-typescript ${outputPath} -o src/generated/api-types.ts`);
