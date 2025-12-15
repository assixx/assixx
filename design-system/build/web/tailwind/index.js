// Auto-generated Tailwind Theme Config

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
