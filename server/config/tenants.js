/**
 * Tenant-Konfigurationen
 * Definiert die Einstellungen für jede Firma
 */

module.exports = {
  // Demo-Tenant für Entwicklung
  demo: {
    id: 'demo',
    name: 'Demo GmbH',
    database: 'assixx_demo',
    branding: {
      logo: '/assets/demo-logo.png',
      primaryColor: '#2196F3',
      secondaryColor: '#FFC107',
    },
    features: {
      maxUsers: 50,
      errorReporting: true,
      surveys: true,
      calendar: true,
      suggestions: true,
    },
    languages: ['de', 'en'],
  },

  // Beispiel: Bosch
  bosch: {
    id: 'bosch',
    name: 'Robert Bosch GmbH',
    database: 'assixx_bosch',
    branding: {
      logo: '/assets/bosch-logo.png',
      primaryColor: '#E20015',
      secondaryColor: '#000000',
    },
    features: {
      maxUsers: 5000,
      errorReporting: true,
      surveys: true,
      calendar: true,
      suggestions: true,
      customModules: ['maintenance-scheduler'],
    },
    languages: ['de', 'en', 'tr', 'pl'],
  },

  // Beispiel: Mercedes
  mercedes: {
    id: 'mercedes',
    name: 'Mercedes-Benz AG',
    database: 'assixx_mercedes',
    branding: {
      logo: '/assets/mercedes-logo.png',
      primaryColor: '#00ADEF',
      secondaryColor: '#A4A8A4',
    },
    features: {
      maxUsers: 10000,
      errorReporting: true,
      surveys: true,
      calendar: true,
      suggestions: true,
      customModules: ['quality-control', 'shift-planning'],
    },
    languages: ['de', 'en', 'es', 'it'],
  },
};
