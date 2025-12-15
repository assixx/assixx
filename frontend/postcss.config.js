export default {
  plugins: {
    // WICHTIG: Reihenfolge ist entscheidend!

    // 1. Import muss zuerst kommen - löst @import statements auf
    'postcss-import': {
      // Erlaubt @import aus node_modules
      path: ['src/styles', 'node_modules'],
    },

    // 2. CSS Nesting - Erlaubt verschachtelte Selektoren (auch für Tailwind @apply)
    'postcss-nesting': {
      // Nutzt die offizielle CSS Nesting Spec
      edition: '2024-02',
    },

    // 3. Custom Media Queries - Definiere Breakpoints einmal
    'postcss-custom-media': {
      // Beispiel Breakpoints - können in CSS genutzt werden
      preserve: false,
    },

    // 4. Moderne CSS Features
    'postcss-preset-env': {
      stage: 2, // Stabile Features
      features: {
        'nesting-rules': false, // Wir nutzen postcss-nesting stattdessen
        'custom-properties': false, // CSS Variables
        'custom-media-queries': true, // @custom-media
        'has-pseudo-class': true, // :has()
        'is-pseudo-class': true, // :is()
        'not-pseudo-class': false, // DISABLED - Tailwind v4 handles this, prevents excessive :not(#\#) selectors
        'any-link-pseudo-class': true, // :any-link
        'dir-pseudo-class': true, // :dir()
        clamp: true, // clamp() function
        'logical-properties-and-values': true, // margin-inline-start etc.
        'media-query-ranges': true, // @media (width >= 768px)
        'cascade-layers': false, // DISABLED - Tailwind v4 handles layers natively, prevents specificity issues
        'gap-properties': true, // gap, row-gap, column-gap
        'overflow-wrap-property': true, // overflow-wrap
        'place-properties': true, // place-items, place-content
        'color-functional-notation': true, // rgb(255 255 255 / 50%)
      },
      autoprefixer: false, // Nutzen separates autoprefixer plugin
    },

    // 5. Autoprefixer - Am Ende für vendor prefixes
    autoprefixer: {
      // Target die letzten 2 Versionen der wichtigsten Browser
      overrideBrowserslist: [
        'last 2 Chrome versions',
        'last 2 Firefox versions',
        'last 2 Safari versions',
        'last 2 Edge versions',
        '> 1%',
        'not dead',
      ],
      grid: 'autoplace', // IE11 Grid Support
    },
  },
};
