/**
 * Features Page - Constants
 * @module features/_lib/constants
 */

import type { FeatureCategory } from './types';

/** Plan order for comparison (lowest to highest) */
export const PLAN_ORDER = ['basic', 'professional', 'enterprise'] as const;

/** Hardcoded feature categories with default inactive state */
export const FEATURE_CATEGORIES: Record<string, FeatureCategory> = {
  'Kern-Features': {
    icon: '',
    features: [
      {
        code: 'employees',
        name: 'Mitarbeiterverwaltung',
        description: 'Verwalten Sie Ihre Mitarbeiter effizient',
        minPlan: 'basic',
        active: false,
      },
      {
        code: 'documents',
        name: 'Dokumentenverwaltung',
        description: 'Zentrale Ablage für alle Dokumente',
        minPlan: 'basic',
        active: false,
      },
    ],
  },
  Kommunikation: {
    icon: '',
    features: [
      {
        code: 'blackboard',
        name: 'Schwarzes Brett',
        description: 'Unternehmensweite Ankündigungen',
        minPlan: 'professional',
        active: false,
      },
      {
        code: 'chat',
        name: 'Chat System',
        description: 'Echtzeit-Kommunikation im Team',
        minPlan: 'professional',
        active: false,
      },
      {
        code: 'surveys',
        name: 'Umfragen',
        description: 'Mitarbeiterfeedback sammeln',
        minPlan: 'enterprise',
        active: false,
      },
    ],
  },
  Organisation: {
    icon: '',
    features: [
      {
        code: 'calendar',
        name: 'Firmenkalender',
        description: 'Termine und Events verwalten',
        minPlan: 'professional',
        active: false,
      },
      {
        code: 'shift_planning',
        name: 'Schichtplanung',
        description: 'Automatisierte Schichtpläne',
        minPlan: 'enterprise',
        active: false,
      },
      {
        code: 'kvp',
        name: 'KVP System',
        description: 'Kontinuierliche Verbesserung',
        minPlan: 'enterprise',
        active: false,
      },
    ],
  },
};

/** Addon pricing per month */
export const ADDON_PRICING = {
  employees: 5,
  admins: 10,
  storage_per_100gb: 10,
} as const;

/** Default tenant name fallback */
export const DEFAULT_TENANT_NAME = 'Ihre Organisation';
