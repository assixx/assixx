module.exports = {
  content: [
    './frontend/src/pages/**/*.html',
    './frontend/src/scripts/**/*.{js,ts}',
    './frontend/src/scripts/components/**/*.{js,ts}'
  ],
  css: ['./frontend/src/styles/**/*.css'],
  
  // Wichtig: Behalte dynamische Klassen
  safelist: [
    // Status-Klassen
    /^badge-/,
    /^btn-/,
    /^active$/,
    /^disabled$/,
    /^collapsed$/,
    
    // Modal-Klassen
    /^modal/,
    
    // Dynamische Klassen aus JavaScript
    'u-hidden',
    'sidebar-collapsed',
    'dropdown-open'
  ],
  
  // Extrahiere auch Klassen aus JavaScript Strings
  defaultExtractor: content => {
    // Standard + Klassen in Strings wie classList.add('my-class')
    const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || []
    const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || []
    
    return broadMatches.concat(innerMatches)
  }
}