#!/usr/bin/env node

const StyleDictionary = require('style-dictionary');
const config = require('../config/style-dictionary.config.js');
const fs = require('fs');
const path = require('path');

console.log('🎨 Building Design Tokens...\n');

// Ensure build directory exists
const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Build each theme
Object.keys(config.themes).forEach((theme) => {
  console.log(`📦 Building ${theme} theme...`);

  const sd = StyleDictionary.extend(config.themes[theme]);
  sd.buildAllPlatforms();

  console.log(`✅ ${theme} theme complete\n`);
});

// Create index file that combines all themes
console.log('📝 Creating index files...');

// CSS Index
const cssIndex = `/* Assixx Design System - All Themes */

/* Default Dark Theme */
@import './variables-dark.css';

/* Light Theme */
@import './variables-light.css';

/* High Contrast Theme */
@import './variables-contrast.css';
`;

fs.writeFileSync(
  path.join(buildDir, 'web', 'css', 'index.css'),
  cssIndex
);

// TypeScript Index
const tsIndex = `// Auto-generated - DO NOT EDIT

export * as dark from './tokens-dark';
export * as light from './tokens-light';
export * as contrast from './tokens-contrast';

export type Theme = 'dark' | 'light' | 'contrast';
`;

fs.writeFileSync(
  path.join(buildDir, 'web', 'ts', 'index.ts'),
  tsIndex
);

// Tailwind Config Merger
const tailwindConfig = `// Auto-generated Tailwind Theme Config

const darkTheme = require('./theme-dark');
const lightTheme = require('./theme-light');
const contrastTheme = require('./theme-contrast');

module.exports = {
  themes: {
    dark: darkTheme,
    light: lightTheme,
    contrast: contrastTheme
  },
  // Use with Tailwind's darkMode: 'class' or darkMode: ['class', '[data-theme="dark"]']
  current: darkTheme // Default theme
};
`;

fs.writeFileSync(
  path.join(buildDir, 'web', 'tailwind', 'index.js'),
  tailwindConfig
);

console.log('✅ Build complete!');
console.log('\n📁 Output locations:');
console.log('   • CSS Variables: build/web/css/');
console.log('   • Tailwind Config: build/web/tailwind/');
console.log('   • TypeScript Types: build/web/ts/');
console.log('   • iOS (Future): build/ios/');
console.log('   • Android (Future): build/android/\n');