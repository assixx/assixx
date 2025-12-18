const StyleDictionary = require('style-dictionary');

// Themes die wir bauen wollen
const THEMES = ['dark', 'light', 'contrast'];

// Helper für Theme-spezifische Builds
function getThemeConfig(theme) {
  return {
    source: [
      'tokens/core/**/*.json',
      'tokens/semantic/**/*.json',
      `tokens/themes/${theme}/**/*.json`,
    ],
    platforms: {
      // CSS Variables für Web
      'web-css': {
        transformGroup: 'css',
        buildPath: `build/web/css/`,
        files: [
          {
            destination: `variables-${theme}.css`,
            format: 'css/variables',
            selector: theme === 'dark' ? ':root' : `[data-theme="${theme}"]`,
            options: {
              outputReferences: true,
            },
          },
        ],
      },

      // Tailwind Config
      'web-tailwind': {
        transformGroup: 'js',
        buildPath: `build/web/tailwind/`,
        files: [
          {
            destination: `theme-${theme}.js`,
            format: 'javascript/es6',
          },
        ],
      },

      // TypeScript Types
      'web-typescript': {
        transformGroup: 'js',
        buildPath: `build/web/ts/`,
        files: [
          {
            destination: `tokens-${theme}.ts`,
            format: 'typescript/es6-declarations',
          },
        ],
      },

      // iOS (Future)
      ios: {
        transformGroup: 'ios-swift-separate',
        buildPath: `build/ios/${theme}/`,
        files: [
          {
            destination: 'Colors.swift',
            format: 'ios-swift/class.swift',
            className: `${theme.charAt(0).toUpperCase()}${theme.slice(1)}Colors`,
            filter: {
              attributes: {
                category: 'color',
              },
            },
          },
        ],
      },

      // Android (Future)
      android: {
        transformGroup: 'android',
        buildPath: `build/android/${theme}/`,
        files: [
          {
            destination: 'colors.xml',
            format: 'android/resources',
            filter: {
              attributes: {
                category: 'color',
              },
            },
          },
        ],
      },
    },
  };
}

// Custom Transforms
StyleDictionary.registerTransform({
  name: 'shadow/css',
  type: 'value',
  matcher: (token) => token.attributes.category === 'shadow',
  transformer: (token) => {
    // Konvertiere Shadow Token zu CSS Shadow
    return token.value;
  },
});

// Custom Format für Tailwind
StyleDictionary.registerFormat({
  name: 'tailwind/theme',
  formatter: function ({ dictionary }) {
    return `module.exports = ${JSON.stringify(dictionary.tokens, null, 2)}`;
  },
});

// TypeScript Format
StyleDictionary.registerFormat({
  name: 'typescript/es6-declarations',
  formatter: function ({ dictionary }) {
    const tokens = dictionary.allTokens;
    let output = '// Auto-generated - DO NOT EDIT\n\n';

    output += 'export const tokens = {\n';
    tokens.forEach((token) => {
      const path = token.path.join('.');
      output += `  '${path}': '${token.value}',\n`;
    });
    output += '} as const;\n\n';
    output += 'export type TokenKey = keyof typeof tokens;\n';

    return output;
  },
});

module.exports = {
  // Basis Config für geteilte Tokens
  source: ['tokens/core/**/*.json', 'tokens/semantic/**/*.json'],

  // Build für jedes Theme
  themes: THEMES.reduce((acc, theme) => {
    acc[theme] = getThemeConfig(theme);
    return acc;
  }, {}),
};
