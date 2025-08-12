/**
 * Feature Category Mapping for Assixx
 * Maps database feature codes to visual categories with display information
 */

export interface FeatureDetail {
  displayName: string;
  description: string;
  details: string[];
}

export interface FeatureCategory {
  name: string;
  icon: string;
  features: Record<string, FeatureDetail>;
}

export interface FeatureCategoryInfo {
  categoryKey: string;
  categoryName: string;
  categoryIcon: string;
  feature: FeatureDetail;
}

export interface FeatureWithCode extends FeatureDetail {
  code: string;
}

export interface CategoryWithFeatures {
  name: string;
  icon: string;
  features: FeatureWithCode[];
}

export const featureCategories: Record<string, FeatureCategory> = {
  // Kern-Features (Core) - Essential system features
  core: {
    name: "Kern-Features",
    icon: "⚙️",
    features: {
      basic_employees: {
        displayName: "Basis Mitarbeiterverwaltung",
        description: "Bis zu 10 Mitarbeiter verwalten",
        details: [
          "Mitarbeiterprofile erstellen",
          "Grundlegende Stammdaten verwalten",
          "Zugriffsrechte verwalten",
        ],
      },
      unlimited_employees: {
        displayName: "Unbegrenzte Mitarbeiter",
        description: "Keine Begrenzung der Mitarbeiteranzahl",
        details: [
          "Unbegrenzte Mitarbeiteranzahl",
          "Erweiterte Verwaltungsfunktionen",
          "Bulk-Import/Export",
        ],
      },
      document_upload: {
        displayName: "Dokument Upload",
        description: "Basis Dokumenten-Upload Funktion",
        details: [
          "Sichere Dokumentenverwaltung",
          "Lohnabrechnungen hochladen",
          "Mitarbeiterdokumente verwalten",
        ],
      },
    },
  },

  // Kommunikation (Communication) - Team collaboration features
  communication: {
    name: "Kommunikation",
    icon: "💬",
    features: {
      chat: {
        displayName: "Chat-System",
        description: "Integrierter Firmen-Chat für Teams",
        details: [
          "Direkte Nachrichten",
          "Gruppenchats",
          "Dateiübertragung",
          "Nachrichtenplanung",
        ],
      },
      blackboard: {
        displayName: "Schwarzes Brett",
        description: "Digitales schwarzes Brett für Ankündigungen",
        details: [
          "Firmenweite Ankündigungen",
          "Abteilungsspezifische Mitteilungen",
          "Prioritätsstufen",
          "Lesebestätigungen",
        ],
      },
      surveys: {
        displayName: "Umfrage-Tool",
        description: "Mitarbeiterbefragungen mit anonymen Optionen",
        details: [
          "Anonyme Umfragen",
          "Verschiedene Fragetypen",
          "Automatische Auswertung",
          "Vorlagen-Bibliothek",
        ],
      },
    },
  },

  // Organisation (Organization) - Planning and management features
  organization: {
    name: "Organisation",
    icon: "📊",
    features: {
      calendar: {
        displayName: "Firmenkalender",
        description: "Integrierter Kalender für Termine und Events",
        details: [
          "Firmentermine verwalten",
          "Abteilungskalender",
          "Teamkalender",
          "Erinnerungen",
        ],
      },
      shifts: {
        displayName: "Schichtplanung",
        description: "Vollständiges Schichtplanungs-Tool",
        details: [
          "Schichtvorlagen",
          "Mitarbeiter-Zuweisung",
          "Tauschbörse",
          "Überstunden-Tracking",
        ],
      },
      kvp: {
        displayName: "KVP System",
        description: "Kontinuierlicher Verbesserungsprozess",
        details: [
          "Verbesserungsvorschläge",
          "Bewertungssystem",
          "Prämienberechnung",
          "Statistiken",
        ],
      },
    },
  },
};

/**
 * Get feature category by feature code
 * @param featureCode - The database feature code
 * @returns Category and feature information
 */
export function getFeatureCategory(
  featureCode: string,
): FeatureCategoryInfo | null {
  for (const [categoryKey, category] of Object.entries(featureCategories)) {
    if (featureCode in category.features) {
      return {
        categoryKey,
        categoryName: category.name,
        categoryIcon: category.icon,
        feature: category.features[featureCode],
      };
    }
  }
  return null;
}

/**
 * Get all features grouped by category
 * @returns Features organized by category
 */
export function getFeaturesByCategory(): Record<string, CategoryWithFeatures> {
  const result: Record<string, CategoryWithFeatures> = {};

  for (const [categoryKey, category] of Object.entries(featureCategories)) {
    result[categoryKey] = {
      name: category.name,
      icon: category.icon,
      features: Object.entries(category.features).map(([code, feature]) => ({
        code,
        ...feature,
      })),
    };
  }

  return result;
}

/**
 * Get feature codes for a specific category
 * @param categoryKey - The category key (core, communication, organization)
 * @returns Array of feature codes
 */
export function getFeatureCodesForCategory(categoryKey: string): string[] {
  const category = featureCategories[categoryKey];
  return Object.keys(category.features);
}
